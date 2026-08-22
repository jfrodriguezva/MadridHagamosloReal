module.exports = [
"[project]/app/calificaciones/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CalificacionesPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$NavBar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/NavBar.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
const API = ("TURBOPACK compile-time value", "http://localhost:10001") ?? "http://localhost:5080";
function seasonLabel(s) {
    return `${s}-${(s + 1).toString().slice(2)}`;
}
function Sparkline({ values, color }) {
    const w = 110, h = 26, pad = 3;
    const pts = values.filter((v)=>v != null);
    if (pts.length < 2) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        width: w,
        height: h,
        viewBox: `0 0 ${w} ${h}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-3 pt-4",
        style: {
            borderTop: "1px solid var(--line)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
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
                    ].map((v)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                        points: line("aiRating"),
                        fill: "none",
                        stroke: "var(--purple)",
                        strokeWidth: 2.5
                    }, void 0, false, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 57,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                        points: line("userRating"),
                        fill: "none",
                        stroke: "var(--gold)",
                        strokeWidth: 2.5
                    }, void 0, false, {
                        fileName: "[project]/app/calificaciones/page.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this),
                    points.map((p, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: [
                                p.aiRating != null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    cx: padL + i * xStep,
                                    cy: yFor(p.aiRating),
                                    r: 3.5,
                                    fill: "var(--purple)"
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 61,
                                    columnNumber: 36
                                }, this),
                                p.userRating != null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    cx: padL + i * xStep,
                                    cy: yFor(p.userRating),
                                    r: 3.5,
                                    fill: "var(--gold)"
                                }, void 0, false, {
                                    fileName: "[project]/app/calificaciones/page.tsx",
                                    lineNumber: 62,
                                    columnNumber: 38
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-8 mt-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
function CalificacionesPage() {
    const [seasons, setSeasons] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeSeason, setActiveSeason] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [seasonMatches, setSeasonMatches] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [seasonRatings, setSeasonRatings] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [expandedPlayer, setExpandedPlayer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [lastMatch, setLastMatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [lastMatchPlayers, setLastMatchPlayers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [drafts, setDrafts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [reviewDrafts, setReviewDrafts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [saved, setSaved] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(new Set());
    const [nextMatch, setNextMatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        fetch(`${API}/api/ratings/seasons`).then((r)=>r.json()).then((rows)=>{
            const list = rows.map((r)=>r.season);
            setSeasons(list);
            if (list.length) setActiveSeason(list[0]);
        });
        loadLastMatch();
        fetch(`${API}/api/dashboard/next-match`).then((r)=>r.ok ? r.json() : null).then((d)=>setNextMatch(d)).catch(()=>{});
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (activeSeason == null) return;
        setExpandedPlayer(null);
        fetch(`${API}/api/ratings/season/${activeSeason}`).then((r)=>r.json()).then((d)=>{
            setSeasonMatches((d.matches ?? []).slice());
            setSeasonRatings(d.ratings ?? []);
        });
    }, [
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
    const lastMatchPlayerMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>new Map(lastMatchPlayers.map((p)=>[
                p.playerId,
                p
            ])), [
        lastMatchPlayers
    ]);
    const playerSummaries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const ids = new Set(seasonRatings.map((r)=>r.playerId));
        if (ratingsOpen) for (const p of lastMatchPlayers)ids.add(p.playerId);
        const totalMatches = seasonMatches.length;
        const DEFAULT_MISSED = 5; // calificación asumida en los partidos que NO jugó, para no premiar a quien jugó poco
        const rows0 = Array.from(ids).map((pid)=>{
            const rows = seasonRatings.filter((r)=>r.playerId === pid);
            const name = rows[0]?.name ?? lastMatchPlayerMap.get(pid)?.playerName ?? "";
            const byFixture = new Map(rows.map((r)=>[
                    r.fixtureId,
                    r
                ]));
            const aiSeries = seasonMatches.map((m)=>byFixture.get(m.fixtureId)?.aiRating ?? null);
            const userSeries = seasonMatches.map((m)=>byFixture.get(m.fixtureId)?.userRating ?? null);
            const aiVals = aiSeries.filter((v)=>v != null);
            const userVals = userSeries.filter((v)=>v != null);
            const matchesPlayed = aiVals.length;
            // Promedio "temporada completa": los partidos que no jugó cuentan como si hubiera
            // jugado con nota 5 -- así el promedio refleja el total de la temporada, no solo
            // sus partidos jugados (un jugador con pocos partidos y notas altas ya no sale mejor
            // que uno que sostuvo un buen nivel jugando toda la temporada).
            const aiAvg = totalMatches > 0 ? (aiVals.reduce((a, b)=>a + b, 0) + DEFAULT_MISSED * (totalMatches - matchesPlayed)) / totalMatches : null;
            const userAvg = userVals.length ? userVals.reduce((a, b)=>a + b, 0) / userVals.length : null;
            return {
                pid,
                name,
                aiSeries,
                userSeries,
                aiAvg,
                userAvg,
                matchesPlayed
            };
        });
        return rows0.sort((a, b)=>(b.aiAvg ?? -1) - (a.aiAvg ?? -1));
    }, [
        seasonRatings,
        seasonMatches,
        ratingsOpen,
        lastMatchPlayers,
        lastMatchPlayerMap
    ]);
    // Jugadores donde tu calificación se aleja más de la de la IA -- útil como gancho de
    // contenido ("¿por qué calificaste tan distinto a Fulano?").
    const discrepancies = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        return playerSummaries.filter((p)=>p.aiAvg != null && p.userAvg != null).map((p)=>({
                ...p,
                diff: Math.abs(p.userAvg - p.aiAvg)
            })).sort((a, b)=>b.diff - a.diff).slice(0, 5);
    }, [
        playerSummaries
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen",
        style: {
            background: "var(--bg)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$NavBar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                active: "/calificaciones"
            }, void 0, false, {
                fileName: "[project]/app/calificaciones/page.tsx",
                lineNumber: 203,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-7xl mx-auto px-8 py-8 flex flex-col gap-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-display text-2xl font-extrabold",
                                children: "Calificaciones"
                            }, void 0, false, {
                                fileName: "[project]/app/calificaciones/page.tsx",
                                lineNumber: 207,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-1.5 overflow-x-auto pb-1",
                        children: seasons.map((s, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                    isCurrentSeasonTab && !ratingsOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm px-1",
                        style: {
                            color: "var(--muted)"
                        },
                        children: [
                            "Aún no se ha jugado ningún partido de Real Madrid en la temporada ",
                            activeSeason != null ? seasonLabel(activeSeason) : "",
                            ".",
                            nextMatch ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    " El recuadro para calificar aparece aquí mismo apenas termine el próximo partido: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border overflow-hidden",
                        style: {
                            background: "var(--surface)",
                            borderColor: "var(--line)"
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-4 py-3 flex items-baseline justify-between flex-wrap gap-2",
                                style: {
                                    borderBottom: "1px solid var(--line)"
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                    ratingsOpen && lastMatch && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-x-auto",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "w-full text-xs",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                style: {
                                                    borderBottom: "1px solid var(--line)"
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                                    ratingsOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            children: playerSummaries.map((row)=>{
                                                const canRateHere = ratingsOpen && lastMatchPlayerMap.has(row.pid);
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            style: {
                                                                borderBottom: "1px solid var(--line)"
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 whitespace-nowrap cursor-pointer",
                                                                    onClick: ()=>setExpandedPlayer(expandedPlayer === row.pid ? null : row.pid),
                                                                    children: row.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 273,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 cursor-pointer",
                                                                    onClick: ()=>setExpandedPlayer(expandedPlayer === row.pid ? null : row.pid),
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Sparkline, {
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
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 text-right font-mono",
                                                                    children: row.aiAvg != null ? row.aiAvg.toFixed(1) : "—"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 282,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2 text-right font-mono",
                                                                    children: row.userAvg != null ? row.userAvg.toFixed(1) : "—"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/calificaciones/page.tsx",
                                                                    lineNumber: 283,
                                                                    columnNumber: 25
                                                                }, this),
                                                                ratingsOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                    className: "px-4 py-2",
                                                                    children: canRateHere ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center gap-2 justify-end",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                                        expandedPlayer === row.pid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                colSpan: ratingsOpen ? 5 : 4,
                                                                className: "px-4 pb-5",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(BigChart, {
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
                            playerSummaries.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                    discrepancies.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border overflow-hidden",
                        style: {
                            background: "var(--surface)",
                            borderColor: "var(--line)"
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-4 py-3",
                                style: {
                                    borderBottom: "1px solid var(--line)"
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col",
                                children: discrepancies.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-3 px-4 py-2.5",
                                        style: {
                                            borderBottom: "1px solid var(--line)"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-sm flex-1",
                                                children: d.name
                                            }, void 0, false, {
                                                fileName: "[project]/app/calificaciones/page.tsx",
                                                lineNumber: 354,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
}),
"[project]/app/components/LogoMark.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
function RealMadridCrest({ size = 40 }) {
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    if (failed) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MonogramMark, {
        size: size
    }, void 0, false, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 10,
        columnNumber: 22
    }, this);
    return(// eslint-disable-next-line @next/next/no-img-element
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
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
function MonogramMark({ size = 40 }) {
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    if (failed) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            width: size,
            height: size,
            viewBox: "0 0 40 40",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
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
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
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
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
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
function MonogramMarkGold({ size = 40 }) {
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    if (failed) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MonogramMark, {
        size: size
    }, void 0, false, {
        fileName: "[project]/app/components/LogoMark.tsx",
        lineNumber: 60,
        columnNumber: 22
    }, this);
    return(// eslint-disable-next-line @next/next/no-img-element
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
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
function ShieldMark({ size = 22, color = "#d9b95c" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M12 2 L22 7 V17 L12 22 L2 17 V7 Z",
                stroke: color,
                strokeWidth: "1.6"
            }, void 0, false, {
                fileName: "[project]/app/components/LogoMark.tsx",
                lineNumber: 77,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
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
}),
"[project]/app/components/NavBar.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>NavBar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$LogoMark$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/LogoMark.tsx [app-ssr] (ecmascript)");
"use client";
;
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
    const [floating, setFloating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onScroll = ()=>setFloating(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, {
            passive: true
        });
        return ()=>window.removeEventListener("scroll", onScroll);
    }, []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "sticky top-0 z-50 flex items-center justify-between px-8 h-16 transition-all",
        style: {
            background: "var(--purple)",
            boxShadow: floating ? "0 6px 18px -6px rgba(20,15,40,.45)" : "none"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/",
                className: "flex items-center gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$LogoMark$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MonogramMarkGold"], {
                        size: 30
                    }, void 0, false, {
                        fileName: "[project]/app/components/NavBar.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-6 items-center",
                children: LINKS.map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
}),
"[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].ReactJsxDevRuntime;
}),
];

//# sourceMappingURL=_18rno88._.js.map