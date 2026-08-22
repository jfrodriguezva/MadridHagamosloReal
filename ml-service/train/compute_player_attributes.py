"""
Calcula atributos estilo FIFA Ultimate Team (Overall, Potential, PACE,
SHOOTING, PASSING, DRIBBLING, DEFENDING, PHYSICAL) a partir de estadísticas
REALES de la temporada (dbo.PlayerSeasonStats) -- normalizadas por 90
minutos y escaladas a la distribución de la propia plantilla (z-score ->
1-99), ponderadas por posición.

Limitación honesta: API-Football no expone velocidad de sprint ni distancia
recorrida, así que PACE es un heurístico (posición + edad), no un dato medido
-- se documenta así también en el propio registro para no aparentar más
precisión de la que hay.
"""
import sys
import os
import numpy as np
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.db import get_connection

MIN_MINUTES = 300  # por debajo de esto, la muestra es demasiado ruidosa


def zscore_to_rating(series: pd.Series, low=45, high=94) -> pd.Series:
    s = series.fillna(series.median())
    z = (s - s.mean()) / (s.std(ddof=0) + 1e-6)
    z = z.clip(-2.2, 2.2)
    scaled = low + (z - z.min()) / (z.max() - z.min() + 1e-6) * (high - low)
    return scaled.round().astype(int)


def pace_heuristic(position: str, age: int) -> float:
    base = {"Attacker": 82, "Midfielder": 72, "Defender": 66, "Goalkeeper": 50}.get(position, 70)
    if age <= 23:
        base += 6
    elif age >= 31:
        base -= (age - 30) * 2
    return base


def main():
    conn = get_connection()
    df = pd.read_sql(
        """
        SELECT p.PlayerId, p.Name, p.Position, p.Age, s.Season,
               s.Minutes, s.Goals, s.Assists, s.ShotsTotal, s.ShotsOn,
               s.PassesTotal, s.PassesAccuracyPct, s.KeyPasses,
               s.TacklesTotal, s.Interceptions, s.DuelsTotal, s.DuelsWon,
               s.DribblesAttempts, s.DribblesSuccess, s.RatingAvg
        FROM dbo.Players p JOIN dbo.PlayerSeasonStats s ON p.PlayerId = s.PlayerId
        WHERE s.Minutes >= ?
        """,
        conn, params=[MIN_MINUTES],
    )
    print(f"Jugadores con minutos suficientes ({MIN_MINUTES}+): {len(df)}")

    p90 = df["Minutes"] / 90.0
    df["goals_p90"] = df["Goals"] / p90
    df["shots_p90"] = df["ShotsTotal"] / p90
    df["shot_acc"] = (df["ShotsOn"] / df["ShotsTotal"].replace(0, np.nan)).fillna(0)
    df["passes_p90"] = df["PassesTotal"] / p90
    df["key_passes_p90"] = df["KeyPasses"] / p90
    df["pass_acc"] = df["PassesAccuracyPct"].fillna(df["PassesAccuracyPct"].median())
    df["dribble_succ_rate"] = (df["DribblesSuccess"] / df["DribblesAttempts"].replace(0, np.nan)).fillna(0)
    df["dribbles_p90"] = df["DribblesAttempts"] / p90
    df["tackles_p90"] = (df["TacklesTotal"].fillna(0) + df["Interceptions"].fillna(0)) / p90
    df["duel_win_rate"] = (df["DuelsWon"] / df["DuelsTotal"].replace(0, np.nan)).fillna(0.5)

    df["SHOOTING"] = zscore_to_rating(0.6 * df["goals_p90"] + 0.25 * df["shots_p90"] + 0.15 * df["shot_acc"] * 5)
    df["PASSING"] = zscore_to_rating(0.4 * df["passes_p90"] / 10 + 0.35 * df["pass_acc"] / 10 + 0.25 * df["key_passes_p90"] * 3)
    df["DRIBBLING"] = zscore_to_rating(0.6 * df["dribble_succ_rate"] * 10 + 0.4 * df["dribbles_p90"])
    df["DEFENDING"] = zscore_to_rating(0.65 * df["tackles_p90"] + 0.35 * df["duel_win_rate"] * 10)
    df["PHYSICAL"] = zscore_to_rating(0.5 * df["duel_win_rate"] * 10 + 0.5 * df["RatingAvg"].fillna(6.5))
    df["PACE"] = df.apply(lambda r: pace_heuristic(r["Position"], r["Age"]), axis=1)

    weights_by_pos = {
        "Attacker": {"PACE": .22, "SHOOTING": .30, "PASSING": .12, "DRIBBLING": .20, "DEFENDING": .04, "PHYSICAL": .12},
        "Midfielder": {"PACE": .14, "SHOOTING": .14, "PASSING": .28, "DRIBBLING": .18, "DEFENDING": .14, "PHYSICAL": .12},
        "Defender": {"PACE": .16, "SHOOTING": .04, "PASSING": .16, "DRIBBLING": .08, "DEFENDING": .40, "PHYSICAL": .16},
        "Goalkeeper": {"PACE": .05, "SHOOTING": .0, "PASSING": .15, "DRIBBLING": .05, "DEFENDING": .05, "PHYSICAL": .20},
    }

    def overall(row):
        if row["Position"] == "Goalkeeper":
            # sin datos de paradas fiables -> el rating real de partido es la mejor señal disponible
            base = (row["RatingAvg"] or 6.8) * 12
            return int(np.clip(base, 60, 90))
        w = weights_by_pos.get(row["Position"], weights_by_pos["Midfielder"])
        val = sum(row[k] * v for k, v in w.items())
        rating_bonus = ((row["RatingAvg"] or 6.8) - 6.8) * 8
        return int(np.clip(val + rating_bonus, 55, 99))

    df["Overall"] = df.apply(overall, axis=1)
    df["Potential"] = df.apply(
        lambda r: int(np.clip(r["Overall"] + max(0, (24 - r["Age"])) * 1.3, r["Overall"], 99)), axis=1
    )

    cur = conn.cursor()
    for _, r in df.iterrows():
        cur.execute(
            """
            MERGE dbo.PlayerAttributes AS tgt
            USING (SELECT ? AS PlayerId, ? AS Season) AS src
            ON tgt.PlayerId = src.PlayerId AND tgt.Season = src.Season
            WHEN MATCHED THEN UPDATE SET
                Overall=?, Potential=?, Pace=?, Shooting=?, Passing=?, Dribbling=?, Defending=?, Physical=?
            WHEN NOT MATCHED THEN INSERT
                (PlayerId, Season, Overall, Potential, Pace, Shooting, Passing, Dribbling, Defending, Physical)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            int(r["PlayerId"]), int(r["Season"]),
            int(r["Overall"]), int(r["Potential"]), int(r["PACE"]), int(r["SHOOTING"]),
            int(r["PASSING"]), int(r["DRIBBLING"]), int(r["DEFENDING"]), int(r["PHYSICAL"]),
            int(r["PlayerId"]), int(r["Season"]),
            int(r["Overall"]), int(r["Potential"]), int(r["PACE"]), int(r["SHOOTING"]),
            int(r["PASSING"]), int(r["DRIBBLING"]), int(r["DEFENDING"]), int(r["PHYSICAL"]),
        )
    conn.commit()

    top = df.sort_values("Overall", ascending=False)[["Name", "Position", "Overall", "Potential", "PACE", "SHOOTING", "PASSING", "DRIBBLING", "DEFENDING", "PHYSICAL"]].head(12)
    print(top.to_string(index=False))
    conn.close()


if __name__ == "__main__":
    main()
