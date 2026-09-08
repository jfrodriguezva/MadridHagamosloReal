"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";
const REAL_MADRID_ID = 541;
const SIZE = 1080;
const PURPLE = "#2b2350", GOLD = "#a8791a", INK = "#1a1a24", CREAM = "#f7f6f2";

type MatchDetail = {
  match: { homeTeam: string; awayTeam: string; homeTeamId: number; homeGoals: number; awayGoals: number; competitionType: string };
  events: { teamId: number; minute: number; playerName: string; eventType: string }[];
};
type MvpResponse = { mvp: { name: string; aiRating: number } | null; worst: { name: string; aiRating: number } | null };

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, align: CanvasTextAlign = "center") {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.textAlign = align;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length;
}

// Una sola tarjeta cuadrada (1080x1080, apta como miniatura o post) con marcador,
// goleadores y MVP -- todo lo que AutoVideoGenerator reparte en varias escenas de
// video, aquí condensado en una sola imagen estática para exportar con un clic.
function drawInfographic(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  data: { homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; competition: string; scorers: string[]; mvpName: string | null; mvpRating: number | null }
) {
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, PURPLE);
  g.addColorStop(1, INK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, SIZE - 16, SIZE, 16);

  ctx.textAlign = "center";
  if (logo) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logo, SIZE / 2 - 30, 46, 60, 60);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 24px "JetBrains Mono", monospace`;
  ctx.fillText(data.competition, SIZE / 2, 140);

  ctx.font = `800 60px "Big Shoulders Display", sans-serif`;
  ctx.fillStyle = "#fff";
  wrapText(ctx, data.homeTeam.toUpperCase(), SIZE / 2, 220, SIZE * 0.42, 60);

  ctx.font = `800 130px "Big Shoulders Display", sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(`${data.homeGoals} – ${data.awayGoals}`, SIZE / 2, 320);

  ctx.font = `800 60px "Big Shoulders Display", sans-serif`;
  ctx.fillStyle = "#fff";
  wrapText(ctx, data.awayTeam.toUpperCase(), SIZE / 2, 400, SIZE * 0.42, 60);

  // Panel inferior tipo tarjeta, con goles y MVP lado a lado -- separa lo cuantitativo
  // (quién anotó) de lo cualitativo (quién rindió mejor), como en un box score real.
  const panelY = 470;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.roundRect(60, panelY, SIZE - 120, SIZE - panelY - 70, 20);
  ctx.fill();

  const colX = [SIZE * 0.28, SIZE * 0.72];
  ctx.font = `700 26px "JetBrains Mono", monospace`;
  ctx.fillStyle = GOLD;
  ctx.fillText("GOLES", colX[0], panelY + 56);
  ctx.fillText("FIGURA DEL PARTIDO", colX[1], panelY + 56);

  ctx.font = `600 30px "Source Sans 3", sans-serif`;
  ctx.fillStyle = "#fff";
  if (data.scorers.length > 0) {
    data.scorers.slice(0, 5).forEach((s, i) => wrapText(ctx, s, colX[0], panelY + 110 + i * 46, SIZE * 0.36, 40));
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Sin goles registrados", colX[0], panelY + 110);
  }

  if (data.mvpName) {
    ctx.font = `700 34px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = "#fff";
    wrapText(ctx, data.mvpName, colX[1], panelY + 110, SIZE * 0.36, 38);
    ctx.font = `800 56px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText((data.mvpRating ?? 0).toFixed(1), colX[1], panelY + 190);
  } else {
    ctx.font = `600 28px "Source Sans 3", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Sin calificaciones aún", colX[1], panelY + 110);
  }

  ctx.font = `600 20px "JetBrains Mono", monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("MADRID HAGÁMOSLO REAL", SIZE / 2, SIZE - 40);
}

export default function AutoInfographic({ fixtureId }: { fixtureId: number | null }) {
  const [generating, setGenerating] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  async function handleGenerate() {
    if (!fixtureId) return;
    setGenerating(true);
    setLog("Buscando los datos reales del partido…");
    try {
      const [detail, mvpRes]: [MatchDetail, MvpResponse] = await Promise.all([
        fetch(`${API}/api/matches/${fixtureId}/detail`).then((r) => r.json()),
        fetch(`${API}/api/matches/${fixtureId}/mvp`).then((r) => r.json()),
      ]);
      const { match } = detail;
      const scorers = detail.events
        .filter((e) => e.eventType === "Goal" && e.teamId === REAL_MADRID_ID)
        .map((e) => `${e.playerName} ${e.minute}'`);

      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;

      let logo: HTMLImageElement | null = null;
      try {
        logo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("logo"));
          img.src = "/logos/monogram-gold.png";
        });
      } catch {
        logo = null;
      }

      setLog("Dibujando la infografía…");
      drawInfographic(ctx, logo, {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        competition: match.competitionType === "UCL" ? "CHAMPIONS LEAGUE" : "LALIGA",
        scorers,
        mvpName: mvpRes.mvp?.name ?? null,
        mvpRating: mvpRes.mvp?.aiRating ?? null,
      });

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `madrid-hagamoslo-real-infografia-${Date.now()}.png`;
      a.click();
      fetch(`${API}/api/media/log`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "image", fileName: a.download, fixtureId }),
      }).catch(() => {});
      setLog("Listo — infografía generada con los datos reales del partido.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "error desconocido";
      setLog(`No se pudo generar la infografía: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleGenerate}
        disabled={generating || !fixtureId}
        className="font-mono text-xs px-4 py-2.5 rounded-md font-bold"
        style={{ background: CREAM, color: INK, border: `1px solid var(--line)` }}
      >
        {generating ? "GENERANDO…" : "📊 GENERAR INFOGRAFÍA AUTOMÁTICA"}
      </button>
      {log && <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{log}</p>}
      {!log && !generating && (
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          Marcador, goles y figura del partido en una sola imagen — sin editar nada a mano.
        </p>
      )}
    </div>
  );
}
