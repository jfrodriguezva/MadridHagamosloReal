"""
Descarga el historial de entrenadores del Real Madrid desde API-Football
y calcula su rendimiento REAL usando nuestros propios resultados de partido
(Fixtures) cruzados con el rango de fechas de cada etapa -- no confiamos en
estadísticas de terceros para el rendimiento, las calculamos nosotros mismos.
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
    print(f"Entrenadores encontrados: {len(coaches)}")

    for c in coaches:
        cur.execute(
            """
            MERGE dbo.Coaches AS tgt USING (SELECT ? AS CoachId) AS src ON tgt.CoachId = src.CoachId
            WHEN MATCHED THEN UPDATE SET Name=?, Nationality=?, PhotoUrl=?
            WHEN NOT MATCHED THEN INSERT (CoachId, Name, Nationality, PhotoUrl) VALUES (?, ?, ?, ?);
            """,
            c["id"], c["name"], c["nationality"], c["photo"],
            c["id"], c["name"], c["nationality"], c["photo"],
        )
        for spell in c["career"]:
            if spell["team"]["id"] != REAL_MADRID_ID:
                continue
            cur.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM dbo.CoachCareer WHERE CoachId=? AND TeamId=? AND StartDate=?)
                    INSERT INTO dbo.CoachCareer (CoachId, TeamId, StartDate, EndDate) VALUES (?, ?, ?, ?);
                """,
                c["id"], REAL_MADRID_ID, spell["start"],
                c["id"], REAL_MADRID_ID, spell["start"], spell["end"],
            )
    conn.commit()

    print("\nRendimiento real por etapa (calculado desde nuestros propios Fixtures):")
    cur.execute(
        """
        SELECT co.Name, cc.StartDate, cc.EndDate
        FROM dbo.CoachCareer cc JOIN dbo.Coaches co ON cc.CoachId = co.CoachId
        WHERE cc.TeamId = ?
        ORDER BY cc.StartDate DESC
        """, REAL_MADRID_ID,
    )
    spells = cur.fetchall()
    for name, start, end in spells:
        end_clause = "AND f.KickoffUtc <= ?" if end else ""
        query = f"""
            SELECT COUNT(*),
                   SUM(CASE WHEN (HomeTeamId=? AND HomeGoals>AwayGoals) OR (AwayTeamId=? AND AwayGoals>HomeGoals) THEN 1 ELSE 0 END) AS W,
                   SUM(CASE WHEN HomeGoals=AwayGoals THEN 1 ELSE 0 END) AS D
            FROM Fixtures f
            WHERE (HomeTeamId=? OR AwayTeamId=?) AND StatusShort='FT' AND f.KickoffUtc >= ? {end_clause}
            """
        params = [REAL_MADRID_ID, REAL_MADRID_ID, REAL_MADRID_ID, REAL_MADRID_ID, start]
        if end:
            params.append(end)
        cur.execute(query, params)
        row = cur.fetchone()
        total, wins, draws = row[0] or 0, row[1] or 0, row[2] or 0
        losses = total - wins - draws
        winpct = (wins / total * 100) if total else 0
        print(f"  {name:20s} {start} -> {end or 'actualidad':10s}  {total} PJ  {wins}W-{draws}E-{losses}P  ({winpct:.1f}% victorias)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
