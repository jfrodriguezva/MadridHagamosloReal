"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

type RefreshStatus = {
  running: boolean;
  finished: boolean;
  exitCode: number | null;
  log: string[];
};

export default function RefreshDataButton() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API}/api/admin/db-provider`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVisible(d?.provider === "sqlite"))
      .catch(() => setVisible(false));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/admin/refresh-status`, { cache: "no-store" });
        if (!res.ok) return;
        const data: RefreshStatus = await res.json();
        setStatus(data);
        if (data.finished) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 2000);
  }

  async function handleClick() {
    setOpen(true);
    try {
      const res = await fetch(`${API}/api/admin/refresh-data`, { method: "POST" });
      if (!res.ok) {
        setStatus({ running: false, finished: true, exitCode: -1, log: ["No se pudo iniciar la actualización."] });
        return;
      }
      setStatus({ running: true, finished: false, exitCode: null, log: [] });
      startPolling();
    } catch {
      setStatus({ running: false, finished: true, exitCode: -1, log: ["No se pudo contactar la API."] });
    }
  }

  if (!visible) return null;

  const running = status?.running ?? false;

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={running}
        className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold border cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--text)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={running ? "animate-spin" : ""}
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        {running ? "Actualizando…" : "Actualizar datos"}
      </button>

      {open && status && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-lg border p-3 text-xs z-20 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              {status.finished ? (status.exitCode === 0 ? "Actualización completa" : "Terminó con errores") : "En progreso…"}
            </span>
            <button onClick={() => setOpen(false)} className="cursor-pointer" style={{ color: "var(--muted)" }}>
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
            {status.log.length ? status.log.join("\n") : "Iniciando…"}
          </div>
        </div>
      )}
    </div>
  );
}
