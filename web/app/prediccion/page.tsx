import NavBar from "../components/NavBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";
const REAL_MADRID_ID = 541;

type FullPrediction = {
  match: {
    fixtureId: number;
    kickoffUtc: string;
    roundLabel: string;
    homeTeam: string;
    homeTeamId: number;
    awayTeam: string;
    awayTeamId: number;
  };
  x12: {
    probHome: number;
    probDraw: number;
    probAway: number;
    bestScoreHome: number;
    bestScoreAway: number;
    bestScoreProb: number;
  } | null;
  btts: { probYes: number } | null;
  over25: { probYes: number } | null;
};

type OddsResponse = {
  match: { fixtureId: number } | null;
  model: { probHome: number; probDraw: number; probAway: number } | null;
  bookmakers: { bookmaker: string; impliedHome: number; impliedDraw: number; impliedAway: number }[];
};

async function getPrediction(): Promise<FullPrediction | null> {
  try {
    const res = await fetch(`${API}/api/predictions/next/full`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as FullPrediction;
  } catch {
    return null;
  }
}

type ScorersResponse = {
  madridExpectedGoals: number;
  scorers: { playerId: number; name: string; goalsThisSeason: number; probability: number }[];
};

type ValueResponse = {
  hasValue: boolean;
  edgePct?: number;
  market?: string;
  modelProbPct?: number;
  marketProbPct?: number;
};

async function getScorers(): Promise<ScorersResponse | null> {
  try {
    const res = await fetch(`${API}/api/predictions/next/scorers`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ScorersResponse;
  } catch {
    return null;
  }
}

async function getValue(): Promise<ValueResponse | null> {
  try {
    const res = await fetch(`${API}/api/predictions/next/value`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ValueResponse;
  } catch {
    return null;
  }
}

async function getOdds(): Promise<OddsResponse | null> {
  try {
    const res = await fetch(`${API}/api/odds/next`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as OddsResponse;
  } catch {
    return null;
  }
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-mono font-semibold">{Math.round(pct * 100)}%</span>
      </div>
      <div className="h-2 rounded" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function confidenceAdvice(prob: number | undefined): { label: string; text: string; tone: "good" | "warn" | "bad" } {
  if (prob == null) return { label: "SIN DATOS", text: "No hay suficiente información para opinar.", tone: "warn" };
  if (prob >= 0.65)
    return {
      label: "CONFIANZA ALTA",
      text: "El modelo y el mercado coinciden en un favorito claro. Aun así, ningún resultado deportivo es seguro — nunca apuestes más de lo que estás dispuesto a perder.",
      tone: "good",
    };
  if (prob >= 0.5)
    return {
      label: "CONFIANZA MODERADA",
      text: "Hay un favorito, pero el margen sobre las otras opciones es estrecho. Es exactamente el escenario donde más dinero se pierde por sobreconfianza.",
      tone: "warn",
    };
  return {
    label: "PARTIDO ABIERTO",
    text: "Ningún resultado tiene una probabilidad dominante — estadísticamente es de los partidos más difíciles de predecir. Si vas a apostar, este es el momento de apostar menos, no más.",
    tone: "bad",
  };
}

export default async function PrediccionPage() {
  const [data, odds, scorers, value] = await Promise.all([getPrediction(), getOdds(), getScorers(), getValue()]);
  const avgBookImpliedAway = odds?.bookmakers?.length
    ? odds.bookmakers.reduce((s, b) => s + b.impliedAway, 0) / odds.bookmakers.length
    : null;
  const topProb = data?.x12 ? Math.max(data.x12.probHome, data.x12.probDraw, data.x12.probAway) : undefined;
  const advice = confidenceAdvice(topProb);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <NavBar active="/prediccion" />

      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-5">
        {!data ? (
          <p style={{ color: "var(--muted)" }}>Sin predicción disponible — no hay próximo partido en la base.</p>
        ) : (
          <>
            <div>
              <span className="font-display text-2xl font-extrabold">Predicción del partido</span>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--muted)" }}>
                {data.match.homeTeam} vs {data.match.awayTeam} · {data.match.roundLabel} ·{" "}
                {new Date(data.match.kickoffUtc).toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </div>
            </div>

            {data.x12 && (
              <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  1X2 / Double Chance
                </span>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center p-3 rounded-lg" style={{ background: "var(--gold-soft)" }}>
                    <div className="font-display text-3xl font-extrabold" style={{ color: "var(--gold)" }}>
                      {Math.round(data.x12.probHome * 100)}%
                    </div>
                    <div className="text-xs mt-1">{data.match.homeTeam}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                    <div className="font-display text-3xl font-extrabold" style={{ color: "var(--muted)" }}>
                      {Math.round(data.x12.probDraw * 100)}%
                    </div>
                    <div className="text-xs mt-1">Empate</div>
                  </div>
                  <div className="text-center p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                    <div className="font-display text-3xl font-extrabold" style={{ color: "var(--bad)" }}>
                      {Math.round(data.x12.probAway * 100)}%
                    </div>
                    <div className="text-xs mt-1">{data.match.awayTeam}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {data.btts && (
                <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Ambos anotan
                  </span>
                  <Bar label="Sí" pct={data.btts.probYes} color="var(--gold)" />
                </div>
              )}
              {data.over25 && (
                <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Over 2.5 goles
                  </span>
                  <Bar label="Over" pct={data.over25.probYes} color="var(--gold)" />
                </div>
              )}
            </div>

            {data.x12 && (
              <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Marcador más probable
                </span>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="font-mono text-2xl font-bold">
                    {data.x12.bestScoreHome}–{data.x12.bestScoreAway}
                  </span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {Math.round(data.x12.bestScoreProb * 100)}% de probabilidad (Poisson doble)
                  </span>
                </div>
              </div>
            )}

            {scorers?.scorers && scorers.scorers.length > 0 && (
              <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Anotador más probable
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                    Madrid: {scorers.madridExpectedGoals} goles esperados
                  </span>
                </div>
                <div className="flex flex-col gap-2 mt-3">
                  {scorers.scorers.map((s, i) => (
                    <div key={s.playerId} className="flex items-center gap-3">
                      <span className="font-mono text-xs w-5" style={{ color: "var(--muted)" }}>{i + 1}</span>
                      <span className="text-sm flex-1">{s.name}</span>
                      <span className="text-[11px]" style={{ color: "var(--muted)" }}>{s.goalsThisSeason} goles temp.</span>
                      <span className="font-mono text-sm font-bold" style={{ color: "var(--gold)" }}>{s.probability}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                  Se reparte el gol esperado del equipo según la participación goleadora real de cada jugador esta
                  temporada (Poisson por jugador).
                </p>
              </div>
            )}

            {value && value.hasValue && (
              <div className="rounded-xl p-4 border flex gap-3" style={{ background: "var(--gold-soft)", borderColor: "var(--line)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" className="flex-shrink-0 mt-0.5">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <div>
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--gold)" }}>
                    Mayor divergencia modelo vs. mercado
                  </div>
                  <p className="text-xs mt-1">
                    En <strong>{value.market}</strong>, nuestro modelo da {value.modelProbPct}% mientras el mercado
                    implica {value.marketProbPct}% — una diferencia de {value.edgePct} puntos. No es una
                    recomendación, es información de dónde discrepamos más del consenso.
                  </p>
                </div>
              </div>
            )}

            {odds?.bookmakers && odds.bookmakers.length > 0 && (
              <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Nuestro modelo vs. mercado de apuestas real
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                    {odds.bookmakers.length} casas
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="text-center p-3 rounded-lg" style={{ background: "var(--gold-soft)" }}>
                    <div className="font-mono text-[10px] uppercase" style={{ color: "var(--gold)" }}>Nuestro modelo</div>
                    <div className="font-display text-2xl font-extrabold" style={{ color: "var(--gold)" }}>
                      {Math.round((data?.x12?.probAway ?? 0) * 100)}%
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                    <div className="font-mono text-[10px] uppercase" style={{ color: "var(--muted)" }}>
                      Consenso de mercado
                    </div>
                    <div className="font-display text-2xl font-extrabold">
                      {avgBookImpliedAway != null ? Math.round(avgBookImpliedAway * 100) : "—"}%
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-3">
                  {odds.bookmakers.map((b) => (
                    <div key={b.bookmaker} className="flex justify-between text-xs">
                      <span style={{ color: "var(--muted)" }}>{b.bookmaker}</span>
                      <span className="font-mono">{Math.round(b.impliedAway * 100)}% Real Madrid</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                  Probabilidad implícita (margen de la casa ya descontado). Que nuestro modelo esté cerca del
                  mercado es una señal de calibración sana, no al revés.
                </p>
              </div>
            )}

            <div
              className="rounded-xl p-4 border flex gap-3"
              style={{
                background: advice.tone === "good" ? "var(--gold-soft)" : advice.tone === "warn" ? "var(--surface-2)" : "#f6e4e6",
                borderColor: "var(--line)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0 mt-0.5">
                <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              <div>
                <div className="font-mono text-[11px] font-bold uppercase tracking-wider">{advice.label}</div>
                <p className="text-xs mt-1" style={{ color: "var(--text)" }}>{advice.text}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
                  Si el juego deja de ser entretenimiento, busca ayuda: línea de juego responsable disponible las 24h.
                </p>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Modelo: Ensemble (XGBoost 20% + Poisson doble 80%), validado walk-forward sobre 380 partidos históricos del
              Real Madrid (67.6% de acierto). Este análisis es informativo, no constituye una recomendación de apuesta.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
