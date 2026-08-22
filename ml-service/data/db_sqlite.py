"""
Conexión a SQLite para la app instalable -- misma madrid.db que lee la API
en modo DB_PROVIDER=sqlite. Expone un cursor compatible con el estilo de
llamada de pyodbc (cur.execute(sql, a, b, c)) que ya usan los scripts de
fetch_*.py, así no hay que reescribir cada llamada a mano.
"""
import os
import sqlite3


class CompatCursor:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql, *params):
        if len(params) == 1 and isinstance(params[0], (list, tuple)):
            p = params[0]
        else:
            p = params
        self._cur.execute(sql, p)
        return self

    def fetchall(self):
        return self._cur.fetchall()

    def fetchone(self):
        return self._cur.fetchone()

    @property
    def description(self):
        return self._cur.description

    def close(self):
        self._cur.close()


class CompatConnection:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return CompatCursor(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_connection():
    path = os.environ["SQLITE_PATH"]
    conn = sqlite3.connect(path)
    return CompatConnection(conn)
