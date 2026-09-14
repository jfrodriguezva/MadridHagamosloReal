import NavBar from "./components/NavBar";
import CalendarStrip from "./components/CalendarStrip";
import RefreshDataButton from "./components/RefreshDataButton";
import { RealMadridCrest } from "./components/LogoMark";
import { teamColor } from "./lib/teamColors";

import { API } from "./lib/api";

type NextMatch = {
  fixtureId: number;
  kickoffUtc: string;
  roundLabel: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  probHome: number | null;
  probDraw: number | null;
  probAway: number | null;
  recentForm?: ("W" | "D" | "L")[];
  recentFormLeague?: ("W" | "D" | "L")[];
  recentFormChampions?: ("W" | "D" | "L")[];
};

type Postmortem = {
  match: {
    fixtureId: number;
    kickoffUtc: string;
    roundLabel: string;
    competitionType: string;
    homeGoals: number;
    awayGoals: number;
    homeTeam: string;
    homeTeamId: number;
    awayTeam: string;
    awayTeamId: number;
    leagueName: string;
  } | null;
  prediction: {
    probHome: number;
    probDraw: number;
    probAway: number;
    bestScoreHome: number | null;
    bestScoreAway: number | null;
    actualOutcome: "H" | "D" | "A" | null;
    wasCorrect: boolean | null;
  } | null;
  valueBet: {
    market: string;
    recommendedSide: "H" | "D" | "A";
    edgePct: number;
    actualOutcome: "H" | "D" | "A" | null;
    wasCorrect: number;
  } | null;
  mvp: { playerId: number; name: string; aiRating: number } | null;
  worst: { playerId: number; name: string; aiRating: number } | null;
  ratingsSummary: { ratedCount: number; avgUserVsAiDelta: number | null } | null;
};

type CalendarMatch = {
  fixtureId: number;
  kickoffUtc: string;
  competitionType?: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeGoals?: number;
  awayGoals?: number;
  probHome: number | null;
  probDraw: number | null;
  probAway: number | null;
  actualOutcome?: "H" | "D" | "A" | null;
  wasCorrect?: boolean | null;
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const REAL_MADRID_ID = 541;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase().replace(".", ""),
    num: d.getDate().toString().padStart(2, "0"),
  };
}

function isRMHome(m: { homeTeamId: number }) {
  return m.homeTeamId === REAL_MADRID_ID;
}

function rmProb(m: { probHome: number | null; probDraw: number | null; probAway: number | null }) {
  if (m.probHome == null) return null;
  return isRMHome(m as any) ? m.probHome! : m.probAway!;
}

function outcomeLabel(outcome: "H" | "D" | "A" | null | undefined, match: { homeTeamId: number }) {
  if (!outcome) return "—";
  if (outcome === "D") return "Empate";
  const rmWon = (outcome === "H") === isRMHome(match);
  return rmWon ? "Ganó el Real Madrid" : "Ganó el rival";
}

function predictedOutcome(p: { probHome: number; probDraw: number; probAway: number }): "H" | "D" | "A" {
  if (p.probHome >= p.probDraw && p.probHome >= p.probAway) return "H";
  if (p.probAway >= p.probDraw) return "A";
  return "D";
}

export default async function DashboardPage() {
  const [next, calendar, accuracy, postmortem] = await Promise.all([
    getJson<NextMatch>("/api/dashboard/next-match"),
    getJson<{ past: CalendarMatch[]; future: CalendarMatch[] }>(
      "/api/dashboard/calendar?pastCount=6&futureCount=4"
    ),
    getJson<{
      overall: { total: number; correct: number };
      last12: { total: number; correct: number };
      favoriteBaseline: { total: number; correct: number };
      activeModel: { algorithm: string; version: string; valAccuracy: number | null; valLogLoss: number | null; valBrier: number | null } | null;
    }>("/api/dashboard/model-accuracy"),
    getJson<Postmortem>("/api/matches/postmortem/last-match"),
  ]);

  const rival = next ? (isRMHome(next) ? next.awayTeam : next.homeTeam) : null;
  const rivalIsHome = next ? !isRMHome(next) : false;
  const winProb = next ? rmProb(next) : null;
  const drawProb = next?.probDraw ?? null;
  const loseProb = next ? (isRMHome(next) ? next.probAway : next.probHome) : null;

  const overallPct = accuracy?.overall?.total
    ? Math.round((accuracy.overall.correct / accuracy.overall.total) * 1000) / 10
    : null;
  const baselinePct = accuracy?.favoriteBaseline?.total
    ? Math.round((accuracy.favoriteBaseline.correct / accuracy.favoriteBaseline.total) * 1000) / 10
    : null;
  const edgeOverBaseline =
    overallPct != null && baselinePct != null ? Math.round((overallPct - baselinePct) * 10) / 10 : null;

  // Diferencia en días de calendario (no horas exactas) -- si faltan 2 días y 3 horas
  // son "2 días", no 3, así que se comparan las fechas sin la hora.
  const daysToNext = next
    ? (() => {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const kickoff = new Date(next.kickoffUtc);
        const startOfKickoffDay = new Date(kickoff.getFullYear(), kickoff.getMonth(), kickoff.getDate());
        return Math.round((startOfKickoffDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
      })()
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <NavBar active="/" />

      <div className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-6">
        <div className="flex justify-end">
          <RefreshDataButton />
        </div>

        {next && daysToNext != null && daysToNext >= 0 && (
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm"
            style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>
              {daysToNext === 0
                ? "¡Hoy juega el Real Madrid!"
                : daysToNext === 1
                ? "El Real Madrid juega mañana"
                : `Faltan ${daysToNext} días para el próximo partido`}{" "}
              — {isRMHome(next) ? next.awayTeam : next.homeTeam}, {new Date(next.kickoffUtc).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" })}{" "}
              · {new Date(next.kickoffUtc).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        {/* HERO ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.5fr] gap-5">
          <div
            className="rounded-xl p-6 text-white"
            style={{ background: "var(--purple)" }}
          >
            {next ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[11px] tracking-wider" style={{ color: "#d9b95c" }}>
                    PRÓXIMO PARTIDO · {next.roundLabel?.toUpperCase()}
                  </span>
                  <span className="font-mono text-[11px] text-[#c9c5df]">
                    {new Date(next.kickoffUtc).toLocaleDateString("es-ES", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    · {new Date(next.kickoffUtc).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="text-center w-24">
                    <div className="w-10 h-10 rounded-full bg-white mx-auto mb-1.5 flex items-center justify-center">
                      {isRMHome(next) ? (
                        <RealMadridCrest size={32} />
                      ) : (
                        <div className="w-6 h-6 rounded-full" style={{ background: teamColor(next.homeTeam) }} />
                      )}
                    </div>
                    <span className="text-sm font-semibold">{next.homeTeam}</span>
                  </div>
                  <div className="font-display text-3xl font-extrabold" style={{ color: "#d9b95c" }}>
                    VS
                  </div>
                  <div className="text-center w-24">
                    <div className="w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ background: isRMHome(next) ? teamColor(next.awayTeam) : "#fff" }}>
                      {!isRMHome(next) && <RealMadridCrest size={32} />}
                    </div>
                    <span className="text-sm font-semibold">{next.awayTeam}</span>
                  </div>
                </div>
                {(() => {
                  // Liga y Champions por separado -- un 3-0 a un rival de la parte baja de
                  // tabla no dice lo mismo que un 3-0 en Champions, mezclarlos en una sola
                  // racha engaña más de lo que ayuda. Si la API todavía no manda el desglose
                  // (despliegue viejo), cae de vuelta a la racha combinada.
                  const rachas = [
                    { label: "LIGA", data: next.recentFormLeague ?? next.recentForm },
                    { label: "UCL", data: next.recentFormChampions },
                  ].filter((r) => r.data && r.data.length > 0);
                  if (rachas.length === 0) return null;
                  return (
                    <div className="flex flex-col gap-1.5 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}>
                      {rachas.map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                          <span className="font-mono text-[10px] tracking-wider w-9" style={{ color: "#c9c5df" }}>
                            {r.label}
                          </span>
                          <div className="flex gap-1">
                            {r.data!.map((v, i) => (
                              <span
                                key={i}
                                className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold"
                                style={{
                                  background: v === "W" ? "var(--good)" : v === "L" ? "var(--bad)" : "rgba(255,255,255,.25)",
                                  color: "#fff",
                                }}
                                title={v === "W" ? "Ganó" : v === "L" ? "Perdió" : "Empató"}
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            ) : (
              <p className="text-sm text-[#c9c5df]">No hay próximo partido programado en la base.</p>
            )}
          </div>

          <div className="rounded-xl p-6 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <div className="flex justify-between items-baseline">
              <span className="font-mono text-[11px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                Predicción destacada · vs {rival ?? "—"} {rivalIsHome ? "(fuera)" : "(casa)"}
              </span>
            </div>
            {winProb != null ? (
              <>
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Gana Real Madrid</span>
                    <span className="font-mono font-semibold">{Math.round(winProb * 100)}%</span>
                  </div>
                  <div className="h-2 rounded" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded" style={{ width: `${winProb * 100}%`, background: "var(--gold)" }} />
                  </div>
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Empate</span>
                      <span className="font-mono font-semibold">{Math.round((drawProb ?? 0) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded" style={{ width: `${(drawProb ?? 0) * 100}%`, background: "var(--muted)" }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Pierde</span>
                      <span className="font-mono font-semibold">{Math.round((loseProb ?? 0) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded" style={{ width: `${(loseProb ?? 0) * 100}%`, background: "var(--bad)" }} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>
                Sin predicción disponible todavía.
              </p>
            )}
          </div>
        </div>

        {/* KPI STRIP */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Acierto histórico"
            value={overallPct != null ? `${overallPct}%` : "—"}
            sub={
              edgeOverBaseline != null
                ? `${edgeOverBaseline >= 0 ? "+" : ""}${edgeOverBaseline} pts vs. predecir siempre que gana el Madrid`
                : undefined
            }
          />
          <Kpi
            label="Últimos 12 partidos"
            value={accuracy?.last12 ? `${accuracy.last12.correct}/${accuracy.last12.total}` : "—"}
          />
          <Kpi label="Muestra validada" value={accuracy?.overall ? `${accuracy.overall.total} partidos` : "—"} />
          <Kpi
            label="Modelo activo"
            value={accuracy?.activeModel ? `${accuracy.activeModel.algorithm} ${accuracy.activeModel.version}` : "—"}
            accent
            sub={
              accuracy?.activeModel?.valLogLoss != null
                ? `log loss ${accuracy.activeModel.valLogLoss.toFixed(3)}${
                    accuracy.activeModel.valBrier != null ? ` · brier ${accuracy.activeModel.valBrier.toFixed(3)}` : ""
                  }`
                : undefined
            }
            subColor="var(--muted)"
          />
        </div>

        {postmortem?.match && (
          <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <div className="flex justify-between items-baseline mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Postmortem · último partido
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {new Date(postmortem.match.kickoffUtc).toLocaleDateString("es-ES", { day: "2-digit", month: "long" })}
                {" · "}
                {postmortem.match.roundLabel}
              </span>
            </div>

            {postmortem.prediction?.actualOutcome == null && (
              <div
                className="mb-3 rounded-lg px-3 py-2 text-xs font-mono flex items-center gap-2"
                style={{ background: "rgba(200,150,50,.12)", color: "var(--gold)" }}
              >
                ⚠ Datos sin actualizar — falta correr <code>persist_predictions.py</code> +{" "}
                <code>export_to_sqlite.py</code> para resolver la predicción de este partido.
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-display text-lg font-bold">
                {postmortem.match.homeTeam} {postmortem.match.homeGoals}–{postmortem.match.awayGoals} {postmortem.match.awayTeam}
              </div>
              {postmortem.prediction?.wasCorrect != null && (
                <span
                  className="font-mono text-[11px] px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: postmortem.prediction.wasCorrect ? "var(--gold-soft)" : "rgba(200,50,50,.12)",
                    color: postmortem.prediction.wasCorrect ? "var(--gold)" : "var(--bad)",
                  }}
                >
                  {postmortem.prediction.wasCorrect ? "✓ predicción acertada" : "✗ predicción fallada"}
                </span>
              )}
            </div>

            {postmortem.prediction && (
              <div className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                Predijimos:{" "}
                <span style={{ color: "var(--text)" }}>
                  {outcomeLabel(predictedOutcome(postmortem.prediction), postmortem.match)}
                </span>{" "}
                ({Math.round(
                  Math.max(postmortem.prediction.probHome, postmortem.prediction.probDraw, postmortem.prediction.probAway) * 100
                )}%)
                {postmortem.prediction.bestScoreHome != null && (
                  <>
                    {" "}· marcador más probable {postmortem.prediction.bestScoreHome}-{postmortem.prediction.bestScoreAway}
                  </>
                )}
                {" · "}Resultado real:{" "}
                <span style={{ color: "var(--text)" }}>{outcomeLabel(postmortem.prediction.actualOutcome, postmortem.match)}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Value bet
                </span>
                {postmortem.valueBet ? (
                  <div className="mt-1 text-sm">
                    <span style={{ color: postmortem.valueBet.wasCorrect ? "var(--good)" : "var(--bad)" }}>
                      {postmortem.valueBet.wasCorrect ? "✓ acertó" : "✗ falló"}
                    </span>{" "}
                    — {postmortem.valueBet.market} (edge +{postmortem.valueBet.edgePct}%)
                  </div>
                ) : (
                  <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    No se detectó value bet en este partido.
                  </div>
                )}
              </div>

              <div className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  MVP (IA)
                </span>
                {postmortem.mvp ? (
                  <div className="mt-1 text-sm">
                    <span className="font-semibold">{postmortem.mvp.name}</span>{" "}
                    <span className="font-mono" style={{ color: "var(--gold)" }}>
                      {Number(postmortem.mvp.aiRating).toFixed(1)}
                    </span>
                    {postmortem.worst && postmortem.worst.playerId !== postmortem.mvp.playerId && (
                      <span style={{ color: "var(--muted)" }}>
                        {" "}
                        · peor: {postmortem.worst.name} ({Number(postmortem.worst.aiRating).toFixed(1)})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    Sin calificaciones de la IA todavía.
                  </div>
                )}
              </div>
            </div>

            {postmortem.ratingsSummary && postmortem.ratingsSummary.ratedCount > 0 && (
              <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                Calificaste {postmortem.ratingsSummary.ratedCount} jugador{postmortem.ratingsSummary.ratedCount === 1 ? "" : "es"} de este
                partido
                {postmortem.ratingsSummary.avgUserVsAiDelta != null && (
                  <>
                    {" "}
                    · en promedio {postmortem.ratingsSummary.avgUserVsAiDelta >= 0 ? "más generoso" : "más duro"} que la IA por{" "}
                    <span className="font-mono">{Math.abs(postmortem.ratingsSummary.avgUserVsAiDelta).toFixed(1)} pts</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <CalendarStrip past={calendar?.past ?? []} future={calendar?.future ?? []} />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  sub,
  subColor = "var(--good)",
}: {
  label: string;
  value: string;
  accent?: boolean;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-lg p-4 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="font-mono text-[10.5px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div
        className="font-display text-3xl font-extrabold mt-1"
        style={{ color: accent ? "var(--gold)" : "var(--text)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[10px] mt-1" style={{ color: subColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}
