"use client";

import { useState } from "react";
import MatchDetail from "./MatchDetail";
import { teamColor } from "../lib/teamColors";

const REAL_MADRID_ID = 541;

const COMP_LABEL: Record<string, string> = {
  LEAGUE: "Liga",
  UCL: "Champions",
  FRIENDLY: "Amistoso",
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

function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase().replace(".", ""),
    num: d.getDate().toString().padStart(2, "0"),
    time: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
  };
}

function isRMHome(m: { homeTeamId: number }) {
  return m.homeTeamId === REAL_MADRID_ID;
}

function rmProb(m: { probHome: number | null; probDraw: number | null; probAway: number | null; homeTeamId: number }) {
  if (m.probHome == null) return null;
  return isRMHome(m) ? m.probHome! : m.probAway!;
}

export default function CalendarStrip({ past, future }: { past: CalendarMatch[]; future: CalendarMatch[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex justify-between items-baseline mb-3">
        <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Calendario · predicción vs resultado real
        </span>
        <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
          toca un día para ver el detalle
        </span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {past.map((m) => {
          const { day, num } = fmtDate(m.kickoffUtc);
          const rival = isRMHome(m) ? m.awayTeam : m.homeTeam;
          const score = `${m.homeGoals}–${m.awayGoals}`;
          const isSel = selected === m.fixtureId;
          const rc = teamColor(rival);
          return (
            <button
              key={m.fixtureId}
              onClick={() => setSelected(isSel ? null : m.fixtureId)}
              className="flex-shrink-0 w-16 rounded-lg text-center border text-left cursor-pointer overflow-hidden hover:shadow-md transition-shadow"
              style={{
                borderColor: isSel ? "var(--purple)" : "var(--line)",
                borderWidth: isSel ? 2 : 1,
                background: "var(--surface)",
              }}
            >
              <div style={{ height: 4, background: rc }} />
              <div className="p-2">
                <div className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>{day}</div>
                <div className="font-display text-xl font-bold">{num}</div>
                <div className="text-[9px] truncate" style={{ color: "var(--muted)" }}>{rival}</div>
                <span
                  className="inline-block text-[7.5px] font-mono px-1 rounded mt-0.5"
                  style={{ background: m.competitionType === "UCL" ? "var(--purple-soft)" : "var(--surface-2)", color: m.competitionType === "UCL" ? "var(--purple)" : "var(--muted)" }}
                >
                  {m.competitionType === "UCL" ? "UCL" : "LIGA"}
                </span>
                <div
                  className="mt-1 text-[10px] font-bold"
                  style={{ color: m.wasCorrect ? "var(--good)" : m.wasCorrect === false ? "var(--bad)" : "var(--muted)" }}
                >
                  {m.wasCorrect != null ? (m.wasCorrect ? "✓" : "✗") : ""} {score}
                </div>
              </div>
            </button>
          );
        })}
        {future.map((m) => {
          const { day, num, time } = fmtDate(m.kickoffUtc);
          const rival = isRMHome(m) ? m.awayTeam : m.homeTeam;
          const p = rmProb(m);
          const isSel = selected === m.fixtureId;
          const rc = teamColor(rival);
          return (
            <button
              key={m.fixtureId}
              onClick={() => setSelected(isSel ? null : m.fixtureId)}
              className="flex-shrink-0 w-16 rounded-lg text-center text-white text-left cursor-pointer overflow-hidden hover:shadow-md transition-shadow"
              style={{ background: "var(--purple)", outline: isSel ? "2px solid var(--gold)" : "none" }}
            >
              <div style={{ height: 4, background: rc }} />
              <div className="p-2">
                <div className="font-mono text-[10px] text-[#c9c5df]">{day}</div>
                <div className="font-display text-xl font-bold">{num}</div>
                <div className="text-[9px] truncate text-[#c9c5df]">{rival}</div>
                <span
                  className="inline-block text-[7.5px] font-mono px-1 rounded mt-0.5"
                  style={{ background: "rgba(255,255,255,.15)", color: "#d9b95c" }}
                >
                  {m.competitionType === "UCL" ? "UCL" : "LIGA"}
                </span>
                <div className="font-mono text-[8.5px] mt-0.5 text-[#c9c5df]">{time}</div>
                <div className="mt-0.5 text-[10px] font-bold" style={{ color: "#d9b95c" }}>
                  {p != null ? `${Math.round(p * 100)}% pend.` : "—"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected != null && (
        <div className="mt-4">
          <MatchDetail key={selected} fixtureId={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
