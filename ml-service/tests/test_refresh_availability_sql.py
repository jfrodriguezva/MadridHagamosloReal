"""
Verifica que el SQL de PlayerAvailability en refresh_current.py (CREATE TABLE
IF NOT EXISTS + INSERT ... ON CONFLICT DO UPDATE) es válido de verdad contra
SQLite -- no llama a la API real, solo ejecuta el mismo SQL que step_availability
usaría, contra un archivo SQLite temporal, para atrapar errores de sintaxis o de
clave primaria antes de que aparezcan la primera vez que alguien presione
"Actualizar datos" en la app instalada.
"""
import sqlite3

CREATE_SQL = """
    CREATE TABLE IF NOT EXISTS PlayerAvailability (
        PlayerId INTEGER NOT NULL,
        FixtureId INTEGER NOT NULL,
        Type TEXT,
        Reason TEXT,
        IngestedAtUtc TEXT,
        PRIMARY KEY (PlayerId, FixtureId)
    )
"""

UPSERT_SQL = """
    INSERT INTO PlayerAvailability (PlayerId, FixtureId, Type, Reason, IngestedAtUtc)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(PlayerId, FixtureId) DO UPDATE SET
        Type=excluded.Type, Reason=excluded.Reason, IngestedAtUtc=excluded.IngestedAtUtc
"""


def test_create_table_and_first_insert():
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()
    cur.execute(CREATE_SQL)
    cur.execute(UPSERT_SQL, (1, 100, "Missing Fixture", "Muscle Injury"))
    conn.commit()

    row = cur.execute("SELECT Type, Reason FROM PlayerAvailability WHERE PlayerId=1 AND FixtureId=100").fetchone()
    assert row == ("Missing Fixture", "Muscle Injury")


def test_upsert_updates_reason_instead_of_duplicating_row():
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()
    cur.execute(CREATE_SQL)
    cur.execute(UPSERT_SQL, (1, 100, "Missing Fixture", "Muscle Injury"))
    cur.execute(UPSERT_SQL, (1, 100, "Questionable", "Illness"))
    conn.commit()

    rows = cur.execute("SELECT Type, Reason FROM PlayerAvailability WHERE PlayerId=1 AND FixtureId=100").fetchall()
    assert rows == [("Questionable", "Illness")]


def test_create_table_is_idempotent_across_repeated_runs():
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()
    cur.execute(CREATE_SQL)
    cur.execute(CREATE_SQL)  # simula correr "Actualizar datos" una segunda vez
    cur.execute(UPSERT_SQL, (2, 101, "Missing Fixture", "Suspended"))
    conn.commit()

    total = cur.execute("SELECT COUNT(*) FROM PlayerAvailability").fetchone()[0]
    assert total == 1
