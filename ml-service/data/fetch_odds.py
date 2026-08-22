"""
Descarga momios reales de casas de apuestas para los próximos partidos del
Real Madrid (mercado 'Match Winner' 1X2) y los normaliza a probabilidad
implícita (quitando el margen de la casa) para comparar contra el modelo.
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
HEADERS = {"x-apisports-key": API_KEY}


def api_get(path, params):
    r = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def implied_probs(odd_h, odd_d, odd_a):
    raw = [1 / odd_h, 1 / odd_d, 1 / odd_a]
    overround = sum(raw)  # >1.0 -- margen de la casa
    return [round(x / overround, 4) for x in raw]


def run():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT FixtureId FROM dbo.Fixtures
        WHERE (HomeTeamId=? OR AwayTeamId=?) AND StatusShort='NS'
        ORDER BY KickoffUtc ASC
        """, REAL_MADRID_ID, REAL_MADRID_ID,
    )
    fixture_ids = [r[0] for r in cur.fetchall()][:6]  # próximos 6 partidos
    if fixture_ids:
        placeholders = ",".join("?" * len(fixture_ids))
        cur.execute(f"DELETE FROM dbo.OddsSnapshots WHERE FixtureId IN ({placeholders})", fixture_ids)

    saved = 0
    for fid in fixture_ids:
        data = api_get("odds", {"fixture": fid})
        response = data.get("response", [])
        if not response:
            print(f"  sin momios para fixture {fid} (aún no publicados)")
            continue

        bookmakers = response[0]["bookmakers"]
        for bk in bookmakers[:5]:  # top 5 casas por partido, suficiente para "cómo se mueven"
            match_winner = next((b for b in bk["bets"] if b["name"] == "Match Winner"), None)
            if not match_winner:
                continue
            values = {v["value"]: float(v["odd"]) for v in match_winner["values"]}
            if not all(k in values for k in ("Home", "Draw", "Away")):
                continue
            ih, idr, ia = implied_probs(values["Home"], values["Draw"], values["Away"])
            cur.execute(
                """
                INSERT INTO dbo.OddsSnapshots
                    (FixtureId, Bookmaker, OddHome, OddDraw, OddAway, ImpliedHome, ImpliedDraw, ImpliedAway)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                fid, bk["name"], values["Home"], values["Draw"], values["Away"], ih, idr, ia,
            )
            saved += 1
        print(f"  fixture {fid}: {len(bookmakers[:5])} casas guardadas")
        time.sleep(0.2)

    conn.commit()
    print(f"Total snapshots de momios guardados: {saved}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
