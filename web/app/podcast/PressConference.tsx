"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API } from "../lib/api";

// Los temas de la rueda de prensa no salen de API-Football (no la expone).
// Entran por cuatro vías, todas visibles y distinguibles en la UI:
//   'oficial'  -> citas de la sala de prensa del club (transcripción de origen)
//   'buscador' -> citas textuales publicadas por medios
//   'claude'   -> temas ya sintetizados que Claude escribió por POST
//   'manual'   -> lo que tú tecleas viendo la rueda en video
// La app nunca decide sola de qué habló el técnico: tú titulas el tema y
// marcas cuál entra al guion.

type Topic = {
  pressTopicId: number;
  topic: string | null;
  quote: string | null;
  angle: string | null;
  selected: boolean;
  sortOrder: number;
};

type Conference = {
  pressConferenceId: number;
  source: string;
  sourceName: string | null;
  sourceUrl: string | null;
  headline: string | null;
  publishedAtUtc: string | null;
  fetchedAtUtc: string | null;
  coachName: string;
  topics: Topic[];
};

type PressResponse = {
  fixtureId: number | null;
  rival: string | null;
  kickoffUtc: string | null;
  coachName: string | null;
  conferences: Conference[];
};

type JobStatus = { running: boolean; finished: boolean; exitCode: number | null; log: string[] };

const SOURCE_LABEL: Record<string, string> = {
  oficial: "SALA DE PRENSA OFICIAL",
  buscador: "CITA PUBLICADA",
  claude: "INVESTIGADO POR CLAUDE",
  manual: "CARGADO A MANO",
};

export default function PressConference() {
  const [data, setData] = useState<PressResponse | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [showJob, setShowJob] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newQuote, setNewQuote] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    queueMicrotask(() => setLoading(true));
    fetch(`${API}/api/press/next`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PressResponse | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // La previa se cuenta mejor cruzando lo que dijo el técnico con lo que dice
  // el modelo, así que el guion arrastra las dos cosas juntas.
  useEffect(() => {
    fetch(`${API}/api/predictions/next/full`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.x12 || !d?.match) return;
        const rmIsHome = d.match.homeTeamId === 541;
        const pctRm = Math.round((rmIsHome ? d.x12.probHome : d.x12.probAway) * 100);
        const pctRival = Math.round((rmIsHome ? d.x12.probAway : d.x12.probHome) * 100);
        const pctDraw = Math.round(d.x12.probDraw * 100);
        const rivalName = rmIsHome ? d.match.awayTeam : d.match.homeTeam;
        setPrediction(
          `${pctRm}% Real Madrid · ${pctDraw}% empate · ${pctRival}% ${rivalName}` +
            (d.x12.bestScoreProb ? ` · marcador más probable ${d.x12.bestScoreHome}-${d.x12.bestScoreAway}` : ""),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  async function fetchPresser() {
    setShowJob(true);
    setJob({ running: true, finished: false, exitCode: null, log: [] });
    try {
      const res = await fetch(`${API}/api/admin/fetch-presser`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setJob({ running: false, finished: true, exitCode: -1, log: [d?.error ?? "No se pudo iniciar la búsqueda."] });
        return;
      }
    } catch {
      setJob({ running: false, finished: true, exitCode: -1, log: ["No se pudo contactar la API."] });
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/admin/fetch-presser-status`, { cache: "no-store" });
        if (!res.ok) return;
        const status: JobStatus = await res.json();
        setJob(status);
        if (status.finished) {
          if (pollRef.current) clearInterval(pollRef.current);
          load();
        }
      } catch {
        /* errores transitorios de polling */
      }
    }, 1500);
  }

  async function saveTopic(topic: Topic, patch: Partial<Topic>) {
    const merged = { ...topic, ...patch };
    setData((prev) =>
      prev
        ? {
            ...prev,
            conferences: prev.conferences.map((c) => ({
              ...c,
              topics: c.topics.map((t) => (t.pressTopicId === topic.pressTopicId ? merged : t)),
            })),
          }
        : prev,
    );
    await fetch(`${API}/api/press/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pressTopicId: merged.pressTopicId,
        topic: merged.topic,
        angle: merged.angle,
        selected: merged.selected,
      }),
    }).catch(() => {});
  }

  async function addManual() {
    if (!newTopic.trim()) return;
    await fetch(`${API}/api/press/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        topics: [{ topic: newTopic.trim(), quote: newQuote.trim() || null, angle: null, selected: true }],
      }),
    }).catch(() => {});
    setNewTopic("");
    setNewQuote("");
    setAdding(false);
    load();
  }

  async function removeConference(id: number) {
    await fetch(`${API}/api/press/conference/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  const selected = (data?.conferences ?? []).flatMap((c) => c.topics.filter((t) => t.selected).map((t) => ({ t, c })));

  function buildScript(): string {
    if (!data) return "";
    const lines: string[] = [];
    lines.push(`PREVIA — Real Madrid vs ${data.rival ?? "?"}`);
    lines.push("");
    if (prediction) {
      lines.push(`El modelo: ${prediction}`);
      lines.push("");
    }
    lines.push(`Lo que dejó la rueda de prensa de ${data.coachName ?? "el técnico"}:`);
    selected.forEach(({ t, c }, i) => {
      lines.push("");
      lines.push(`${i + 1}. ${t.topic?.trim() || "(sin titular)"}`);
      if (t.quote) lines.push(`   Cita: "${t.quote}"`);
      if (t.angle) lines.push(`   Mi ángulo: ${t.angle}`);
      if (c.sourceName) lines.push(`   Fuente: ${c.sourceName}${c.sourceUrl ? ` — ${c.sourceUrl}` : ""}`);
    });
    return lines.join("\n");
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(buildScript());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* el portapapeles puede estar bloqueado; el texto sigue visible abajo */
    }
  }

  return (
    <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Rueda de prensa previa {data?.coachName ? `— ${data.coachName}` : ""}
          </span>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {data?.rival ? `Antes del Real Madrid vs ${data.rival}.` : "Sin próximo partido en la base."} Marca los
            temas que van al guion de la previa.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setAdding((a) => !a)}
            className="font-mono text-[10px] px-2.5 py-1 rounded-full cursor-pointer"
            style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
          >
            + TEMA A MANO
          </button>
          <button
            onClick={fetchPresser}
            disabled={job?.running}
            className="font-mono text-[10px] px-2.5 py-1 rounded-full cursor-pointer disabled:opacity-50"
            style={{ background: "var(--purple)", color: "#fff" }}
          >
            {job?.running ? "BUSCANDO…" : "TRAER RUEDA DE PRENSA"}
          </button>
        </div>
      </div>

      {showJob && job && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              {job.finished ? (job.exitCode === 0 ? "Búsqueda terminada" : "Terminó con errores") : "Buscando…"}
            </span>
            <button onClick={() => setShowJob(false)} className="cursor-pointer" style={{ color: "var(--muted)" }}>
              ✕
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {job.log.length ? job.log.join("\n") : "Iniciando…"}
          </div>
        </div>
      )}

      {adding && (
        <div className="mt-3 rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "var(--line)" }}>
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Tema — ej. 'Duda con Mbappé para el once'"
            className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
            style={{ borderColor: "var(--line)", background: "var(--bg)" }}
          />
          <textarea
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            placeholder="Cita textual (opcional) — lo que dijo, tal cual"
            rows={2}
            className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y"
            style={{ borderColor: "var(--line)", background: "var(--bg)" }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="font-mono text-[10px] px-3 py-1.5 cursor-pointer" style={{ color: "var(--muted)" }}>
              CANCELAR
            </button>
            <button
              onClick={addManual}
              className="font-mono text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
              style={{ background: "var(--purple)", color: "#fff" }}
            >
              GUARDAR TEMA
            </button>
          </div>
        </div>
      )}

      {loading && (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          Cargando…
        </p>
      )}

      {!loading && (data?.conferences.length ?? 0) === 0 && (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          Todavía no hay nada de la rueda previa. Dale a <strong>TRAER RUEDA DE PRENSA</strong> para buscar citas
          publicadas, escribe un tema a mano, o pídele a Claude que investigue la rueda de esta semana y la cargue.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {data?.conferences.map((c) => (
          <div key={c.pressConferenceId} className="rounded-lg border" style={{ borderColor: "var(--line)" }}>
            <div
              className="flex justify-between items-center gap-3 px-3 py-2"
              style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}
            >
              <div className="min-w-0">
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
                  {SOURCE_LABEL[c.source] ?? c.source.toUpperCase()}
                </span>
                <span className="ml-2 text-xs truncate" style={{ color: "var(--muted)" }}>
                  {c.sourceName ?? "—"}
                  {c.headline ? ` · ${c.headline}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.sourceUrl && (
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px]" style={{ color: "var(--purple)" }}>
                    ABRIR NOTA
                  </a>
                )}
                <button
                  onClick={() => removeConference(c.pressConferenceId)}
                  className="font-mono text-[10px] cursor-pointer"
                  style={{ color: "var(--muted)" }}
                  title="Quitar esta fuente y sus temas"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex flex-col divide-y" style={{ borderColor: "var(--line)" }}>
              {c.topics.map((t) => (
                <div key={t.pressTopicId} className="p-3 flex gap-3" style={{ borderTop: "1px solid var(--line)" }}>
                  <input
                    type="checkbox"
                    checked={t.selected}
                    onChange={(e) => saveTopic(t, { selected: e.target.checked })}
                    className="mt-1 cursor-pointer"
                    title="Entra al guion de la previa"
                  />
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <input
                      defaultValue={t.topic ?? ""}
                      onBlur={(e) => e.target.value !== (t.topic ?? "") && saveTopic(t, { topic: e.target.value })}
                      placeholder="Titula el tema (la app no lo inventa por ti)"
                      className="w-full text-sm font-semibold px-2 py-1 rounded border outline-none"
                      style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                    />
                    {t.quote && (
                      <blockquote
                        className="text-sm italic pl-3"
                        style={{ borderLeft: "3px solid var(--gold)", color: "var(--text)" }}
                      >
                        {t.quote}
                      </blockquote>
                    )}
                    <textarea
                      defaultValue={t.angle ?? ""}
                      onBlur={(e) => e.target.value !== (t.angle ?? "") && saveTopic(t, { angle: e.target.value })}
                      placeholder="Tu ángulo para el podcast…"
                      rows={2}
                      className="w-full text-sm px-2 py-1 rounded border outline-none resize-y"
                      style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="mt-5 rounded-lg border p-4" style={{ borderColor: "var(--gold)", background: "var(--gold-soft)" }}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--gold)" }}>
              Guion de la previa — {selected.length} tema{selected.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={copyScript}
              className="font-mono text-[10px] px-2.5 py-1 rounded-full cursor-pointer"
              style={{ background: "var(--purple)", color: "#fff" }}
            >
              {copied ? "COPIADO" : "COPIAR GUION"}
            </button>
          </div>
          <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "inherit" }}>
            {buildScript()}
          </pre>
        </div>
      )}
    </div>
  );
}
