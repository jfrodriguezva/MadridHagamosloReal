"use client";

import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";

import { API } from "../lib/api";

type Player = {
  playerId: number;
  name: string;
  position: string;
  age: number;
  nationality: string;
  photoUrl: string;
  shirtNumber: number | null;
  overall: number;
  potential: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
};

type Coach = {
  coach: { name: string; nationality: string; photoUrl: string; startDate: string; endDate: string | null };
  stats: { played: number; wins: number | null; draws: number | null };
  preferredFormation: { formation: string; matches: number } | null;
  career: { teamName: string; startDate: string; endDate: string | null }[];
};

const POS_LABEL: Record<string, string> = {
  Goalkeeper: "POR",
  Defender: "DEF",
  Midfielder: "MED",
  Attacker: "DEL",
};

const POS_FILTERS = [
  { key: "ALL", label: "TODOS" },
  { key: "Goalkeeper", label: "POR" },
  { key: "Defender", label: "DEF" },
  { key: "Midfielder", label: "MED" },
  { key: "Attacker", label: "DEL" },
];

function Radar({ p }: { p: Player }) {
  const attrs = [
    { k: "PACE", v: p.pace },
    { k: "SHO", v: p.shooting },
    { k: "PAS", v: p.passing },
    { k: "DRI", v: p.dribbling },
    { k: "DEF", v: p.defending },
    { k: "PHY", v: p.physical },
  ];
  const cx = 120, cy = 108, maxR = 62;
  const angleFor = (i: number) => (-90 + i * 60) * (Math.PI / 180);
  const pt = (i: number, r: number) => [cx + r * Math.cos(angleFor(i)), cy + r * Math.sin(angleFor(i))];
  const outer = attrs.map((_, i) => pt(i, maxR));
  const value = attrs.map((a, i) => pt(i, (a.v / 99) * maxR));
  const toPoints = (arr: number[][]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg width="240" height="216" viewBox="0 0 240 216">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={toPoints(attrs.map((_, i) => pt(i, maxR * f)))} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      <polygon points={toPoints(value)} fill="#a8791a" fillOpacity={0.28} stroke="#a8791a" strokeWidth={2.5} />
      {attrs.map((a, i) => {
        const [lx, ly] = pt(i, maxR + 22);
        const anchor = Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end";
        return (
          <text key={a.k} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontFamily="JetBrains Mono" fontSize={10} fill="#1a1a24">
            {a.k} {a.v}
          </text>
        );
      })}
    </svg>
  );
}

function AttributeBars({ p }: { p: Player }) {
  const attrs = [
    { k: "PACE", v: p.pace },
    { k: "SHOOTING", v: p.shooting },
    { k: "PASSING", v: p.passing },
    { k: "DRIBBLING", v: p.dribbling },
    { k: "DEFENDING", v: p.defending },
    { k: "PHYSICAL", v: p.physical },
  ];
  const colorFor = (v: number) => (v >= 80 ? "var(--good)" : v >= 60 ? "var(--gold)" : v >= 40 ? "var(--muted)" : "var(--bad)");
  return (
    <div className="flex flex-col gap-2.5">
      {attrs.map((a) => (
        <div key={a.k}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-mono" style={{ color: "var(--muted)" }}>{a.k}</span>
            <span className="font-mono font-bold">{a.v}</span>
          </div>
          <div className="h-2 rounded" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded" style={{ width: `${a.v}%`, background: colorFor(a.v) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type ProgressPoint = { fixtureId: number; kickoffUtc: string; opponent: string; aiRating: number | null; userRating: number | null };

function ProgressChart({ points }: { points: ProgressPoint[] }) {
  if (points.length === 0) return <p className="text-xs" style={{ color: "var(--muted)" }}>Sin historial de calificación todavía para este jugador.</p>;
  const w = 520, h = 170, padL = 30, padR = 12, padT = 10, padB = 34;
  const xStep = points.length > 1 ? (w - padL - padR) / (points.length - 1) : 0;
  const yFor = (v: number) => h - padB - ((v / 10) * (h - padT - padB));
  const linePoints = (key: "aiRating" | "userRating") =>
    points.map((p, i) => (p[key] != null ? `${padL + i * xStep},${yFor(p[key]!)}` : null)).filter(Boolean).join(" ");

  const aiVals = points.map((p) => p.aiRating).filter((v): v is number => v != null);
  const userVals = points.map((p) => p.userRating).filter((v): v is number => v != null);
  const aiFinal = aiVals.length ? (aiVals.reduce((a, b) => a + b, 0) / aiVals.length).toFixed(1) : "—";
  const userFinal = userVals.length ? (userVals.reduce((a, b) => a + b, 0) / userVals.length).toFixed(1) : "—";

  return (
    <div>
      <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
        Calificación (0-10) en cada uno de los últimos {points.length} partidos jugados — morado es la calificación
        real de rendimiento (dato de API-Football), dorado es la tuya cuando la agregaste en /calificaciones.
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={padL - 6} y={yFor(v) + 3} textAnchor="end" fontFamily="JetBrains Mono" fontSize={9} fill="#6a6879">{v}</text>
          </g>
        ))}
        <polyline points={linePoints("aiRating")} fill="none" stroke="var(--purple)" strokeWidth={2} />
        <polyline points={linePoints("userRating")} fill="none" stroke="var(--gold)" strokeWidth={2} />
        {points.map((p, i) => (
          <g key={p.fixtureId}>
            {p.aiRating != null && <circle cx={padL + i * xStep} cy={yFor(p.aiRating)} r={2.5} fill="var(--purple)" />}
            {p.userRating != null && <circle cx={padL + i * xStep} cy={yFor(p.userRating)} r={2.5} fill="var(--gold)" />}
            <text
              x={padL + i * xStep} y={h - padB + 14} textAnchor="middle"
              fontFamily="JetBrains Mono" fontSize={8} fill="#6a6879"
              transform={`rotate(-35 ${padL + i * xStep} ${h - padB + 14})`}
            >
              {p.opponent.length > 10 ? p.opponent.slice(0, 9) + "…" : p.opponent}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-6 mt-1">
        <span className="font-mono text-[11px]" style={{ color: "var(--purple)" }}>Promedio IA: {aiFinal}</span>
        <span className="font-mono text-[11px]" style={{ color: "var(--gold)" }}>Tu promedio: {userFinal}</span>
      </div>
    </div>
  );
}

export default function JugadoresPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showProgress, setShowProgress] = useState(true);
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/players`).then((r) => r.json()).then(setPlayers).catch(() => setPlayers([]));
    fetch(`${API}/api/coach/current`).then((r) => (r.ok ? r.json() : null)).then(setCoach).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (posFilter !== "ALL" && p.position !== posFilter) return false;
      if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [players, posFilter, query]);

  // el jugador destacado queda FIJO -- solo cambia si tú lo eliges en la lista
  const featured = selectedId != null ? filtered.find((p) => p.playerId === selectedId) ?? filtered[0] : filtered[0];

  useEffect(() => {
    setProgress([]);
    if (featured?.playerId) loadProgress(featured.playerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.playerId]);

  function loadProgress(playerId: number) {
    setProgressLoading(true);
    fetch(`${API}/api/ratings/season-progress/${playerId}`)
      .then((r) => r.json())
      .then(setProgress)
      .finally(() => setProgressLoading(false));
  }

  const winPct = coach?.stats?.played ? Math.round(((coach.stats.wins ?? 0) / coach.stats.played) * 100) : null;
  const losses = coach?.stats?.played
    ? coach.stats.played - (coach.stats.wins ?? 0) - (coach.stats.draws ?? 0)
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <NavBar active="/jugadores" />

      <div className="max-w-6xl mx-auto px-8 py-8 flex gap-6 items-start">
        {/* LIST */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugador…"
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          />
          <div className="flex flex-wrap gap-1.5">
            {POS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setPosFilter(f.key)}
                className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  background: posFilter === f.key ? "var(--purple)" : "transparent",
                  color: posFilter === f.key ? "#fff" : "var(--muted)",
                  border: posFilter === f.key ? "none" : "1px solid var(--line)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            {filtered.length} jugadores
          </span>
          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {filtered.map((p) => {
              const isActive = featured?.playerId === p.playerId;
              return (
                <div
                  key={p.playerId}
                  onClick={() => setSelectedId(p.playerId)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
                  style={{ background: isActive ? "var(--gold-soft)" : "transparent" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.photoUrl}
                    alt={p.name}
                    className="w-7 h-7 rounded-full flex-shrink-0 object-cover"
                    style={{ background: "var(--surface-2)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                      {POS_LABEL[p.position] ?? p.position}
                    </div>
                  </div>
                  <span className="font-display text-lg font-extrabold" style={{ color: "var(--gold)" }}>
                    {p.overall}
                  </span>
                </div>
              );
            })}
            {filtered.length === 0 && players.length > 0 && (
              <p className="text-sm px-3" style={{ color: "var(--muted)" }}>
                Sin resultados para “{query}”.
              </p>
            )}
          </div>
        </div>

        {/* DETAIL */}
        {featured && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Tarjeta única: foto + identidad + atributos, todo junto */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
              <div className="flex gap-6 p-5">
                <div
                  className="w-52 flex-shrink-0 rounded-xl overflow-hidden text-white flex flex-col"
                  style={{ background: "linear-gradient(160deg,#2b2350 0%,#1a1530 100%)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured.photoUrl}
                    alt={featured.name}
                    className="w-full h-48 object-cover object-top"
                    style={{ background: "rgba(255,255,255,.06)" }}
                  />
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-4xl font-extrabold" style={{ color: "#d9b95c" }}>
                        {featured.overall}
                      </span>
                      <span className="font-mono text-[11px]">{POS_LABEL[featured.position] ?? featured.position}</span>
                    </div>
                    <div className="font-display text-lg font-bold mt-1 leading-tight">{featured.name}</div>
                    <div className="text-[11px] text-[#c9c5df] mt-1">
                      {featured.age} años · {featured.nationality}
                    </div>
                    <div className="text-[11px] text-[#c9c5df]">Potencial {featured.potential}</div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Atributos (0-100) — calculado desde estadísticas reales de temporada
                  </span>
                  <div className="flex gap-6 mt-4 items-center">
                    <Radar p={featured} />
                    <div className="flex-1">
                      <AttributeBars p={featured} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Progreso · últimos 10 partidos
                  </span>
                  <button
                    onClick={() => {
                      if (showProgress) {
                        setShowProgress(false);
                      } else {
                        setShowProgress(true);
                        loadProgress(featured.playerId);
                      }
                    }}
                    className="font-mono text-[10px] px-2.5 py-1 rounded-full"
                    style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
                  >
                    {showProgress ? "OCULTAR" : "VER PROGRESO"}
                  </button>
                </div>
                {showProgress ? (
                  progressLoading ? (
                    <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Cargando…</p>
                  ) : (
                    <div className="mt-3">
                      <ProgressChart points={progress} />
                    </div>
                  )
                ) : (
                  <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                    Califica jugadores en /calificaciones después de cada partido — aquí verás cómo evoluciona.
                  </p>
                )}
              </div>

              {coach && (
                <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Cuerpo técnico
                  </span>
                  <div className="flex items-center gap-4 mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coach.coach.photoUrl}
                      alt={coach.coach.name}
                      className="w-14 h-14 rounded-full flex-shrink-0 object-cover"
                      style={{ background: "var(--purple-soft)" }}
                    />
                    <div className="flex-1">
                      <div className="font-display text-lg font-bold">{coach.coach.name}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {coach.coach.nationality} · desde{" "}
                        {new Date(coach.coach.startDate).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                      </div>
                    </div>
                    {winPct != null && coach.stats.played > 0 ? (
                      <div className="text-right">
                        <div className="font-display text-2xl font-extrabold" style={{ color: "var(--gold)" }}>
                          {winPct}%
                        </div>
                        <div className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                          {coach.stats.played} PJ
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] px-2 py-1 rounded" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                        SIN PARTIDOS AÚN
                      </span>
                    )}
                  </div>
                  {coach.stats.played > 0 && (
                    <div className="font-mono text-xs mt-3" style={{ color: "var(--muted)" }}>
                      {coach.stats.wins}V — {coach.stats.draws}E — {losses}D en esta etapa
                    </div>
                  )}
                  {coach.preferredFormation && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>FORMACIÓN PREFERIDA</span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
                        {coach.preferredFormation.formation}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                        ({coach.preferredFormation.matches} partidos)
                      </span>
                    </div>
                  )}
                  {coach.career?.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                      <span className="font-mono text-[10px] uppercase" style={{ color: "var(--muted)" }}>Trayectoria</span>
                      <div className="flex flex-col gap-1 mt-1.5 max-h-32 overflow-y-auto">
                        {coach.career.map((c, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span>{c.teamName}</span>
                            <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                              {new Date(c.startDate).getFullYear()}–{c.endDate ? new Date(c.endDate).getFullYear() : "presente"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {players.length === 0 && (
          <p style={{ color: "var(--muted)" }}>Cargando plantilla…</p>
        )}
      </div>
    </div>
  );
}
