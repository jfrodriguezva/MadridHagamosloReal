"""
Corre el modelo del usuario (RM_SalaBlanca predictor: Poisson independiente +
calibración de empate + ventaja de local) TAL CUAL sobre el mismo dataset
walk-forward de 10 temporadas (6,080 partidos de La Liga, 380 del Real
Madrid) que valida el modelo de este proyecto -- para responder con datos,
no con opinión, cuál generaliza mejor fuera de muestra.

Constantes y fórmula copiadas sin modificar de su predict_match():
HOME_ADVANTAGE=1.25, DRAW_CALIBRATION=1.4, MAX_GOALS=6.
"""
import sys
import os
import math
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, log_loss

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from train_model import rps_3class, TEST_SEASONS, RESULT_TO_IDX

REAL_MADRID_ID = 541
HOME_ADVANTAGE = 1.25
DRAW_CALIBRATION = 1.4
MAX_GOALS = 6


def _poisson_p(lam, k):
    return (lam ** k) * math.exp(-lam) / math.factorial(k)


def predict_match(home_goals_for, home_goals_against, away_goals_for, away_goals_against, home_advantage=True):
    adv = HOME_ADVANTAGE if home_advantage else 1.0
    lambda_home = ((home_goals_for + away_goals_against) / 2) * adv
    lambda_away = (away_goals_for + home_goals_against) / 2

    prob_home = prob_draw = prob_away = 0.0
    for h in range(MAX_GOALS + 1):
        for a in range(MAX_GOALS + 1):
            p = _poisson_p(lambda_home, h) * _poisson_p(lambda_away, a)
            if h == a:
                p *= DRAW_CALIBRATION
            if h > a:
                prob_home += p
            elif h == a:
                prob_draw += p
            else:
                prob_away += p
    total = prob_home + prob_draw + prob_away
    return prob_home / total, prob_draw / total, prob_away / total


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    feat = pd.read_parquet(os.path.join(here, "..", "data", "features.parquet"))

    # inputs "form10" (mismos que usa este proyecto) -- comparación de modelo
    # a igualdad de features de entrada, aislando la técnica estadística
    rows = []
    for _, r in feat.iterrows():
        ph, pd_, pa = predict_match(
            r["home_form10_gf"], r["home_form10_ga"], r["away_form10_gf"], r["away_form10_ga"]
        )
        rows.append({"FixtureId": r["FixtureId"], "Season": r["Season"],
                      "HomeTeamId": r["HomeTeamId"], "AwayTeamId": r["AwayTeamId"],
                      "prob_h": ph, "prob_d": pd_, "prob_a": pa, "result_1x2": r["result_1x2"]})
    df = pd.DataFrame(rows)
    df["actual"] = df["result_1x2"].map(RESULT_TO_IDX)

    # -- comparación 1: mismas 10 temporadas de test (2016-2025), toda La Liga --
    test = df[df["Season"].isin(TEST_SEASONS)]
    probs = test[["prob_h", "prob_d", "prob_a"]].values
    acc = accuracy_score(test["actual"], probs.argmax(axis=1))
    ll = log_loss(test["actual"], probs, labels=[0, 1, 2])
    rps = rps_3class(probs, test["actual"].values)
    print(f"=== Modelo del usuario, TODA LA LIGA, 10 temporadas (n={len(test)}) ===")
    print(f"accuracy={acc*100:.1f}%  log_loss={ll:.4f}  rps={rps:.4f}")
    print("(comparar contra: mi ensemble 52.8% acc / 0.9848 logloss / 0.1975 rps)\n")

    # -- comparación 2: solo partidos del Real Madrid, mismas 10 temporadas --
    rm = test[(test["HomeTeamId"] == REAL_MADRID_ID) | (test["AwayTeamId"] == REAL_MADRID_ID)]
    probs_rm = rm[["prob_h", "prob_d", "prob_a"]].values
    acc_rm = accuracy_score(rm["actual"], probs_rm.argmax(axis=1))
    print(f"=== Modelo del usuario, SOLO REAL MADRID, 10 temporadas (n={len(rm)}) ===")
    print(f"accuracy={acc_rm*100:.1f}%")
    print("(comparar contra: mi ensemble 67.6% acc, mismo alcance)\n")

    # -- comparación 3: replica exacta de su backtest -- 3 temporadas, solo Real Madrid --
    last3 = df[(df["Season"].isin([2023, 2024, 2025])) &
               ((df["HomeTeamId"] == REAL_MADRID_ID) | (df["AwayTeamId"] == REAL_MADRID_ID))]
    probs_l3 = last3[["prob_h", "prob_d", "prob_a"]].values
    acc_l3 = accuracy_score(last3["actual"], probs_l3.argmax(axis=1))
    n_correct = int(round(acc_l3 * len(last3)))
    se = math.sqrt(acc_l3 * (1 - acc_l3) / len(last3)) if len(last3) else 0
    print(f"=== Réplica de SU backtest: 3 temporadas 2023-2025, solo Real Madrid (n={len(last3)}) ===")
    print(f"accuracy={acc_l3*100:.1f}% ({n_correct}/{len(last3)})  error estándar ±{se*100*1.96:.1f} pts (IC 95%)")
    print(f"Ellos reportan 73.4% train / 73.7% holdout sobre 109-114 partidos -- mismo orden de magnitud de muestra.")


if __name__ == "__main__":
    main()
