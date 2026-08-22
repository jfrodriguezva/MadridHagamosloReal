"""
Persiste en dbo.Predictions:
  1) Las predicciones OOF walk-forward YA VALIDADAS (ensamble XGBoost+Poisson)
     para los partidos ya jugados del Real Madrid -- esto es lo que alimenta
     el calendario "predicción vs resultado real" del dashboard, y es honesto
     porque cada predicción se generó SOLO con datos anteriores a esa fecha.
  2) Predicciones para los próximos partidos programados (NS) del Real Madrid,
     usando el estado de Elo/forma más reciente y el modelo activo.
"""
import sys
import os
import numpy as np
import pandas as pd
import joblib
from scipy.stats import poisson as poisson_dist

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data.db import get_connection
from features import load_fixtures, build_feature_table, ELO_K, HOME_ADV, ELO_INITIAL, expected_score
from train_model import GENERAL_FEATURES
from poisson_model import GOAL_FEATURES, score_matrix, market_probs_from_matrix

REAL_MADRID_ID = 541
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(HERE, "..", "models")


def get_active_model_id(cur, market="1X2"):
    cur.execute(
        "SELECT TOP 1 ModelId FROM dbo.PredictionModels WHERE Market = ? AND IsActive = 1 ORDER BY ModelId DESC",
        market,
    )
    row = cur.fetchone()
    return row[0] if row else None


def persist_historical(conn, feat: pd.DataFrame, model_id: int):
    from train_model import walk_forward_1x2, TEST_SEASONS
    from poisson_model import walk_forward_poisson

    print("Recalculando predicciones históricas OOF (ensamble)...")
    _, oof_xgb = walk_forward_1x2(feat)
    oof_poisson = walk_forward_poisson(feat, TEST_SEASONS)
    merged = oof_xgb.merge(
        oof_poisson[["FixtureId", "prob_h", "prob_d", "prob_a"]],
        on="FixtureId", suffixes=("_xgb", "_poisson"),
    )
    poisson_bundle = joblib.load(os.path.join(MODELS_DIR, "model_poisson.pkl"))
    w = poisson_bundle["ensemble_weight_xgb"]

    probs_xgb = merged[["prob_h_xgb", "prob_d_xgb", "prob_a_xgb"]].values
    probs_poisson = merged[["prob_h_poisson", "prob_d_poisson", "prob_a_poisson"]].values
    probs_poisson = probs_poisson / probs_poisson.sum(axis=1, keepdims=True)
    blend = w * probs_xgb + (1 - w) * probs_poisson
    blend = blend / blend.sum(axis=1, keepdims=True)
    merged["prob_h"], merged["prob_d"], merged["prob_a"] = blend[:, 0], blend[:, 1], blend[:, 2]

    madrid_fx = feat[(feat["HomeTeamId"] == REAL_MADRID_ID) | (feat["AwayTeamId"] == REAL_MADRID_ID)]["FixtureId"]
    rm = merged[merged["FixtureId"].isin(set(madrid_fx))].copy()

    idx_to_letter = {0: "H", 1: "D", 2: "A"}
    cur = conn.cursor()
    cur.execute("DELETE FROM dbo.Predictions WHERE Market = '1X2'")
    saved = 0
    for _, r in rm.iterrows():
        predicted_idx = int(np.argmax([r["prob_h"], r["prob_d"], r["prob_a"]]))
        actual_letter = idx_to_letter[int(r["actual"])]
        was_correct = 1 if predicted_idx == int(r["actual"]) else 0
        cur.execute(
            """
            INSERT INTO dbo.Predictions
                (FixtureId, ModelId, Market, ProbHome, ProbDraw, ProbAway, ActualOutcome, WasCorrect)
            VALUES (?, ?, '1X2', ?, ?, ?, ?, ?)
            """,
            int(r["FixtureId"]), model_id, float(r["prob_h"]), float(r["prob_d"]), float(r["prob_a"]),
            actual_letter, was_correct,
        )
        saved += 1
    conn.commit()
    print(f"  {saved} predicciones históricas del Real Madrid guardadas.")


def persist_upcoming(conn, feat: pd.DataFrame, model_id: int):
    print("Calculando predicciones para próximos partidos programados...")
    xgb_bundle = joblib.load(os.path.join(MODELS_DIR, "model_1x2.pkl"))
    poisson_bundle = joblib.load(os.path.join(MODELS_DIR, "model_poisson.pkl"))
    w = poisson_bundle["ensemble_weight_xgb"]

    # reconstruir el estado (Elo/forma) hasta el último partido FT, replicando
    # exactamente la lógica de features.build_feature_table pero exponiendo el
    # estado final para poder proyectar partidos futuros
    elo, last5, last_date, h2h = {}, {}, {}, {}
    df = load_fixtures()
    for _, m in df.iterrows():
        home, away = m["HomeTeamId"], m["AwayTeamId"]
        elo_home = elo.get(home, ELO_INITIAL)
        elo_away = elo.get(away, ELO_INITIAL)
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
        key = (min(home, away), max(home, away))
        h2h.setdefault(key, [])
        h2h[key].append(h2h_res if home == key[0] else -h2h_res)

    def agg(hist, n):
        h = hist[-n:]
        if not h:
            return 0.0, 0.0, 0.0
        return (np.mean([x[0] for x in h]), np.mean([x[1] for x in h]), np.mean([x[2] for x in h]))

    conn2 = conn
    cur = conn2.cursor()
    cur.execute(
        """
        SELECT FixtureId, KickoffUtc, HomeTeamId, AwayTeamId
        FROM dbo.Fixtures
        WHERE (HomeTeamId = ? OR AwayTeamId = ?) AND StatusShort = 'NS'
        ORDER BY KickoffUtc
        """,
        REAL_MADRID_ID, REAL_MADRID_ID,
    )
    upcoming = cur.fetchall()
    print(f"  {len(upcoming)} partidos programados encontrados.")

    cur.execute("DELETE FROM dbo.Predictions WHERE Market IN ('1X2', 'BTTS', 'OVER25') AND ActualOutcome IS NULL")

    for fixture_id, kickoff, home, away in upcoming:
        elo_home, elo_away = elo.get(home, ELO_INITIAL), elo.get(away, ELO_INITIAL)
        h_hist, a_hist = last5.get(home, []), last5.get(away, [])
        h_form5, h_gf5, h_ga5 = agg(h_hist, 5)
        a_form5, a_gf5, a_ga5 = agg(a_hist, 5)
        h_form10, h_gf10, h_ga10 = agg(h_hist, 10)
        a_form10, a_gf10, a_ga10 = agg(a_hist, 10)
        h_rest = min((pd.Timestamp(kickoff) - last_date[home]).days, 30) if home in last_date else 10
        a_rest = min((pd.Timestamp(kickoff) - last_date[away]).days, 30) if away in last_date else 10
        key = (min(home, away), max(home, away))
        h2h_hist = h2h.get(key, [])[-5:]
        h2h_balance = float(np.mean([r * (1 if home == key[0] else -1) for r in h2h_hist])) if h2h_hist else 0.0

        row = {
            "elo_home": elo_home, "elo_away": elo_away, "elo_diff": elo_home + HOME_ADV - elo_away,
            "home_form5_pts": h_form5, "away_form5_pts": a_form5,
            "home_form5_gf": h_gf5, "home_form5_ga": h_ga5, "away_form5_gf": a_gf5, "away_form5_ga": a_ga5,
            "home_form10_pts": h_form10, "away_form10_pts": a_form10,
            "home_form10_gf": h_gf10, "home_form10_ga": h_ga10, "away_form10_gf": a_gf10, "away_form10_ga": a_ga10,
            "home_rest_days": h_rest, "away_rest_days": a_rest, "h2h_balance": h2h_balance,
        }
        row["exp_goals_home"] = (row["home_form5_gf"] + row["away_form5_ga"]) / 2.0
        row["exp_goals_away"] = (row["away_form5_gf"] + row["home_form5_ga"]) / 2.0
        row["exp_total_goals"] = row["exp_goals_home"] + row["exp_goals_away"]
        row["combined_leakiness"] = row["home_form5_ga"] + row["away_form5_ga"]
        row["combined_firepower"] = row["home_form5_gf"] + row["away_form5_gf"]
        row["form5_pts_diff"] = row["home_form5_pts"] - row["away_form5_pts"]
        row["form10_pts_diff"] = row["home_form10_pts"] - row["away_form10_pts"]
        row["rest_diff"] = row["home_rest_days"] - row["away_rest_days"]

        X = pd.DataFrame([row])
        probs_xgb = xgb_bundle["model"].predict_proba(X[xgb_bundle["features"]])[0]

        lam_home = float(np.clip(poisson_bundle["reg_home"].predict(X[GOAL_FEATURES])[0], 0.15, 6.0))
        lam_away = float(np.clip(poisson_bundle["reg_away"].predict(X[GOAL_FEATURES])[0], 0.15, 6.0))
        mat = score_matrix(lam_home, lam_away)
        mkt = market_probs_from_matrix(mat)
        probs_poisson = np.array([mkt["home"], mkt["draw"], mkt["away"]])
        probs_poisson = probs_poisson / probs_poisson.sum()

        probs = w * probs_xgb + (1 - w) * probs_poisson
        probs = probs / probs.sum()

        cur.execute(
            """
            INSERT INTO dbo.Predictions
                (FixtureId, ModelId, Market, ProbHome, ProbDraw, ProbAway, BestScoreHome, BestScoreAway, BestScoreProb, LambdaHome, LambdaAway)
            VALUES (?, ?, '1X2', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            fixture_id, model_id, float(probs[0]), float(probs[1]), float(probs[2]),
            mkt["best_score"][0], mkt["best_score"][1], mkt["best_score_p"], lam_home, lam_away,
        )
        cur.execute(
            "INSERT INTO dbo.Predictions (FixtureId, ModelId, Market, ProbYes) VALUES (?, ?, 'BTTS', ?)",
            fixture_id, model_id, float(mkt["btts"]),
        )
        cur.execute(
            "INSERT INTO dbo.Predictions (FixtureId, ModelId, Market, ProbYes) VALUES (?, ?, 'OVER25', ?)",
            fixture_id, model_id, float(mkt["over25"]),
        )
        print(f"  Fixture {fixture_id} ({kickoff}): H={probs[0]:.2f} D={probs[1]:.2f} A={probs[2]:.2f}  "
              f"marcador {mkt['best_score']} ({mkt['best_score_p']:.2f})  BTTS={mkt['btts']:.2f}  O2.5={mkt['over25']:.2f}")

    conn2.commit()


def main():
    feat = pd.read_parquet(os.path.join(HERE, "..", "data", "features.parquet"))
    conn = get_connection()
    cur = conn.cursor()
    model_id = get_active_model_id(cur, "1X2")
    if model_id is None:
        raise RuntimeError("No hay modelo activo para 1X2 en dbo.PredictionModels")
    print(f"Usando ModelId={model_id} (1X2 activo)")

    persist_historical(conn, feat, model_id)
    persist_upcoming(conn, feat, model_id)

    conn.close()


if __name__ == "__main__":
    main()
