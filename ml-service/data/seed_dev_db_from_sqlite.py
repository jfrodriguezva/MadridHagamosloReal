"""
Importa TODO el snapshot desktop/madrid.db (SQLite, con el histórico completo)
hacia la base de desarrollo en SQL Server (MadridHagamosloReal) -- la
dirección inversa de export_to_sqlite.py. Pensado para justo después de
sql/bootstrap-dev-db.ps1: te deja el esquema con datos reales para
desarrollar/probar en local sin correr el pipeline completo de fetch_*.py
(necesita tu propia API key y horas de backfill).

Requiere las mismas variables de entorno que el resto de ml-service/data
(ver ../.env.example) -- SQL_SERVER, SQL_DATABASE, y SQL_USE_WINDOWS_AUTH=true
o SQL_USER/SQL_PASSWORD.

Es SEGURO correrlo varias veces: borra e inserta de nuevo por tabla (nunca
toca el esquema en sí, solo los datos).

Uso:
    python seed_dev_db_from_sqlite.py
    python seed_dev_db_from_sqlite.py --sqlite-path ../../desktop/madrid.db
"""
import argparse
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import get_connection  # noqa: E402

# Mismo orden que export_to_sqlite.py (padres antes que hijos) -- reutilizado
# tal cual para no mantener el orden de dependencias FK en dos lugares que se
# puedan desincronizar. Las tablas nuevas (PlayerAvailability, ValueBetLog,
# EpisodeMetrics) no existen en el snapshot todavía -- se saltan solas.
TABLES = [
    "Teams", "Leagues", "Fixtures", "Players", "PlayerSeasonStats", "PlayerAttributes",
    "PredictionFeatureSnapshots", "PredictionModels", "Predictions",
    "FixtureStatistics", "Coaches", "CoachCareer", "MatchLineups", "MatchLineupPlayers",
    "MatchEvents2", "MatchPlayerRatings", "UserLineups", "UserLineupPlayers",
    "UserPlayerRatings", "OddsSnapshots", "PodcastHistory", "GeneratedMedia",
    "PlayerAvailability",
]

IDENTITY_COLUMNS = {
    "MatchEvents2": "EventId",
    "OddsSnapshots": "OddsSnapshotId",
    "PodcastHistory": "PodcastId",
    "PredictionFeatureSnapshots": "SnapshotId",
    "PredictionModels": "ModelId",
    "Predictions": "PredictionId",
    "UserLineups": "UserLineupId",
    "GeneratedMedia": "MediaId",
}


def log(msg):
    print(msg, flush=True)


def table_exists_in_sqlite(scur, table):
    scur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return scur.fetchone() is not None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sqlite-path",
        default=os.path.join(os.path.dirname(__file__), "..", "..", "desktop", "madrid.db"),
    )
    args = parser.parse_args()

    if not os.path.exists(args.sqlite_path):
        log(f"No se encontró {args.sqlite_path}")
        sys.exit(1)

    sconn = sqlite3.connect(args.sqlite_path)
    scur = sconn.cursor()
    conn = get_connection()
    cur = conn.cursor()

    present = [t for t in TABLES if table_exists_in_sqlite(scur, t)]

    try:
        # Fase 1: borrar en orden INVERSO (hijos antes que padres) -- si se
        # borrara Teams antes que Fixtures, la FK de Fixtures a Teams lo impediría.
        log("Limpiando datos existentes (orden inverso de dependencias)...")
        for table in reversed(present):
            cur.execute(f"DELETE FROM dbo.{table}")
        conn.commit()

        # Fase 2: insertar en orden NORMAL (padres antes que hijos).
        for table in present:
            scur.execute(f"PRAGMA table_info({table})")
            cols = [r[1] for r in scur.fetchall()]
            col_list = ", ".join(f"[{c}]" for c in cols)

            scur.execute(f"SELECT {col_list} FROM {table}")
            rows = scur.fetchall()
            if not rows:
                log(f"  (vacía en el snapshot) {table}")
                continue

            identity_col = IDENTITY_COLUMNS.get(table)
            if identity_col:
                cur.execute(f"SET IDENTITY_INSERT dbo.{table} ON")

            placeholders = ", ".join("?" * len(cols))
            insert_sql = f"INSERT INTO dbo.{table} ({col_list}) VALUES ({placeholders})"
            cur.executemany(insert_sql, rows)

            if identity_col:
                cur.execute(f"SET IDENTITY_INSERT dbo.{table} OFF")

            conn.commit()
            log(f"  {len(rows)} fila(s) -> {table}")

        skipped = [t for t in TABLES if t not in present]
        if skipped:
            log(f"Tablas nuevas sin datos en el snapshot (normal): {', '.join(skipped)}")
        log("Listo.")
    finally:
        scur.close()
        sconn.close()
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
