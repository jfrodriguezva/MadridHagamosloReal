"""
Enriquece el cuerpo técnico: guarda TODA su carrera (no solo Real Madrid) para
poder contar "por dónde ha pasado", y calcula su formación preferida a partir
de dbo.MatchLineups.Formation -- dato real, no supuesto.
"""
import os
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


def run():
    conn = get_connection()
    cur = conn.cursor()

    data = api_get("coachs", {"team": REAL_MADRID_ID})
    coaches = data.get("response", [])

    for c in coaches:
        for spell in c["career"]:
            team = spell["team"]
            cur.execute(
                "IF NOT EXISTS (SELECT 1 FROM dbo.Teams WHERE TeamId=?) INSERT INTO dbo.Teams (TeamId, Name, Country) VALUES (?, ?, 'N/A')",
                team["id"], team["id"], team["name"],
            )
            cur.execute(
                """
                MERGE dbo.CoachCareer AS tgt
                USING (SELECT ? AS CoachId, ? AS TeamId, ? AS StartDate) AS src
                ON tgt.CoachId=src.CoachId AND tgt.TeamId=src.TeamId AND tgt.StartDate=src.StartDate
                WHEN MATCHED THEN UPDATE SET EndDate=?, TeamName=?
                WHEN NOT MATCHED THEN INSERT (CoachId, TeamId, StartDate, EndDate, TeamName)
                VALUES (?, ?, ?, ?, ?);
                """,
                c["id"], team["id"], spell["start"],
                spell["end"], team["name"],
                c["id"], team["id"], spell["start"], spell["end"], team["name"],
            )
    conn.commit()
    print(f"Carrera completa guardada para {len(coaches)} entrenadores.")

    # formación preferida = la más usada en dbo.MatchLineups mientras dirigió al Madrid
    cur.execute(
        """
        SELECT co.CoachId, co.Name, ml.Formation, COUNT(*) AS n
        FROM MatchLineups ml
        JOIN Fixtures f ON ml.FixtureId = f.FixtureId
        JOIN Coaches co ON ml.CoachName = co.Name
        WHERE ml.TeamId = ? AND ml.Formation IS NOT NULL
        GROUP BY co.CoachId, co.Name, ml.Formation
        ORDER BY co.Name, n DESC
        """, REAL_MADRID_ID,
    )
    rows = cur.fetchall()
    print("\nFormación más usada por entrenador (calculado de partidos reales):")
    seen = set()
    for coach_id, name, formation, n in rows:
        if coach_id in seen:
            continue
        seen.add(coach_id)
        print(f"  {name}: {formation} ({n} partidos)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
