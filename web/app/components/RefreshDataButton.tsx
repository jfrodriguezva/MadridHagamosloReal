"use client";

import { useEffect, useRef, useState } from "react";

import { API } from "../lib/api";

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

  const [keyConfigured, setKeyConfigured] = useState(true);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);

  function checkKeyStatus() {
    fetch(`${API}/api/admin/api-key-status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setKeyConfigured(d ? d.configured : true))
      .catch(() => setKeyConfigured(true));
  }

  async function saveApiKey() {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    setKeyMessage(null);
    try {
      const res = await fetch(`${API}/api/admin/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      if (res.ok) {
        setKeyMessage("Guardada. Ya puedes actualizar datos.");
        setApiKeyInput("");
        setShowKeyForm(false);
        checkKeyStatus();
      } else {
        const d = await res.json();
        setKeyMessage(d.error ?? "No se pudo guardar la key.");
      }
    } catch {
      setKeyMessage("No se pudo contactar la API.");
    } finally {
      setSavingKey(false);
    }
  }

  useEffect(() => {
    fetch(`${API}/api/admin/db-provider`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setVisible(d?.provider === "sqlite");
        if (d?.provider === "sqlite") checkKeyStatus();
      })
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
    <div className="relative flex items-center gap-2">
      {!keyConfigured && (
        <div className="relative">
          <button
            onClick={() => setShowKeyForm((s) => !s)}
            className="font-mono text-[10.5px] px-3 py-2 rounded-lg border"
            style={{ background: "var(--bad-soft, transparent)", borderColor: "var(--bad)", color: "var(--bad)" }}
          >
            FALTA TU API KEY — CONFIGURAR
          </button>
          {showKeyForm && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-lg border p-3 text-xs z-20 shadow-lg flex flex-col gap-2"
              style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            >
              <p style={{ color: "var(--muted)" }}>
                Pega tu API key de{" "}
                <a href="https://www.api-football.com/" target="_blank" rel="noreferrer" style={{ color: "var(--purple)" }}>
                  api-football.com
                </a>{" "}
                — se guarda solo en este equipo, en <code>scripts\.env</code>.
              </p>
              <input
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Tu API key"
                type="password"
                className="rounded-md border px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: "var(--line)" }}
              />
              <button
                onClick={saveApiKey}
                disabled={savingKey || !apiKeyInput.trim()}
                className="font-mono text-[10.5px] px-3 py-1.5 rounded-md font-bold disabled:opacity-50"
                style={{ background: "var(--gold)", color: "#1a1a24" }}
              >
                {savingKey ? "GUARDANDO…" : "GUARDAR API KEY"}
              </button>
              {keyMessage && <p style={{ color: "var(--muted)" }}>{keyMessage}</p>}
            </div>
          )}
        </div>
      )}

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
