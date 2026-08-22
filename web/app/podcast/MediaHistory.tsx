"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

type MediaItem = { mediaId: number; kind: "image" | "video"; fileName: string; createdAtUtc: string };

export default function MediaHistory({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/media/history`).then((r) => r.json()).then(setItems).catch(() => {});
  }, [refreshKey]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Historial de exportaciones ({items.length})
        </span>
        <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>{open ? "OCULTAR" : "VER"}</span>
      </button>
      {open && (
        <div className="flex flex-col">
          {items.map((it) => (
            <div key={it.mediaId} className="flex items-center gap-3 px-4 py-2" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ background: it.kind === "video" ? "var(--purple-soft)" : "var(--gold-soft)", color: it.kind === "video" ? "var(--purple)" : "var(--gold)" }}>
                {it.kind === "video" ? "VIDEO" : "IMAGEN"}
              </span>
              <span className="text-xs flex-1 truncate">{it.fileName}</span>
              <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                {new Date(it.createdAtUtc).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
