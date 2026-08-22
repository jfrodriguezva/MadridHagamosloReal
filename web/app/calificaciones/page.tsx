"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

type MatchPlayer = { playerId: number; playerName: string; posCode: string; isStarter: boolean; rating: number | null; review: string | null };
type LastMatch = { fixtureId: number; kickoffUtc: string; season: number; homeTeam: string; homeTeamId: number; awayTeam: string; awayTeamId: number; homeGoals: number; awayGoals: number };
type SeasonMatch = { fixtureId: number; kickoffUtc: string; competitionType: string; opponent: string; homeGoals: number; awayGoals: number };
type SeasonRatingRow = { playerId: number; name: string; fixtureId: number; aiRating: number | null; userRating: number | null };

function seasonLabel(s: number) {
  return `${s}-${(s + 1).toString().slice(2)}`;
}

function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const w = 110, h = 26, pad = 3;
  const pts = values.filter((v): v is number => v != null);
  if (pts.length < 2) return <span className="text-[10px]" style={{ color: "var(--muted)" }}>—</span>;
  const xStep = (w - pad * 2) / (values.length - 1);
  const yFor = (v: number) => h - pad - (v / 10) * (h - pad * 2);
  const line = values.map((v, i) => (v != null ? `${pad + i * xStep},${yFor(v)}` : null)).filter(Boolean).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

function BigChart({ matches, rows, playerId }: { matches: SeasonMatch[]; rows: SeasonRatingRow[]; playerId: number }) {
  const byFixture = new Map(rows.filter((r) => r.playerId === playerId).map((r) => [r.fixtureId, r]));
  const points = matches
    .filter((m) => byFixture.has(m.fixtureId))
    .map((m) => ({ ...m, ...byFixture.get(m.fixtureId)! }));
  if (points.length === 0) return null;

  const w = 1400, h = 260, padL = 34, padR = 16, padT = 14, padB = 46;
  const xStep = points.length > 1 ? (w - padL - padR) / (points.length - 1) : 0;
  const yFor = (v: number) => h - padB - (v / 10) * (h - padT - padB);
  const line = (key: "aiRating" | "userRating") =>
    points.map((p, i) => (p[key] != null ? `${padL + i * xStep},${yFor(p[key]!)}` : null)).filter(Boolean).join(" ");
  const aiVals = points.map((p) => p.aiRating).filter((v): v is number => v != null);
  const userVals = points.map((p) => p.userRating).filter((v): v is number => v != null);
  const aiFinal = aiVals.length ? (aiVals.reduce((a, b) => a + b, 0) / aiVals.length).toFixed(1) : "—";
  const userFinal = userVals.length ? (userVals.reduce((a, b) => a + b, 0) / userVals.length).toFixed(1) : "—";

  return (
    <div className="mt-3 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={padL - 8} y={yFor(v) + 4} textAnchor="end" fontFamily="JetBrains Mono" fontSize={12} fill="#6a6879">{v}</text>
          </g>
        ))}
        <polyline points={line("aiRating")} fill="none" stroke="var(--purple)" strokeWidth={2.5} />
        <polyline points={line("userRating")} fill="none" stroke="var(--gold)" strokeWidth={2.5} />
        {points.map((p, i) => (
          <g key={p.fixtureId}>
            {p.aiRating != null && <circle cx={padL + i * xStep} cy={yFor(p.aiRating)} r={3.5} fill="var(--purple)" />}
            {p.userRating != null && <circle cx={padL + i * xStep} cy={yFor(p.userRating)} r={3.5} fill="var(--gold)" />}
            <text x={padL + i * xStep} y={h - padB + 18} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={11} fill="#6a6879"
              transform={`rotate(-35 ${padL + i * xStep} ${h - padB + 18})`}>
              {p.opponent.length > 14 ? p.opponent.slice(0, 13) + "…" : p.opponent}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-8 mt-2">
        <span className="font-mono text-sm" style={{ color: "var(--purple)" }}>Promedio IA temporada: {aiFinal}</span>
        <span className="font-mono text-sm" style={{ color: "var(--gold)" }}>Tu promedio temporada: {userFinal}</span>
      </div>
    </div>
  );
}

export default function CalificacionesPage() {
  const [seasons, setSeasons] = useState<number[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [seasonMatches, setSeasonMatches] = useState<SeasonMatch[]>([]);
  const [seasonRatings, setSeasonRatings] = useState<SeasonRatingRow[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);

  const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);
  const [lastMatchPlayers, setLastMatchPlayers] = useState<MatchPlayer[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [nextMatch, setNextMatch] = useState<{ kickoffUtc: string; homeTeam: string; awayTeam: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/api/ratings/seasons`)
      .then((r) => r.json())
      .then((rows: { season: number }[]) => {
        const list = rows.map((r) => r.season);
        setSeasons(list);
        if (list.length) setActiveSeason(list[0]);
      });
    loadLastMatch();
    fetch(`${API}/api/dashboard/next-match`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNextMatch(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSeason == null) return;
    setExpandedPlayer(null);
    fetch(`${API}/api/ratings/season/${activeSeason}`)
      .then((r) => r.json())
      .then((d) => {
        setSeasonMatches((d.matches ?? []).slice());
        setSeasonRatings(d.ratings ?? []);
      });
  }, [activeSeason]);

  function loadLastMatch() {
    fetch(`${API}/api/ratings/last-match`)
      .then((r) => r.json())
      .then((data) => {
        setLastMatch(data.match);
        setLastMatchPlayers(data.players ?? []);
        const d: Record<number, string> = {};
        const rv: Record<number, string> = {};
        const s = new Set<number>();
        for (const p of data.players ?? []) {
          if (p.rating != null) {
            d[p.playerId] = String(p.rating);
            s.add(p.playerId);
          }
          if (p.review != null) rv[p.playerId] = p.review;
        }
        setDrafts(d);
        setReviewDrafts(rv);
        setSaved(s);
      });
  }

  async function saveRating(playerId: number) {
    const raw = drafts[playerId];
    const rating = parseFloat(raw);
    if (isNaN(rating) || rating < 0 || rating > 10 || !lastMatch) return;
    await fetch(`${API}/api/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: lastMatch.fixtureId, playerId, rating, review: reviewDrafts[playerId]?.trim() || null }),
    });
    setSaved((s) => new Set(s).add(playerId));
    if (activeSeason != null) {
      fetch(`${API}/api/ratings/season/${activeSeason}`).then((r) => r.json()).then((d) => {
        setSeasonMatches((d.matches ?? []).slice());
        setSeasonRatings(d.ratings ?? []);
      });
    }
  }

  const isCurrentSeasonTab = seasons.length > 0 && activeSeason === seasons[0];
  const ratingsOpen = isCurrentSeasonTab && lastMatch != null && lastMatch.season === activeSeason;
  const lastMatchPlayerMap = useMemo(() => new Map(lastMatchPlayers.map((p) => [p.playerId, p])), [lastMatchPlayers]);

  const playerSummaries = useMemo(() => {
    const ids = new Set(seasonRatings.map((r) => r.playerId));
    if (ratingsOpen) for (const p of lastMatchPlayers) ids.add(p.playerId);
    const totalMatches = seasonMatches.length;
    const DEFAULT_MISSED = 5; // calificación asumida en los partidos que NO jugó, para no premiar a quien jugó poco

    const rows0 = Array.from(ids).map((pid) => {
      const rows = seasonRatings.filter((r) => r.playerId === pid);
      const name = rows[0]?.name ?? lastMatchPlayerMap.get(pid)?.playerName ?? "";
      const byFixture = new Map(rows.map((r) => [r.fixtureId, r]));
      const aiSeries = seasonMatches.map((m) => byFixture.get(m.fixtureId)?.aiRating ?? null);
      const userSeries = seasonMatches.map((m) => byFixture.get(m.fixtureId)?.userRating ?? null);
      const aiVals = aiSeries.filter((v): v is number => v != null);
      const userVals = userSeries.filter((v): v is number => v != null);
      const matchesPlayed = aiVals.length;
      // Promedio "temporada completa": los partidos que no jugó cuentan como si hubiera
      // jugado con nota 5 -- así el promedio refleja el total de la temporada, no solo
      // sus partidos jugados (un jugador con pocos partidos y notas altas ya no sale mejor
      // que uno que sostuvo un buen nivel jugando toda la temporada).
      const aiAvg = totalMatches > 0
        ? (aiVals.reduce((a, b) => a + b, 0) + DEFAULT_MISSED * (totalMatches - matchesPlayed)) / totalMatches
        : null;
      const userAvg = userVals.length ? userVals.reduce((a, b) => a + b, 0) / userVals.length : null;
      return { pid, name, aiSeries, userSeries, aiAvg, userAvg, matchesPlayed };
    });

    return rows0.sort((a, b) => (b.aiAvg ?? -1) - (a.aiAvg ?? -1));
  }, [seasonRatings, seasonMatches, ratingsOpen, lastMatchPlayers, lastMatchPlayerMap]);

  // Jugadores donde tu calificación se aleja más de la de la IA -- útil como gancho de
  // contenido ("¿por qué calificaste tan distinto a Fulano?").
  const discrepancies = useMemo(() => {
    return playerSummaries
      .filter((p) => p.aiAvg != null && p.userAvg != null)
      .map((p) => ({ ...p, diff: Math.abs(p.userAvg! - p.aiAvg!) }))
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 5);
  }, [playerSummaries]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <NavBar active="/calificaciones" />

      <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col gap-6">
        <div>
          <span className="font-display text-2xl font-extrabold">Calificaciones</span>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Solo se puede calificar el último partido jugado de la temporada en curso. Todo lo demás es histórico.
          </p>
        </div>

        {/* TABS por temporada */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {seasons.map((s, i) => (
            <button
              key={s}
              onClick={() => setActiveSeason(s)}
              className="font-mono text-xs px-3 py-1.5 rounded-full flex-shrink-0 cursor-pointer"
              style={{
                background: activeSeason === s ? "var(--purple)" : "transparent",
                color: activeSeason === s ? "#fff" : "var(--muted)",
                border: activeSeason === s ? "none" : "1px solid var(--line)",
              }}
            >
              {seasonLabel(s)} {i === 0 ? "· actual" : ""}
            </button>
          ))}
        </div>

        {isCurrentSeasonTab && !ratingsOpen && (
          <p className="text-sm px-1" style={{ color: "var(--muted)" }}>
            Aún no se ha jugado ningún partido de Real Madrid en la temporada {activeSeason != null ? seasonLabel(activeSeason) : ""}.
            {nextMatch ? (
              <> El recuadro para calificar aparece aquí mismo apenas termine el próximo partido: <strong>{nextMatch.homeTeam} vs {nextMatch.awayTeam}</strong>, {new Date(nextMatch.kickoffUtc).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}.</>
            ) : (
              " En cuanto se juegue el primero, podrás calificarlo aquí."
            )}
          </p>
        )}

        {/* Tabla única: jugador + progreso + IA/Tú + (si aplica) calificar último partido */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <div className="px-4 py-3 flex items-baseline justify-between flex-wrap gap-2" style={{ borderBottom: "1px solid var(--line)" }}>
            <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              {activeSeason != null ? `Temporada ${seasonLabel(activeSeason)}` : ""} · {seasonMatches.length} partidos con alineación
            </span>
            {ratingsOpen && lastMatch && (
              <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                Calificando último partido: {lastMatch.homeTeam} {lastMatch.homeGoals}–{lastMatch.awayGoals} {lastMatch.awayTeam}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th className="text-left px-4 py-2 font-mono" style={{ color: "var(--muted)" }}>Jugador</th>
                  <th className="text-left px-4 py-2 font-mono" style={{ color: "var(--muted)" }}>Progreso</th>
                  <th className="text-right px-4 py-2 font-mono" style={{ color: "var(--muted)" }}>IA</th>
                  <th className="text-right px-4 py-2 font-mono" style={{ color: "var(--muted)" }}>Tú</th>
                  {ratingsOpen && (
                    <th className="text-right px-4 py-2 font-mono" style={{ color: "var(--muted)" }}>Calificar último</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {playerSummaries.map((row) => {
                  const canRateHere = ratingsOpen && lastMatchPlayerMap.has(row.pid);
                  return (
                    <Fragment key={row.pid}>
                      <tr style={{ borderBottom: "1px solid var(--line)" }}>
                        <td
                          className="px-4 py-2 whitespace-nowrap cursor-pointer"
                          onClick={() => setExpandedPlayer(expandedPlayer === row.pid ? null : row.pid)}
                        >
                          {row.name}
                        </td>
                        <td className="px-4 py-2 cursor-pointer" onClick={() => setExpandedPlayer(expandedPlayer === row.pid ? null : row.pid)}>
                          <Sparkline values={row.aiSeries} color="var(--purple)" />
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{row.aiAvg != null ? row.aiAvg.toFixed(1) : "—"}</td>
                        <td className="px-4 py-2 text-right font-mono">{row.userAvg != null ? row.userAvg.toFixed(1) : "—"}</td>
                        {ratingsOpen && (
                          <td className="px-4 py-2">
                            {canRateHere ? (
                              <div className="flex items-center gap-2 justify-end">
                                <input
                                  type="text"
                                  value={reviewDrafts[row.pid] ?? ""}
                                  onChange={(e) => setReviewDrafts((d) => ({ ...d, [row.pid]: e.target.value }))}
                                  placeholder="Reseña breve (opcional)"
                                  maxLength={200}
                                  className="w-40 rounded-md border px-2 py-1 text-xs outline-none"
                                  style={{ borderColor: "var(--line)" }}
                                />
                                <input
                                  type="number" min={0} max={10} step={0.5}
                                  value={drafts[row.pid] ?? ""}
                                  onChange={(e) => setDrafts((d) => ({ ...d, [row.pid]: e.target.value }))}
                                  placeholder="—"
                                  className="w-16 rounded-md border px-2 py-1 text-sm text-center outline-none"
                                  style={{ borderColor: "var(--line)" }}
                                />
                                <button
                                  onClick={() => saveRating(row.pid)}
                                  className="font-mono text-[10px] px-3 py-1.5 rounded-md font-bold whitespace-nowrap"
                                  style={{ background: saved.has(row.pid) ? "var(--good)" : "var(--gold)", color: saved.has(row.pid) ? "#fff" : "#1a1a24" }}
                                >
                                  {saved.has(row.pid) ? "GUARDADO" : "GUARDAR"}
                                </button>
                              </div>
                            ) : (
                              <span className="block text-right" style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                      {expandedPlayer === row.pid && (
                        <tr>
                          <td colSpan={ratingsOpen ? 5 : 4} className="px-4 pb-5">
                            <BigChart matches={seasonMatches} rows={seasonRatings} playerId={row.pid} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {playerSummaries.length === 0 && (
            <p className="text-sm p-4" style={{ color: "var(--muted)" }}>
              Sin calificaciones registradas en esta temporada todavía.
            </p>
          )}
        </div>
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Toca un jugador para ver su gráfica de progreso completa de la temporada, a todo el ancho. Morado = calificación IA
          por partido (dato real de rendimiento) · Dorado = la tuya. El promedio de la columna IA es sobre el total de
          partidos de la temporada, no solo los que jugó — los partidos que no jugó cuentan con nota 5.
        </p>

        {discrepancies.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Donde más discrepas con la IA — material para el podcast
              </span>
            </div>
            <div className="flex flex-col">
              {discrepancies.map((d) => (
                <div key={d.pid} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span className="text-sm flex-1">{d.name}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--purple)" }}>IA {d.aiAvg!.toFixed(1)}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--gold)" }}>Tú {d.userAvg!.toFixed(1)}</span>
                  <span
                    className="font-mono text-[11px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: d.userAvg! > d.aiAvg! ? "var(--good)" : "var(--bad)", color: "#fff" }}
                  >
                    {d.userAvg! > d.aiAvg! ? "+" : ""}{(d.userAvg! - d.aiAvg!).toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
