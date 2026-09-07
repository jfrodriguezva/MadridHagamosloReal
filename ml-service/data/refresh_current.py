"""
Actualización en vivo para la app instalada (SQLite): trae solo lo que
puede haber cambiado desde la última vez -- la temporada actual de LaLiga
y Champions, alineaciones/eventos/calificaciones de partidos recién
jugados, la plantilla vigente, y momios de los próximos partidos. No
vuelve a descargar el histórico completo (eso quedó ya en madrid.db desde
el desarrollo) para no gastar cuota de API de más en cada clic.

Se ejecuta con el Python portátil que trae el instalador:
    runtime\\python\\python.exe data\\refresh_current.py
usando SQLITE_PATH (obligatoria) y las credenciales de API-Football desde
un archivo .env en la misma carpeta (API_FOOTBALL_KEY, API_FOOTBALL_BASE,
LALIGA_LEAGUE_ID, REAL_MADRID_TEAM_ID).
"""
import datetime
import os
import sys
import time

# el intérprete portátil embebido no agrega automáticamente la carpeta del
# script a sys.path -- se agrega a mano para poder importar db_sqlite.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pip_system_certs.wrapt_requests  # noqa: F401 -- confía en el almacén de certificados de Windows
import requests
from dotenv import load_dotenv

# Carga el .env de la MISMA carpeta que este script (no del directorio de
# trabajo actual) -- así funciona sin importar desde dónde lo lance la app.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from db_sqlite import get_connection  # noqa: E402 -- después de load_dotenv()

API_KEY = os.environ["API_FOOTBALL_KEY"]
BASE = os.environ["API_FOOTBALL_BASE"]
LALIGA_LEAGUE_ID = int(os.environ["LALIGA_LEAGUE_ID"])
REAL_MADRID_ID = int(os.environ["REAL_MADRID_TEAM_ID"])
UCL_LEAGUE_ID = 2
HEADERS = {"x-apisports-key": API_KEY}


def log(msg):
    print(msg, flush=True)


def current_season():
    today = datetime.date.today()
    return today.year if today.month >= 7 else today.year - 1


def api_get(path, params, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
        except requests.exceptions.RequestException as e:
            log(f"  ! red: {e}, reintento {attempt+1}/{retries}")
            time.sleep(2)
            continue
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            log("  ! cuota de API agotada por ahora")
            return None
        log(f"  ! HTTP {r.status_code} en {path}, reintento {attempt+1}/{retries}")
        time.sleep(2)
    return None


def upsert_league(cur, league_id, name, country):
    cur.execute("INSERT OR IGNORE INTO Leagues (LeagueId, Name, Country) VALUES (?, ?, ?)", league_id, name, country)


def upsert_team(cur, team_id, name, country):
    cur.execute("INSERT OR IGNORE INTO Teams (TeamId, Name, Country) VALUES (?, ?, ?)", team_id, name, country)


def upsert_fixture(cur, f, competition_type=None):
    fx, lg, teams, goals, score = f["fixture"], f["league"], f["teams"], f["goals"], f["score"]
    comp = competition_type or "LEAGUE"
    cur.execute(
        """
        INSERT INTO Fixtures
            (FixtureId, LeagueId, Season, RoundLabel, KickoffUtc, StatusShort,
             HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, HomeGoalsHT, AwayGoalsHT,
             VenueId, RefereeName, CompetitionType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(FixtureId) DO UPDATE SET
            HomeGoals=excluded.HomeGoals, AwayGoals=excluded.AwayGoals, StatusShort=excluded.StatusShort
        """,
        fx["id"], lg["id"], lg["season"], lg["round"], fx["date"], fx["status"]["short"],
        teams["home"]["id"], teams["away"]["id"], goals["home"], goals["away"],
        score["halftime"]["home"], score["halftime"]["away"],
        fx["venue"]["id"], fx["referee"], comp,
    )


def step_fixtures(cur):
    log("1/7 · Fixtures de la temporada actual (LaLiga)...")
    season = current_season()
    data = api_get("fixtures", {"league": LALIGA_LEAGUE_ID, "season": season})
    if not data:
        return
    upsert_league(cur, LALIGA_LEAGUE_ID, "La Liga", "Spain")
    n = 0
    for f in data.get("response", []):
        teams = f["teams"]
        upsert_team(cur, teams["home"]["id"], teams["home"]["name"], "Spain")
        upsert_team(cur, teams["away"]["id"], teams["away"]["name"], "Spain")
        upsert_fixture(cur, f, "LEAGUE")
        n += 1
    log(f"   {n} partidos de LaLiga {season}-{season+1} actualizados")

    log("2/7 · Fixtures de la temporada actual (Champions)...")
    data = api_get("fixtures", {"team": REAL_MADRID_ID, "league": UCL_LEAGUE_ID, "season": season})
    if data:
        upsert_league(cur, UCL_LEAGUE_ID, "UEFA Champions League", "Europe")
        n = 0
        for f in data.get("response", []):
            for t in (f["teams"]["home"], f["teams"]["away"]):
                upsert_team(cur, t["id"], t["name"], "N/A")
            upsert_fixture(cur, f, "UCL")
            n += 1
        log(f"   {n} partidos de Champions {season}-{season+1} actualizados")


def step_lineups_events(cur):
    log("3/7 · Alineaciones y eventos de partidos recién jugados...")
    # Solo la temporada en curso -- el histórico ya se cargó una vez durante el
    # desarrollo; este botón es para lo nuevo, no para rehacer un backfill completo.
    cur.execute(
        """
        SELECT FixtureId FROM Fixtures
        WHERE (HomeTeamId=? OR AwayTeamId=?) AND StatusShort='FT' AND Season=?
        AND FixtureId NOT IN (SELECT DISTINCT FixtureId FROM MatchLineups)
        ORDER BY KickoffUtc DESC
        """, REAL_MADRID_ID, REAL_MADRID_ID, current_season(),
    )
    fixture_ids = [r[0] for r in cur.fetchall()]
    if not fixture_ids:
        log("   nada nuevo")
        return
    log(f"   {len(fixture_ids)} partido(s) pendiente(s)")
    for fid in fixture_ids:
        lineups = api_get("fixtures/lineups", {"fixture": fid})
        events = api_get("fixtures/events", {"fixture": fid})
        if lineups is None or events is None:
            log("   ! cuota agotada, se detiene aquí de forma segura")
            break
        for team_block in (lineups or {}).get("response", []):
            team_id = team_block["team"]["id"]
            coach = team_block.get("coach") or {}
            cur.execute(
                "INSERT OR IGNORE INTO MatchLineups (FixtureId, TeamId, CoachName, Formation) VALUES (?, ?, ?, ?)",
                fid, team_id, coach.get("name"), team_block.get("formation"),
            )
            for entry in team_block.get("startXI", []):
                p = entry["player"]
                if p.get("id") is None:
                    continue
                cur.execute(
                    """
                    INSERT OR IGNORE INTO MatchLineupPlayers
                        (FixtureId, TeamId, PlayerId, PlayerName, ShirtNumber, PosCode, GridSlot, IsStarter)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    fid, team_id, p["id"], p["name"], p["number"], p["pos"], p["grid"],
                )
            for entry in team_block.get("substitutes", []):
                p = entry["player"]
                if p.get("id") is None:
                    continue
                cur.execute(
                    """
                    INSERT OR IGNORE INTO MatchLineupPlayers
                        (FixtureId, TeamId, PlayerId, PlayerName, ShirtNumber, PosCode, GridSlot, IsStarter)
                    VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
                    """,
                    fid, team_id, p["id"], p["name"], p["number"], p["pos"],
                )
        if (events or {}).get("response"):
            cur.execute("DELETE FROM MatchEvents2 WHERE FixtureId=?", fid)
            for e in events["response"]:
                player = e.get("player") or {}
                assist = e.get("assist") or {}
                cur.execute(
                    """
                    INSERT INTO MatchEvents2
                        (FixtureId, TeamId, Minute, ExtraMinute, PlayerId, PlayerName, AssistPlayerId, AssistPlayerName, EventType, EventDetail)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    fid, e["team"]["id"], e["time"]["elapsed"], e["time"]["extra"],
                    player.get("id"), player.get("name"), assist.get("id"), assist.get("name"),
                    e["type"], e.get("detail"),
                )
        time.sleep(0.15)


def step_ratings(cur):
    log("4/7 · Calificaciones de rendimiento (IA)...")
    # Igual que arriba: solo temporada en curso -- los ~200 partidos viejos sin
    # calificación (API-Football no las tiene para temporadas muy antiguas) no
    # se vuelven a intentar en cada clic del botón.
    cur.execute(
        """
        SELECT FixtureId FROM Fixtures
        WHERE (HomeTeamId=? OR AwayTeamId=?) AND StatusShort='FT' AND Season=?
        AND FixtureId NOT IN (SELECT DISTINCT FixtureId FROM MatchPlayerRatings)
        ORDER BY KickoffUtc DESC
        """, REAL_MADRID_ID, REAL_MADRID_ID, current_season(),
    )
    fixture_ids = [r[0] for r in cur.fetchall()]
    if not fixture_ids:
        log("   nada nuevo")
        return
    log(f"   {len(fixture_ids)} partido(s) pendiente(s)")
    for fid in fixture_ids:
        data = api_get("fixtures/players", {"fixture": fid})
        if data is None:
            log("   ! cuota agotada, se detiene aquí de forma segura")
            break
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
                    "INSERT OR IGNORE INTO MatchPlayerRatings (FixtureId, PlayerId, AiRating, Minutes) VALUES (?, ?, ?, ?)",
                    fid, p["player"]["id"], rating_val, stats["games"]["minutes"],
                )
        time.sleep(0.15)


def step_squad(cur):
    log("5/7 · Plantilla vigente...")
    r = requests.get(f"{BASE}/players/squads", headers=HEADERS, params={"team": REAL_MADRID_ID}, timeout=20)
    r.raise_for_status()
    squad = r.json()["response"][0]["players"]
    cur.execute("UPDATE Players SET IsCurrentSquad = 0 WHERE TeamId = ?", REAL_MADRID_ID)
    for p in squad:
        cur.execute(
            """
            INSERT INTO Players (PlayerId, TeamId, Name, Position, ShirtNumber, PhotoUrl, IsCurrentSquad)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(PlayerId) DO UPDATE SET
                IsCurrentSquad=1, Name=excluded.Name, Position=excluded.Position,
                ShirtNumber=excluded.ShirtNumber, PhotoUrl=excluded.PhotoUrl
            """,
            p["id"], REAL_MADRID_ID, p["name"], p["position"], p["number"], p["photo"],
        )
    log(f"   {len(squad)} jugadores en plantilla vigente")


def step_odds(cur):
    log("6/7 · Momios de los próximos partidos...")
    cur.execute(
        """
        SELECT FixtureId FROM Fixtures
        WHERE (HomeTeamId=? OR AwayTeamId=?) AND StatusShort='NS'
        ORDER BY KickoffUtc ASC
        """, REAL_MADRID_ID, REAL_MADRID_ID,
    )
    fixture_ids = [r[0] for r in cur.fetchall()][:6]
    if not fixture_ids:
        log("   sin próximos partidos en la base")
        return
    placeholders = ",".join("?" * len(fixture_ids))
    cur.execute(f"DELETE FROM OddsSnapshots WHERE FixtureId IN ({placeholders})", fixture_ids)
    saved = 0
    for fid in fixture_ids:
        data = api_get("odds", {"fixture": fid})
        if not data or not data.get("response"):
            continue
        for bk in data["response"][0]["bookmakers"][:5]:
            match_winner = next((b for b in bk["bets"] if b["name"] == "Match Winner"), None)
            if not match_winner:
                continue
            values = {v["value"]: float(v["odd"]) for v in match_winner["values"]}
            if not all(k in values for k in ("Home", "Draw", "Away")):
                continue
            raw = [1 / values["Home"], 1 / values["Draw"], 1 / values["Away"]]
            overround = sum(raw)
            ih, idr, ia = [round(x / overround, 4) for x in raw]
            cur.execute(
                """
                INSERT INTO OddsSnapshots
                    (FixtureId, Bookmaker, OddHome, OddDraw, OddAway, ImpliedHome, ImpliedDraw, ImpliedAway)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                fid, bk["name"], values["Home"], values["Draw"], values["Away"], ih, idr, ia,
            )
            saved += 1
        time.sleep(0.15)
    log(f"   {saved} momios guardados")


def step_availability(cur):
    log("7/7 · Bajas y dudas (lesión/sanción)...")
    # Se crea sola la primera vez que corre este paso -- así una app ya instalada
    # (madrid.db viejo, sin esta tabla) no necesita reinstalarse para tener esto.
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS PlayerAvailability (
            PlayerId INTEGER NOT NULL,
            FixtureId INTEGER NOT NULL,
            Type TEXT,
            Reason TEXT,
            IngestedAtUtc TEXT,
            PRIMARY KEY (PlayerId, FixtureId)
        )
        """
    )
    data = api_get("injuries", {"team": REAL_MADRID_ID, "season": current_season()})
    if not data:
        log("   sin datos (cuota agotada o temporada sin bajas registradas)")
        return
    n = 0
    for row in data.get("response", []):
        player = row.get("player") or {}
        fixture = row.get("fixture") or {}
        if player.get("id") is None or fixture.get("id") is None:
            continue
        cur.execute(
            """
            INSERT INTO PlayerAvailability (PlayerId, FixtureId, Type, Reason, IngestedAtUtc)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(PlayerId, FixtureId) DO UPDATE SET
                Type=excluded.Type, Reason=excluded.Reason, IngestedAtUtc=excluded.IngestedAtUtc
            """,
            player["id"], fixture["id"], player.get("type"), player.get("reason"),
        )
        n += 1
    log(f"   {n} registro(s) de bajas/dudas actualizados")


def run():
    if not os.environ.get("SQLITE_PATH"):
        log("Falta SQLITE_PATH en el entorno.")
        sys.exit(1)
    conn = get_connection()
    cur = conn.cursor()
    try:
        step_fixtures(cur); conn.commit()
        step_lineups_events(cur); conn.commit()
        step_ratings(cur); conn.commit()
        step_squad(cur); conn.commit()
        step_odds(cur); conn.commit()
        step_availability(cur); conn.commit()
        log("Listo.")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run()
