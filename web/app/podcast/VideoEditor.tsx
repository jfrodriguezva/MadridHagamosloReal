"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

type Corner = "br" | "bl" | "tr" | "tl";
type TextOverlay = { id: string; keyword: string; color: string; startSec: number; endSec: number };
type MediaOverlay = { id: string; kind: "image" | "video"; src: string; name: string; startSec: number; endSec: number; corner: Corner };
type AudioTrack = { id: string; src: string; name: string; startSec: number; volume: number };

const OVERLAY_PRESETS: { keyword: string; color: string }[] = [
  { keyword: "gol ⚡", color: "#a8791a" },
  { keyword: "estadística 📊", color: "#2b2350" },
  { keyword: "movimiento táctico", color: "#2f7a4f" },
  { keyword: "xG", color: "#a3323a" },
  { keyword: "próximo rival", color: "#6a6879" },
];
const CORNER_STYLE: Record<Corner, React.CSSProperties> = {
  br: { right: 12, bottom: 12 },
  bl: { left: 12, bottom: 12 },
  tr: { right: 12, top: 12 },
  tl: { left: 12, top: 12 },
};
const CORNER_LABEL: Record<Corner, string> = { br: "Abajo-der", bl: "Abajo-izq", tr: "Arriba-der", tl: "Arriba-izq" };

let idSeq = 1;
const newId = () => `e${idSeq++}`;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoEditor() {
  const [baseVideo, setBaseVideo] = useState<{ url: string; name: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [mediaOverlays, setMediaOverlays] = useState<MediaOverlay[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [picking, setPicking] = useState<"video" | "image" | "clip" | "audio" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLog, setExportLog] = useState<string | null>(null);

  const [transcribing, setTranscribing] = useState(false);
  const [transcribeLog, setTranscribeLog] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const activeMediaOverlays = mediaOverlays.filter((o) => current >= o.startSec && current < o.endSec);
  const activeTextOverlay = textOverlays.find((o) => current >= o.startSec && current < o.endSec) ?? null;

  // WebView2 (la app de escritorio) es Chromium real -- un <input type="file"> normal
  // ya abre el selector nativo de Windows sin necesidad de ningún puente propio.
  async function pickFile(kind: "video" | "image" | "audio"): Promise<{ url: string; name: string } | null> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "video" ? "video/*" : kind === "image" ? "image/*" : "audio/*";
    return new Promise((resolve) => {
      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file ? { url: URL.createObjectURL(file), name: file.name } : null);
      };
      input.click();
    });
  }

  async function handlePickBaseVideo() {
    setPicking("video");
    try {
      const picked = await pickFile("video");
      if (picked) setBaseVideo(picked);
    } finally {
      setPicking(null);
    }
  }

  async function handleAddMediaOverlay(kind: "image" | "video") {
    setPicking(kind === "video" ? "clip" : "image");
    try {
      const picked = await pickFile(kind);
      if (!picked) return;
      const start = current;
      const end = Math.min(duration || start + 5, start + 5);
      setMediaOverlays((os) => [...os, { id: newId(), kind, src: picked.url, name: picked.name, startSec: start, endSec: end, corner: "br" }]);
    } finally {
      setPicking(null);
    }
  }

  async function handleAddAudioTrack() {
    setPicking("audio");
    try {
      const picked = await pickFile("audio");
      if (!picked) return;
      setAudioTracks((as) => [...as, { id: newId(), src: picked.url, name: picked.name, startSec: current, volume: 0.8 }]);
    } finally {
      setPicking(null);
    }
  }

  function addTextOverlay(preset: { keyword: string; color: string }) {
    const start = current;
    const end = Math.min(duration || start + 4, start + 4);
    setTextOverlays((os) => [...os, { id: newId(), keyword: preset.keyword, color: preset.color, startSec: start, endSec: end }]);
  }

  function removeTextOverlay(id: string) { setTextOverlays((os) => os.filter((o) => o.id !== id)); }
  function removeMediaOverlay(id: string) { setMediaOverlays((os) => os.filter((o) => o.id !== id)); }
  function removeAudioTrack(id: string) { setAudioTracks((as) => as.filter((a) => a.id !== id)); }
  function updateTextOverlay(id: string, patch: Partial<TextOverlay>) { setTextOverlays((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o))); }
  function updateMediaOverlay(id: string, patch: Partial<MediaOverlay>) { setMediaOverlays((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o))); }
  function updateAudioTrack(id: string, patch: Partial<AudioTrack>) { setAudioTracks((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a))); }

  // Renderiza el video final componiendo TODO encima del video base -- nunca lo reemplaza.
  // Imágenes/clips se ubican como PiP en una esquina con el filtro `overlay`, el audio
  // adicional se mezcla con `amix`, y los textos se queman al final con `drawtext`.
  async function handleExportVideo() {
    if (!baseVideo) return;
    setExporting(true);
    setExportProgress(0);
    setExportLog("Cargando el motor de video…");
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL, fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => setExportProgress(Math.max(0, Math.min(100, Math.round(progress * 100)))));
      await ffmpeg.load({
        coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
      });

      async function run(args: string[], step: string) {
        const code = await ffmpeg.exec(args);
        if (code !== 0) throw new Error(`Falló el paso "${step}" (ffmpeg código ${code}).`);
      }

      setExportLog("Leyendo tu grabación…");
      await ffmpeg.writeFile("base.mp4", await fetchFile(baseVideo.url));

      const inputs = ["-i", "base.mp4"];
      let inputIdx = 1;
      const filters: string[] = [];
      let curVideo = "0:v";

      for (const ov of mediaOverlays) {
        const fname = `mov${inputIdx}.${ov.kind === "image" ? "png" : "mp4"}`;
        await ffmpeg.writeFile(fname, await fetchFile(ov.src));
        if (ov.kind === "image") inputs.push("-loop", "1", "-t", `${duration}`, "-i", fname);
        else inputs.push("-i", fname);

        const pos = ov.corner === "br" ? "W-w-24:H-h-24" : ov.corner === "bl" ? "24:H-h-24" : ov.corner === "tr" ? "W-w-24:24" : "24:24";
        const scaled = `ov${inputIdx}s`;
        const composed = `v${inputIdx}`;
        filters.push(`[${inputIdx}:v]scale=360:-2${ov.kind === "video" ? `,setpts=PTS-STARTPTS+${ov.startSec}/TB` : ""}[${scaled}]`);
        filters.push(`[${curVideo}][${scaled}]overlay=${pos}:enable='between(t,${ov.startSec},${ov.endSec})'[${composed}]`);
        curVideo = composed;
        inputIdx++;
      }

      if (textOverlays.length > 0) {
        await ffmpeg.writeFile("font.ttf", await fetchFile("/fonts/overlay-font.ttf"));
        const drawtexts = textOverlays
          .map((o) => {
            const text = o.keyword.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
            return `drawtext=fontfile=font.ttf:text='${text}':fontcolor=white:fontsize=42:box=1:boxcolor=${o.color}@0.85:boxborderw=14:x=(w-text_w)/2:y=h-th-40:enable='between(t,${o.startSec},${o.endSec})'`;
          })
          .join(",");
        filters.push(`[${curVideo}]${drawtexts}[vtext]`);
        curVideo = "vtext";
      }

      for (const at of audioTracks) {
        const fname = `aud${inputIdx}.mp3`;
        await ffmpeg.writeFile(fname, await fetchFile(at.src));
        inputs.push("-i", fname);
        inputIdx++;
      }

      const hasVideoFilters = filters.length > 0;
      const trackInputIndices = audioTracks.map((_, i) => inputIdx - audioTracks.length + i);

      // La grabación base puede no tener pista de audio (ej. captura muda) -- referenciar
      // "0:a" a ciegas rompe ffmpeg si no existe. Cuando hay pistas propias que mezclar,
      // se intenta primero asumiendo que la base sí trae audio (el caso normal); si falla,
      // se reintenta tratando la base como muda.
      async function buildAndRun(baseHasAudio: boolean) {
        const videoArgs = hasVideoFilters
          ? ["-filter_complex", filters.join(";"), "-map", `[${curVideo}]`]
          : ["-map", "0:v"];
        // -shortest es obligatorio: las imágenes en overlay se cargan con -loop 1 (duración
        // infinita) para poder mostrarlas solo en su ventana de tiempo -- sin esto ffmpeg se
        // queda esperando a que ese input infinito "termine" y nunca cierra el archivo.
        const codecArgs = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p", "-shortest"];

        if (audioTracks.length === 0) {
          // sin pistas propias -- se conserva el audio de la base tal cual si existe, o queda mudo
          await run([...inputs, ...videoArgs, "-map", "0:a?", ...codecArgs, "-c:a", "aac", "final.mp4"], "componer video final");
          return;
        }

        const audioFilters: string[] = [];
        const audioLabels: string[] = [];
        audioTracks.forEach((at, i) => {
          const idx = trackInputIndices[i];
          const label = `a${idx}`;
          const delayMs = Math.round(at.startSec * 1000);
          audioFilters.push(`[${idx}:a]volume=${at.volume},adelay=${delayMs}|${delayMs}[${label}]`);
          audioLabels.push(`[${label}]`);
        });
        const mixCount = (baseHasAudio ? 1 : 0) + audioTracks.length;
        audioFilters.push(`${baseHasAudio ? "[0:a]" : ""}${audioLabels.join("")}amix=inputs=${mixCount}:duration=first:dropout_transition=0[amixed]`);

        const fc = [...(hasVideoFilters ? filters : []), ...audioFilters].join(";");
        const mapVideo = hasVideoFilters ? `[${curVideo}]` : "0:v";
        await run([
          ...inputs, "-filter_complex", fc, "-map", mapVideo, "-map", "[amixed]",
          ...codecArgs, "-c:a", "aac", "final.mp4",
        ], "componer video final");
      }

      setExportLog("Componiendo capas…");
      if (audioTracks.length === 0) {
        await buildAndRun(true); // -map 0:a? ya es seguro sin audio, no hace falta reintentar
      } else {
        try {
          await buildAndRun(true);
        } catch {
          setExportLog("La grabación no trae audio propio, mezclando solo las pistas agregadas…");
          await buildAndRun(false);
        }
      }

      setExportLog("Descargando…");
      const data = await ffmpeg.readFile("final.mp4");
      const bytes = data instanceof Uint8Array ? new Uint8Array(data) : data;
      const blob = new Blob([bytes], { type: "video/mp4" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `madrid-hagamoslo-real-${Date.now()}.mp4`;
      a.click();
      fetch(`${API}/api/media/log`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "video", fileName: a.download }),
      }).catch(() => {});
      setExportLog("Listo.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setExportLog(`No se pudo exportar el video: ${msg}`);
    } finally {
      setExporting(false);
    }
  }

  // Extrae solo el audio (comprimido, no el video completo) con ffmpeg.wasm y lo sube
  // a /api/media/transcribe -- ahí un script Python local (faster-whisper) lo convierte
  // a texto, sin ningún servicio externo de pago. Solo funciona en desarrollo por ahora
  // (ver comentario en Program.cs); si no está disponible, el error lo explica.
  async function handleTranscribe() {
    if (!baseVideo) return;
    setTranscribing(true);
    setTranscript(null);
    setCopied(false);
    setTranscribeLog("Cargando el motor de audio…");
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL, fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
      });

      setTranscribeLog("Extrayendo el audio de tu grabación…");
      await ffmpeg.writeFile("base.mp4", await fetchFile(baseVideo.url));
      const code = await ffmpeg.exec(["-i", "base.mp4", "-vn", "-acodec", "libmp3lame", "-b:a", "96k", "audio.mp3"]);
      if (code !== 0) throw new Error("No se pudo extraer el audio del video.");

      const audioData = await ffmpeg.readFile("audio.mp3");
      const audioBytes = audioData instanceof Uint8Array ? new Uint8Array(audioData) : audioData;
      const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });

      setTranscribeLog("Transcribiendo — puede tardar varios minutos según la duración…");
      const form = new FormData();
      form.append("audio", audioBlob, "audio.mp3");
      const res = await fetch(`${API}/api/media/transcribe`, { method: "POST", body: form });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.detail ?? body?.title ?? "La transcripción falló.");
      }
      setTranscript(body.transcript || "(sin texto detectado)");
      setTranscribeLog(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setTranscribeLog(`No se pudo transcribir: ${msg}`);
    } finally {
      setTranscribing(false);
    }
  }

  async function copyTranscript() {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible -- el usuario puede seleccionar el texto a mano */
    }
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [baseVideo]);

  return (
    <div className="p-5 flex flex-col gap-5">
      {!baseVideo ? (
        <div
          className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center py-16 text-center gap-3"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Elige el archivo de tu grabación desde tu equipo
          </span>
          <button
            onClick={handlePickBaseVideo}
            disabled={picking === "video"}
            className="font-mono text-[11px] px-3 py-1.5 rounded-md font-bold"
            style={{ background: "var(--gold)", color: "#1a1a24" }}
          >
            {picking === "video" ? "ABRIENDO…" : "SELECCIONAR GRABACIÓN"}
          </button>
          <span className="font-mono text-[10px]" style={{ color: "var(--purple)" }}>100% local · nada sale de tu equipo</span>
        </div>
      ) : (
        <>
          <div className="flex gap-5">
            {/* Vista previa con composición en vivo: overlays encima del video, nunca lo tapan */}
            <div className="relative rounded-lg overflow-hidden bg-black" style={{ width: 480, height: 270, flexShrink: 0 }}>
              <video ref={videoRef} src={baseVideo.url} controls className="w-full h-full object-contain" />
              {activeMediaOverlays.map((ov) => (
                <div key={ov.id} className="absolute rounded overflow-hidden shadow-lg border-2" style={{ ...CORNER_STYLE[ov.corner], width: "32%", borderColor: "var(--gold)" }}>
                  {ov.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ov.src} alt={ov.name} className="w-full h-auto block" />
                  ) : (
                    <video src={ov.src} autoPlay muted loop className="w-full h-auto block" />
                  )}
                </div>
              ))}
              {activeTextOverlay && (
                <div
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md font-bold text-sm text-white"
                  style={{ background: activeTextOverlay.color }}
                >
                  {activeTextOverlay.keyword}
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Overlays de texto — en el momento actual ({fmt(current)})
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {OVERLAY_PRESETS.map((p) => (
                    <button key={p.keyword} onClick={() => addTextOverlay(p)}
                      className="font-mono text-[11px] px-2.5 py-1 rounded-full" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
                      + {p.keyword}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Agregar encima del video — imagen, clip o audio
                </span>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleAddMediaOverlay("image")} disabled={picking === "image"}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded-md" style={{ background: "var(--surface-2)" }}>
                    {picking === "image" ? "Abriendo…" : "+ Imagen"}
                  </button>
                  <button onClick={() => handleAddMediaOverlay("video")} disabled={picking === "clip"}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded-md" style={{ background: "var(--surface-2)" }}>
                    {picking === "clip" ? "Abriendo…" : "+ Clip"}
                  </button>
                  <button onClick={handleAddAudioTrack} disabled={picking === "audio"}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded-md" style={{ background: "var(--surface-2)" }}>
                    {picking === "audio" ? "Abriendo…" : "+ Audio"}
                  </button>
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
                  Las imágenes y clips se agregan como recuadro sobre el video (no lo tapan) — puedes cambiar la esquina abajo.
                </p>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleExportVideo}
                  disabled={exporting}
                  className="self-start font-mono text-xs px-4 py-2.5 rounded-md font-bold"
                  style={{ background: "var(--purple)", color: "#fff" }}
                >
                  {exporting ? `RENDERIZANDO… ${exportProgress}%` : "GENERAR VIDEO FINAL"}
                </button>
                <button
                  onClick={handleTranscribe}
                  disabled={transcribing}
                  className="self-start font-mono text-xs px-4 py-2.5 rounded-md font-bold"
                  style={{ background: "var(--surface-2)", color: "var(--text)" }}
                  title="Transcribe el audio a texto de forma local (faster-whisper) para armar tus shownotes"
                >
                  {transcribing ? "TRANSCRIBIENDO…" : "📝 TRANSCRIBIR AUDIO"}
                </button>
              </div>
              {exportLog && <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{exportLog}</p>}
              {transcribeLog && <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{transcribeLog}</p>}
            </div>
          </div>

          {transcript && (
            <div className="rounded-lg border p-4" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Transcripción — para tu descripción de YouTube o shownotes
                </span>
                <button
                  onClick={copyTranscript}
                  className="font-mono text-[10px] px-2.5 py-1 rounded-full"
                  style={{ border: "1px solid var(--line)", color: copied ? "var(--good)" : "var(--muted)" }}
                >
                  {copied ? "COPIADO ✓" : "COPIAR"}
                </button>
              </div>
              <textarea
                readOnly
                value={transcript}
                rows={6}
                className="w-full rounded-md border p-2.5 text-sm resize-y"
                style={{ borderColor: "var(--line)", background: "var(--bg)", color: "var(--text)" }}
              />
            </div>
          )}

          {/* Línea de tiempo */}
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Línea de tiempo — {fmt(current)} / {fmt(duration)}
            </span>
            <div className="relative mt-2 rounded-md" style={{ height: 14, background: "var(--surface-2)" }}>
              <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${duration ? (current / duration) * 100 : 0}%`, background: "var(--text)" }} />
            </div>
            {[
              { label: "Overlays de imagen/clip", items: mediaOverlays.map((o) => ({ id: o.id, start: o.startSec, end: o.endSec, label: `${o.kind === "image" ? "🖼" : "🎬"} ${o.name}`, color: "var(--purple)" })) },
              { label: "Audio", items: audioTracks.map((a) => ({ id: a.id, start: a.startSec, end: Math.min(duration, a.startSec + 6), label: `🔊 ${a.name}`, color: "var(--good)" })) },
              { label: "Texto", items: textOverlays.map((o) => ({ id: o.id, start: o.startSec, end: o.endSec, label: o.keyword, color: o.color })) },
            ].map((track) => (
              <div key={track.label} className="relative mt-1.5 rounded-md" style={{ height: 22, background: "var(--surface-2)" }}>
                {track.items.map((it) => (
                  <div key={it.id} title={it.label} className="absolute top-0 bottom-0 rounded-sm flex items-center justify-center overflow-hidden"
                    style={{ left: `${duration ? (it.start / duration) * 100 : 0}%`, width: `${duration ? Math.max(1, ((it.end - it.start) / duration) * 100) : 0}%`, background: it.color }}>
                    <span className="font-mono text-[9px] text-white px-1 truncate">{it.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Listas editables */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Texto</span>
              <div className="flex flex-col gap-1.5 mt-2">
                {textOverlays.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>Ninguno.</p>}
                {textOverlays.map((o) => (
                  <div key={o.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{ background: "var(--surface-2)" }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.color }} />
                    <span className="text-xs flex-1 truncate">{o.keyword}</span>
                    <input type="number" min={0} max={duration} step={0.5} value={o.startSec.toFixed(1)}
                      onChange={(e) => updateTextOverlay(o.id, { startSec: Number(e.target.value) })}
                      className="w-12 rounded border px-1 text-[10px]" style={{ borderColor: "var(--line)" }} />
                    <button onClick={() => removeTextOverlay(o.id)} className="font-mono text-[10px] px-1.5 py-1 rounded" style={{ background: "var(--bad)", color: "#fff" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Imagen / clip</span>
              <div className="flex flex-col gap-1.5 mt-2">
                {mediaOverlays.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>Ninguno.</p>}
                {mediaOverlays.map((o) => (
                  <div key={o.id} className="flex flex-col gap-1 px-2 py-1.5 rounded-md" style={{ background: "var(--surface-2)" }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs flex-1 truncate">{o.kind === "image" ? "🖼" : "🎬"} {o.name}</span>
                      <button onClick={() => removeMediaOverlay(o.id)} className="font-mono text-[10px] px-1.5 py-1 rounded" style={{ background: "var(--bad)", color: "#fff" }}>✕</button>
                    </div>
                    <div className="flex items-center gap-1">
                      {(["tl", "tr", "bl", "br"] as Corner[]).map((c) => (
                        <button key={c} onClick={() => updateMediaOverlay(o.id, { corner: c })}
                          className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: o.corner === c ? "var(--purple)" : "var(--surface)", color: o.corner === c ? "#fff" : "var(--muted)" }}>
                          {CORNER_LABEL[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Audio</span>
              <div className="flex flex-col gap-1.5 mt-2">
                {audioTracks.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>Ninguno.</p>}
                {audioTracks.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{ background: "var(--surface-2)" }}>
                    <span className="text-xs flex-1 truncate">🔊 {a.name}</span>
                    <input type="range" min={0} max={1} step={0.05} value={a.volume}
                      onChange={(e) => updateAudioTrack(a.id, { volume: Number(e.target.value) })} className="w-16" />
                    <button onClick={() => removeAudioTrack(a.id)} className="font-mono text-[10px] px-1.5 py-1 rounded" style={{ background: "var(--bad)", color: "#fff" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
