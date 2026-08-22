"""
Descarga los partidos del Real Madrid en la Champions League (liga id 2)
-- solo los del Real Madrid, no toda la competición, porque a diferencia de
La Liga aquí no necesitamos volumen para entrenar el modelo general, solo
enriquecer el histórico propio del club.
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
UCL_LEAGUE_ID = 2

SEASONS = list(range(2015, 2027))


def api_get(path, params):
    r = requests.get(f"{BASE}/{path}", headers=HEADERS, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def run():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "IF NOT EXISTS (SELECT 1 FROM dbo.Leagues WHERE LeagueId=?) INSERT INTO dbo.Leagues (LeagueId, Name, Country) VALUES (?, 'UEFA Champions League', 'Europe')",
        UCL_LEAGUE_ID, UCL_LEAGUE_ID,
    )

    total = 0
    for season in SEASONS:
        data = api_get("fixtures", {"team": REAL_MADRID_ID, "league": UCL_LEAGUE_ID, "season": season})
        response = data.get("response", [])
        season_count = 0
        for f in response:
            fx, lg, teams, goals, score = f["fixture"], f["league"], f["teams"], f["goals"], f["score"]
            teams_all = [teams["home"], teams["away"]]
            for t in teams_all:
                cur.execute(
                    "IF NOT EXISTS (SELECT 1 FROM dbo.Teams WHERE TeamId=?) INSERT INTO dbo.Teams (TeamId, Name, Country) VALUES (?, ?, ?)",
                    t["id"], t["id"], t["name"], "N/A",
                )
            cur.execute(
                """
                MERGE dbo.Fixtures AS tgt
                USING (SELECT ? AS FixtureId) AS src ON tgt.FixtureId = src.FixtureId
                WHEN MATCHED THEN UPDATE SET HomeGoals=?, AwayGoals=?, StatusShort=?
                WHEN NOT MATCHED THEN INSERT
                    (FixtureId, LeagueId, Season, RoundLabel, KickoffUtc, StatusShort,
                     HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, HomeGoalsHT, AwayGoalsHT,
                     VenueId, RefereeName, CompetitionType)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UCL');
                """,
                fx["id"],
                goals["home"], goals["away"], fx["status"]["short"],
                fx["id"], UCL_LEAGUE_ID, season, lg["round"], fx["date"], fx["status"]["short"],
                teams["home"]["id"], teams["away"]["id"], goals["home"], goals["away"],
                score["halftime"]["home"], score["halftime"]["away"], fx["venue"]["id"], fx["referee"],
            )
            season_count += 1
        conn.commit()
        total += season_count
        print(f"  {season}-{season+1}: {season_count} partidos de Champions")
        time.sleep(0.2)

    print(f"Total partidos de Champions guardados: {total}")

    # marcar el resto de partidos existentes (La Liga) con su tipo correcto
    cur.execute("UPDATE dbo.Fixtures SET CompetitionType='LEAGUE' WHERE CompetitionType IS NULL")
    conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
