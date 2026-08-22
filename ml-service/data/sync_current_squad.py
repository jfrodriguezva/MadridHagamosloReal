"""
Sincroniza dbo.Players.IsCurrentSquad contra la plantilla REAL vigente
(/players/squads) -- así Jugadores y Táctica solo listan a quien está hoy
en el equipo, sin importar de qué temporada vengan sus estadísticas.
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


def run():
    r = requests.get(f"{BASE}/players/squads", headers=HEADERS, params={"team": REAL_MADRID_ID}, timeout=20)
    r.raise_for_status()
    data = r.json()
    squad = data["response"][0]["players"]
    current_ids = {p["id"] for p in squad}
    print(f"Plantilla vigente: {len(current_ids)} jugadores")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("UPDATE dbo.Players SET IsCurrentSquad = 0 WHERE TeamId = ?", REAL_MADRID_ID)

    for p in squad:
        cur.execute(
            """
            MERGE dbo.Players AS tgt
            USING (SELECT ? AS PlayerId) AS src ON tgt.PlayerId = src.PlayerId
            WHEN MATCHED THEN UPDATE SET IsCurrentSquad=1, Name=?, Position=?, ShirtNumber=?, PhotoUrl=?
            WHEN NOT MATCHED THEN INSERT (PlayerId, TeamId, Name, Position, ShirtNumber, PhotoUrl, IsCurrentSquad)
            VALUES (?, ?, ?, ?, ?, ?, 1);
            """,
            p["id"], p["name"], p["position"], p["number"], p["photo"],
            p["id"], REAL_MADRID_ID, p["name"], p["position"], p["number"], p["photo"],
        )

    conn.commit()

    cur.execute("SELECT COUNT(*) FROM dbo.Players WHERE TeamId=? AND IsCurrentSquad=1", REAL_MADRID_ID)
    print(f"Marcados como plantilla vigente en BD: {cur.fetchone()[0]}")
    cur.execute("SELECT Name FROM dbo.Players WHERE TeamId=? AND IsCurrentSquad=0 ORDER BY Name", REAL_MADRID_ID)
    left = [r[0] for r in cur.fetchall()]
    print(f"Ya no están en la plantilla (histórico): {', '.join(left) if left else '(ninguno)'}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
