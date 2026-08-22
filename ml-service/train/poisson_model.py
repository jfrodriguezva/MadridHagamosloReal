"""
Doble Poisson calibrado: en vez de clasificar directo H/D/A, se estima
lambda_home y lambda_away (goles esperados) con una regresión de Poisson,
y de ahí se deriva la distribución completa de marcadores -- de la que
salen 1X2, BTTS, Over/Under y "marcador más probable" de forma consistente
entre sí (algo que un clasificador XGBoost por mercado NO garantiza).
Es el enfoque que la literatura reporta como más robusto para el mercado
de marcador exacto y como líneas base sólidas para el resto.
"""
import sys
import os
import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.linear_model import PoissonRegressor
from sklearn.metrics import accuracy_score, log_loss, brier_score_loss

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

GOAL_FEATURES = [
    "elo_diff", "home_form5_gf", "home_form5_ga", "away_form5_gf", "away_form5_ga",
    "home_form10_gf", "home_form10_ga", "away_form10_gf", "away_form10_ga",
    "home_rest_days", "away_rest_days",
]

MAX_GOALS = 8


def score_matrix(lam_home, lam_away, max_goals=MAX_GOALS):
    ph = poisson.pmf(np.arange(max_goals + 1), lam_home)
    pa = poisson.pmf(np.arange(max_goals + 1), lam_away)
    return np.outer(ph, pa)  # [i,j] = P(home=i, away=j)


def market_probs_from_matrix(mat):
    idx = np.arange(mat.shape[0])
    p_home = mat[np.greater.outer(idx, idx)].sum()
    p_away = mat[np.less.outer(idx, idx)].sum()
    p_draw = np.trace(mat)
    p_btts = mat[1:, 1:].sum()
    total_goals = idx[:, None] + idx[None, :]
    p_over25 = mat[total_goals > 2].sum()
    best_i, best_j = np.unravel_index(np.argmax(mat), mat.shape)
    return {
        "home": p_home, "draw": p_draw, "away": p_away,
        "btts": p_btts, "over25": p_over25,
        "best_score": (int(best_i), int(best_j)), "best_score_p": float(mat[best_i, best_j]),
    }


def walk_forward_poisson(feat: pd.DataFrame, test_seasons):
    oof_rows = []
    for test_season in test_seasons:
        train_df = feat[feat["Season"] < test_season]
        test_df = feat[feat["Season"] == test_season]
        if len(train_df) < 300 or test_df.empty:
            continue

        reg_home = PoissonRegressor(alpha=1.0, max_iter=300)
        reg_away = PoissonRegressor(alpha=1.0, max_iter=300)
        reg_home.fit(train_df[GOAL_FEATURES], train_df["home_goals"])
        reg_away.fit(train_df[GOAL_FEATURES], train_df["away_goals"])

        lam_home = np.clip(reg_home.predict(test_df[GOAL_FEATURES]), 0.15, 6.0)
        lam_away = np.clip(reg_away.predict(test_df[GOAL_FEATURES]), 0.15, 6.0)

        for k, (_, row) in enumerate(test_df.iterrows()):
            mat = score_matrix(lam_home[k], lam_away[k])
            mkt = market_probs_from_matrix(mat)
            oof_rows.append({
                "FixtureId": row["FixtureId"], "Season": test_season,
                "prob_h": mkt["home"], "prob_d": mkt["draw"], "prob_a": mkt["away"],
                "prob_btts": mkt["btts"], "prob_over25": mkt["over25"],
                "lam_home": lam_home[k], "lam_away": lam_away[k],
                "actual_1x2": row["result_1x2"], "actual_btts": row["btts"], "actual_over25": row["over25"],
            })

    return pd.DataFrame(oof_rows)


def evaluate(oof: pd.DataFrame):
    idx_map = {"H": 0, "D": 1, "A": 2}
    actual_idx = oof["actual_1x2"].map(idx_map).values
    probs = oof[["prob_h", "prob_d", "prob_a"]].values
    probs = probs / probs.sum(axis=1, keepdims=True)

    metrics_1x2 = {
        "accuracy": float(accuracy_score(actual_idx, probs.argmax(axis=1))),
        "log_loss": float(log_loss(actual_idx, probs, labels=[0, 1, 2])),
    }
    metrics_btts = {
        "accuracy": float(accuracy_score(oof["actual_btts"], oof["prob_btts"] > 0.5)),
        "log_loss": float(log_loss(oof["actual_btts"], oof["prob_btts"].clip(1e-6, 1 - 1e-6))),
        "brier": float(brier_score_loss(oof["actual_btts"], oof["prob_btts"])),
    }
    metrics_over25 = {
        "accuracy": float(accuracy_score(oof["actual_over25"], oof["prob_over25"] > 0.5)),
        "log_loss": float(log_loss(oof["actual_over25"], oof["prob_over25"].clip(1e-6, 1 - 1e-6))),
        "brier": float(brier_score_loss(oof["actual_over25"], oof["prob_over25"])),
    }
    return metrics_1x2, metrics_btts, metrics_over25


if __name__ == "__main__":
    feat = pd.read_parquet(os.path.join(os.path.dirname(__file__), "..", "data", "features.parquet"))
    test_seasons = list(range(2016, 2026))
    oof = walk_forward_poisson(feat, test_seasons)
    m1, mb, mo = evaluate(oof)
    print("1X2 (Poisson doble):", m1)
    print("BTTS (Poisson doble):", mb)
    print("Over2.5 (Poisson doble):", mo)
