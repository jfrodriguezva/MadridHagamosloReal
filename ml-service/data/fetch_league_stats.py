"""
Descarga estadísticas por partido (tiros, posesión, córners, faltas) de
TODOS los partidos de La Liga en base (no solo Real Madrid) -- necesario
para que BTTS y Over/Under dejen de depender solo de goles históricos y
puedan usar un proxy real de xG para cualquier equipo rival del Madrid.
Reanudable: solo pide lo que falte, respeta el límite diario del plan.
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
HEADERS = {"x-apisports-key": API_KEY}

STAT_MAP = {
    "Shots on Goal": "ShotsOnGoal",
    "Total Shots": "TotalShots",
    "Ball Possession": "BallPossessionPct",
    "Corner Kicks": "Corners",
    "Fouls": "Fouls",
    "Yellow Cards": "YellowCards",
    "Red Cards": "RedCards",
}

DAILY_SAFETY_MARGIN = 300  # deja colchón para no agotar el plan del día


def api_get(path, params, retries=5):
    for attempt in range(retries):
        try:
            resp = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
        except requests.exceptions.RequestException as e:
            print(f"  ! error de red en {path} {params}: {e}, retry {attempt+1}/{retries}")
            time.sleep(3 * (attempt + 1))
            continue
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 429:
            print("  ! límite de requests alcanzado por hoy, deteniendo de forma segura")
            return None
        print(f"  ! HTTP {resp.status_code} en {path} {params}, retry {attempt+1}/{retries}")
        time.sleep(2 * (attempt + 1))
    return None


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


def check_quota():
    data = api_get("status", {})
    if not data:
        return 0
    r = data["response"]["requests"]
    remaining = r["limit_day"] - r["current"]
    print(f"Cuota restante hoy: {remaining} de {r['limit_day']}")
    return remaining


def run():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT FixtureId FROM dbo.Fixtures
        WHERE StatusShort = 'FT' AND Season >= 2015
        -- temporadas 2010-2014: confirmado con la API que no tienen estadísticas
        -- de tiros/posesión disponibles (fixtures/statistics devuelve vacío) --
        -- no vale la pena seguir gastando cuota diaria en volver a pedirlas.
        AND FixtureId NOT IN (SELECT DISTINCT FixtureId FROM dbo.FixtureStatistics)
        ORDER BY KickoffUtc DESC
        """
    )
    fixture_ids = [r[0] for r in cur.fetchall()]
    print(f"Pendientes de descargar: {len(fixture_ids)} partidos")

    remaining_quota = check_quota()
    budget = max(0, remaining_quota - DAILY_SAFETY_MARGIN)
    to_fetch = fixture_ids[:budget]
    print(f"Con el colchón de seguridad, se descargarán hoy: {len(to_fetch)} partidos "
          f"(quedarán {len(fixture_ids) - len(to_fetch)} para la próxima corrida)")

    saved = 0
    consecutive_failures = 0
    for fid in to_fetch:
        data = api_get("fixtures/statistics", {"fixture": fid})
        if data is None:
            consecutive_failures += 1
            if consecutive_failures >= 5:
                print("  ! 5 fallos seguidos (probablemente cuota agotada), deteniendo de forma segura")
                break
            continue  # fallo puntual de red ya reintentado -- se sigue con el siguiente partido
        consecutive_failures = 0
        if not data.get("response"):
            saved += 1
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
        if saved % 200 == 0:
            conn.commit()
            print(f"  {saved}/{len(to_fetch)} guardados...")
        time.sleep(0.1)

    conn.commit()
    print(f"Total guardado esta corrida: {saved}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
