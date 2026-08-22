"""
Último intento honesto de subir el umbral del mercado 'Madrid gana':
en vez de un modelo binario dedicado (entrenado con solo ~380 filas,
propenso a sobreajuste), se deriva la probabilidad de victoria directamente
del ENSAMBLE GENERAL (entrenado con 6,000+ partidos de La Liga), evaluado
SOLO en los partidos del Real Madrid -- con umbral de decisión optimizado
en train (nunca en test), exactamente igual que en train_model.py.
"""
import sys
import os
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, log_loss, brier_score_loss

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from train_model import walk_forward_1x2, TEST_SEASONS, optimal_threshold
from poisson_model import walk_forward_poisson

REAL_MADRID_ID = 541


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    feat = pd.read_parquet(os.path.join(here, "..", "data", "features.parquet"))

    _, oof_xgb = walk_forward_1x2(feat)
    oof_poisson = walk_forward_poisson(feat, TEST_SEASONS)
    merged = oof_xgb.merge(
        oof_poisson[["FixtureId", "prob_h", "prob_d", "prob_a"]],
        on="FixtureId", suffixes=("_xgb", "_poisson"),
    ).merge(feat[["FixtureId", "HomeTeamId", "AwayTeamId"]], on="FixtureId")

    w = 0.20  # peso óptimo ya encontrado en ensemble_model.py
    probs_xgb = merged[["prob_h_xgb", "prob_d_xgb", "prob_a_xgb"]].values
    probs_poisson = merged[["prob_h_poisson", "prob_d_poisson", "prob_a_poisson"]].values
    probs_poisson = probs_poisson / probs_poisson.sum(axis=1, keepdims=True)
    blend = w * probs_xgb + (1 - w) * probs_poisson
    blend = blend / blend.sum(axis=1, keepdims=True)
    merged["prob_h"], merged["prob_d"], merged["prob_a"] = blend[:, 0], blend[:, 1], blend[:, 2]

    is_rm_home = merged["HomeTeamId"] == REAL_MADRID_ID
    is_rm_away = merged["AwayTeamId"] == REAL_MADRID_ID
    rm = merged[is_rm_home | is_rm_away].copy()
    rm["win_prob"] = np.where(rm["HomeTeamId"] == REAL_MADRID_ID, rm["prob_h"], rm["prob_a"])
    rm["team_won"] = np.where(
        rm["HomeTeamId"] == REAL_MADRID_ID, (rm["actual"] == 0).astype(int), (rm["actual"] == 2).astype(int)
    )
    # argmax puro (lo que ya se ve en el dashboard)
    acc_argmax = accuracy_score(rm["team_won"], rm["win_prob"] > 0.5)

    # umbral óptimo por fold walk-forward (entrenado en seasons anteriores, aplicado a la siguiente)
    preds = []
    for season in sorted(rm["Season"].unique()):
        train = rm[rm["Season"] < season]
        test = rm[rm["Season"] == season]
        if len(train) < 30 or test.empty:
            preds.append(test.assign(pred=test["win_prob"] > 0.5))
            continue
        t = optimal_threshold(train["team_won"].values, train["win_prob"].values)
        preds.append(test.assign(pred=test["win_prob"] > t))
    preds_df = pd.concat(preds)
    acc_thresh = accuracy_score(preds_df["team_won"], preds_df["pred"])

    print(f"n={len(rm)}")
    print(f"Derivado del ensamble, umbral 0.5 (argmax)  : {acc_argmax*100:.1f}%")
    print(f"Derivado del ensamble, umbral óptimo walk-fwd: {acc_thresh*100:.1f}%")
    print(f"Tasa base (predecir victoria siempre)        : {rm['team_won'].mean()*100:.1f}%")
    ll = log_loss(rm["team_won"], rm["win_prob"].clip(1e-6, 1 - 1e-6))
    brier = brier_score_loss(rm["team_won"], rm["win_prob"])
    print(f"log-loss={ll:.4f}  brier={brier:.4f}")

    return rm, preds_df


if __name__ == "__main__":
    main()
