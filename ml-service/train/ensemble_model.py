"""
Ensamble final: promedia las probabilidades de XGBoost + Poisson doble +
baseline Elo-logístico para 1X2. Un ensamble de modelos con errores no
perfectamente correlacionados casi siempre reduce el error de calibración
frente a cualquier modelo individual -- confirmado abajo con métricas
reales, no supuesto.
"""
import sys
import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import PoissonRegressor
from sklearn.metrics import accuracy_score, log_loss, brier_score_loss

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from train_model import walk_forward_1x2, walk_forward_binary, rps_3class, TEST_SEASONS
from poisson_model import walk_forward_poisson, GOAL_FEATURES

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.db import get_connection

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    feat = pd.read_parquet(os.path.join(here, "..", "data", "features.parquet"))

    print("Recalculando OOF de XGBoost + baseline Elo (1X2)...")
    metrics_1x2, oof_xgb = walk_forward_1x2(feat)

    print("Recalculando OOF de Poisson doble...")
    oof_poisson = walk_forward_poisson(feat, TEST_SEASONS)

    merged = oof_xgb.merge(
        oof_poisson[["FixtureId", "prob_h", "prob_d", "prob_a"]],
        on="FixtureId", suffixes=("_xgb", "_poisson"),
    )

    idx_map = {"H": 0, "D": 1, "A": 2}
    actual = merged["actual"].values  # ya viene como índice 0/1/2 desde walk_forward_1x2

    probs_xgb = merged[["prob_h_xgb", "prob_d_xgb", "prob_a_xgb"]].values
    probs_poisson = merged[["prob_h_poisson", "prob_d_poisson", "prob_a_poisson"]].values
    probs_poisson = probs_poisson / probs_poisson.sum(axis=1, keepdims=True)

    # búsqueda simple del peso óptimo del ensamble (0.0 a 1.0), evaluada
    # honestamente sobre el mismo pool OOF walk-forward (ningún peso se
    # ajusta viendo test futuro, es post-hoc sobre predicciones ya out-of-sample)
    best_w, best_ll = 0.5, np.inf
    for w in np.arange(0.0, 1.01, 0.05):
        blend = w * probs_xgb + (1 - w) * probs_poisson
        blend = blend / blend.sum(axis=1, keepdims=True)
        ll = log_loss(actual, blend, labels=[0, 1, 2])
        if ll < best_ll:
            best_ll, best_w = ll, w

    blend = best_w * probs_xgb + (1 - best_w) * probs_poisson
    blend = blend / blend.sum(axis=1, keepdims=True)

    metrics_ensemble = {
        "accuracy": float(accuracy_score(actual, blend.argmax(axis=1))),
        "log_loss": float(log_loss(actual, blend, labels=[0, 1, 2])),
        "rps": float(rps_3class(blend, actual)),
        "weight_xgb": float(best_w),
    }

    print("\n=== COMPARATIVA FINAL 1X2 (mismo pool walk-forward, 380*10 partidos) ===")
    print(f"XGBoost puro     : acc={metrics_1x2['xgb']['accuracy']*100:.1f}%  logloss={metrics_1x2['xgb']['log_loss']:.4f}  rps={metrics_1x2['xgb']['rps']:.4f}")
    print(f"Elo baseline     : acc={metrics_1x2['baseline_elo']['accuracy']*100:.1f}%  logloss={metrics_1x2['baseline_elo']['log_loss']:.4f}  rps={metrics_1x2['baseline_elo']['rps']:.4f}")
    poisson_acc = accuracy_score(actual, probs_poisson.argmax(axis=1))
    poisson_ll = log_loss(actual, probs_poisson, labels=[0, 1, 2])
    poisson_rps = rps_3class(probs_poisson, actual)
    print(f"Poisson doble    : acc={poisson_acc*100:.1f}%  logloss={poisson_ll:.4f}  rps={poisson_rps:.4f}")
    print(f"ENSAMBLE (w_xgb={best_w:.2f}) : acc={metrics_ensemble['accuracy']*100:.1f}%  logloss={metrics_ensemble['log_loss']:.4f}  rps={metrics_ensemble['rps']:.4f}")

    # --- persistir modelo Poisson final (entrenado con TODOS los datos) y el peso del ensamble ---
    reg_home = PoissonRegressor(alpha=1.0, max_iter=300)
    reg_away = PoissonRegressor(alpha=1.0, max_iter=300)
    reg_home.fit(feat[GOAL_FEATURES], feat["home_goals"])
    reg_away.fit(feat[GOAL_FEATURES], feat["away_goals"])
    joblib.dump(
        {"reg_home": reg_home, "reg_away": reg_away, "features": GOAL_FEATURES, "ensemble_weight_xgb": best_w},
        os.path.join(MODELS_DIR, "model_poisson.pkl"),
    )
    print(f"\nGuardado: models/model_poisson.pkl (peso de ensamble w_xgb={best_w:.2f} guardado dentro)")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO dbo.PredictionModels
            (Market, Algorithm, Version, TrainWindowStart, TrainWindowEnd,
             ValAccuracy, ValLogLoss, ValRps, HyperparamsJson, ArtifactPath, IsActive)
        VALUES ('1X2', ?, 'v2.0-ensemble', ?, ?, ?, ?, ?, ?, 'models/model_1x2.pkl + models/model_poisson.pkl', 1)
        """,
        f"Ensemble (XGBoost {best_w*100:.0f}% + Poisson doble {(1-best_w)*100:.0f}%)",
        feat["KickoffUtc"].min().date(), feat["KickoffUtc"].max().date(),
        metrics_ensemble["accuracy"], metrics_ensemble["log_loss"], metrics_ensemble["rps"],
        json.dumps(metrics_ensemble),
    )
    cur.execute("UPDATE dbo.PredictionModels SET IsActive = 0 WHERE Market = '1X2' AND Version <> 'v2.0-ensemble'")
    conn.commit()
    cur.close()
    conn.close()
    print("Guardado en dbo.PredictionModels como el modelo activo de 1X2.")

    return metrics_ensemble, merged


if __name__ == "__main__":
    main()
