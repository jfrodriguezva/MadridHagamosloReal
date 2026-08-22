"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NavBar from "../components/NavBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";
const MAX_STARTERS = 11;

type Player = {
  playerId: number;
  name: string;
  position: string;
  overall: number;
  photoUrl: string;
};

type Placed = { player: Player; x: number; y: number };

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

const NATURAL_BAND: Record<string, [number, number]> = {
  // banda "y" (0=arriba/ataque, 100=abajo/portería) donde un jugador de esa
  // posición se considera "en su rol natural" -- fuera de ese rango, penaliza
  Goalkeeper: [85, 100],
  Defender: [60, 85],
  Midfielder: [35, 65],
  Attacker: [0, 35],
};

function detectFormation(placed: Placed[]): string {
  const outfield = placed.filter((p) => p.player.position !== "Goalkeeper");
  if (outfield.length === 0) return "—";
  const ys = outfield.map((p) => p.y).sort((a, b) => b - a); // de defensa (y alto) a ataque (y bajo)
  const bands: number[][] = [[ys[0]]];
  for (let i = 1; i < ys.length; i++) {
    const gap = bands[bands.length - 1][bands[bands.length - 1].length - 1] - ys[i];
    if (gap > 9) bands.push([ys[i]]);
    else bands[bands.length - 1].push(ys[i]);
  }
  return bands.map((b) => b.length).join("-");
}

function efficiencyPenalty(player: Player, y: number): number {
  const band = NATURAL_BAND[player.position];
  if (!band) return 0;
  if (y >= band[0] && y <= band[1]) return 0;
  const dist = y < band[0] ? band[0] - y : y - band[1];
  return Math.min(30, Math.round(dist * 1.1));
}

export default function TacticaPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [fixtureId, setFixtureId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [draggingBenchId, setDraggingBenchId] = useState<number | null>(null);
  const [draggingPlacedId, setDraggingPlacedId] = useState<number | null>(null);
  const isDragActive = draggingBenchId != null || draggingPlacedId != null;
  const fieldRef = useRef<HTMLDivElement>(null);
  const [departed, setDeparted] = useState<{ playerId: number; playerName: string }[]>([]);
  const [nextMatchInfo, setNextMatchInfo] = useState<{ homeTeam: string; awayTeam: string; homeTeamId: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/api/players`).then((r) => r.json()).then(setPlayers).catch(() => setPlayers([]));
    fetch(`${API}/api/lineups/departed-since-last`).then((r) => r.json()).then(setDeparted).catch(() => {});
    fetch(`${API}/api/dashboard/next-match`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNextMatchInfo(d))
      .catch(() => {});

    fetch(`${API}/api/lineups/next`)
      .then((r) => r.json())
      .then(async (data) => {
        setFixtureId(data.fixtureId);
        // TODO: si en el futuro guardamos x/y reales, cargar aquí. Por ahora
        // arranca vacío y el usuario arma libremente, o carga el último XI.
      })
      .catch(() => {});
  }, []);

  const nextRival = nextMatchInfo ? (nextMatchInfo.homeTeamId === 541 ? nextMatchInfo.awayTeam : nextMatchInfo.homeTeam) : null;

  async function loadLastLineup() {
    const last = await fetch(`${API}/api/lineups/last-played`).then((r) => r.json());
    if (!last.slots?.length || players.length === 0) return;
    const rows: Record<string, number> = { G: 92, D: 72, M: 48, F: 15 };
    const perPos: Record<string, number> = { G: 0, D: 0, M: 0, F: 0 };
    const counts: Record<string, number> = { G: 0, D: 0, M: 0, F: 0 };
    for (const s of last.slots) counts[s.posCode] = (counts[s.posCode] ?? 0) + 1;
    const next: Placed[] = [];
    for (const s of last.slots) {
      const full = players.find((p) => p.playerId === s.playerId);
      if (!full) continue;
      const idx = perPos[s.posCode]++;
      const total = counts[s.posCode] || 1;
      const x = 15 + (idx + 0.5) * (70 / total);
      next.push({ player: full, x, y: rows[s.posCode] ?? 50 });
    }
    setPlaced(next.slice(0, MAX_STARTERS));
    setMessage("Cargado el XI del último partido jugado.");
  }

  const placedIds = new Set(placed.map((p) => p.player.playerId));
  const bench = useMemo(
    () =>
      players.filter((p) => {
        if (placedIds.has(p.playerId)) return false;
        if (posFilter !== "ALL" && p.position !== posFilter) return false;
        if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
        return true;
      }),
    [players, placedIds, posFilter, query]
  );

  function coordsFromEvent(e: React.DragEvent) {
    const rect = fieldRef.current!.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(96, Math.max(4, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function handleFieldDrop(e: React.DragEvent) {
    e.preventDefault();
    const { x, y } = coordsFromEvent(e);
    if (draggingPlacedId != null) {
      setPlaced((prev) => prev.map((p) => (p.player.playerId === draggingPlacedId ? { ...p, x, y } : p)));
      setDraggingPlacedId(null);
      return;
    }
    if (draggingBenchId != null) {
      const player = players.find((p) => p.playerId === draggingBenchId);
      if (!player) return;

      // Si sueltas encima de un jugador ya colocado, lo reemplaza en vez de sumarse.
      const REPLACE_RADIUS = 9;
      const target = placed.find((p) => Math.hypot(p.x - x, p.y - y) < REPLACE_RADIUS);
      if (target) {
        setPlaced((prev) => prev.map((p) => (p === target ? { player, x: p.x, y: p.y } : p)));
        setDraggingBenchId(null);
        setMessage(null);
        return;
      }

      if (placed.length >= MAX_STARTERS) {
        setMessage(`Ya tienes ${MAX_STARTERS} titulares — quita a alguien antes de agregar otro.`);
        return;
      }
      setPlaced((prev) => [...prev, { player, x, y }]);
      setDraggingBenchId(null);
      setMessage(null);
    }
  }

  function removePlaced(playerId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setPlaced((prev) => prev.filter((p) => p.player.playerId !== playerId));
  }

  const formation = detectFormation(placed);

  async function saveLineup() {
    if (!fixtureId) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/lineups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId,
          formation,
          slots: placed.map((p, i) => ({ slotPosition: `S${i}`, playerId: p.player.playerId })),
        }),
      });
      const data = await res.json();
      setMessage(res.ok ? `Alineación guardada para el próximo partido${nextRival ? ` vs ${nextRival}` : ""}.` : data.error ?? "No se pudo guardar.");
    } catch {
      setMessage("Error de red al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <NavBar active="/tactica" />

      <div className="max-w-6xl mx-auto px-8 py-8 flex gap-6">
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-display text-2xl font-extrabold">{formation}</span>
              <button
                onClick={loadLastLineup}
                className="font-mono text-[10px] px-2.5 py-1 rounded-full"
                style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
              >
                CARGAR ÚLTIMO XI
              </button>
              <button
                onClick={() => { setPlaced([]); setMessage(null); }}
                disabled={placed.length === 0}
                className="font-mono text-[10px] px-2.5 py-1 rounded-full disabled:opacity-40"
                style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
              >
                LIMPIAR
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs" style={{ color: placed.length === MAX_STARTERS ? "var(--good)" : "var(--muted)" }}>
                {placed.length}/{MAX_STARTERS} titulares
              </span>
              <button
                onClick={saveLineup}
                disabled={saving || placed.length === 0}
                className="font-mono text-xs px-4 py-2 rounded-md font-bold disabled:opacity-50"
                style={{ background: "var(--gold)", color: "#1a1a24" }}
                title={nextRival ? `Se guarda para el próximo partido: vs ${nextRival}` : undefined}
              >
                {saving ? "GUARDANDO…" : nextRival ? `GUARDAR PARA vs ${nextRival.toUpperCase()}` : "GUARDAR ALINEACIÓN"}
              </button>
            </div>
          </div>
          {message && <div className="text-sm" style={{ color: "var(--muted)" }}>{message}</div>}

          <div
            ref={fieldRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFieldDrop}
            className="relative rounded-xl overflow-hidden"
            style={{
              height: 560,
              background:
                "repeating-linear-gradient(180deg, #2f7a4f 0, #2f7a4f 40px, #2c7449 40px, #2c7449 80px)",
              boxShadow: isDragActive ? "inset 0 0 0 3px rgba(217,185,92,.6)" : "none",
              transition: "box-shadow .15s",
            }}
          >
            <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
              <g stroke="rgba(255,255,255,.55)" strokeWidth="0.4" fill="none">
                <rect x="4" y="4" width="92" height="132" />
                <line x1="4" y1="70" x2="96" y2="70" />
                <circle cx="50" cy="70" r="12" />
                <circle cx="50" cy="70" r="0.6" fill="rgba(255,255,255,.55)" />
                {/* área grande y chica -- arriba (ataque) */}
                <rect x="24" y="4" width="52" height="18" />
                <rect x="38" y="4" width="24" height="7" />
                <circle cx="50" cy="16.5" r="0.6" fill="rgba(255,255,255,.55)" />
                <path d="M 38 22 A 12 12 0 0 0 62 22" />
                {/* área grande y chica -- abajo (portería propia) */}
                <rect x="24" y="118" width="52" height="18" />
                <rect x="38" y="129" width="24" height="7" />
                <circle cx="50" cy="123.5" r="0.6" fill="rgba(255,255,255,.55)" />
                <path d="M 38 118 A 12 12 0 0 1 62 118" />
                {/* arcos de esquina */}
                <path d="M 4 4 A 3 3 0 0 1 7 7" />
                <path d="M 96 4 A 3 3 0 0 0 93 7" />
                <path d="M 4 136 A 3 3 0 0 0 7 133" />
                <path d="M 96 136 A 3 3 0 0 1 93 133" />
              </g>
            </svg>

            {placed.map((p) => {
              const penalty = efficiencyPenalty(p.player, p.y);
              return (
                <div
                  key={p.player.playerId}
                  draggable
                  onDragStart={() => setDraggingPlacedId(p.player.playerId)}
                  onDragEnd={() => setDraggingPlacedId(null)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing"
                  style={{
                    top: `${p.y}%`,
                    left: `${p.x}%`,
                    transition: draggingPlacedId === p.player.playerId ? "none" : "top .25s ease, left .25s ease",
                    opacity: draggingPlacedId === p.player.playerId ? 0.35 : 1,
                    zIndex: draggingPlacedId === p.player.playerId ? 20 : 10,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden relative transition-transform hover:scale-110"
                    style={{
                      boxShadow: penalty > 0 ? "0 0 0 3px var(--bad)" : "0 4px 10px -3px rgba(20,15,40,.4)",
                      background: "var(--surface)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.player.photoUrl} alt={p.player.name} className="w-full h-full object-cover" />
                    <span
                      onClick={(e) => removePlaced(p.player.playerId, e)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border flex items-center justify-center text-[9px] cursor-pointer"
                      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                    >
                      ×
                    </span>
                  </div>
                  <span className="text-white text-[10px] font-semibold mt-1 whitespace-nowrap bg-black/30 px-1 rounded">
                    {p.player.name}
                  </span>
                  {penalty > 0 && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full mt-0.5" style={{ background: "var(--bad)", color: "#fff" }}>
                      −{penalty}% fuera de posición
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Arrastra jugadores de la banca a cualquier punto de la cancha, y arrastra los ya colocados para reacomodarlos —
            la formación de arriba se detecta sola según cómo los ubiques. Máximo {MAX_STARTERS}. Fuera de su banda
            natural pierde eficiencia. Solo puedes guardar la alineación del próximo partido sin jugarse.
          </p>
        </div>

        <div className="w-72 flex-shrink-0 rounded-xl p-4 border flex flex-col gap-3" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
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
            Banca ({bench.length}) · plantilla actual del Madrid
          </span>
          <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">
            {bench.map((p) => (
              <div
                key={p.playerId}
                draggable
                onDragStart={() => setDraggingBenchId(p.playerId)}
                onDragEnd={() => setDraggingBenchId(null)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all hover:shadow-md"
                style={{
                  border: "1px solid var(--line)",
                  opacity: draggingBenchId === p.playerId ? 0.4 : 1,
                  background: draggingBenchId === p.playerId ? "var(--gold-soft)" : "transparent",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photoUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                  {POS_LABEL[p.position] ?? p.position}
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: "var(--gold)" }}>
                  {p.overall}
                </span>
              </div>
            ))}
            {bench.length === 0 && players.length > 0 && (
              <p className="text-sm px-1" style={{ color: "var(--muted)" }}>Sin resultados.</p>
            )}
          </div>

          {departed.length > 0 && (
            <div className="pt-3 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Jugaron el último partido, ya no están
              </span>
              <div className="flex flex-col gap-1 mt-2">
                {departed.map((d) => (
                  <div key={d.playerId} className="text-xs" style={{ color: "var(--muted)" }}>
                    {d.playerName}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
