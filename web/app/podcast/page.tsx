"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import ImageEditor from "./ImageEditor";
import VideoEditor from "./VideoEditor";
import MediaHistory from "./MediaHistory";
import AutoVideoGenerator from "./AutoVideoGenerator";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

type HistoryItem = { podcastId: number; fixtureId: number; title: string; episodeLabel: string; youtubeLink: string; generatedAtUtc: string };
type OutlineBlock = { block: string; minutes: number; note: string };
type ClipSuggestion = { label: string; fromMinute: number; toMinute: number };
type Suggestions = {
  titles: string[];
  hashtags: string[];
  talkingPoints: string[];
  outline?: OutlineBlock[];
  clipSuggestions?: ClipSuggestion[];
};

export default function PodcastPage() {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [fixtureId, setFixtureId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [episodeLabel, setEpisodeLabel] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"contenido" | "editor" | "imagen">("contenido");

  function loadAnalysis() {
    setLoading(true);
    fetch(`${API}/api/podcast/analysis/last-match`)
      .then((r) => r.json())
      .then((d) => {
        setAnalysis(d.text);
        setFixtureId(d.fixtureId ?? null);
        if (d.fixtureId) {
          fetch(`${API}/api/podcast/suggestions/${d.fixtureId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((s: Suggestions | null) => {
              setSuggestions(s);
              if (s?.titles?.[0]) setSelectedTitle(s.titles[0]);
            });
        }
      })
      .finally(() => setLoading(false));
  }

  function loadHistory() {
    fetch(`${API}/api/podcast/history`).then((r) => r.json()).then(setHistory);
  }

  useEffect(() => {
    loadAnalysis();
    loadHistory();
  }, []);

  async function publish() {
    if (!fixtureId || !episodeLabel.trim() || !youtubeLink.trim()) return;
    const res = await fetch(`${API}/api/podcast/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId, title: selectedTitle, episodeLabel, youtubeLink }),
    });
    if (res.ok) {
      setPublishMessage("Guardado en el histórico.");
      setShowPublishForm(false);
      setEpisodeLabel("");
      setYoutubeLink("");
      loadHistory();
    } else {
      const d = await res.json();
      setPublishMessage(d.error ?? "No se pudo guardar.");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <NavBar active="/podcast" />

      <div className="max-w-5xl mx-auto px-8 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-display text-2xl font-extrabold">Podcast</span>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Análisis y propuesta de contenido para tu episodio post-partido.
            </p>
          </div>
          {tab === "contenido" && (
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="font-mono text-[10px] px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
            >
              {showHistory ? "OCULTAR HISTÓRICO" : `VER HISTÓRICO (${history.length})`}
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("contenido")}
            className="font-mono text-xs px-4 py-2 rounded-full"
            style={{
              background: tab === "contenido" ? "var(--purple)" : "transparent",
              color: tab === "contenido" ? "#fff" : "var(--muted)",
              border: tab === "contenido" ? "none" : "1px solid var(--line)",
            }}
          >
            CONTENIDO
          </button>
          <button
            onClick={() => setTab("editor")}
            className="font-mono text-xs px-4 py-2 rounded-full"
            style={{
              background: tab === "editor" ? "var(--purple)" : "transparent",
              color: tab === "editor" ? "#fff" : "var(--muted)",
              border: tab === "editor" ? "none" : "1px solid var(--line)",
            }}
          >
            EDITOR DE VIDEO
          </button>
          <button
            onClick={() => setTab("imagen")}
            className="font-mono text-xs px-4 py-2 rounded-full"
            style={{
              background: tab === "imagen" ? "var(--purple)" : "transparent",
              color: tab === "imagen" ? "#fff" : "var(--muted)",
              border: tab === "imagen" ? "none" : "1px solid var(--line)",
            }}
          >
            EDITOR DE IMAGEN
          </button>
        </div>

        {tab === "contenido" && showHistory && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th className="text-left px-4 py-2 font-mono text-[10px]" style={{ color: "var(--muted)" }}>EPISODIO</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px]" style={{ color: "var(--muted)" }}>TÍTULO</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px]" style={{ color: "var(--muted)" }}>LINK</th>
                  <th className="text-right px-4 py-2 font-mono text-[10px]" style={{ color: "var(--muted)" }}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.podcastId} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td className="px-4 py-2 font-mono">{h.episodeLabel}</td>
                    <td className="px-4 py-2">{h.title}</td>
                    <td className="px-4 py-2">
                      <a href={h.youtubeLink} target="_blank" rel="noreferrer" style={{ color: "var(--purple)" }}>
                        ver video
                      </a>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                      {new Date(h.generatedAtUtc).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <p className="text-sm p-4" style={{ color: "var(--muted)" }}>
                Todavía no publicaste ningún episodio.
              </p>
            )}
          </div>
        )}

        {tab === "contenido" && (
        <>
        <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <div className="flex justify-between items-baseline">
            <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Análisis del último partido — generado desde datos reales
            </span>
            <button
              onClick={loadAnalysis}
              className="font-mono text-[10px] px-2.5 py-1 rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
            >
              REGENERAR
            </button>
          </div>
          <p className="text-sm mt-3 leading-relaxed">{loading ? "Generando…" : analysis}</p>
          <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
            Combina goles/asistencias reales, la calificación real de rendimiento por jugador, y tu propia
            calificación cuando la agregas en /calificaciones — no es un modelo de lenguaje todavía.
          </p>
        </div>

        {suggestions && (
          <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Qué hablar en el episodio
              </span>
              {suggestions.outline && suggestions.outline.length > 0 && (
                <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                  ~{suggestions.outline.reduce((s, b) => s + b.minutes, 0)} min sugeridos
                </span>
              )}
            </div>
            {suggestions.outline && suggestions.outline.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.outline.map((b) => (
                  <span
                    key={b.block}
                    className="font-mono text-[10px] px-2 py-1 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--muted)" }}
                    title={b.note}
                  >
                    {b.block} · {b.minutes} min
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 mt-3">
              {suggestions.talkingPoints.map((t, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="font-mono flex-shrink-0" style={{ color: "var(--gold)" }}>{i + 1}.</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>

            {suggestions.clipSuggestions && suggestions.clipSuggestions.length > 0 && (
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Clips cortos sugeridos (Reels / Shorts / TikTok)
                </span>
                <div className="flex flex-col gap-1.5 mt-2">
                  {suggestions.clipSuggestions.map((c, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{c.label}</span>
                      <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                        min. {c.fromMinute}–{c.toMinute}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Título para YouTube
              </span>
              <div className="flex flex-col gap-2 mt-2">
                {suggestions.titles.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={selectedTitle === t} onChange={() => setSelectedTitle(t)} />
                    {t}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {suggestions.hashtags.map((h) => (
                  <span key={h} className="font-mono text-[11px] px-2.5 py-1 rounded-full" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 flex flex-wrap items-start gap-3" style={{ borderTop: "1px solid var(--line)" }}>
              <AutoVideoGenerator
                fixtureId={fixtureId}
                title={selectedTitle}
                talkingPoints={suggestions?.talkingPoints ?? []}
                hashtags={suggestions?.hashtags ?? []}
              />

              {!showPublishForm ? (
                <button
                  onClick={() => setShowPublishForm(true)}
                  className="font-mono text-xs px-4 py-2.5 rounded-md font-bold"
                  style={{ background: "var(--gold)", color: "#1a1a24" }}
                >
                  MARCAR VIDEO COMO PUBLICADO
                </button>
              ) : (
                <div className="mt-3 flex flex-col gap-2 max-w-md">
                  <input
                    value={episodeLabel}
                    onChange={(e) => setEpisodeLabel(e.target.value)}
                    placeholder="Nombre del episodio (ej. Episodio 12)"
                    className="rounded-md border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--line)" }}
                  />
                  <input
                    value={youtubeLink}
                    onChange={(e) => setYoutubeLink(e.target.value)}
                    placeholder="Link de YouTube del video ya publicado"
                    className="rounded-md border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--line)" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={publish}
                      className="font-mono text-xs px-4 py-2 rounded-md font-bold"
                      style={{ background: "var(--good)", color: "#fff" }}
                    >
                      GUARDAR EN HISTÓRICO
                    </button>
                    <button
                      onClick={() => setShowPublishForm(false)}
                      className="font-mono text-xs px-4 py-2 rounded-md"
                      style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
                    >
                      CANCELAR
                    </button>
                  </div>
                </div>
              )}
              {publishMessage && <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>{publishMessage}</p>}
              <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
                El histórico solo guarda episodios ya publicados de verdad (con su link de YouTube) — no guardamos
                borradores ni intentos.
              </p>
            </div>
          </div>
        )}
        </>
        )}

        {tab === "editor" && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <div className="p-5" style={{ borderBottom: "1px solid var(--line)" }}>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Editor de video — 100% local, hecho en casa
              </span>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Sube tu grabación y agrégale encima texto, imágenes, otro clip y otra pista de audio, sin taparla — y genera el video final ya renderizado.
              </p>
            </div>
            <VideoEditor />
          </div>
        )}

        {tab === "imagen" && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <div className="p-5" style={{ borderBottom: "1px solid var(--line)" }}>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Editor de imagen — 100% local, hecho en casa
              </span>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Sube una imagen y retócala con pinceles reales: aclara algo (ej. el balón), oculta un detalle, clona una zona para tapar otra, agrega texto y ajusta brillo/contraste/color.
              </p>
            </div>
            <ImageEditor />
          </div>
        )}

        <MediaHistory refreshKey={0} />
      </div>
    </div>
  );
}
