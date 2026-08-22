"""
Features adicionales SOLO para el Real Madrid, basadas en estadísticas reales
de tiros/posesión/córners (dbo.FixtureStatistics) -- disponibles de forma
completa desde la temporada 2015-16. Es la pieza que más se acerca a un
proxy de xG sin pagar el costo de pedir estadísticas de las 6,000+ filas de
toda la liga.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from data.db import get_connection

REAL_MADRID_ID = 541


def load_madrid_shot_stats() -> pd.DataFrame:
    conn = get_connection()
    df = pd.read_sql(
        """
        SELECT f.FixtureId, f.KickoffUtc, f.Season,
               fs.ShotsOnGoal, fs.TotalShots, fs.BallPossessionPct, fs.Corners
        FROM dbo.Fixtures f
        JOIN dbo.FixtureStatistics fs ON f.FixtureId = fs.FixtureId AND fs.TeamId = ?
        WHERE f.HomeTeamId = ? OR f.AwayTeamId = ?
        ORDER BY f.KickoffUtc ASC
        """,
        conn, params=[REAL_MADRID_ID, REAL_MADRID_ID, REAL_MADRID_ID],
    )
    conn.close()
    df["KickoffUtc"] = pd.to_datetime(df["KickoffUtc"])

    # rolling de los ÚLTIMOS 5 partidos, sin incluir el partido actual (shift 1)
    for col in ["ShotsOnGoal", "TotalShots", "BallPossessionPct", "Corners"]:
        df[f"team_{col.lower()}_form5"] = (
            df[col].shift(1).rolling(window=5, min_periods=2).mean()
        )
    return df[["FixtureId", "Season",
               "team_shotsongoal_form5", "team_totalshots_form5",
               "team_ballpossessionpct_form5", "team_corners_form5"]]


if __name__ == "__main__":
    df = load_madrid_shot_stats()
    print(df.dropna().tail(5))
    print(f"\nFilas totales: {len(df)}  |  con datos suficientes: {df.dropna().shape[0]}")
