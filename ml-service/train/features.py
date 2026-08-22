"""
Feature engineering para el clasificador 1X2 / mercados binarios.

Construye, partido a partido y en orden cronológico (sin fuga de datos):
  - Elo rating de cada equipo (actualizado tras cada resultado)
  - Forma reciente (puntos de los últimos 5 partidos)
  - Promedio de goles anotados/recibidos (últimos 5 y 10 partidos)
  - Días de descanso desde el partido anterior
  - Ventaja de localía implícita en el propio Elo (K y home-advantage bonus)
  - Historial H2H (balance de los últimos enfrentamientos directos)

Todo se calcula ÚNICAMENTE con partidos anteriores a la fecha del partido en
cuestión -- es la disciplina anti fuga de datos que exige un walk-forward real.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from data.db import get_connection

ELO_K = 22
HOME_ADV = 68  # bonus de Elo por jugar en casa (calibrado en literatura ~60-100)
ELO_INITIAL = 1500


def load_fixtures():
    conn = get_connection()
    df = pd.read_sql(
        """
        SELECT FixtureId, LeagueId, Season, KickoffUtc, HomeTeamId, AwayTeamId,
               HomeGoals, AwayGoals
        FROM dbo.Fixtures
        WHERE StatusShort = 'FT' AND HomeGoals IS NOT NULL
        ORDER BY KickoffUtc ASC
        """,
        conn,
    )
    conn.close()
    df["KickoffUtc"] = pd.to_datetime(df["KickoffUtc"])
    return df


def expected_score(elo_a, elo_b):
    return 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 400.0))


def build_feature_table(df: pd.DataFrame) -> pd.DataFrame:
    elo = {}
    last5 = {}   # team_id -> list of (points, gf, ga) últimos partidos (cualquier lado)
    last_date = {}  # team_id -> fecha del último partido jugado
    h2h = {}     # (min_id,max_id) -> list of results desde la perspectiva de min_id

    rows = []
    for _, m in df.iterrows():
        home, away = m["HomeTeamId"], m["AwayTeamId"]
        elo_home = elo.get(home, ELO_INITIAL)
        elo_away = elo.get(away, ELO_INITIAL)

        h_hist = last5.get(home, [])
        a_hist = last5.get(away, [])

        def agg(hist, n):
            h = hist[-n:]
            if not h:
                return 0.0, 0.0, 0.0
            pts = np.mean([x[0] for x in h])
            gf = np.mean([x[1] for x in h])
            ga = np.mean([x[2] for x in h])
            return pts, gf, ga

        h_form5, h_gf5, h_ga5 = agg(h_hist, 5)
        a_form5, a_gf5, a_ga5 = agg(a_hist, 5)
        h_form10, h_gf10, h_ga10 = agg(h_hist, 10)
        a_form10, a_gf10, a_ga10 = agg(a_hist, 10)

        h_rest = (m["KickoffUtc"] - last_date[home]).days if home in last_date else 10
        a_rest = (m["KickoffUtc"] - last_date[away]).days if away in last_date else 10

        key = (min(home, away), max(home, away))
        h2h_hist = h2h.get(key, [])[-5:]
        if h2h_hist:
            perspective = 1 if home == key[0] else -1
            h2h_balance = float(np.mean([r * perspective for r in h2h_hist]))
        else:
            h2h_balance = 0.0

        rows.append({
            "FixtureId": m["FixtureId"],
            "KickoffUtc": m["KickoffUtc"],
            "Season": m["Season"],
            "HomeTeamId": home,
            "AwayTeamId": away,
            "elo_home": elo_home,
            "elo_away": elo_away,
            "elo_diff": elo_home + HOME_ADV - elo_away,
            "home_form5_pts": h_form5, "away_form5_pts": a_form5,
            "home_form5_gf": h_gf5, "home_form5_ga": h_ga5,
            "away_form5_gf": a_gf5, "away_form5_ga": a_ga5,
            "home_form10_pts": h_form10, "away_form10_pts": a_form10,
            "home_form10_gf": h_gf10, "home_form10_ga": h_ga10,
            "away_form10_gf": a_gf10, "away_form10_ga": a_ga10,
            "home_rest_days": min(h_rest, 30),
            "away_rest_days": min(a_rest, 30),
            "h2h_balance": h2h_balance,
            "home_goals": m["HomeGoals"],
            "away_goals": m["AwayGoals"],
        })

        # --- actualizar estado DESPUÉS de registrar las features (sin fuga) ---
        hg, ag = m["HomeGoals"], m["AwayGoals"]
        if hg > ag:
            res_home, res_away, h2h_res = 3, 0, 1
        elif hg < ag:
            res_home, res_away, h2h_res = 0, 3, -1
        else:
            res_home, res_away, h2h_res = 1, 1, 0

        actual_home = 1.0 if hg > ag else (0.5 if hg == ag else 0.0)
        exp_home = expected_score(elo_home + HOME_ADV, elo_away)
        delta = ELO_K * (actual_home - exp_home)
        elo[home] = elo_home + delta
        elo[away] = elo_away - delta

        last5.setdefault(home, []).append((res_home, hg, ag))
        last5.setdefault(away, []).append((res_away, ag, hg))
        last_date[home] = m["KickoffUtc"]
        last_date[away] = m["KickoffUtc"]

        h2h.setdefault(key, [])
        h2h[key].append(h2h_res if home == key[0] else -h2h_res)

    feat = pd.DataFrame(rows)

    def outcome_1x2(hg, ag):
        if hg > ag:
            return "H"
        if hg < ag:
            return "A"
        return "D"

    feat["result_1x2"] = [outcome_1x2(h, a) for h, a in zip(feat["home_goals"], feat["away_goals"])]
    feat["btts"] = ((feat["home_goals"] > 0) & (feat["away_goals"] > 0)).astype(int)
    feat["over25"] = ((feat["home_goals"] + feat["away_goals"]) > 2.5).astype(int)

    # --- features de interacción: aproximan el "goles esperados" combinando ---
    # --- el ataque de un equipo con la fragilidad defensiva del rival        ---
    feat["exp_goals_home"] = (feat["home_form5_gf"] + feat["away_form5_ga"]) / 2.0
    feat["exp_goals_away"] = (feat["away_form5_gf"] + feat["home_form5_ga"]) / 2.0
    feat["exp_total_goals"] = feat["exp_goals_home"] + feat["exp_goals_away"]
    feat["combined_leakiness"] = feat["home_form5_ga"] + feat["away_form5_ga"]
    feat["combined_firepower"] = feat["home_form5_gf"] + feat["away_form5_gf"]
    feat["form5_pts_diff"] = feat["home_form5_pts"] - feat["away_form5_pts"]
    feat["form10_pts_diff"] = feat["home_form10_pts"] - feat["away_form10_pts"]
    feat["rest_diff"] = feat["home_rest_days"] - feat["away_rest_days"]

    return feat


if __name__ == "__main__":
    df = load_fixtures()
    feat = build_feature_table(df)
    print(f"Filas: {len(feat)}  |  Columnas: {feat.shape[1]}")
    print(feat.tail(3).T)
    feat.to_parquet(os.path.join(os.path.dirname(__file__), "..", "data", "features.parquet"))
    print("Guardado en data/features.parquet")
