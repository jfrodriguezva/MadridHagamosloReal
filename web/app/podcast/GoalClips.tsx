"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";
const W = 1080, H = 1920;
const REAL_MADRID_ID = 541;
const PURPLE = "#2b2350", GOLD = "#a8791a", INK = "#1a1a24";

type Goal = { playerName: string; minute: number; extraMinute: number | null };
type MatchDetail = {
  match: { homeTeam: string; awayTeam: string; homeTeamId: number; homeGoals: number; awayGoals: number; competitionType: string };
  events: { teamId: number; minute: number; extraMinute: number | null; playerName: string; eventType: string }[];
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
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
  ctx.textAlign = "center";
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

// Una sola escena por gol -- "⚽ GOL" + jugador + minuto -- pensada como teaser vertical
// para Reels/Shorts/TikTok, no como resumen completo (eso ya lo cubre AutoVideoGenerator).
function drawGoalCard(ctx: CanvasRenderingContext2D, goal: Goal, opponent: string, scoreLine: string) {
  const g = ctx.createLinearGradient(0, 0, W * 0.65, H);
  g.addColorStop(0, PURPLE);
  g.addColorStop(1, INK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const vign = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.75);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - 14, W, 14);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 26px "JetBrains Mono", monospace`;
  ctx.fillText(`vs ${opponent.toUpperCase()}`, W / 2, 150);

  ctx.font = `800 110px "Big Shoulders Display", sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText("⚽ GOL", W / 2, H * 0.36);

  ctx.font = `800 80px "Big Shoulders Display", sans-serif`;
  ctx.fillStyle = "#fff";
  wrapText(ctx, goal.playerName, W / 2, H * 0.48, W * 0.82, 88);

  ctx.font = `700 56px "JetBrains Mono", monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const minuteLabel = goal.extraMinute ? `${goal.minute}+${goal.extraMinute}'` : `${goal.minute}'`;
  ctx.fillText(minuteLabel, W / 2, H * 0.58);

  ctx.font = `600 34px "JetBrains Mono", monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(scoreLine, W / 2, H * 0.68);

  ctx.font = `600 22px "JetBrains Mono", monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("MADRID HAGÁMOSLO REAL", W / 2, H - 40);
}

export default function GoalClips({ fixtureId }: { fixtureId: number | null }) {
  const [generating, setGenerating] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [goalCount, setGoalCount] = useState(0);
  const [done, setDone] = useState(0);

  async function handleGenerate() {
    if (!fixtureId) return;
    setGenerating(true);
    setDone(0);
    setLog("Buscando los goles del partido…");
    try {
      const detail: MatchDetail = await fetch(`${API}/api/matches/${fixtureId}/detail`).then((r) => r.json());
      const { match } = detail;
      const opponent = match.homeTeamId === REAL_MADRID_ID ? match.awayTeam : match.homeTeam;
      const scoreLine = `${match.homeTeam} ${match.homeGoals}–${match.awayGoals} ${match.awayTeam}`;
      const goals = detail.events.filter((e) => e.eventType === "Goal" && e.teamId === REAL_MADRID_ID);

      if (goals.length === 0) {
        setLog("El Real Madrid no anotó en este partido — no hay clips que generar.");
        return;
      }
      setGoalCount(goals.length);

      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
      });

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      for (let i = 0; i < goals.length; i++) {
        setLog(`Generando clip ${i + 1} de ${goals.length} — ${goals[i].playerName}…`);
        drawGoalCard(ctx, goals[i], opponent, scoreLine);
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await ffmpeg.writeFile("card.png", bytes);
        const code = await ffmpeg.exec([
          "-loop", "1", "-t", "3.5", "-r", "30", "-i", "card.png",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
          `clip${i}.mp4`,
        ]);
        if (code !== 0) throw new Error(`No se pudo generar el clip de ${goals[i].playerName}`);

        const data = await ffmpeg.readFile(`clip${i}.mp4`);
        const outBytes = data instanceof Uint8Array ? new Uint8Array(data) : data;
        const outBlob = new Blob([outBytes], { type: "video/mp4" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(outBlob);
        a.download = `madrid-gol-${goals[i].playerName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.mp4`;
        a.click();
        fetch(`${API}/api/media/log`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "video", fileName: a.download, fixtureId }),
        }).catch(() => {});
        setDone(i + 1);
        await ffmpeg.deleteFile(`clip${i}.mp4`);
      }

      setLog(`Listo — ${goals.length} clip(s) descargado(s), uno por gol.`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "error desconocido";
      setLog(`No se pudieron generar los clips: ${msg}`);
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
        style={{ background: "var(--gold)", color: "#1a1a24" }}
      >
        {generating ? `GENERANDO CLIP ${done + 1}/${goalCount || "?"}…` : "🎬 GENERAR CLIPS POR GOL"}
      </button>
      {log && <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{log}</p>}
      {!log && !generating && (
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          Un video corto (vertical, ~3.5s) por cada gol del Real Madrid — listo para Reels/Shorts/TikTok, todo local.
        </p>
      )}
    </div>
  );
}
