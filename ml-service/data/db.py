"""Conexión a SQL Server (MadridHagamosloReal) vía pyodbc."""
import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    server = os.environ["SQL_SERVER"]
    database = os.environ["SQL_DATABASE"]
    use_windows_auth = os.environ.get("SQL_USE_WINDOWS_AUTH", "false").lower() == "true"

    if use_windows_auth:
        conn_str = (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={server};DATABASE={database};"
            "Trusted_Connection=yes;TrustServerCertificate=yes;"
        )
    else:
        user = os.environ["SQL_USER"]
        password = os.environ["SQL_PASSWORD"]
        conn_str = (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={server};DATABASE={database};"
            f"UID={user};PWD={password};TrustServerCertificate=yes;"
        )
    return pyodbc.connect(conn_str, autocommit=False)
