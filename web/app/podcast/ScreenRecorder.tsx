"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { API } from "../lib/api";
import {
  isWpfHost,
  notifyRecordingStarted,
  notifyRecordingState,
  notifyRecordingStopped,
  onRecordingCommand,
} from "../lib/wpfBridge";

const FPS = 30;

// Grabación local para el podcast. Dos modos, según qué se quiera grabar:
//
//  - "app": graba una sección del portal (la pizarra, la predicción…) SIN que
//    salga nada del resto de la app. Usa Region Capture: se captura la propia
//    pestaña y se recorta a nivel de compositor al marco elegido, así que la
//    barra de navegación, los controles del grabador y el indicador flotante
//    de "grabando" no existen en el video aunque estén en pantalla.
//
//  - "pantalla": graba otra ventana o la pantalla completa (la transmisión del
//    partido, otra web) y recorta el rectángulo que el usuario arrastre,
//    dibujándolo en un <canvas> a 30fps -- Canvas 2D nativo, igual que el resto
//    de exportaciones del proyecto. La propia pestaña se excluye del selector.
//
// En ambos casos el control de detener es un indicador flotante fijo, estilo
// iPhone: siempre visible, sin volver a esta pestaña, y nunca grabado.
// Todo ocurre en el equipo: se escribe un .webm local, nada sale a internet.

type Rect = { x: number; y: number; w: number; h: number }; // normalizado 0..1
type Modo = "app" | "pantalla";

// Region Capture todavía no está en las definiciones de TypeScript.
type CropTargetCtor = { fromElement(el: Element): Promise<unknown> };
type CroppableTrack = MediaStreamTrack & { cropTo?: (target: unknown) => Promise<void> };
type VideoConVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const FRAME_VIEWS = [
  { path: "/tactica", label: "PIZARRA" },
  { path: "/prediccion", label: "PREDICCIÓN" },
  { path: "/calificaciones", label: "CALIFICACIONES" },
  { path: "/jugadores", label: "JUGADORES" },
];

const FULL_FRAME: Rect = { x: 0, y: 0, w: 1, h: 1 };

function regionCaptureDisponible(): boolean {
  return typeof window !== "undefined" && "CropTarget" in window;
}

function pickMimeType(): string {
  for (const c of ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ScreenRecorder({ onSaved }: { onSaved?: () => void }) {
  const [modo, setModo] = useState<Modo>("app");
  const [view, setView] = useState<string>("/tactica");
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rect, setRect] = useState<Rect>(FULL_FRAME);
  const [micOn, setMicOn] = useState(true);
  const [sysAudioOn, setSysAudioOn] = useState(false);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string>("");
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string>("");
  const [resultSize, setResultSize] = useState(0);
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null); // objetivo del recorte en modo "app"
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const drawTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const rectRef = useRef<Rect>(FULL_FRAME);
  const dragRef = useRef<{ mode: "new" | "move" | "resize"; startX: number; startY: number; base: Rect } | null>(null);
  // espejos para el reporte al control nativo, que corre fuera del ciclo de React
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const micLevelRef = useRef(0);
  const stateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vfcHandleRef = useRef<number | null>(null);

  const cancelDrawLoop = useCallback(() => {
    if (drawTimerRef.current) clearInterval(drawTimerRef.current);
    drawTimerRef.current = null;
    const v = videoRef.current as VideoConVFC | null;
    if (vfcHandleRef.current != null && v?.cancelVideoFrameCallback) {
      v.cancelVideoFrameCallback(vfcHandleRef.current);
    }
    vfcHandleRef.current = null;
  }, []);

  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    micLevelRef.current = micLevel;
  }, [micLevel]);

  // Botones del control flotante nativo (solo dentro de la app de escritorio).
  useEffect(() => {
    return onRecordingCommand((command) => {
      if (command === "stop") stopRecording();
      else togglePause();
    });
  }, []);

  const stopEverything = useCallback(() => {
    cancelDrawLoop();
    if (clockRef.current) clearInterval(clockRef.current);
    if (stateTimerRef.current) clearInterval(stateTimerRef.current);
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    clockRef.current = stateTimerRef.current = null;
    meterRafRef.current = null;
    notifyRecordingStopped();
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setSharing(false);
    setRecording(false);
    setPaused(false);
    setMicLevel(0);
  }, [cancelDrawLoop]);

  useEffect(() => stopEverything, [stopEverything]);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((d) => setMics(d.filter((x) => x.kind === "audioinput")))
      .catch(() => {});
  }, [sharing]);

  async function startSharing() {
    setError(null);
    setAviso(null);
    const enModoApp = modo === "app";

    try {
      // preferCurrentTab/selfBrowserSurface son de Chromium y no están en las
      // definiciones estándar de TypeScript, de ahí el cast.
      const opciones = {
        video: { frameRate: FPS },
        audio: true,
        ...(enModoApp
          ? { preferCurrentTab: true, selfBrowserSurface: "include" }
          : { selfBrowserSurface: "exclude", surfaceSwitching: "include" }),
      } as DisplayMediaStreamOptions;

      const stream = await navigator.mediaDevices.getDisplayMedia(opciones);
      displayStreamRef.current = stream;
      const track = stream.getVideoTracks()[0] as CroppableTrack | undefined;
      track?.addEventListener("ended", () => stopEverything());

      if (enModoApp) {
        // El recorte a nivel de compositor es lo que garantiza que el resto de
        // la app no salga en el video. Si el navegador no lo soporta, se avisa
        // en vez de grabar de más sin decirlo.
        if (regionCaptureDisponible() && track?.cropTo && marcoRef.current) {
          try {
            const CropTargetApi = (window as unknown as { CropTarget: CropTargetCtor }).CropTarget;
            const objetivo = await CropTargetApi.fromElement(marcoRef.current);
            await track.cropTo(objetivo);
            setAviso(null);
          } catch {
            setAviso(
              "No se pudo recortar al marco: el video incluirá toda la ventana. Usa el modo PANTALLA y arrastra el recuadro a mano.",
            );
          }
        } else {
          setAviso(
            "Este navegador no soporta el recorte por elemento. Usa el modo PANTALLA y arrastra el recuadro a mano.",
          );
        }
      }

      const video = videoRef.current!;
      video.srcObject = stream;
      if (!video.videoWidth) {
        await new Promise<void>((resolve) => {
          video.addEventListener("loadedmetadata", () => resolve(), { once: true });
          setTimeout(resolve, 3000);
        });
      }
      await video.play().catch(() => {});
      setSourceSize({ w: video.videoWidth, h: video.videoHeight });
      setSharing(true);
      setRect(FULL_FRAME);
      if (stream.getAudioTracks().length > 0) setSysAudioOn(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`No se pudo iniciar la captura (${msg}).`);
    }
  }

  // --- recuadro manual (solo modo pantalla) ---------------------------------

  function toNorm(e: React.PointerEvent): { x: number; y: number } {
    const box = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!sharing || modo === "app") return;
    const p = toNorm(e);
    const r = rectRef.current;
    const box = overlayRef.current!.getBoundingClientRect();
    const handle = 18 / Math.min(box.width, box.height);
    const nearCorner = Math.abs(p.x - (r.x + r.w)) < handle && Math.abs(p.y - (r.y + r.h)) < handle;
    const inside = p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
    dragRef.current = { mode: nearCorner ? "resize" : inside ? "move" : "new", startX: p.x, startY: p.y, base: r };
    (e.target as Element).setPointerCapture(e.pointerId);
    if (!nearCorner && !inside) setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toNorm(e);
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

    if (drag.mode === "new") {
      setRect({
        x: Math.min(drag.startX, p.x),
        y: Math.min(drag.startY, p.y),
        w: Math.abs(p.x - drag.startX),
        h: Math.abs(p.y - drag.startY),
      });
    } else if (drag.mode === "move") {
      setRect({
        x: clamp01(Math.min(drag.base.x + (p.x - drag.startX), 1 - drag.base.w)),
        y: clamp01(Math.min(drag.base.y + (p.y - drag.startY), 1 - drag.base.h)),
        w: drag.base.w,
        h: drag.base.h,
      });
    } else {
      setRect({ x: drag.base.x, y: drag.base.y, w: clamp01(p.x - drag.base.x), h: clamp01(p.y - drag.base.y) });
    }
  }

  function onPointerUp() {
    const r = rectRef.current;
    if (r.w < 0.02 || r.h < 0.02) setRect(FULL_FRAME);
    dragRef.current = null;
  }

  // --- grabación ------------------------------------------------------------

  async function buildAudioTracks(): Promise<MediaStreamTrack[]> {
    const tracks: MediaStreamTrack[] = [];
    try {
      const ac = new AudioContext();
      audioCtxRef.current = ac;
      const dest = ac.createMediaStreamDestination();
      let anyAudio = false;

      if (micOn) {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: micId ? { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true } : true,
        });
        micStreamRef.current = micStream;
        ac.createMediaStreamSource(micStream).connect(dest);
        anyAudio = true;

        // medidor de nivel, para no descubrir al final que el micro estaba mudo
        const analyser = ac.createAnalyser();
        analyser.fftSize = 512;
        ac.createMediaStreamSource(micStream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setMicLevel(Math.min(1, peak / 90));
          meterRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      const sysTracks = displayStreamRef.current?.getAudioTracks() ?? [];
      if (sysAudioOn && sysTracks.length > 0) {
        ac.createMediaStreamSource(new MediaStream(sysTracks)).connect(dest);
        anyAudio = true;
      }
      if (anyAudio) tracks.push(...dest.stream.getAudioTracks());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`No se pudo abrir el micrófono (${msg}). Se graba solo video.`);
    }
    return tracks;
  }

  async function startRecording() {
    setError(null);
    setResultUrl(null);
    const video = videoRef.current!;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      setError("La fuente de video todavía no tiene tamaño. Vuelve a compartir.");
      return;
    }

    let videoTracks: MediaStreamTrack[];

    if (modo === "app") {
      // el track ya viene recortado al marco: se graba tal cual, sin pasar por
      // canvas (menos CPU y sin reescalados)
      videoTracks = displayStreamRef.current!.getVideoTracks();
    } else {
      const canvas = canvasRef.current!;
      const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
      canvas.width = even(rect.w * vw);
      canvas.height = even(rect.h * vh);
      const ctx = canvas.getContext("2d")!;
      const dibujar = () => {
        const r = rectRef.current;
        ctx.drawImage(video, r.x * vw, r.y * vh, r.w * vw, r.h * vh, 0, 0, canvas.width, canvas.height);
      };

      // Grabar otra ventana implica irse a otra aplicación, y Chromium
      // estrangula los timers de una página que dejó de estar visible: con
      // setInterval el canvas bajaría a ~1fps justo cuando importa.
      // requestVideoFrameCallback va guiado por los cuadros que entrega el
      // propio stream, así que sigue al ritmo real de la captura.
      const v = video as VideoConVFC;
      if (v.requestVideoFrameCallback) {
        const loop = () => {
          dibujar();
          vfcHandleRef.current = v.requestVideoFrameCallback!(loop);
        };
        vfcHandleRef.current = v.requestVideoFrameCallback(loop);
      } else {
        drawTimerRef.current = setInterval(dibujar, 1000 / FPS);
      }
      videoTracks = canvas.captureStream(FPS).getVideoTracks();
    }

    const audioTracks = await buildAudioTracks();
    const combined = new MediaStream([...videoTracks, ...audioTracks]);
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(combined, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setResultSize(blob.size);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      setResultName(`grabacion-${stamp}.webm`);
      cancelDrawLoop();
      if (clockRef.current) clearInterval(clockRef.current);
      if (stateTimerRef.current) clearInterval(stateTimerRef.current);
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
      stateTimerRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setMicLevel(0);
      notifyRecordingStopped();
    };

    recorder.start(1000);
    setRecording(true);
    setPaused(false);
    setElapsed(0);
    elapsedRef.current = 0;
    clockRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    // saca la píldora nativa always-on-top y la mantiene al día. Cada 250ms en
    // vez de cada segundo para que el medidor de micrófono se vea vivo.
    notifyRecordingStarted();
    stateTimerRef.current = setInterval(
      () => notifyRecordingState(elapsedRef.current, pausedRef.current, micLevelRef.current),
      250,
    );
  }

  function togglePause() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setPaused(true);
      if (clockRef.current) clearInterval(clockRef.current);
    } else if (rec.state === "paused") {
      rec.resume();
      setPaused(false);
      clockRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    setPaused(false);
  }

  async function saveResult() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultName;
    a.click();
    await fetch(`${API}/api/media/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "video", fileName: resultName }),
    }).catch(() => {});
    onSaved?.();
  }

  const outW = sourceSize ? Math.round(rect.w * sourceSize.w) : 0;
  const outH = sourceSize ? Math.round(rect.h * sourceSize.h) : 0;

  // Indicador flotante estilo iPhone: fijo sobre todo, siempre alcanzable, y
  // fuera del recorte -- así que no aparece en el video que está grabando.
  // `recording` solo pasa a true tras un clic, o sea ya en el cliente: no hace
  // falta un estado de "montado" que descuadre la hidratación.
  const pill = recording && typeof document !== "undefined"
    ? createPortal(
        <div
          className="fixed z-[9999] flex items-center gap-3 rounded-full px-4 py-2 shadow-lg"
          style={{ top: 14, right: 18, background: "rgba(20,15,40,.92)", backdropFilter: "blur(6px)" }}
        >
          <span
            className={paused ? "" : "animate-pulse"}
            style={{ width: 10, height: 10, borderRadius: "50%", background: paused ? "#c9c5df" : "#e2464f" }}
          />
          <span className="font-mono text-xs" style={{ color: "#fff", minWidth: 42 }}>
            {fmtTime(elapsed)}
          </span>
          {micOn && (
            <span
              title="Nivel del micrófono"
              style={{
                width: 34,
                height: 4,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${micLevel > 0.03 ? "#4ec27a" : "#e2464f"} ${Math.round(
                  micLevel * 100,
                )}%, rgba(255,255,255,.22) ${Math.round(micLevel * 100)}%)`,
              }}
            />
          )}
          <button
            onClick={togglePause}
            className="font-mono text-[10px] px-2 py-1 rounded-full cursor-pointer"
            style={{ border: "1px solid rgba(255,255,255,.35)", color: "#fff" }}
          >
            {paused ? "SEGUIR" : "PAUSA"}
          </button>
          <button
            onClick={stopRecording}
            className="font-mono text-[10px] px-3 py-1 rounded-full cursor-pointer font-bold"
            style={{ background: "#e2464f", color: "#fff" }}
          >
            DETENER
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      {pill}

      <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Grabar local
        </span>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Se guarda un .webm en tu equipo — nada sube a internet. Mientras grabas aparece un control flotante con
          cronómetro, pausa y detener, y ese control no sale en el video.
          {isWpfHost()
            ? " Como estás en la app de escritorio, el control queda por encima de todas las ventanas: puedes detener la grabación sin volver aquí, aunque estés en otro programa."
            : " En el navegador el control vive dentro de esta página; dentro de la app de escritorio queda por encima de todas las ventanas."}
        </p>

        <div className="mt-4 flex gap-1.5">
          {(
            [
              { key: "app", label: "SECCIÓN DE LA APP", hint: "graba solo el marco, sin el resto de la app" },
              { key: "pantalla", label: "OTRA VENTANA / PANTALLA", hint: "recortas a mano el rectángulo" },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => {
                if (sharing || recording) return;
                setModo(m.key);
                setAviso(null);
              }}
              disabled={sharing || recording}
              title={m.hint}
              className="font-mono text-[10px] px-3 py-1.5 rounded-full cursor-pointer disabled:opacity-50"
              style={{
                background: modo === m.key ? "var(--purple)" : "transparent",
                color: modo === m.key ? "#fff" : "var(--muted)",
                border: modo === m.key ? "none" : "1px solid var(--line)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!sharing ? (
            <button
              onClick={startSharing}
              className="font-mono text-[11px] px-4 py-2 rounded-full cursor-pointer"
              style={{ background: "var(--purple)", color: "#fff" }}
            >
              {modo === "app" ? "PREPARAR GRABACIÓN" : "COMPARTIR PANTALLA"}
            </button>
          ) : (
            <>
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="font-mono text-[11px] px-4 py-2 rounded-full cursor-pointer flex items-center gap-2"
                  style={{ background: "var(--bad)", color: "#fff" }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: "#fff" }} /> GRABAR
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="font-mono text-[11px] px-4 py-2 rounded-full cursor-pointer flex items-center gap-2"
                  style={{ background: "var(--purple)", color: "#fff" }}
                >
                  <span className="w-2 h-2" style={{ background: "#fff" }} /> DETENER · {fmtTime(elapsed)}
                </button>
              )}
              {modo === "pantalla" && (
                <button
                  onClick={() => setRect(FULL_FRAME)}
                  className="font-mono text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
                  style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
                >
                  RECUADRO COMPLETO
                </button>
              )}
              <button
                onClick={stopEverything}
                className="font-mono text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
                style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
              >
                TERMINAR CAPTURA
              </button>
            </>
          )}

          <label className="flex items-center gap-1.5 font-mono text-[10px] cursor-pointer" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={micOn} onChange={(e) => setMicOn(e.target.checked)} disabled={recording} />
            MICRÓFONO
          </label>
          {mics.length > 1 && (
            <select
              value={micId}
              onChange={(e) => setMicId(e.target.value)}
              disabled={recording || !micOn}
              className="font-mono text-[10px] px-2 py-1 rounded border"
              style={{ borderColor: "var(--line)", background: "var(--bg)" }}
            >
              <option value="">Micrófono por defecto</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || "Entrada de audio"}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 font-mono text-[10px] cursor-pointer" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={sysAudioOn} onChange={(e) => setSysAudioOn(e.target.checked)} disabled={recording} />
            AUDIO DEL SISTEMA
          </label>
        </div>

        {error && (
          <p className="mt-3 text-xs" style={{ color: "var(--bad)" }}>
            {error}
          </p>
        )}
        {aviso && (
          <p className="mt-3 text-xs" style={{ color: "var(--gold)" }}>
            {aviso}
          </p>
        )}

        {/* Modo app: el marco es el objetivo del recorte. Todo lo que queda
            fuera de este div no entra al video. */}
        {modo === "app" ? (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="font-mono text-[10px] uppercase" style={{ color: "var(--muted)" }}>
                Qué grabar
              </span>
              {FRAME_VIEWS.map((v) => (
                <button
                  key={v.path}
                  onClick={() => !recording && setView(v.path)}
                  disabled={recording}
                  className="font-mono text-[9px] px-2 py-0.5 rounded-full cursor-pointer disabled:opacity-50"
                  style={{
                    background: view === v.path ? "var(--purple)" : "transparent",
                    color: view === v.path ? "#fff" : "var(--muted)",
                    border: view === v.path ? "none" : "1px solid var(--line)",
                  }}
                >
                  {v.label}
                </button>
              ))}
              {sharing && (
                <span className="font-mono text-[10px] ml-auto" style={{ color: "var(--gold)" }}>
                  ● SOLO ESTE MARCO ENTRA AL VIDEO
                </span>
              )}
            </div>
            <div
              ref={marcoRef}
              className="rounded-lg overflow-hidden"
              style={{ border: sharing ? "2px solid #d9b95c" : "1px solid var(--line)", background: "var(--bg)" }}
            >
              <iframe key={view} src={view} title="Sección para grabar" className="w-full block" style={{ height: 560 }} />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] uppercase" style={{ color: "var(--muted)" }}>
                Fuente {sourceSize ? `· ${sourceSize.w}×${sourceSize.h}` : ""}
              </span>
              {sharing && (
                <span className="font-mono text-[10px]" style={{ color: "var(--gold)" }}>
                  SALIDA {outW}×{outH}
                </span>
              )}
            </div>
            <div
              ref={overlayRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="relative rounded-lg overflow-hidden select-none"
              style={{ background: "#111", cursor: sharing ? "crosshair" : "default", touchAction: "none" }}
            >
              <video ref={videoRef} muted playsInline className="w-full h-auto block" />
              {sharing && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "rgba(20,15,40,.55)",
                      clipPath: `polygon(0% 0%, 0% 100%, ${rect.x * 100}% 100%, ${rect.x * 100}% ${rect.y * 100}%, ${
                        (rect.x + rect.w) * 100
                      }% ${rect.y * 100}%, ${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%, ${rect.x * 100}% ${
                        (rect.y + rect.h) * 100
                      }%, ${rect.x * 100}% 100%, 100% 100%, 100% 0%)`,
                    }}
                  />
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${rect.x * 100}%`,
                      top: `${rect.y * 100}%`,
                      width: `${rect.w * 100}%`,
                      height: `${rect.h * 100}%`,
                      border: "2px solid #d9b95c",
                    }}
                  >
                    <span className="absolute" style={{ right: -6, bottom: -6, width: 12, height: 12, background: "#d9b95c", borderRadius: 2 }} />
                  </div>
                </>
              )}
              {!sharing && (
                <div className="aspect-video flex items-center justify-center">
                  <span className="font-mono text-[11px]" style={{ color: "#8a86a0" }}>
                    Sin fuente — dale a COMPARTIR PANTALLA
                  </span>
                </div>
              )}
            </div>
            {sharing && (
              <p className="mt-1.5 font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                Arrastra fuera para dibujar el recuadro · dentro para moverlo · esquina dorada para redimensionar
              </p>
            )}
          </div>
        )}

        {/* en modo app el video de la fuente no se muestra: enseñarlo aquí crea
            el efecto espejo infinito y no aporta nada */}
        {modo === "app" && <video ref={videoRef} muted playsInline className="hidden" />}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {resultUrl && (
        <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Última grabación · {fmtTime(elapsed)} · {(resultSize / 1024 / 1024).toFixed(1)} MB
            </span>
            <button
              onClick={saveResult}
              className="font-mono text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
              style={{ background: "var(--purple)", color: "#fff" }}
            >
              GUARDAR .WEBM
            </button>
          </div>
          <video src={resultUrl} controls className="w-full rounded-lg" style={{ maxHeight: 420, background: "#111" }} />
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Guárdalo y cárgalo en el editor de video como clip base o como overlay.
          </p>
        </div>
      )}
    </div>
  );
}
