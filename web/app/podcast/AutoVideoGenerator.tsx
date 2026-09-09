"use client";

import { useState } from "react";

import { API } from "../lib/api";
const W = 1080, H = 1920;

const PURPLE = "#2b2350", GOLD = "#a8791a", INK = "#1a1a24";

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, align: CanvasTextAlign) {
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

function baseCard(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, cardIndex: number, cardTotal: number) {
  const g = ctx.createLinearGradient(0, 0, W * 0.65, H);
  g.addColorStop(0, PURPLE);
  g.addColorStop(1, INK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // viñeta sutil para que no se vea plano
  const vign = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.75);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - 14, W, 14);

  // puntos de progreso, estilo historia
  const dotW = (W - 128) / cardTotal - 8;
  for (let i = 0; i < cardTotal; i++) {
    ctx.fillStyle = i <= cardIndex ? GOLD : "rgba(255,255,255,0.25)";
    const x = 64 + i * (dotW + 8);
    ctx.fillRect(x, 44, dotW, 5);
  }

  if (logo) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logo, W / 2 - 26, 66, 52, 52);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 24px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("MADRID HAGÁMOSLO REAL", W / 2, 148);
}

type Card =
  | { kind: "title"; title: string; opponent: string; score: string }
  | { kind: "score"; homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; competition: string }
  | { kind: "scorers"; scorers: string[] }
  | { kind: "mvp"; name: string; rating: number }
  | { kind: "talking"; point: string; index: number; total: number }
  | { kind: "outro"; hashtags: string[] };

function drawCard(ctx: CanvasRenderingContext2D, card: Card, logo: HTMLImageElement | null, cardIndex: number, cardTotal: number) {
  baseCard(ctx, logo, cardIndex, cardTotal);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  if (card.kind === "title") {
    ctx.font = `600 32px "JetBrains Mono", monospace`;
    ctx.fillStyle = GOLD;
    ctx.fillText(card.score, W / 2, H * 0.38);
    ctx.fillStyle = "#fff";
    ctx.font = `800 76px "Big Shoulders Display", sans-serif`;
    wrapText(ctx, card.title, W / 2, H * 0.48, W * 0.82, 88, "center");
  } else if (card.kind === "score") {
    ctx.font = `600 30px "JetBrains Mono", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(card.competition, W / 2, H * 0.32);
    ctx.font = `800 64px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = "#fff";
    wrapText(ctx, card.homeTeam.toUpperCase(), W / 2, H * 0.42, W * 0.85, 68, "center");
    ctx.font = `800 150px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText(`${card.homeGoals} – ${card.awayGoals}`, W / 2, H * 0.56);
    ctx.font = `800 64px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = "#fff";
    wrapText(ctx, card.awayTeam.toUpperCase(), W / 2, H * 0.64, W * 0.85, 68, "center");
  } else if (card.kind === "scorers") {
    ctx.font = `700 40px "JetBrains Mono", monospace`;
    ctx.fillStyle = GOLD;
    ctx.fillText("GOLES", W / 2, H * 0.32);
    ctx.font = `700 52px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = "#fff";
    card.scorers.forEach((s, i) => wrapText(ctx, s, W / 2, H * 0.42 + i * 90, W * 0.82, 56, "center"));
  } else if (card.kind === "mvp") {
    ctx.font = `700 40px "JetBrains Mono", monospace`;
    ctx.fillStyle = GOLD;
    ctx.fillText("FIGURA DEL PARTIDO", W / 2, H * 0.36);
    ctx.font = `800 84px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = "#fff";
    wrapText(ctx, card.name, W / 2, H * 0.46, W * 0.85, 90, "center");
    ctx.font = `800 130px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText(card.rating.toFixed(1), W / 2, H * 0.58);
  } else if (card.kind === "talking") {
    ctx.font = `600 28px "JetBrains Mono", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`${card.index}/${card.total}`, W / 2, H * 0.3);
    ctx.font = `700 54px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = "#fff";
    wrapText(ctx, card.point, W / 2, H * 0.42, W * 0.82, 64, "center");
  } else if (card.kind === "outro") {
    ctx.font = `800 80px "Big Shoulders Display", sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText("HALA MADRID", W / 2, H * 0.44);
    ctx.font = `600 34px "JetBrains Mono", monospace`;
    ctx.fillStyle = "#fff";
    wrapText(ctx, card.hashtags.join("  "), W / 2, H * 0.54, W * 0.85, 44, "center");
  }
}

export default function AutoVideoGenerator({
  fixtureId, title, talkingPoints, hashtags,
}: { fixtureId: number | null; title: string; talkingPoints: string[]; hashtags: string[] }) {
  const [generating, setGenerating] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function handleGenerate() {
    if (!fixtureId) return;
    setGenerating(true);
    setProgress(0);
    setLog("Buscando los datos reales del partido…");
    try {
      const [detailRes, mvpRes] = await Promise.all([
        fetch(`${API}/api/matches/${fixtureId}/detail`).then((r) => r.json()),
        fetch(`${API}/api/matches/${fixtureId}/mvp`).then((r) => r.json()),
      ]);
      const match = detailRes.match;
      const goals = (detailRes.events ?? []).filter((e: { eventType: string }) => e.eventType === "Goal");
      const isHome = match.homeTeamId === 541;
      const rmGoals = isHome ? match.homeGoals : match.awayGoals;
      const oppGoals = isHome ? match.awayGoals : match.homeGoals;

      const cards: Card[] = [
        { kind: "title", title, opponent: isHome ? match.awayTeam : match.homeTeam, score: `${match.homeTeam} ${match.homeGoals}–${match.awayGoals} ${match.awayTeam}` },
        { kind: "score", homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeGoals: match.homeGoals, awayGoals: match.awayGoals, competition: match.competitionType === "UCL" ? "CHAMPIONS LEAGUE" : "LALIGA" },
      ];
      if (goals.length > 0) {
        cards.push({ kind: "scorers", scorers: goals.map((g: { playerName: string; minute: number }) => `${g.playerName} ${g.minute}'`) });
      }
      if (mvpRes.mvp) cards.push({ kind: "mvp", name: mvpRes.mvp.name, rating: mvpRes.mvp.aiRating });
      talkingPoints.slice(0, 3).forEach((p, i) => cards.push({ kind: "talking", point: p, index: i + 1, total: Math.min(3, talkingPoints.length) }));
      cards.push({ kind: "outro", hashtags: hashtags.slice(0, 4) });

      setLog("Dibujando las escenas…");
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
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

      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL, fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: p }) => setProgress(Math.max(0, Math.min(100, Math.round(p * 100)))));
      await ffmpeg.load({
        coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
      });
      await ffmpeg.writeFile("font.ttf", await fetchFile("/fonts/overlay-font.ttf"));

      const durations = cards.map((c) => (c.kind === "title" || c.kind === "outro" ? 3.4 : 2.8));
      const inputs: string[] = [];
      for (let i = 0; i < cards.length; i++) {
        setLog(`Renderizando escena ${i + 1} de ${cards.length}…`);
        drawCard(ctx, cards[i], logo, i, cards.length);
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await ffmpeg.writeFile(`card${i}.png`, bytes);
        inputs.push("-loop", "1", "-t", `${durations[i]}`, "-r", "30", "-i", `card${i}.png`);
      }

      // Transición con crossfade (xfade) entre cada par de escenas en vez de corte seco --
      // se encadenan de a pares acumulando el offset de tiempo real de cada transición.
      setLog("Uniendo las escenas con transición…");
      const T = 0.5;
      let cur = "0:v";
      let cumulative = durations[0];
      const xfadeParts: string[] = [];
      for (let i = 1; i < cards.length; i++) {
        const next = `x${i}`;
        const offset = Math.max(0, cumulative - T);
        xfadeParts.push(`[${cur}][${i}:v]xfade=transition=fade:duration=${T}:offset=${offset.toFixed(2)}[${next}]`);
        cur = next;
        cumulative = cumulative + durations[i] - T;
      }
      const filterComplex = xfadeParts.join(";");
      const code = await ffmpeg.exec([
        ...inputs, "-filter_complex", filterComplex, "-map", `[${cur}]`,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p", "final.mp4",
      ]);
      if (code !== 0) throw new Error("No se pudieron unir las escenas");

      const data = await ffmpeg.readFile("final.mp4");
      const bytes = data instanceof Uint8Array ? new Uint8Array(data) : data;
      const blob = new Blob([bytes], { type: "video/mp4" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `madrid-hagamoslo-real-auto-${Date.now()}.mp4`;
      a.click();
      fetch(`${API}/api/media/log`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "video", fileName: a.download, fixtureId }),
      }).catch(() => {});
      setLog("Listo — video generado automáticamente con los datos reales del partido.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "error desconocido";
      setLog(`No se pudo generar el video: ${msg}`);
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
        style={{ background: "var(--purple)", color: "#fff" }}
      >
        {generating ? `GENERANDO VIDEO… ${progress}%` : "⚡ GENERAR VIDEO AUTOMÁTICO"}
      </button>
      {log && <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{log}</p>}
      {!log && !generating && (
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          Vertical, con transición entre escenas — tarda hasta un minuto en renderizar, todo local.
        </p>
      )}
    </div>
  );
}
