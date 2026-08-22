"""
Descarga alineación titular (con entrenador y formación) y eventos
(goles/asistencias/tarjetas) de cada partido FINALIZADO del Real Madrid --
LaLiga + Champions League. Es lo que alimenta el detalle de partido del
dashboard y el "cargar última alineación" de la Pizarra táctica.
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


def api_get(path, params, retries=4):
    for attempt in range(retries):
        try:
            r = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
        except requests.exceptions.RequestException:
            time.sleep(3)
            continue
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            return None
        time.sleep(2)
    return None


def save_lineups(cur, fixture_id, data):
    for team_block in data.get("response", []):
        team_id = team_block["team"]["id"]
        coach = team_block.get("coach") or {}
        cur.execute(
            """
            IF NOT EXISTS (SELECT 1 FROM dbo.MatchLineups WHERE FixtureId=? AND TeamId=?)
                INSERT INTO dbo.MatchLineups (FixtureId, TeamId, CoachName, Formation) VALUES (?, ?, ?, ?);
            """,
            fixture_id, team_id, fixture_id, team_id, coach.get("name"), team_block.get("formation"),
        )
        for entry in team_block.get("startXI", []):
            p = entry["player"]
            if p.get("id") is None:
                continue
            cur.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM dbo.MatchLineupPlayers WHERE FixtureId=? AND TeamId=? AND PlayerId=?)
                    INSERT INTO dbo.MatchLineupPlayers (FixtureId, TeamId, PlayerId, PlayerName, ShirtNumber, PosCode, GridSlot, IsStarter)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1);
                """,
                fixture_id, team_id, p["id"],
                fixture_id, team_id, p["id"], p["name"], p["number"], p["pos"], p["grid"],
            )
        for entry in team_block.get("substitutes", []):
            p = entry["player"]
            if p.get("id") is None:
                continue
            cur.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM dbo.MatchLineupPlayers WHERE FixtureId=? AND TeamId=? AND PlayerId=?)
                    INSERT INTO dbo.MatchLineupPlayers (FixtureId, TeamId, PlayerId, PlayerName, ShirtNumber, PosCode, GridSlot, IsStarter)
                    VALUES (?, ?, ?, ?, ?, ?, NULL, 0);
                """,
                fixture_id, team_id, p["id"],
                fixture_id, team_id, p["id"], p["name"], p["number"], p["pos"],
            )


def save_events(cur, fixture_id, data):
    for e in data.get("response", []):
        player = e.get("player") or {}
        assist = e.get("assist") or {}
        cur.execute(
            """
            INSERT INTO dbo.MatchEvents2
                (FixtureId, TeamId, Minute, ExtraMinute, PlayerId, PlayerName, AssistPlayerId, AssistPlayerName, EventType, EventDetail)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            fixture_id, e["team"]["id"], e["time"]["elapsed"], e["time"]["extra"],
            player.get("id"), player.get("name"), assist.get("id"), assist.get("name"),
            e["type"], e.get("detail"),
        )


def run():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT FixtureId FROM dbo.Fixtures
        WHERE (HomeTeamId=? OR AwayTeamId=?) AND StatusShort='FT'
        AND FixtureId NOT IN (SELECT DISTINCT FixtureId FROM dbo.MatchLineups)
        ORDER BY KickoffUtc DESC
        """, REAL_MADRID_ID, REAL_MADRID_ID,
    )
    fixture_ids = [r[0] for r in cur.fetchall()]
    print(f"Pendientes: {len(fixture_ids)} partidos")

    done = 0
    for fid in fixture_ids:
        lineups = api_get("fixtures/lineups", {"fixture": fid})
        events = api_get("fixtures/events", {"fixture": fid})
        if lineups is None or events is None:
            print("  ! cuota agotada, deteniendo de forma segura")
            break
        if lineups.get("response"):
            save_lineups(cur, fid, lineups)
        if events.get("response"):
            cur.execute("DELETE FROM dbo.MatchEvents2 WHERE FixtureId=?", fid)
            save_events(cur, fid, events)
        done += 1
        if done % 40 == 0:
            conn.commit()
            print(f"  {done}/{len(fixture_ids)}...")
        time.sleep(0.1)

    conn.commit()
    print(f"Total procesados: {done}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
