(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/calificaciones/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CalificacionesPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$NavBar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/NavBar.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const API = ("TURBOPACK compile-time value", "http://localhost:10001") ?? "http://localhost:5080";
function seasonLabel(s) {
    return `${s}-${(s + 1).toString().slice(2)}`;
}
function Sparkline({ values, color }) {
    const w = 110, h = 26, pad = 3;
    const pts = values.filter((v)=>v != null);
    if (pts.length < 2) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "text-[10px]",
        style: {
            color: "var(--muted)"
        },
        children: "—"
    }, void 0, false, {
        fileName: "[project]/app/calificaciones/page.tsx",
        lineNumber: 20,
        columnNumber: 30
    }, this);
    const xStep = (w - pad * 2) / (values.length - 1);
    const yFor = (v)=>h - pad - v / 10 * (h - pad * 2);
    const line = values.map((v, i)=>v != null ? `${pad + i * xStep},${yFor(v)}` : null).filter(Boolean).join(" ");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        width: w,
        height: h,
        viewBox: `0 0 ${w} ${h}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
            points: line,
            fill: "none",
            stroke: color,
            strokeWidth: 1.6
        }, void 0, false, {
            fileName: "[project]/app/calificaciones/page.tsx",
            lineNumber: 26,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/calificaciones/page.tsx",
        lineNumber: 25,
        columnNumber: 5
    }, this);
}
_c = Sparkline;
function BigChart({ matches, rows, playerId }) {
    const byFixture = new Map(rows.filter((r)=>r.playerId === playerId).map((r)=>[
            r.fixtureId,
            r
        ]));
    const points = matches.filter((m)=>byFixture.has(m.fixtureId)).map((m)=>({
            ...m,
            ...byFixture.get(m.fixtureId)
        }));
    if (points.length === 0) return null;
    const w = 1400, h = 260, padL = 34, padR = 16, padT = 14, padB = 46;
    const xStep = points.length > 1 ? (w - padL - padR) / (points.length - 1) : 0;
    const yFor = (v)=>h - padB - v / 10 * (h - padT - padB);
    const line = (key)=>points.map((p, i)=>p[key] != null ? `${padL + i * xStep},${yFor(p[key])}` : null).filter(Boolean).join(" ");
    const aiVals = points.map((p)=>p.aiRating).filter((v)=>v != null);
    const userVals = points.map((p)=>p.userRating).filter((v)=>v != null);
    const aiFinal = aiVals.length ? (aiVals.reduce((a, b)=>a + b, 0) / aiVals.length).toFixed(1) : "—";
    const userFinal = userVals.length ? (userVals.reduce((a, b)=>a + b, 0) / userVals.length).toFixed(1) : "—";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-3 pt-4",
        style: {
            borderTop: "1px solid var(--line)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                width: "100%",
                viewBox: `0 0 ${w} ${h}`,
                preserveAspectRatio: "none",
                style: {
                    display: "block"
                },
                children: [
                    [
                        0,
                        5,
                        10
                    ].map((v)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: padL,
                                    x2: w - padR,
                                    y1: yFor(v),
                                    y2: yFor(v),
                                    stroke: "var(--line)",
                                    strokeWidth: 1
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 53,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                    x: padL - 8,
                                    y: yFor(v) + 4,
                                    textAnchor: "end",
                                    fontFamily: "JetBrains Mono",
                                    fontSize: 12,
                                    fill: "#6a6879",
                                    children: v
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 54,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, v, true, {
                            fileName: "[project]/app/calificaciones/page.tsx",
                            lineNumber: 52,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                        points: line("aiRating"),
                        fill: "none",
                        stroke: "var(--purple)",
                        strokeWidth: 2.5
                    }, void 0, false, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 57,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                        points: line("userRating"),
                        fill: "none",
                        stroke: "var(--gold)",
                        strokeWidth: 2.5
                    }, void 0, false, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this),
                    points.map((p, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: [
                                p.aiRating != null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    cx: padL + i * xStep,
                                    cy: yFor(p.aiRating),
                                    r: 3.5,
                                    fill: "var(--purple)"
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 61,
                                    columnNumber: 36
                                }, this),
                                p.userRating != null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    cx: padL + i * xStep,
                                    cy: yFor(p.userRating),
                                    r: 3.5,
                                    fill: "var(--gold)"
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 62,
                                    columnNumber: 38
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                    x: padL + i * xStep,
                                    y: h - padB + 18,
                                    textAnchor: "middle",
                                    fontFamily: "JetBrains Mono",
                                    fontSize: 11,
                                    fill: "#6a6879",
                                    transform: `rotate(-35 ${padL + i * xStep} ${h - padB + 18})`,
                                    children: p.opponent.length > 14 ? p.opponent.slice(0, 13) + "…" : p.opponent
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 63,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, p.fixtureId, true, {
                            fileName: "[project]/app/calificaciones/page.tsx",
                            lineNumber: 60,
                            columnNumber: 11
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/app/calificaciones/page.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-8 mt-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-sm",
                        style: {
                            color: "var(--purple)"
                        },
                        children: [
                            "Promedio IA temporada: ",
                            aiFinal
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 71,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-sm",
                        style: {
                            color: "var(--gold)"
                        },
                        children: [
                            "Tu promedio temporada: ",
                            userFinal
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/calificaciones/page.tsx",
                lineNumber: 70,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/calificaciones/page.tsx",
        lineNumber: 49,
        columnNumber: 5
    }, this);
}
_c1 = BigChart;
function CalificacionesPage() {
    _s();
    const [seasons, setSeasons] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeSeason, setActiveSeason] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [seasonMatches, setSeasonMatches] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [seasonRatings, setSeasonRatings] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [expandedPlayer, setExpandedPlayer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [lastMatch, setLastMatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [lastMatchPlayers, setLastMatchPlayers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [drafts, setDrafts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [reviewDrafts, setReviewDrafts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [saved, setSaved] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Set());
    const [nextMatch, setNextMatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CalificacionesPage.useEffect": ()=>{
            fetch(`${API}/api/ratings/seasons`).then({
                "CalificacionesPage.useEffect": (r)=>r.json()
            }["CalificacionesPage.useEffect"]).then({
                "CalificacionesPage.useEffect": (rows)=>{
                    const list = rows.map({
                        "CalificacionesPage.useEffect.list": (r)=>r.season
                    }["CalificacionesPage.useEffect.list"]);
                    setSeasons(list);
                    if (list.length) setActiveSeason(list[0]);
                }
            }["CalificacionesPage.useEffect"]);
            loadLastMatch();
            fetch(`${API}/api/dashboard/next-match`).then({
                "CalificacionesPage.useEffect": (r)=>r.ok ? r.json() : null
            }["CalificacionesPage.useEffect"]).then({
                "CalificacionesPage.useEffect": (d)=>setNextMatch(d)
            }["CalificacionesPage.useEffect"]).catch({
                "CalificacionesPage.useEffect": ()=>{}
            }["CalificacionesPage.useEffect"]);
        }
    }["CalificacionesPage.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CalificacionesPage.useEffect": ()=>{
            if (activeSeason == null) return;
            setExpandedPlayer(null);
            fetch(`${API}/api/ratings/season/${activeSeason}`).then({
                "CalificacionesPage.useEffect": (r)=>r.json()
            }["CalificacionesPage.useEffect"]).then({
                "CalificacionesPage.useEffect": (d)=>{
                    setSeasonMatches((d.matches ?? []).slice());
                    setSeasonRatings(d.ratings ?? []);
                }
            }["CalificacionesPage.useEffect"]);
        }
    }["CalificacionesPage.useEffect"], [
        activeSeason
    ]);
    function loadLastMatch() {
        fetch(`${API}/api/ratings/last-match`).then((r)=>r.json()).then((data)=>{
            setLastMatch(data.match);
            setLastMatchPlayers(data.players ?? []);
            const d = {};
            const rv = {};
            const s = new Set();
            for (const p of data.players ?? []){
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
    async function saveRating(playerId) {
        const raw = drafts[playerId];
        const rating = parseFloat(raw);
        if (isNaN(rating) || rating < 0 || rating > 10 || !lastMatch) return;
        await fetch(`${API}/api/ratings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fixtureId: lastMatch.fixtureId,
                playerId,
                rating,
                review: reviewDrafts[playerId]?.trim() || null
            })
        });
        setSaved((s)=>new Set(s).add(playerId));
        if (activeSeason != null) {
            fetch(`${API}/api/ratings/season/${activeSeason}`).then((r)=>r.json()).then((d)=>{
                setSeasonMatches((d.matches ?? []).slice());
                setSeasonRatings(d.ratings ?? []);
            });
        }
    }
    const isCurrentSeasonTab = seasons.length > 0 && activeSeason === seasons[0];
    const ratingsOpen = isCurrentSeasonTab && lastMatch != null && lastMatch.season === activeSeason;
    const lastMatchPlayerMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CalificacionesPage.useMemo[lastMatchPlayerMap]": ()=>new Map(lastMatchPlayers.map({
                "CalificacionesPage.useMemo[lastMatchPlayerMap]": (p)=>[
                        p.playerId,
                        p
                    ]
            }["CalificacionesPage.useMemo[lastMatchPlayerMap]"]))
    }["CalificacionesPage.useMemo[lastMatchPlayerMap]"], [
        lastMatchPlayers
    ]);
    const playerSummaries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CalificacionesPage.useMemo[playerSummaries]": ()=>{
            const ids = new Set(seasonRatings.map({
                "CalificacionesPage.useMemo[playerSummaries]": (r)=>r.playerId
            }["CalificacionesPage.useMemo[playerSummaries]"]));
            if (ratingsOpen) for (const p of lastMatchPlayers)ids.add(p.playerId);
            const totalMatches = seasonMatches.length;
            const DEFAULT_MISSED = 5; // calificación asumida en los partidos que NO jugó, para no premiar a quien jugó poco
            const rows0 = Array.from(ids).map({
                "CalificacionesPage.useMemo[playerSummaries].rows0": (pid)=>{
                    const rows = seasonRatings.filter({
                        "CalificacionesPage.useMemo[playerSummaries].rows0.rows": (r)=>r.playerId === pid
                    }["CalificacionesPage.useMemo[playerSummaries].rows0.rows"]);
                    const name = rows[0]?.name ?? lastMatchPlayerMap.get(pid)?.playerName ?? "";
                    const byFixture = new Map(rows.map({
                        "CalificacionesPage.useMemo[playerSummaries].rows0": (r)=>[
                                r.fixtureId,
                                r
                            ]
                    }["CalificacionesPage.useMemo[playerSummaries].rows0"]));
                    const aiSeries = seasonMatches.map({
                        "CalificacionesPage.useMemo[playerSummaries].rows0.aiSeries": (m)=>byFixture.get(m.fixtureId)?.aiRating ?? null
                    }["CalificacionesPage.useMemo[playerSummaries].rows0.aiSeries"]);
                    const userSeries = seasonMatches.map({
                        "CalificacionesPage.useMemo[playerSummaries].rows0.userSeries": (m)=>byFixture.get(m.fixtureId)?.userRating ?? null
                    }["CalificacionesPage.useMemo[playerSummaries].rows0.userSeries"]);
                    const aiVals = aiSeries.filter({
                        "CalificacionesPage.useMemo[playerSummaries].rows0.aiVals": (v)=>v != null
                    }["CalificacionesPage.useMemo[playerSummaries].rows0.aiVals"]);
                    const userVals = userSeries.filter({
                        "CalificacionesPage.useMemo[playerSummaries].rows0.userVals": (v)=>v != null
                    }["CalificacionesPage.useMemo[playerSummaries].rows0.userVals"]);
                    const matchesPlayed = aiVals.length;
                    // Promedio "temporada completa": los partidos que no jugó cuentan como si hubiera
                    // jugado con nota 5 -- así el promedio refleja el total de la temporada, no solo
                    // sus partidos jugados (un jugador con pocos partidos y notas altas ya no sale mejor
                    // que uno que sostuvo un buen nivel jugando toda la temporada).
                    const aiAvg = totalMatches > 0 ? (aiVals.reduce({
                        "CalificacionesPage.useMemo[playerSummaries].rows0": (a, b)=>a + b
                    }["CalificacionesPage.useMemo[playerSummaries].rows0"], 0) + DEFAULT_MISSED * (totalMatches - matchesPlayed)) / totalMatches : null;
                    const userAvg = userVals.length ? userVals.reduce({
                        "CalificacionesPage.useMemo[playerSummaries].rows0": (a, b)=>a + b
                    }["CalificacionesPage.useMemo[playerSummaries].rows0"], 0) / userVals.length : null;
                    return {
                        pid,
                        name,
                        aiSeries,
                        userSeries,
                        aiAvg,
                        userAvg,
                        matchesPlayed
                    };
                }
            }["CalificacionesPage.useMemo[playerSummaries].rows0"]);
            return rows0.sort({
                "CalificacionesPage.useMemo[playerSummaries]": (a, b)=>(b.aiAvg ?? -1) - (a.aiAvg ?? -1)
            }["CalificacionesPage.useMemo[playerSummaries]"]);
        }
    }["CalificacionesPage.useMemo[playerSummaries]"], [
        seasonRatings,
        seasonMatches,
        ratingsOpen,
        lastMatchPlayers,
        lastMatchPlayerMap
    ]);
    // Jugadores donde tu calificación se aleja más de la de la IA -- útil como gancho de
    // contenido ("¿por qué calificaste tan distinto a Fulano?").
    const discrepancies = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CalificacionesPage.useMemo[discrepancies]": ()=>{
            return playerSummaries.filter({
                "CalificacionesPage.useMemo[discrepancies]": (p)=>p.aiAvg != null && p.userAvg != null
            }["CalificacionesPage.useMemo[discrepancies]"]).map({
                "CalificacionesPage.useMemo[discrepancies]": (p)=>({
                        ...p,
                        diff: Math.abs(p.userAvg - p.aiAvg)
                    })
            }["CalificacionesPage.useMemo[discrepancies]"]).sort({
                "CalificacionesPage.useMemo[discrepancies]": (a, b)=>b.diff - a.diff
            }["CalificacionesPage.useMemo[discrepancies]"]).slice(0, 5);
        }
    }["CalificacionesPage.useMemo[discrepancies]"], [
        playerSummaries
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen",
        style: {
            background: "var(--bg)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$NavBar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                active: "/calificaciones"
            }, void 0, false, {
                fileName: "[project]/app/calificaciones/page.tsx",
                lineNumber: 203,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-7xl mx-auto px-8 py-8 flex flex-col gap-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-display text-2xl font-extrabold",
                                children: "Calificaciones"
                            }, void 0, false, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 207,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm mt-1",
                                style: {
                                    color: "var(--muted)"
                                },
                                children: "Solo se puede calificar el último partido jugado de la temporada en curso. Todo lo demás es histórico."
                            }, void 0, false, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 208,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 206,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-1.5 overflow-x-auto pb-1",
                        children: seasons.map((s, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setActiveSeason(s),
                                className: "font-mono text-xs px-3 py-1.5 rounded-full flex-shrink-0 cursor-pointer",
                                style: {
                                    background: activeSeason === s ? "var(--purple)" : "transparent",
                                    color: activeSeason === s ? "#fff" : "var(--muted)",
                                    border: activeSeason === s ? "none" : "1px solid var(--line)"
                                },
                                children: [
                                    seasonLabel(s),
                                    " ",
                                    i === 0 ? "· actual" : ""
                                ]
                            }, s, true, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 216,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 214,
                        columnNumber: 9
                    }, this),
                    isCurrentSeasonTab && !ratingsOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm px-1",
                        style: {
                            color: "var(--muted)"
                        },
                        children: [
                            "Aún no se ha jugado ningún partido de Real Madrid en la temporada ",
                            activeSeason != null ? seasonLabel(activeSeason) : "",
                            ".",
                            nextMatch ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    " El recuadro para calificar aparece aquí mismo apenas termine el próximo partido: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: [
                                            nextMatch.homeTeam,
                                            " vs ",
                                            nextMatch.awayTeam
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/calificaciones/page.tsx",
                                        lineNumber: 235,
                                        columnNumber: 99
                                    }, this),
                                    ", ",
                                    new Date(nextMatch.kickoffUtc).toLocaleDateString("es-ES", {
                                        day: "numeric",
                                        month: "long"
                                    }),
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 235,
                                columnNumber: 15
                            }, this) : " En cuanto se juegue el primero, podrás calificarlo aquí."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 232,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border overflow-hidden",
                        style: {
                            background: "var(--surface)",
                            borderColor: "var(--line)"
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-4 py-3 flex items-baseline justify-between flex-wrap gap-2",
                                style: {
                                    borderBottom: "1px solid var(--line)"
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-mono text-[11px] uppercase tracking-wider",
                                        style: {
                                            color: "var(--muted)"
                                        },
                                        children: [
                                            activeSeason != null ? `Temporada ${seasonLabel(activeSeason)}` : "",
                                            " · ",
                                            seasonMatches.length,
                                            " partidos con alineación"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/calificaciones/page.tsx",
                                        lineNumber: 245,
                                        columnNumber: 13
                                    }, this),
                                    ratingsOpen && lastMatch && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-mono text-[11px]",
                                        style: {
                                            color: "var(--muted)"
                                        },
                                        children: [
                                            "Calificando último partido: ",
                                            lastMatch.homeTeam,
                                            " ",
                                            lastMatch.homeGoals,
                                            "–",
                                            lastMatch.awayGoals,
                                            " ",
                                            lastMatch.awayTeam
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/calificaciones/page.tsx",
                                        lineNumber: 249,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 244,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-x-auto",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "w-full text-xs",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                style: {
                                                    borderBottom: "1px solid var(--line)"
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "text-left px-4 py-2 font-mono",
                                                        style: {
                                                            color: "var(--muted)"
                                                        },
                                                        children: "Jugador"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                        lineNumber: 258,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "text-left px-4 py-2 font-mono",
                                                        style: {
                                                            color: "var(--muted)"
                                                        },
                                                        children: "Progreso"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                        lineNumber: 259,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "text-right px-4 py-2 font-mono",
                                                        style: {
                                                            color: "var(--muted)"
                                                        },
                                                        children: "IA"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                        lineNumber: 260,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "text-right px-4 py-2 font-mono",
                                                        style: {
                                                            color: "var(--muted)"
                                                        },
                                                        children: "Tú"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                        lineNumber: 261,
                                                        columnNumber: 19
                                                    }, this),
                                                    ratingsOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "text-right px-4 py-2 font-mono",
                                                        style: {
                                                            color: "var(--muted)"
                                                        },
                                                        children: "Calificar último"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                        lineNumber: 263,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                lineNumber: 257,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/calificaciones/page.tsx",
                                            lineNumber: 256,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            children: playerSummaries.map((row)=>{
                                                const canRateHere = ratingsOpen && lastMatchPlayerMap.has(row.pid);
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            style: {
                                                                borderBottom: "1px solid var(--line)"
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 whitespace-nowrap cursor-pointer",
                                                                    onClick: ()=>setExpandedPlayer(expandedPlayer === row.pid ? null : row.pid),
                                                                    children: row.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 273,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 cursor-pointer",
                                                                    onClick: ()=>setExpandedPlayer(expandedPlayer === row.pid ? null : row.pid),
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Sparkline, {
                                                                        values: row.aiSeries,
                                                                        color: "var(--purple)"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                                        lineNumber: 280,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 279,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 text-right font-mono",
                                                                    children: row.aiAvg != null ? row.aiAvg.toFixed(1) : "—"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 282,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 text-right font-mono",
                                                                    children: row.userAvg != null ? row.userAvg.toFixed(1) : "—"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 283,
                                                                    columnNumber: 25
                                                                }, this),
                                                                ratingsOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2",
                                                                    children: canRateHere ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center gap-2 justify-end",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                                type: "text",
                                                                                value: reviewDrafts[row.pid] ?? "",
                                                                                onChange: (e)=>setReviewDrafts((d)=>({
                                                                                            ...d,
                                                                                            [row.pid]: e.target.value
                                                                                        })),
                                                                                placeholder: "Reseña breve (opcional)",
                                                                                maxLength: 200,
                                                                                className: "w-40 rounded-md border px-2 py-1 text-xs outline-none",
                                                                                style: {
                                                                                    borderColor: "var(--line)"
                                                                                }
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                                                lineNumber: 288,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                                type: "number",
                                                                                min: 0,
                                                                                max: 10,
                                                                                step: 0.5,
                                                                                value: drafts[row.pid] ?? "",
                                                                                onChange: (e)=>setDrafts((d)=>({
                                                                                            ...d,
                                                                                            [row.pid]: e.target.value
                                                                                        })),
                                                                                placeholder: "—",
                                                                                className: "w-16 rounded-md border px-2 py-1 text-sm text-center outline-none",
                                                                                style: {
                                                                                    borderColor: "var(--line)"
                                                                                }
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                                                lineNumber: 297,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                onClick: ()=>saveRating(row.pid),
                                                                                className: "font-mono text-[10px] px-3 py-1.5 rounded-md font-bold whitespace-nowrap",
                                                                                style: {
                                                                                    background: saved.has(row.pid) ? "var(--good)" : "var(--gold)",
                                                                                    color: saved.has(row.pid) ? "#fff" : "#1a1a24"
                                                                                },
                                                                                children: saved.has(row.pid) ? "GUARDADO" : "GUARDAR"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                                                lineNumber: 305,
                                                                                columnNumber: 33
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                                        lineNumber: 287,
                                                                        columnNumber: 31
                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "block text-right",
                                                                        style: {
                                                                            color: "var(--muted)"
                                                                        },
                                                                        children: "—"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/calificaciones/page.tsx",
                                                                        lineNumber: 314,
                                                                        columnNumber: 31
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 285,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/calificaciones/page.tsx",
                                                            lineNumber: 272,
                                                            columnNumber: 23
                                                        }, this),
                                                        expandedPlayer === row.pid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                colSpan: ratingsOpen ? 5 : 4,
                                                                className: "px-4 pb-5",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BigChart, {
                                                                    matches: seasonMatches,
                                                                    rows: seasonRatings,
                                                                    playerId: row.pid
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 322,
                                                                    columnNumber: 29
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                                lineNumber: 321,
                                                                columnNumber: 27
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/calificaciones/page.tsx",
                                                            lineNumber: 320,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, row.pid, true, {
                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                    lineNumber: 271,
                                                    columnNumber: 21
                                                }, this);
                                            })
                                        }, void 0, false, {
                                            fileName: "[project]/app/calificaciones/page.tsx",
                                            lineNumber: 267,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 255,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 254,
                                columnNumber: 11
                            }, this),
                            playerSummaries.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm p-4",
                                style: {
                                    color: "var(--muted)"
                                },
                                children: "Sin calificaciones registradas en esta temporada todavía."
                            }, void 0, false, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 333,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 243,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px]",
                        style: {
                            color: "var(--muted)"
                        },
                        children: "Toca un jugador para ver su gráfica de progreso completa de la temporada, a todo el ancho. Morado = calificación IA por partido (dato real de rendimiento) · Dorado = la tuya. El promedio de la columna IA es sobre el total de partidos de la temporada, no solo los que jugó — los partidos que no jugó cuentan con nota 5."
                    }, void 0, false, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 338,
                        columnNumber: 9
                    }, this),
                    discrepancies.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border overflow-hidden",
                        style: {
                            background: "var(--surface)",
                            borderColor: "var(--line)"
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-4 py-3",
                                style: {
                                    borderBottom: "1px solid var(--line)"
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "font-mono text-[11px] uppercase tracking-wider",
                                    style: {
                                        color: "var(--muted)"
                                    },
                                    children: "Donde más discrepas con la IA — material para el podcast"
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 347,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 346,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col",
                                children: discrepancies.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-3 px-4 py-2.5",
                                        style: {
                                            borderBottom: "1px solid var(--line)"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-sm flex-1",
                                                children: d.name
                                            }, void 0, false, {
                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                lineNumber: 354,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-mono text-xs",
                                                style: {
                                                    color: "var(--purple)"
                                                },
                                                children: [
                                                    "IA ",
                                                    d.aiAvg.toFixed(1)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                lineNumber: 355,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-mono text-xs",
                                                style: {
                                                    color: "var(--gold)"
                                                },
                                                children: [
                                                    "Tú ",
                                                    d.userAvg.toFixed(1)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                lineNumber: 356,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-mono text-[11px] px-2 py-0.5 rounded-full font-bold",
                                                style: {
                                                    background: d.userAvg > d.aiAvg ? "var(--good)" : "var(--bad)",
                                                    color: "#fff"
                                                },
                                                children: [
                                                    d.userAvg > d.aiAvg ? "+" : "",
                                                    (d.userAvg - d.aiAvg).toFixed(1)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                lineNumber: 357,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, d.pid, true, {
                                        fileName: "[project]/app/calificaciones/page.tsx",
                                        lineNumber: 353,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 351,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 345,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/calificaciones/page.tsx",
                lineNumber: 205,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/calificaciones/page.tsx",
        lineNumber: 202,
        columnNumber: 5
    }, this);
}
_s(CalificacionesPage, "vKzUOUND+vRHsaDQBvYhQtfKoIE=");
_c2 = CalificacionesPage;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "Sparkline");
__turbopack_context__.k.register(_c1, "BigChart");
__turbopack_context__.k.register(_c2, "CalificacionesPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/LogoMark.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MonogramMark",
    ()=>MonogramMark,
    "MonogramMarkGold",
    ()=>MonogramMarkGold,
    "RealMadridCrest",
    ()=>RealMadridCrest,
    "ShieldMark",
    ()=>ShieldMark
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
function RealMadridCrest({ size = 40 }) {
    _s();
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    if (failed) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MonogramMark, {
        size: size
    }, void 0, false, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 10,
        columnNumber: 22
    }, this);
    return(// eslint-disable-next-line @next/next/no-img-element
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
        src: "/logos/crest.png",
        alt: "Real Madrid",
        width: size,
        height: size,
        style: {
            objectFit: "contain"
        },
        onError: ()=>setFailed(true)
    }, void 0, false, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this));
}
_s(RealMadridCrest, "BFa/7w0IiJnSoWJxZHxuU4kOwF4=");
_c = RealMadridCrest;
function MonogramMark({ size = 40 }) {
    _s1();
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    if (failed) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            width: size,
            height: size,
            viewBox: "0 0 40 40",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                    cx: "20",
                    cy: "20",
                    r: "19",
                    fill: "#2b2350",
                    stroke: "#d9b95c",
                    strokeWidth: "1.2"
                }, void 0, false, {
                    fileName: "[project]/app/components/LogoMark.tsx",
                    lineNumber: 32,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                    x: "20",
                    y: "24",
                    textAnchor: "middle",
                    fontFamily: "Big Shoulders Display, sans-serif",
                    fontWeight: 800,
                    fontSize: "15",
                    fill: "#d9b95c",
                    letterSpacing: "0.5",
                    children: "MHR"
                }, void 0, false, {
                    fileName: "[project]/app/components/LogoMark.tsx",
                    lineNumber: 33,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/LogoMark.tsx",
            lineNumber: 31,
            columnNumber: 7
        }, this);
    }
    return(// eslint-disable-next-line @next/next/no-img-element
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
        src: "/logos/monogram.png",
        alt: "Madrid Hagámoslo Real",
        width: size,
        height: size,
        style: {
            objectFit: "contain"
        },
        onError: ()=>setFailed(true)
    }, void 0, false, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 45,
        columnNumber: 5
    }, this));
}
_s1(MonogramMark, "BFa/7w0IiJnSoWJxZHxuU4kOwF4=");
_c1 = MonogramMark;
function MonogramMarkGold({ size = 40 }) {
    _s2();
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    if (failed) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MonogramMark, {
        size: size
    }, void 0, false, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 60,
        columnNumber: 22
    }, this);
    return(// eslint-disable-next-line @next/next/no-img-element
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
        src: "/logos/monogram-gold.png",
        alt: "Madrid Hagámoslo Real",
        width: size,
        height: size,
        style: {
            objectFit: "contain"
        },
        onError: ()=>setFailed(true)
    }, void 0, false, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 63,
        columnNumber: 5
    }, this));
}
_s2(MonogramMarkGold, "BFa/7w0IiJnSoWJxZHxuU4kOwF4=");
_c2 = MonogramMarkGold;
function ShieldMark({ size = 22, color = "#d9b95c" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M12 2 L22 7 V17 L12 22 L2 17 V7 Z",
                stroke: color,
                strokeWidth: "1.6"
            }, void 0, false, {
                fileName: "[project]/app/components/LogoMark.tsx",
                lineNumber: 77,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "12",
                cy: "12",
                r: "3.2",
                fill: color
            }, void 0, false, {
                fileName: "[project]/app/components/LogoMark.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 76,
        columnNumber: 5
    }, this);
}
_c3 = ShieldMark;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "RealMadridCrest");
__turbopack_context__.k.register(_c1, "MonogramMark");
__turbopack_context__.k.register(_c2, "MonogramMarkGold");
__turbopack_context__.k.register(_c3, "ShieldMark");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/NavBar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>NavBar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$LogoMark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/LogoMark.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const LINKS = [
    {
        href: "/",
        label: "DASHBOARD"
    },
    {
        href: "/jugadores",
        label: "JUGADORES"
    },
    {
        href: "/tactica",
        label: "TÁCTICA"
    },
    {
        href: "/prediccion",
        label: "PREDICCIÓN"
    },
    {
        href: "/calificaciones",
        label: "CALIFICACIONES"
    },
    {
        href: "/podcast",
        label: "PODCAST"
    }
];
function NavBar({ active }) {
    _s();
    const [floating, setFloating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NavBar.useEffect": ()=>{
            const onScroll = {
                "NavBar.useEffect.onScroll": ()=>setFloating(window.scrollY > 8)
            }["NavBar.useEffect.onScroll"];
            onScroll();
            window.addEventListener("scroll", onScroll, {
                passive: true
            });
            return ({
                "NavBar.useEffect": ()=>window.removeEventListener("scroll", onScroll)
            })["NavBar.useEffect"];
        }
    }["NavBar.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "sticky top-0 z-50 flex items-center justify-between px-8 h-16 transition-all",
        style: {
            background: "var(--purple)",
            boxShadow: floating ? "0 6px 18px -6px rgba(20,15,40,.45)" : "none"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/",
                className: "flex items-center gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$LogoMark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MonogramMarkGold"], {
                        size: 30
                    }, void 0, false, {
                        fileName: "[project]/app/components/NavBar.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-display font-extrabold text-lg text-white tracking-wide",
                        children: "MADRID HAGÁMOSLO REAL"
                    }, void 0, false, {
                        fileName: "[project]/app/components/NavBar.tsx",
                        lineNumber: 35,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/NavBar.tsx",
                lineNumber: 33,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-6 items-center",
                children: LINKS.map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: l.href,
                        className: "font-mono text-xs pb-5",
                        style: {
                            color: active === l.href ? "#fff" : "#c9c5df",
                            borderBottom: active === l.href ? "2px solid #d9b95c" : "2px solid transparent"
                        },
                        children: l.label
                    }, l.href, false, {
                        fileName: "[project]/app/components/NavBar.tsx",
                        lineNumber: 39,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/components/NavBar.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                style: {
                    background: "#d9b95c",
                    color: "#2b2350"
                },
                children: "JF"
            }, void 0, false, {
                fileName: "[project]/app/components/NavBar.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/NavBar.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_s(NavBar, "jZDUPO0cXQZpZK8cbqi8OWl8HrQ=");
_c = NavBar;
var _c;
__turbopack_context__.k.register(_c, "NavBar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
/**
 * @license React
 * react-jsx-dev-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            case REACT_ACTIVITY_TYPE:
                return "Activity";
            case REACT_VIEW_TRANSITION_TYPE:
                return "ViewTransition";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_CONTEXT_TYPE:
                return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
        try {
            var name = getComponentNameFromType(type);
            return name ? "<" + name + ">" : "<...>";
        } catch (x) {
            return "<...>";
        }
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
        return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.defineProperty(type, "_debugStack", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
            for(isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
        } else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
            children = getComponentNameFromType(type);
            var keys = Object.keys(config).filter(function(k) {
                return "key" !== k;
            });
            isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
            didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
            maybeKey = {};
            for(var propName in config)"key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var React = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
    };
    React = {
        react_stack_bottom_frame: function(callStackForError) {
            return callStackForError();
        }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
            var previousStackTraceLimit = Error.stackTraceLimit;
            Error.stackTraceLimit = 10;
            var debugStackDEV = Error("react-stack-top-frame");
            Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
}();
}),
"[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)");
}
}),
]);

//# sourceMappingURL=_1tkrbe4._.js.map