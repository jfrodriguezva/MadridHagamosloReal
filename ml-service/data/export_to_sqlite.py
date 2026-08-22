"""
Exporta toda la base de SQL Server (MadridHagamosloReal) a un archivo SQLite
único -- es el motor de datos que usa la versión instalable personal (API
corriendo con DB_PROVIDER=sqlite, sin necesidad de tener SQL Server como
servicio en la máquina del usuario final). Preserva primary keys/autoincrement
para que los UPSERT (ON CONFLICT) y los INSERT+last_insert_rowid() del API
funcionen igual que en SQL Server.
"""
import decimal
import os
import sqlite3
import pyodbc
from dotenv import load_dotenv
from db import get_connection


def sqlite_safe(v):
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v

load_dotenv()

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "desktop", "madrid.db")

TABLES = [
    "Teams", "Leagues", "Fixtures", "Players", "PlayerSeasonStats", "PlayerAttributes",
    "PredictionFeatureSnapshots", "PredictionModels", "Predictions",
    "FixtureStatistics", "Coaches", "CoachCareer", "MatchLineups", "MatchLineupPlayers",
    "MatchEvents2", "MatchPlayerRatings", "UserLineups", "UserLineupPlayers",
    "UserPlayerRatings", "OddsSnapshots", "PodcastHistory", "GeneratedMedia",
]

# Columnas IDENTITY en SQL Server -- en SQLite, "INTEGER PRIMARY KEY" de una
# sola columna es el alias del rowid y autoincrementa solo con last_insert_rowid().
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


def sqlite_type(sql_type: str) -> str:
    t = sql_type.lower()
    if "int" in t:
        return "INTEGER"
    if "decimal" in t or "float" in t or "real" in t:
        return "REAL"
    if "bit" in t:
        return "INTEGER"
    if "date" in t:
        return "TEXT"
    return "TEXT"


def get_primary_key_columns(cur, table):
    cur.execute(
        """
        SELECT c.name
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id
        JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id
        WHERE i.is_primary_key=1 AND i.object_id = OBJECT_ID(?)
        ORDER BY ic.key_ordinal
        """,
        table,
    )
    return [r[0] for r in cur.fetchall()]


def run():
    sql_conn = get_connection()
    cur = sql_conn.cursor()

    if os.path.exists(OUT_PATH):
        os.remove(OUT_PATH)
    sconn = sqlite3.connect(OUT_PATH)
    scur = sconn.cursor()

    for table in TABLES:
        cur.execute(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? ORDER BY ORDINAL_POSITION",
            table,
        )
        cols = cur.fetchall()
        if not cols:
            print(f"  (omitida, no existe) {table}")
            continue

        pk_cols = get_primary_key_columns(cur, table)
        identity_col = IDENTITY_COLUMNS.get(table)

        col_defs = []
        for c in cols:
            name, sql_type = c[0], c[1]
            if identity_col and name == identity_col:
                col_defs.append(f'"{name}" INTEGER PRIMARY KEY')
            else:
                col_defs.append(f'"{name}" {sqlite_type(sql_type)}')

        constraints = []
        if not identity_col and pk_cols:
            pk_list = ", ".join(f'"{c}"' for c in pk_cols)
            constraints.append(f"PRIMARY KEY ({pk_list})")

        all_defs = ", ".join(col_defs + constraints)
        scur.execute(f'CREATE TABLE "{table}" ({all_defs})')

        cur.execute(f"SELECT * FROM dbo.[{table}]")
        rows = cur.fetchall()
        col_names = [d[0] for d in cur.description]
        placeholders = ",".join("?" * len(col_names))
        quoted_cols = ",".join('"' + c + '"' for c in col_names)
        insert_sql = f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({placeholders})'
        scur.executemany(insert_sql, [tuple(sqlite_safe(v) for v in r) for r in rows])
        print(f"  {table}: {len(rows)} filas")

    sconn.commit()
    sconn.close()
    cur.close()
    sql_conn.close()
    print(f"\nExportado a {os.path.abspath(OUT_PATH)}")


if __name__ == "__main__":
    run()
