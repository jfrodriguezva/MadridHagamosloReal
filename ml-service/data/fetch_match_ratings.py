"""
Descarga la calificación de partido (0-10) que da API-Football a cada
jugador del Real Madrid en sus últimos N partidos -- es la "calificación IA"
que se compara contra la calificación que tú das en /calificaciones.
"""
import os
import sys
import time
import pip_system_certs.wrapt_requests  # noqa: F401
import requests
from dotenv import load_dotenv
from db import get_connection

load_dotenv()

API_KEY = os.environ["API_FOOTBALL_KEY"]
BASE = os.environ["API_FOOTBALL_BASE"]
REAL_MADRID_ID = int(os.environ["REAL_MADRID_TEAM_ID"])
HEADERS = {"x-apisports-key": API_KEY}
N_MATCHES = int(sys.argv[1]) if len(sys.argv) > 1 else 15


def api_get(path, params):
    r = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def run():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT TOP (?) FixtureId FROM Fixtures
        WHERE (HomeTeamId=? OR AwayTeamId=?) AND StatusShort='FT'
        AND FixtureId NOT IN (SELECT DISTINCT FixtureId FROM MatchPlayerRatings)
        ORDER BY KickoffUtc DESC
        """, N_MATCHES, REAL_MADRID_ID, REAL_MADRID_ID,
    )
    fixture_ids = [r[0] for r in cur.fetchall()]
    print(f"Pendientes: {len(fixture_ids)} partidos")

    for fid in fixture_ids:
        data = api_get("fixtures/players", {"fixture": fid})
        for team_block in data.get("response", []):
            if team_block["team"]["id"] != REAL_MADRID_ID:
                continue
            for p in team_block["players"]:
                stats = p["statistics"][0] if p["statistics"] else None
                if not stats or not stats["games"].get("rating"):
                    continue
                try:
                    rating_val = float(stats["games"]["rating"])
                except (ValueError, TypeError):
                    continue
                cur.execute(
                    """
                    IF NOT EXISTS (SELECT 1 FROM MatchPlayerRatings WHERE FixtureId=? AND PlayerId=?)
                        INSERT INTO MatchPlayerRatings (FixtureId, PlayerId, AiRating, Minutes) VALUES (?, ?, ?, ?);
                    """,
                    fid, p["player"]["id"],
                    fid, p["player"]["id"], rating_val, stats["games"]["minutes"],
                )
        conn.commit()
        time.sleep(0.15)

    print("Listo.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
