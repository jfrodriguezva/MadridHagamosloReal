"""
Descarga la plantilla actual del Real Madrid + estadísticas de temporada
(todas las competiciones, LaLiga priorizada) desde API-Football, y las
guarda en dbo.Players / dbo.PlayerSeasonStats.
"""
import os
import time
import pip_system_certs.wrapt_requests  # noqa: F401
import requests
from dotenv import load_dotenv
from db import get_connection

load_dotenv()

API_KEY = os.environ["API_FOOTBALL_KEY"]
BASE = os.environ["API_FOOTBALL_BASE"]
REAL_MADRID_ID = int(os.environ["REAL_MADRID_TEAM_ID"])
LALIGA_ID = int(os.environ["LALIGA_LEAGUE_ID"])
HEADERS = {"x-apisports-key": API_KEY}
SEASON = 2025


def api_get(path, params, retries=3):
    for attempt in range(retries):
        resp = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
        if resp.status_code == 200:
            return resp.json()
        print(f"  ! HTTP {resp.status_code} en {path} {params}, retry {attempt+1}/{retries}")
        time.sleep(2 * (attempt + 1))
    return None


def pick_best_stats_block(statistics):
    """Prioriza LaLiga; si no jugó LaLiga toma el bloque con más minutos."""
    laliga = [s for s in statistics if s["league"]["id"] == LALIGA_ID]
    if laliga:
        return laliga[0]
    return max(statistics, key=lambda s: s["games"]["minutes"] or 0, default=None)


def aggregate_all_competitions(statistics):
    agg = {
        "appearances": 0, "minutes": 0, "goals": 0, "assists": 0,
        "shots_total": 0, "shots_on": 0, "passes_total": 0, "key_passes": 0,
        "tackles_total": 0, "interceptions": 0, "duels_total": 0, "duels_won": 0,
        "dribbles_attempts": 0, "dribbles_success": 0, "fouls_committed": 0,
        "yellow": 0, "red": 0, "ratings": [],
    }
    for s in statistics:
        g = s["games"]
        agg["appearances"] += g["appearences"] or 0
        agg["minutes"] += g["minutes"] or 0
        if g["rating"]:
            try:
                agg["ratings"].append(float(g["rating"]))
            except ValueError:
                pass
        agg["goals"] += (s["goals"]["total"] or 0)
        agg["assists"] += (s["goals"]["assists"] or 0)
        agg["shots_total"] += (s["shots"]["total"] or 0)
        agg["shots_on"] += (s["shots"]["on"] or 0)
        agg["passes_total"] += (s["passes"]["total"] or 0)
        agg["key_passes"] += (s["passes"]["key"] or 0)
        agg["tackles_total"] += (s["tackles"]["total"] or 0)
        agg["interceptions"] += (s["tackles"]["interceptions"] or 0)
        agg["duels_total"] += (s["duels"]["total"] or 0)
        agg["duels_won"] += (s["duels"]["won"] or 0)
        agg["dribbles_attempts"] += (s["dribbles"]["attempts"] or 0)
        agg["dribbles_success"] += (s["dribbles"]["success"] or 0)
        agg["fouls_committed"] += (s["fouls"]["committed"] or 0)
        agg["yellow"] += (s["cards"]["yellow"] or 0)
        agg["red"] += (s["cards"]["red"] or 0)
    return agg


def run():
    conn = get_connection()
    cur = conn.cursor()

    all_players = []
    page = 1
    while True:
        data = api_get("players", {"team": REAL_MADRID_ID, "season": SEASON, "page": page})
        if not data or not data.get("response"):
            break
        all_players.extend(data["response"])
        total_pages = data["paging"]["total"]
        print(f"  página {page}/{total_pages} -- {len(data['response'])} jugadores")
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.3)

    print(f"Total jugadores encontrados: {len(all_players)}")

    for p in all_players:
        info = p["player"]
        stats_list = p["statistics"]
        if not stats_list:
            continue
        best = pick_best_stats_block(stats_list)
        position = best["games"]["position"] if best else None
        number = best["games"]["number"] if best else None

        cur.execute(
            """
            MERGE dbo.Players AS tgt
            USING (SELECT ? AS PlayerId) AS src ON tgt.PlayerId = src.PlayerId
            WHEN MATCHED THEN UPDATE SET
                Name=?, Age=?, Nationality=?, HeightCm=?, WeightKg=?, PhotoUrl=?, Position=?, ShirtNumber=?
            WHEN NOT MATCHED THEN INSERT
                (PlayerId, TeamId, Name, Age, Nationality, HeightCm, WeightKg, PhotoUrl, Position, ShirtNumber)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            info["id"],
            info["name"], info["age"], info["nationality"],
            int((info["height"] or "0").replace(" cm", "")) if info.get("height") else None,
            int((info["weight"] or "0").replace(" kg", "")) if info.get("weight") else None,
            info["photo"], position, number,
            info["id"], REAL_MADRID_ID, info["name"], info["age"], info["nationality"],
            int((info["height"] or "0").replace(" cm", "")) if info.get("height") else None,
            int((info["weight"] or "0").replace(" kg", "")) if info.get("weight") else None,
            info["photo"], position, number,
        )

        agg = aggregate_all_competitions(stats_list)
        rating_avg = sum(agg["ratings"]) / len(agg["ratings"]) if agg["ratings"] else None
        passes_acc = None
        laliga_block = next((s for s in stats_list if s["league"]["id"] == LALIGA_ID), None)
        if laliga_block and laliga_block["passes"]["accuracy"]:
            try:
                passes_acc = float(laliga_block["passes"]["accuracy"])
            except (ValueError, TypeError):
                passes_acc = None

        cur.execute(
            """
            MERGE dbo.PlayerSeasonStats AS tgt
            USING (SELECT ? AS PlayerId, ? AS Season) AS src
            ON tgt.PlayerId = src.PlayerId AND tgt.Season = src.Season
            WHEN MATCHED THEN UPDATE SET
                Appearances=?, Minutes=?, Goals=?, Assists=?, ShotsTotal=?, ShotsOn=?,
                PassesTotal=?, PassesAccuracyPct=?, KeyPasses=?, TacklesTotal=?, Interceptions=?,
                DuelsTotal=?, DuelsWon=?, DribblesAttempts=?, DribblesSuccess=?,
                FoulsCommitted=?, YellowCards=?, RedCards=?, RatingAvg=?
            WHEN NOT MATCHED THEN INSERT
                (PlayerId, Season, Appearances, Minutes, Goals, Assists, ShotsTotal, ShotsOn,
                 PassesTotal, PassesAccuracyPct, KeyPasses, TacklesTotal, Interceptions,
                 DuelsTotal, DuelsWon, DribblesAttempts, DribblesSuccess,
                 FoulsCommitted, YellowCards, RedCards, RatingAvg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            info["id"], SEASON,
            agg["appearances"], agg["minutes"], agg["goals"], agg["assists"], agg["shots_total"], agg["shots_on"],
            agg["passes_total"], passes_acc, agg["key_passes"], agg["tackles_total"], agg["interceptions"],
            agg["duels_total"], agg["duels_won"], agg["dribbles_attempts"], agg["dribbles_success"],
            agg["fouls_committed"], agg["yellow"], agg["red"], rating_avg,
            info["id"], SEASON,
            agg["appearances"], agg["minutes"], agg["goals"], agg["assists"], agg["shots_total"], agg["shots_on"],
            agg["passes_total"], passes_acc, agg["key_passes"], agg["tackles_total"], agg["interceptions"],
            agg["duels_total"], agg["duels_won"], agg["dribbles_attempts"], agg["dribbles_success"],
            agg["fouls_committed"], agg["yellow"], agg["red"], rating_avg,
        )

    conn.commit()
    print("Listo.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
