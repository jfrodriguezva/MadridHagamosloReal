"""
Descarga estadísticas por partido (tiros, posesión, córners, faltas) SOLO
para los partidos del Real Madrid -- son las que de verdad mueven la aguja
en la literatura (xG-proxy) y son caras de pedir para las 6,000+ filas de
toda la liga, así que se reservan para el mercado más importante del
producto: predicción de los propios partidos del Madrid.
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


def api_get(path, params, retries=3):
    for attempt in range(retries):
        resp = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
        if resp.status_code == 200:
            return resp.json()
        print(f"  ! HTTP {resp.status_code} on {path} {params}, retry {attempt+1}/{retries}")
        time.sleep(2 * (attempt + 1))
    return None


STAT_MAP = {
    "Shots on Goal": "ShotsOnGoal",
    "Total Shots": "TotalShots",
    "Ball Possession": "BallPossessionPct",
    "Corner Kicks": "Corners",
    "Fouls": "Fouls",
    "Yellow Cards": "YellowCards",
    "Red Cards": "RedCards",
}


def parse_value(stat_type, value):
    if value is None:
        return None
    if stat_type == "Ball Possession":
        try:
            return float(str(value).replace("%", ""))
        except ValueError:
            return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def run():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT FixtureId FROM dbo.Fixtures
        WHERE (HomeTeamId = ? OR AwayTeamId = ?) AND StatusShort = 'FT'
        AND FixtureId NOT IN (SELECT DISTINCT FixtureId FROM dbo.FixtureStatistics)
        ORDER BY KickoffUtc
        """,
        REAL_MADRID_ID, REAL_MADRID_ID,
    )
    fixture_ids = [r[0] for r in cur.fetchall()]
    print(f"Pendientes de descargar: {len(fixture_ids)} partidos")

    saved = 0
    for i, fid in enumerate(fixture_ids):
        data = api_get("fixtures/statistics", {"fixture": fid})
        if not data or not data.get("response"):
            continue
        for team_block in data["response"]:
            team_id = team_block["team"]["id"]
            values = {}
            for s in team_block["statistics"]:
                col = STAT_MAP.get(s["type"])
                if col:
                    values[col] = parse_value(s["type"], s["value"])
            if not values:
                continue
            cur.execute(
                """
                MERGE dbo.FixtureStatistics AS tgt
                USING (SELECT ? AS FixtureId, ? AS TeamId) AS src
                ON tgt.FixtureId = src.FixtureId AND tgt.TeamId = src.TeamId
                WHEN MATCHED THEN UPDATE SET
                    ShotsOnGoal=?, TotalShots=?, BallPossessionPct=?, Corners=?, Fouls=?, YellowCards=?, RedCards=?
                WHEN NOT MATCHED THEN INSERT
                    (FixtureId, TeamId, ShotsOnGoal, TotalShots, BallPossessionPct, Corners, Fouls, YellowCards, RedCards)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                fid, team_id,
                values.get("ShotsOnGoal"), values.get("TotalShots"), values.get("BallPossessionPct"),
                values.get("Corners"), values.get("Fouls"), values.get("YellowCards"), values.get("RedCards"),
                fid, team_id,
                values.get("ShotsOnGoal"), values.get("TotalShots"), values.get("BallPossessionPct"),
                values.get("Corners"), values.get("Fouls"), values.get("YellowCards"), values.get("RedCards"),
            )
        saved += 1
        if saved % 50 == 0:
            conn.commit()
            print(f"  {saved}/{len(fixture_ids)} guardados...")
        time.sleep(0.12)

    conn.commit()
    print(f"Total guardado: {saved} partidos")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
