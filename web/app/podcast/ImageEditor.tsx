"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";
const CANVAS_W = 1080;
const CANVAS_H = 1080;

type TextLayer = {
  id: string; x: number; y: number; w: number; h: number;
  text: string; color: string; fontSize: number;
  font: "display" | "mono" | "body"; weight: number; align: "left" | "center" | "right";
};

type Tool = "mover" | "brillo" | "ocultar" | "sello";

const PALETTE = ["#ffffff", "#2b2350", "#a8791a", "#1a1a24", "#f7f6f2", "#a3323a", "#2f7a4f"];
const FONT_FAMILY: Record<TextLayer["font"], string> = {
  display: '"Big Shoulders Display", sans-serif',
  mono: '"JetBrains Mono", monospace',
  body: '"Source Sans 3", sans-serif',
};

const TOOL_LABEL: Record<Tool, string> = {
  mover: "Mover texto",
  brillo: "Pincel de brillo",
  ocultar: "Pincel de ocultar",
  sello: "Sello clonar",
};
const TOOL_HELP: Record<Tool, string> = {
  mover: "Arrastra las capas de texto sobre la imagen.",
  brillo: "Pinta sobre algo (ej. el balón) para aclararlo y darle brillo.",
  ocultar: "Pinta sobre algo que quieras esconder (ej. texto de la imagen) — lo suaviza con lo que lo rodea.",
  sello: "Primero toca la zona que quieres copiar (fuente), luego pinta donde quieras pegarla — así se \"borra\" algo cubriéndolo con otra parte de la foto.",
};

let idSeq = 1;
const newId = () => `t${idSeq++}`;

// Plantillas: posiciones/estilos de texto ya pensados para miniatura de episodio,
// para no armar el layout de texto desde cero cada vez -- el usuario solo cambia
// las palabras y, si quiere, arrastra/reescala como con cualquier capa de texto.
type ImageTemplate = { id: string; label: string; layers: Omit<TextLayer, "id">[] };

const TEMPLATES: ImageTemplate[] = [
  {
    id: "resultado",
    label: "Resultado",
    layers: [
      {
        x: CANVAS_W * 0.1, y: CANVAS_H * 0.06, w: CANVAS_W * 0.8, h: 56,
        text: "PARTIDO ANALIZADO", color: "#ffffff", fontSize: 32, font: "mono", weight: 700, align: "center",
      },
      {
        x: CANVAS_W * 0.08, y: CANVAS_H * 0.68, w: CANVAS_W * 0.84, h: 180,
        text: "2 - 0", color: "#d9b95c", fontSize: 130, font: "display", weight: 900, align: "center",
      },
    ],
  },
  {
    id: "titular",
    label: "Titular",
    layers: [
      {
        x: CANVAS_W * 0.08, y: CANVAS_H * 0.6, w: CANVAS_W * 0.84, h: 260,
        text: "TU TITULAR AQUÍ", color: "#ffffff", fontSize: 76, font: "display", weight: 800, align: "left",
      },
    ],
  },
  {
    id: "cita",
    label: "Cita",
    layers: [
      {
        x: CANVAS_W * 0.12, y: CANVAS_H * 0.4, w: CANVAS_W * 0.76, h: 220,
        text: "Escribe aquí la frase destacada", color: "#ffffff", fontSize: 50, font: "body", weight: 600, align: "center",
      },
    ],
  },
];

type Filters = { grayscale: number; sepia: number; brightness: number; contrast: number; saturate: number };
const DEFAULT_FILTERS: Filters = { grayscale: 0, sepia: 0, brightness: 100, contrast: 100, saturate: 100 };
function filtersToCss(f: Filters) {
  return `grayscale(${f.grayscale}%) sepia(${f.sepia}%) brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%)`;
}
function filtersAreDefault(f: Filters) {
  return f.grayscale === 0 && f.sepia === 0 && f.brightness === 100 && f.contrast === 100 && f.saturate === 100;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

export default function ImageEditor() {
  const [hasImage, setHasImage] = useState(false);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tool, setTool] = useState<Tool>("mover");
  const [brushSize, setBrushSize] = useState(60);
  const [hasSource, setHasSource] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const workCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeState = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const paintingRef = useRef(false);
  const cloneSourceRef = useRef<{ x: number; y: number } | null>(null);
  const paintOriginRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  const selected = texts.find((t) => t.id === selectedId) ?? null;

  function updateText(id: string, patch: Partial<TextLayer>) {
    setTexts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function addText() {
    const t: TextLayer = {
      id: newId(), x: CANVAS_W * 0.5 - 220, y: CANVAS_H * 0.5 - 34, w: 440, h: 68,
      text: "Tu texto aquí", color: "#ffffff", fontSize: 48, font: "display", weight: 800, align: "center",
    };
    setTexts((ts) => [...ts, t]);
    setSelectedId(t.id);
  }

  function removeSelected() {
    if (!selectedId) return;
    setTexts((ts) => ts.filter((t) => t.id !== selectedId));
    setSelectedId(null);
  }

  function applyTemplate(t: ImageTemplate) {
    if (texts.length > 0 && !confirm("Esto reemplaza el texto actual por la plantilla. ¿Continuar?")) return;
    const newTexts = t.layers.map((l) => ({ ...l, id: newId() }));
    setTexts(newTexts);
    setSelectedId(newTexts[0]?.id ?? null);
    setTool("mover");
  }

  async function handlePickImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const img = await loadImage(String(reader.result));
        const canvas = workCanvasRef.current;
        if (!canvas) return;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext("2d")!;
        const scale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (CANVAS_W - dw) / 2, (CANVAS_H - dh) / 2, dw, dh);
        historyRef.current = [];
        setCanUndo(false);
        setHasImage(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // Coordenadas del lienzo: de CSS-px (lo que ve el usuario) a resolución real 1080x1080.
  const scaleFactor = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return 1;
    return CANVAS_W / el.getBoundingClientRect().width;
  }, []);

  function canvasPointFromEvent(e: React.PointerEvent): { x: number; y: number } {
    const el = wrapRef.current!;
    const rect = el.getBoundingClientRect();
    const s = scaleFactor();
    return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s };
  }

  function pushHistory() {
    const ctx = workCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    historyRef.current.push(snap);
    if (historyRef.current.length > 12) historyRef.current.shift();
    setCanUndo(true);
  }

  function undo() {
    const ctx = workCanvasRef.current?.getContext("2d");
    const snap = historyRef.current.pop();
    if (!ctx || !snap) return;
    ctx.putImageData(snap, 0, 0);
    setCanUndo(historyRef.current.length > 0);
  }

  // Pincel de brillo: sube el valor RGB dentro de un radio, con caída suave hacia el borde.
  function paintBrighten(cx: number, cy: number, radius: number) {
    const ctx = workCanvasRef.current!.getContext("2d")!;
    const x0 = Math.max(0, Math.floor(cx - radius)), y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(CANVAS_W, Math.ceil(cx + radius)), y1 = Math.min(CANVAS_H, Math.ceil(cy + radius));
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const data = ctx.getImageData(x0, y0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x0 + x - cx, dy = y0 + y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const strength = (1 - dist / radius) * 0.35;
        const i = (y * w + x) * 4;
        data.data[i] = Math.min(255, data.data[i] + 255 * strength * 0.5);
        data.data[i + 1] = Math.min(255, data.data[i + 1] + 255 * strength * 0.5);
        data.data[i + 2] = Math.min(255, data.data[i + 2] + 255 * strength * 0.45);
      }
    }
    ctx.putImageData(data, x0, y0);
  }

  // Pincel de ocultar: reemplaza cada pixel por el promedio de su entorno (desenfoque local) --
  // borra detalle fino como texto sin dejar un parche de color plano.
  function paintHide(cx: number, cy: number, radius: number) {
    const ctx = workCanvasRef.current!.getContext("2d")!;
    const pad = 6;
    const x0 = Math.max(0, Math.floor(cx - radius - pad)), y0 = Math.max(0, Math.floor(cy - radius - pad));
    const x1 = Math.min(CANVAS_W, Math.ceil(cx + radius + pad)), y1 = Math.min(CANVAS_H, Math.ceil(cy + radius + pad));
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const src = ctx.getImageData(x0, y0, w, h);
    const out = new ImageData(w, h);
    out.data.set(src.data);
    const k = 4;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x0 + x - cx, dy = y0 + y - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let sy = -k; sy <= k; sy += 2) {
          for (let sx = -k; sx <= k; sx += 2) {
            const px = x + sx, py = y + sy;
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            const i = (py * w + px) * 4;
            r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
          }
        }
        const i = (y * w + x) * 4;
        out.data[i] = r / n; out.data[i + 1] = g / n; out.data[i + 2] = b / n; out.data[i + 3] = 255;
      }
    }
    ctx.putImageData(out, x0, y0);
  }

  // Sello clonar: copia píxeles desde (fuente + desplazamiento) a la posición actual.
  function paintClone(cx: number, cy: number, radius: number, source: { x: number; y: number }, origin: { x: number; y: number }) {
    const ctx = workCanvasRef.current!.getContext("2d")!;
    const offX = source.x - origin.x, offY = source.y - origin.y;
    const sx = cx + offX, sy = cy + offY;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(workCanvasRef.current!, sx - radius, sy - radius, radius * 2, radius * 2, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (tool === "mover" || !hasImage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = canvasPointFromEvent(e);
    if (tool === "sello" && !cloneSourceRef.current) {
      cloneSourceRef.current = p;
      setHasSource(true);
      return;
    }
    pushHistory();
    paintingRef.current = true;
    paintOriginRef.current = p;
    if (tool === "brillo") paintBrighten(p.x, p.y, brushSize);
    else if (tool === "ocultar") paintHide(p.x, p.y, brushSize);
    else if (tool === "sello" && cloneSourceRef.current) paintClone(p.x, p.y, brushSize, cloneSourceRef.current, p);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (!paintingRef.current || !hasImage) return;
    const p = canvasPointFromEvent(e);
    if (tool === "brillo") paintBrighten(p.x, p.y, brushSize);
    else if (tool === "ocultar") paintHide(p.x, p.y, brushSize);
    else if (tool === "sello" && cloneSourceRef.current && paintOriginRef.current) {
      paintClone(p.x, p.y, brushSize, cloneSourceRef.current, paintOriginRef.current);
    }
  }

  function onCanvasPointerUp() {
    paintingRef.current = false;
  }

  function resetCloneSource() {
    cloneSourceRef.current = null;
    setHasSource(false);
  }

  function onLayerPointerDown(e: React.PointerEvent, t: TextLayer) {
    if (tool !== "mover") return;
    e.stopPropagation();
    setSelectedId(t.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { id: t.id, startX: e.clientX, startY: e.clientY, origX: t.x, origY: t.y };
  }

  function onOverlayPointerMove(e: React.PointerEvent) {
    if (tool !== "mover") { onCanvasPointerMove(e); return; }
    const s = scaleFactor();
    if (dragState.current) {
      const dx = (e.clientX - dragState.current.startX) * s;
      const dy = (e.clientY - dragState.current.startY) * s;
      updateText(dragState.current.id, { x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    } else if (resizeState.current) {
      const dx = (e.clientX - resizeState.current.startX) * s;
      updateText(resizeState.current.id, { w: Math.max(60, resizeState.current.origW + dx) });
    }
  }

  function onOverlayPointerUp(e: React.PointerEvent) {
    dragState.current = null;
    resizeState.current = null;
    onCanvasPointerUp();
  }

  function onOverlayPointerDown(e: React.PointerEvent) {
    if (tool === "mover") { setSelectedId(null); return; }
    onCanvasPointerDown(e);
  }

  function onResizeHandleDown(e: React.PointerEvent, t: TextLayer) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    resizeState.current = { id: t.id, startX: e.clientX, startY: e.clientY, origW: t.w, origH: t.h };
  }

  // Exporta: el lienzo de trabajo (ya con los retoques de pincel) + filtros globales + texto encima.
  async function handleExport() {
    if (!hasImage) return;
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no disponible");

      ctx.filter = filtersToCss(filters);
      ctx.drawImage(workCanvasRef.current!, 0, 0);
      ctx.filter = "none";

      for (const t of texts) {
        ctx.fillStyle = t.color;
        ctx.font = `${t.weight} ${t.fontSize}px ${FONT_FAMILY[t.font]}`;
        ctx.textAlign = t.align;
        ctx.textBaseline = "middle";
        const xPos = t.align === "left" ? t.x : t.align === "right" ? t.x + t.w : t.x + t.w / 2;
        ctx.fillText(t.text, xPos, t.y + t.h / 2, t.w);
      }

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `madrid-hagamoslo-real-${Date.now()}.png`;
      a.click();
      fetch(`${API}/api/media/log`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "image", fileName: a.download }),
      }).catch(() => {});
    } catch {
      alert("No se pudo exportar la imagen. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (tool !== "sello") resetCloneSource();
  }, [tool]);

  return (
    <div className="p-5 flex gap-6 items-start">
      {/* Panel izquierdo */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>1. Imagen</span>
          <button
            onClick={handlePickImage}
            className="font-mono text-[11px] px-2.5 py-1.5 rounded-md mt-2 w-full font-bold"
            style={{ background: hasImage ? "var(--surface-2)" : "var(--gold)", color: hasImage ? "var(--text)" : "#1a1a24" }}
          >
            {hasImage ? "CAMBIAR IMAGEN" : "SUBIR IMAGEN"}
          </button>
          {!hasImage && (
            <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
              Sube el corte del partido que quieras usar.
            </p>
          )}
        </div>

        {hasImage && (
          <>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>2. Plantilla</span>
              <div className="flex gap-1.5 mt-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="font-mono text-[10.5px] px-2 py-1.5 rounded-md flex-1"
                    style={{ background: "var(--surface-2)", color: "var(--text)" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
                Coloca el texto ya ubicado — solo cambia las palabras o arrástralo.
              </p>
            </div>

            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>3. Herramienta</span>
              <div className="flex flex-col gap-1 mt-2">
                {(["mover", "brillo", "ocultar", "sello"] as Tool[]).map((t) => (
                  <button key={t} onClick={() => setTool(t)}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded-md text-left"
                    style={{ background: tool === t ? "var(--purple)" : "var(--surface-2)", color: tool === t ? "#fff" : "var(--text)" }}>
                    {TOOL_LABEL[t]}
                  </button>
                ))}
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>{TOOL_HELP[tool]}</p>
              {tool === "sello" && (
                <p className="text-[10px] mt-1" style={{ color: hasSource ? "var(--good)" : "var(--gold)" }}>
                  {hasSource ? "Fuente lista — ya puedes pintar." : "Toca la zona que quieres copiar."}
                </p>
              )}
              {tool !== "mover" && (
                <>
                  <label className="text-[10px] font-mono block mt-2" style={{ color: "var(--muted)" }}>Tamaño del pincel</label>
                  <input type="range" min={20} max={160} value={brushSize} className="w-full"
                    onChange={(e) => setBrushSize(Number(e.target.value))} />
                  <div className="flex gap-1.5 mt-1.5">
                    <button onClick={undo} disabled={!canUndo}
                      className="font-mono text-[10px] px-2 py-1 rounded-md flex-1 disabled:opacity-40" style={{ background: "var(--surface-2)" }}>
                      Deshacer
                    </button>
                    {tool === "sello" && (
                      <button onClick={resetCloneSource}
                        className="font-mono text-[10px] px-2 py-1 rounded-md flex-1" style={{ background: "var(--surface-2)" }}>
                        Nueva fuente
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>4. Texto</span>
              <button onClick={addText} className="font-mono text-[11px] px-2.5 py-1.5 rounded-md mt-2 w-full" style={{ background: "var(--surface-2)" }}>
                + Agregar texto
              </button>
            </div>

            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>5. Ajustes de imagen</span>
              <div className="flex flex-col gap-1.5 mt-2">
                {([
                  ["Brillo", "brightness", 50, 150],
                  ["Contraste", "contrast", 50, 150],
                  ["Saturación", "saturate", 0, 200],
                  ["Blanco y negro", "grayscale", 0, 100],
                  ["Sepia", "sepia", 0, 100],
                ] as [string, keyof Filters, number, number][]).map(([label, key, min, max]) => (
                  <div key={key}>
                    <label className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>{label}</label>
                    <input type="range" min={min} max={max} value={filters[key]} className="w-full"
                      onChange={(e) => setFilters((f) => ({ ...f, [key]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              {!filtersAreDefault(filters) && (
                <button onClick={() => setFilters(DEFAULT_FILTERS)} className="font-mono text-[10px] px-2 py-1 rounded-md mt-1.5" style={{ background: "var(--surface-2)" }}>
                  Restablecer ajustes
                </button>
              )}
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="font-mono text-[12px] px-3 py-2.5 rounded-md font-bold mt-2"
              style={{ background: "var(--good)", color: "#fff" }}
            >
              {exporting ? "EXPORTANDO…" : "⬇ EXPORTAR PNG"}
            </button>
          </>
        )}
      </div>

      {/* Lienzo */}
      <div className="flex-1 flex justify-center">
        <div
          className="relative overflow-hidden rounded-lg shadow-lg flex items-center justify-center"
          style={{
            width: "100%", maxWidth: 420,
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            background: hasImage ? "#000" : "var(--surface-2)",
            containerType: "inline-size",
            cursor: tool === "mover" ? "default" : "crosshair",
          } as React.CSSProperties}
          ref={wrapRef}
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
          onPointerDown={onOverlayPointerDown}
        >
          <canvas
            ref={workCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="absolute inset-0 w-full h-full"
            style={{ filter: filtersToCss(filters), display: hasImage ? "block" : "none" }}
          />
          {!hasImage && (
            <span className="text-sm px-6 text-center" style={{ color: "var(--muted)" }}>
              Sube una imagen para empezar
            </span>
          )}
          {texts.map((t) => {
            const pct = { x: (t.x / CANVAS_W) * 100, y: (t.y / CANVAS_H) * 100, w: (t.w / CANVAS_W) * 100, h: (t.h / CANVAS_H) * 100 };
            const isSel = selectedId === t.id && !exporting && tool === "mover";
            return (
              <div
                key={t.id}
                style={{
                  position: "absolute", left: `${pct.x}%`, top: `${pct.y}%`, width: `${pct.w}%`, height: `${pct.h}%`,
                  outline: isSel ? "2px solid var(--gold)" : "none", outlineOffset: 2,
                  cursor: tool === "mover" ? "move" : "inherit",
                  pointerEvents: tool === "mover" ? "auto" : "none",
                  display: "flex", alignItems: "center",
                  justifyContent: t.align === "left" ? "flex-start" : t.align === "right" ? "flex-end" : "center",
                }}
                onPointerDown={(e) => onLayerPointerDown(e, t)}
              >
                <span
                  contentEditable={isSel}
                  suppressContentEditableWarning
                  onBlur={(e) => updateText(t.id, { text: e.currentTarget.textContent || "" })}
                  style={{
                    color: t.color, fontFamily: FONT_FAMILY[t.font], fontWeight: t.weight,
                    fontSize: `${(t.fontSize / CANVAS_W) * 100}cqw`, lineHeight: 1.15, outline: "none",
                    textAlign: t.align, width: "100%", wordBreak: "break-word",
                  }}
                >
                  {t.text}
                </span>
                {isSel && (
                  <div
                    onPointerDown={(e) => onResizeHandleDown(e, t)}
                    className="absolute -right-1 -bottom-1 w-3 h-3 rounded-full"
                    style={{ background: "var(--gold)", cursor: "ew-resize" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel derecho: propiedades del texto seleccionado */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-4">
        <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {selected ? "Propiedades del texto" : "Capas de texto"}
        </span>
        {!selected && (
          <div className="flex flex-col gap-1">
            {texts.length === 0 && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {hasImage ? "Agrega texto desde la izquierda." : "Sube una imagen primero."}
              </p>
            )}
            {texts.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTool("mover"); setSelectedId(t.id); }}
                className="font-mono text-[10px] px-2 py-1.5 rounded text-left"
                style={{ background: "var(--surface-2)" }}
              >
                {t.text.slice(0, 20) || "(vacío)"}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>Tamaño</label>
            <input type="range" min={16} max={140} value={selected.fontSize}
              onChange={(e) => updateText(selected.id, { fontSize: Number(e.target.value) })} />
            <label className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>Fuente</label>
            <div className="flex gap-1">
              {(["display", "body", "mono"] as const).map((f) => (
                <button key={f} onClick={() => updateText(selected.id, { font: f })}
                  className="font-mono text-[10px] px-2 py-1 rounded flex-1"
                  style={{ background: selected.font === f ? "var(--purple)" : "var(--surface-2)", color: selected.font === f ? "#fff" : "var(--text)" }}>
                  {f === "display" ? "Título" : f === "body" ? "Texto" : "Mono"}
                </button>
              ))}
            </div>
            <label className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>Alineación</label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button key={a} onClick={() => updateText(selected.id, { align: a })}
                  className="font-mono text-[10px] px-2 py-1 rounded flex-1"
                  style={{ background: selected.align === a ? "var(--purple)" : "var(--surface-2)", color: selected.align === a ? "#fff" : "var(--text)" }}>
                  {a === "left" ? "Izq" : a === "center" ? "Centro" : "Der"}
                </button>
              ))}
            </div>
            <label className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => updateText(selected.id, { color: c })}
                  className="w-5 h-5 rounded-full border" style={{ background: c, borderColor: "var(--line)" }} />
              ))}
            </div>
            <button onClick={removeSelected} className="font-mono text-[10px] px-2 py-1 rounded mt-2" style={{ background: "var(--bad)", color: "#fff" }}>
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
