"""
ETL: descarga temporadas históricas de La Liga desde API-Football y las
inserta en SQL Server (dbo.Teams, dbo.Leagues, dbo.Fixtures).

Se descarga la liga COMPLETA (no solo Real Madrid) porque el Elo/pi-rating
y el clasificador 1X2 necesitan el universo de partidos entre todos los
equipos para generalizar bien -- luego se filtra a los partidos del
Real Madrid para servir predicciones y evaluar el modelo en producto.
"""
import os
import time
import pip_system_certs.wrapt_requests  # noqa: F401 - confía en el almacén de certificados de Windows (proxy corporativo)
import requests
from dotenv import load_dotenv
from db import get_connection

load_dotenv()

API_KEY = os.environ["API_FOOTBALL_KEY"]
BASE = os.environ["API_FOOTBALL_BASE"]
LEAGUE_ID = int(os.environ["LALIGA_LEAGUE_ID"])
HEADERS = {"x-apisports-key": API_KEY}

SEASONS = list(range(2008, 2027))  # 2008-09 ... 2026-27, para maximizar volumen de entrenamiento


def api_get(path, params, retries=3):
    for attempt in range(retries):
        resp = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20, verify=True)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("errors"):
                print(f"  ! API warning {path} {params}: {data['errors']}")
            return data
        print(f"  ! HTTP {resp.status_code} on {path} {params}, retry {attempt+1}/{retries}")
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Failed {path} {params} after {retries} retries")


def upsert_league(cur, league_id, name, country):
    cur.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM dbo.Leagues WHERE LeagueId = ?)
            INSERT INTO dbo.Leagues (LeagueId, Name, Country) VALUES (?, ?, ?)
        """,
        league_id, league_id, name, country,
    )


def upsert_team(cur, team_id, name, country):
    cur.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM dbo.Teams WHERE TeamId = ?)
            INSERT INTO dbo.Teams (TeamId, Name, Country) VALUES (?, ?, ?)
        """,
        team_id, team_id, name, country,
    )


def upsert_fixture(cur, f):
    fx = f["fixture"]
    lg = f["league"]
    teams = f["teams"]
    goals = f["goals"]
    score = f["score"]

    # los partidos NO finalizados (NS = programado) también se guardan --
    # el dashboard los necesita para "próximo partido" / calendario, pero
    # el entrenamiento (features.py) sigue filtrando solo StatusShort='FT'
    cur.execute(
        """
        MERGE dbo.Fixtures AS tgt
        USING (SELECT ? AS FixtureId) AS src
        ON tgt.FixtureId = src.FixtureId
        WHEN MATCHED THEN UPDATE SET
            HomeGoals = ?, AwayGoals = ?, StatusShort = ?
        WHEN NOT MATCHED THEN INSERT
            (FixtureId, LeagueId, Season, RoundLabel, KickoffUtc, StatusShort,
             HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, HomeGoalsHT, AwayGoalsHT,
             VenueId, RefereeName)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        fx["id"],
        goals["home"], goals["away"], fx["status"]["short"],
        fx["id"], lg["id"], lg["season"], lg["round"], fx["date"], fx["status"]["short"],
        teams["home"]["id"], teams["away"]["id"], goals["home"], goals["away"],
        score["halftime"]["home"], score["halftime"]["away"],
        fx["venue"]["id"], fx["referee"],
    )
    return True


def run():
    conn = get_connection()
    cur = conn.cursor()

    print("Descargando temporadas de La Liga (id 140)...")
    total_inserted = 0
    for season in SEASONS:
        print(f"-> Temporada {season}-{season+1}")
        data = api_get("fixtures", {"league": LEAGUE_ID, "season": season})
        response = data.get("response", [])
        if not response:
            print(f"   (sin datos para {season}, se omite)")
            continue

        upsert_league(cur, LEAGUE_ID, "La Liga", "Spain")

        season_count = 0
        for f in response:
            teams = f["teams"]
            upsert_team(cur, teams["home"]["id"], teams["home"]["name"], "Spain")
            upsert_team(cur, teams["away"]["id"], teams["away"]["name"], "Spain")
            if upsert_fixture(cur, f):
                season_count += 1
        conn.commit()
        total_inserted += season_count
        print(f"   {season_count} partidos finalizados guardados")
        time.sleep(0.5)  # cortesía de rate-limit, Plan Pro admite bastante más

    print(f"\nTotal partidos finalizados en base: {total_inserted}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
