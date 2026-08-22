"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";
const REAL_MADRID_ID = 541;

const COMP_LABEL: Record<string, string> = {
  LEAGUE: "LaLiga",
  UCL: "Champions League",
  FRIENDLY: "Amistoso",
};

type Detail = {
  match: {
    fixtureId: number;
    kickoffUtc: string;
    roundLabel: string;
    competitionType: string;
    homeGoals: number | null;
    awayGoals: number | null;
    homeTeam: string;
    homeTeamId: number;
    awayTeam: string;
    awayTeamId: number;
    leagueName: string;
  };
  lineups: { teamId: number; coachName: string; formation: string }[];
  players: { teamId: number; playerName: string; posCode: string; isStarter: boolean }[];
  events: { teamId: number; minute: number; playerName: string; assistPlayerName: string | null; eventType: string; eventDetail: string }[];
};

export default function MatchDetail({ fixtureId, onClose }: { fixtureId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/matches/${fixtureId}/detail`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [fixtureId]);

  if (loading) {
    return (
      <div className="rounded-xl p-6 border text-sm" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--muted)" }}>
        Cargando detalle del partido…
      </div>
    );
  }
  if (!detail) return null;

  const { match, lineups, players, events } = detail;
  const rmLineup = lineups.find((l) => l.teamId === REAL_MADRID_ID);
  const rmStarters = players.filter((p) => p.teamId === REAL_MADRID_ID && p.isStarter);
  const goals = events.filter((e) => e.eventType === "Goal");

  return (
    <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between">
        <div>
          <span
            className="font-mono text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: match.competitionType === "UCL" ? "var(--purple-soft)" : "var(--gold-soft)",
              color: match.competitionType === "UCL" ? "var(--purple)" : "var(--gold)",
            }}
          >
            {COMP_LABEL[match.competitionType] ?? match.leagueName}
          </span>
          <div className="font-display text-lg font-bold mt-1">
            {match.homeTeam} {match.homeGoals}–{match.awayGoals} {match.awayTeam}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {new Date(match.kickoffUtc).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            {" · "}
            {match.roundLabel}
          </div>
        </div>
        <button onClick={onClose} className="text-sm px-2" style={{ color: "var(--muted)" }}>
          ✕
        </button>
      </div>

      {rmLineup && (
        <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
          DT: <span style={{ color: "var(--text)" }}>{rmLineup.coachName ?? "—"}</span> · Formación:{" "}
          <span style={{ color: "var(--text)" }}>{rmLineup.formation ?? "—"}</span>
        </div>
      )}

      {rmStarters.length > 0 && (
        <div className="mt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            XI titular
          </span>
          <div className="text-sm mt-1 leading-relaxed">
            {rmStarters.map((p) => p.playerName).join(" — ")}
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div className="mt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Goles
          </span>
          <div className="flex flex-col gap-1 mt-1">
            {goals.map((g, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {g.playerName}
                  {g.assistPlayerName && (
                    <span style={{ color: "var(--muted)" }}> (asist. {g.assistPlayerName})</span>
                  )}
                </span>
                <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                  {g.minute}'
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rmStarters.length === 0 && goals.length === 0 && (
        <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
          Sin alineación/eventos descargados todavía para este partido.
        </p>
      )}
    </div>
  );
}
