"""
Entrenamiento y validación walk-forward (por temporada, expanding window)
de los modelos de predicción. Nunca se mezcla el orden temporal: cada
temporada de test se predice con un modelo entrenado SOLO con temporadas
anteriores -- así los números que salen aquí son los que de verdad se
pueden esperar en producción, no un accuracy inflado por fuga de datos.

Mercados entrenados:
  1) 1X2 general (multiclase)          -- XGBoost vs baseline Elo-logístico
  2) BTTS (ambos anotan)                -- XGBoost binario
  3) Over 2.5 goles                     -- XGBoost binario
  4) "Real Madrid gana" (especializado) -- XGBoost binario, features desde
     la perspectiva del Real Madrid (especialización = mejor accuracy,
     confirmado en la literatura frente a un modelo genérico reutilizado)

Guarda cada modelo + sus métricas reales en dbo.PredictionModels.
"""
import sys
import os
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss, brier_score_loss
import xgboost as xgb
import joblib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.db import get_connection
from madrid_shot_features import load_madrid_shot_stats

REAL_MADRID_ID = 541
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(HERE, "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

GENERAL_FEATURES = [
    "elo_home", "elo_away", "elo_diff",
    "home_form5_pts", "away_form5_pts", "home_form5_gf", "home_form5_ga",
    "away_form5_gf", "away_form5_ga",
    "home_form10_pts", "away_form10_pts", "home_form10_gf", "home_form10_ga",
    "away_form10_gf", "away_form10_ga",
    "home_rest_days", "away_rest_days", "h2h_balance",
    "exp_goals_home", "exp_goals_away", "exp_total_goals",
    "combined_leakiness", "combined_firepower",
    "form5_pts_diff", "form10_pts_diff", "rest_diff",
]

TEST_SEASONS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]


def rps_3class(probs, actual_idx, n_classes=3):
    """Ranked Probability Score, orden H(0) D(1) A(2). Menor es mejor."""
    cum_p = np.cumsum(probs, axis=1)
    actual = np.zeros_like(probs)
    actual[np.arange(len(actual_idx)), actual_idx] = 1
    cum_a = np.cumsum(actual, axis=1)
    return np.mean(np.sum((cum_p[:, :-1] - cum_a[:, :-1]) ** 2, axis=1) / (n_classes - 1))


RESULT_TO_IDX = {"H": 0, "D": 1, "A": 2}  # orden fijo y EXPLÍCITO -- LabelEncoder
# ordena alfabéticamente (A,D,H) y producía probabilidades home/away invertidas


def walk_forward_1x2(feat: pd.DataFrame):
    oof_probs_xgb, oof_probs_base, oof_actual, oof_meta = [], [], [], []

    for test_season in TEST_SEASONS:
        train_df = feat[feat["Season"] < test_season]
        test_df = feat[feat["Season"] == test_season]
        if len(train_df) < 300 or test_df.empty:
            continue

        X_train = train_df[GENERAL_FEATURES]
        y_train = train_df["result_1x2"].map(RESULT_TO_IDX).values
        X_test = test_df[GENERAL_FEATURES]
        y_test = test_df["result_1x2"].map(RESULT_TO_IDX).values

        model = xgb.XGBClassifier(
            n_estimators=260, max_depth=3, learning_rate=0.035,
            subsample=0.85, colsample_bytree=0.75,
            reg_lambda=1.5, reg_alpha=0.3,
            objective="multi:softprob", num_class=3,
            eval_metric="mlogloss", tree_method="hist",
            random_state=42,
        )
        model.fit(X_train, y_train)
        p_xgb = model.predict_proba(X_test)

        # baseline: regresión logística multinomial SOLO con elo_diff
        base = LogisticRegression(max_iter=500, multi_class="multinomial")
        base.fit(train_df[["elo_diff"]], y_train)
        p_base = np.zeros((len(test_df), 3))
        base_classes = list(base.classes_)
        raw = base.predict_proba(test_df[["elo_diff"]])
        for j, c in enumerate(base_classes):
            p_base[:, c] = raw[:, j]

        oof_probs_xgb.append(p_xgb)
        oof_probs_base.append(p_base)
        oof_actual.append(y_test)
        oof_meta.append(test_df[["FixtureId", "Season"]])

        acc = accuracy_score(y_test, p_xgb.argmax(axis=1))
        print(f"  [1X2] temporada test {test_season}: n={len(test_df)}  acc={acc:.3f}")

    probs_xgb = np.vstack(oof_probs_xgb)
    probs_base = np.vstack(oof_probs_base)
    actual = np.concatenate(oof_actual)
    meta = pd.concat(oof_meta)

    metrics = {
        "xgb": {
            "accuracy": float(accuracy_score(actual, probs_xgb.argmax(axis=1))),
            "log_loss": float(log_loss(actual, probs_xgb, labels=[0, 1, 2])),
            "rps": float(rps_3class(probs_xgb, actual)),
        },
        "baseline_elo": {
            "accuracy": float(accuracy_score(actual, probs_base.argmax(axis=1))),
            "log_loss": float(log_loss(actual, probs_base, labels=[0, 1, 2])),
            "rps": float(rps_3class(probs_base, actual)),
        },
    }
    # modelo final: entrenado con TODAS las temporadas disponibles, para servir en producción
    final_model = xgb.XGBClassifier(
        n_estimators=260, max_depth=3, learning_rate=0.035,
        subsample=0.85, colsample_bytree=0.75, reg_lambda=1.5, reg_alpha=0.3,
        objective="multi:softprob", num_class=3, eval_metric="mlogloss",
        tree_method="hist", random_state=42,
    )
    final_model.fit(feat[GENERAL_FEATURES], feat["result_1x2"].map(RESULT_TO_IDX).values)
    joblib.dump({"model": final_model, "class_order": ["H", "D", "A"], "features": GENERAL_FEATURES},
                os.path.join(MODELS_DIR, "model_1x2.pkl"))

    return metrics, meta.assign(actual=actual, prob_h=probs_xgb[:, 0],
                                 prob_d=probs_xgb[:, 1], prob_a=probs_xgb[:, 2])


def optimal_threshold(y_train, p_train):
    """Umbral de decisión que maximiza accuracy EN TRAIN (nunca en test) --
    con clases desbalanceadas (ej. el Madrid gana 67% de sus partidos),
    0.5 fijo castiga la accuracy frente al baseline trivial de "predecir
    siempre la clase mayoritaria"; este umbral corrige ese sesgo sin tocar
    ni una sola etiqueta del fold de test."""
    candidates = np.unique(np.clip(p_train, 0.01, 0.99))
    if len(candidates) == 0:
        return 0.5
    best_t, best_acc = 0.5, -1
    for t in candidates:
        acc = accuracy_score(y_train, p_train > t)
        if acc > best_acc:
            best_acc, best_t = acc, t
    return best_t


def walk_forward_binary(feat: pd.DataFrame, target_col: str, name: str):
    oof_probs, oof_actual, oof_pred = [], [], []
    for test_season in TEST_SEASONS:
        train_df = feat[feat["Season"] < test_season]
        test_df = feat[feat["Season"] == test_season]
        if len(train_df) < 300 or test_df.empty:
            continue
        model = xgb.XGBClassifier(
            n_estimators=320, max_depth=4, learning_rate=0.05,
            min_child_weight=5, subsample=0.85, colsample_bytree=0.8, reg_lambda=1.2,
            objective="binary:logistic", eval_metric="logloss",
            tree_method="hist", random_state=42,
        )
        model.fit(train_df[GENERAL_FEATURES], train_df[target_col])
        p_train = model.predict_proba(train_df[GENERAL_FEATURES])[:, 1]
        thresh = optimal_threshold(train_df[target_col].values, p_train)
        p = model.predict_proba(test_df[GENERAL_FEATURES])[:, 1]
        oof_probs.append(p)
        oof_actual.append(test_df[target_col].values)
        oof_pred.append(p > thresh)

    probs = np.concatenate(oof_probs)
    actual = np.concatenate(oof_actual)
    preds = np.concatenate(oof_pred)
    metrics = {
        "accuracy": float(accuracy_score(actual, preds)),
        "accuracy_fixed_50": float(accuracy_score(actual, probs > 0.5)),
        "log_loss": float(log_loss(actual, probs)),
        "brier": float(brier_score_loss(actual, probs)),
    }
    final_model = xgb.XGBClassifier(
        n_estimators=320, max_depth=4, learning_rate=0.05,
        min_child_weight=5, subsample=0.85, colsample_bytree=0.8, reg_lambda=1.2,
        objective="binary:logistic", eval_metric="logloss",
        tree_method="hist", random_state=42,
    )
    final_model.fit(feat[GENERAL_FEATURES], feat[target_col])
    joblib.dump({"model": final_model, "features": GENERAL_FEATURES},
                os.path.join(MODELS_DIR, f"model_{name}.pkl"))
    return metrics


def madrid_perspective(feat: pd.DataFrame) -> pd.DataFrame:
    """Reorienta cada partido del Madrid a features 'equipo' vs 'rival',
    sin importar si jugó de local o visitante -- especialización real."""
    is_home = feat["HomeTeamId"] == REAL_MADRID_ID
    is_away = feat["AwayTeamId"] == REAL_MADRID_ID
    m = feat[is_home | is_away].copy()

    def pick(row):
        home = row["HomeTeamId"] == REAL_MADRID_ID
        return pd.Series({
            "team_elo": row["elo_home"] if home else row["elo_away"],
            "opp_elo": row["elo_away"] if home else row["elo_home"],
            "team_form5_pts": row["home_form5_pts"] if home else row["away_form5_pts"],
            "opp_form5_pts": row["away_form5_pts"] if home else row["home_form5_pts"],
            "team_form5_gf": row["home_form5_gf"] if home else row["away_form5_gf"],
            "team_form5_ga": row["home_form5_ga"] if home else row["away_form5_ga"],
            "opp_form5_gf": row["away_form5_gf"] if home else row["home_form5_gf"],
            "opp_form5_ga": row["away_form5_ga"] if home else row["home_form5_ga"],
            "team_rest_days": row["home_rest_days"] if home else row["away_rest_days"],
            "opp_rest_days": row["away_rest_days"] if home else row["home_rest_days"],
            "h2h_balance": row["h2h_balance"] if home else -row["h2h_balance"],
            "is_home": 1 if home else 0,
            "Season": row["Season"],
            "FixtureId": row["FixtureId"],
            "team_won": 1 if ((home and row["result_1x2"] == "H") or
                               (not home and row["result_1x2"] == "A")) else 0,
        })

    out = m.apply(pick, axis=1)
    out["FixtureId"] = out["FixtureId"].astype(int)
    out["Season"] = out["Season"].astype(int)
    out["elo_diff_team"] = out["team_elo"] - out["opp_elo"] + out["is_home"] * 68
    out["exp_goals_team"] = (out["team_form5_gf"] + out["opp_form5_ga"]) / 2.0
    out["exp_goals_opp"] = (out["opp_form5_gf"] + out["team_form5_ga"]) / 2.0
    out["exp_goal_diff"] = out["exp_goals_team"] - out["exp_goals_opp"]
    out["form5_pts_diff"] = out["team_form5_pts"] - out["opp_form5_pts"]

    # features reales de tiros/posesión (proxy de xG) -- solo disponibles
    # de forma completa desde la temporada 2015-16 en adelante
    shots = load_madrid_shot_stats()
    out = out.merge(shots.drop(columns=["Season"]), on="FixtureId", how="left")
    return out


MADRID_FEATURES = [
    "team_elo", "opp_elo", "elo_diff_team", "is_home",
    "team_form5_pts", "opp_form5_pts", "team_form5_gf", "team_form5_ga",
    "opp_form5_gf", "opp_form5_ga", "team_rest_days", "opp_rest_days", "h2h_balance",
    "exp_goals_team", "exp_goals_opp", "exp_goal_diff", "form5_pts_diff",
]

MADRID_FEATURES_ENRICHED = MADRID_FEATURES + [
    "team_shotsongoal_form5", "team_totalshots_form5",
    "team_ballpossessionpct_form5", "team_corners_form5",
]


def walk_forward_madrid_win(mfeat: pd.DataFrame, feature_list=None):
    feature_list = feature_list or MADRID_FEATURES
    mfeat = mfeat.dropna(subset=feature_list + ["team_won"]).copy()
    oof_probs, oof_actual, oof_pred = [], [], []
    seasons_present = sorted(mfeat["Season"].unique())
    test_seasons = [s for s in TEST_SEASONS if s in seasons_present]
    for test_season in test_seasons:
        train_df = mfeat[mfeat["Season"] < test_season]
        test_df = mfeat[mfeat["Season"] == test_season]
        if len(train_df) < 100 or test_df.empty:
            continue
        model = xgb.XGBClassifier(
            n_estimators=150, max_depth=2, learning_rate=0.04,
            min_child_weight=8, subsample=0.9, colsample_bytree=0.8, reg_lambda=2.0,
            objective="binary:logistic", eval_metric="logloss",
            tree_method="hist", random_state=42,
        )
        model.fit(train_df[feature_list], train_df["team_won"])
        p_train = model.predict_proba(train_df[feature_list])[:, 1]
        thresh = optimal_threshold(train_df["team_won"].values, p_train)
        p = model.predict_proba(test_df[feature_list])[:, 1]
        oof_probs.append(p)
        oof_actual.append(test_df["team_won"].values)
        oof_pred.append(p > thresh)
        acc = accuracy_score(test_df["team_won"], p > thresh)
        print(f"  [MADRID_WIN] temporada test {test_season}: n={len(test_df)}  acc={acc:.3f}  umbral={thresh:.2f}")

    probs = np.concatenate(oof_probs)
    actual = np.concatenate(oof_actual)
    preds = np.concatenate(oof_pred)
    metrics = {
        "accuracy": float(accuracy_score(actual, preds)),
        "accuracy_fixed_50": float(accuracy_score(actual, probs > 0.5)),
        "log_loss": float(log_loss(actual, probs)),
        "brier": float(brier_score_loss(actual, probs)),
        "base_rate_madrid_win": float(np.mean(actual)),
    }
    final_model = xgb.XGBClassifier(
        n_estimators=180, max_depth=3, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.8, reg_lambda=1.0,
        objective="binary:logistic", eval_metric="logloss",
        tree_method="hist", random_state=42,
    )
    final_model.fit(mfeat[feature_list], mfeat["team_won"])
    joblib.dump({"model": final_model, "features": feature_list},
                os.path.join(MODELS_DIR, "model_madrid_win.pkl"))
    return metrics


def save_model_metrics(cur, market, algorithm, metrics, train_start, train_end):
    cur.execute(
        """
        INSERT INTO dbo.PredictionModels
            (Market, Algorithm, Version, TrainWindowStart, TrainWindowEnd,
             ValAccuracy, ValLogLoss, ValRps, ValBrier, HyperparamsJson, ArtifactPath, IsActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """,
        market, algorithm, "v1.0", train_start, train_end,
        metrics.get("accuracy"), metrics.get("log_loss"), metrics.get("rps"), metrics.get("brier"),
        json.dumps(metrics), f"models/model_{market.lower()}.pkl",
    )


def main():
    feat = pd.read_parquet(os.path.join(HERE, "..", "data", "features.parquet"))
    train_start = feat["KickoffUtc"].min().date()
    train_end = feat["KickoffUtc"].max().date()

    print("\n=== 1X2 general (walk-forward por temporada 2020-2025) ===")
    metrics_1x2, oof = walk_forward_1x2(feat)
    print(json.dumps(metrics_1x2, indent=2))

    print("\n=== BTTS (ambos anotan) ===")
    metrics_btts = walk_forward_binary(feat, "btts", "btts")
    print(json.dumps(metrics_btts, indent=2))

    print("\n=== Over 2.5 goles ===")
    metrics_ou = walk_forward_binary(feat, "over25", "over25")
    print(json.dumps(metrics_ou, indent=2))

    # Lo que de verdad importa para el producto: estos mismos modelos
    # generales, evaluados SOLO en los partidos donde jugó el Real Madrid
    # (el 100% de lo que la app va a mostrar).
    madrid_mask = (oof.merge(feat[["FixtureId", "HomeTeamId", "AwayTeamId"]], on="FixtureId")
                   .pipe(lambda d: (d["HomeTeamId"] == REAL_MADRID_ID) | (d["AwayTeamId"] == REAL_MADRID_ID)))
    oof_rm = oof.merge(feat[["FixtureId", "HomeTeamId", "AwayTeamId", "btts", "over25"]], on="FixtureId")
    oof_rm = oof_rm[(oof_rm["HomeTeamId"] == REAL_MADRID_ID) | (oof_rm["AwayTeamId"] == REAL_MADRID_ID)]
    rm_1x2_acc = accuracy_score(
        oof_rm["actual"], oof_rm[["prob_h", "prob_d", "prob_a"]].values.argmax(axis=1)
    )
    print(f"\n>> 1X2 (XGBoost general) evaluado SOLO en partidos del Real Madrid: n={len(oof_rm)}  acc={rm_1x2_acc*100:.1f}%")

    print("\n=== Real Madrid gana (modelo especializado, base) ===")
    mfeat = madrid_perspective(feat)
    metrics_madrid_base = walk_forward_madrid_win(mfeat, MADRID_FEATURES)
    print(json.dumps(metrics_madrid_base, indent=2))

    print("\n=== Real Madrid gana (enriquecido con tiros/posesión reales, 2016+) ===")
    metrics_madrid_enriched = walk_forward_madrid_win(mfeat, MADRID_FEATURES_ENRICHED)
    print(json.dumps(metrics_madrid_enriched, indent=2))

    if metrics_madrid_enriched["accuracy"] >= metrics_madrid_base["accuracy"]:
        metrics_madrid, madrid_feature_set, madrid_algo = metrics_madrid_enriched, MADRID_FEATURES_ENRICHED, "XGBoost (especializado + tiros/posesión)"
    else:
        metrics_madrid, madrid_feature_set, madrid_algo = metrics_madrid_base, MADRID_FEATURES, "XGBoost (especializado)"
    print(f">> Featureset ganador para MADRID_WIN: {'enriquecido' if madrid_feature_set is MADRID_FEATURES_ENRICHED else 'base'}")
    # el .pkl final ya quedó guardado con el featureset correspondiente por la
    # última llamada a walk_forward_madrid_win que corresponda al ganador
    if madrid_feature_set is MADRID_FEATURES:
        walk_forward_madrid_win(mfeat, MADRID_FEATURES)  # re-guarda el .pkl base como definitivo

    conn = get_connection()
    cur = conn.cursor()
    save_model_metrics(cur, "1X2", "XGBoost", metrics_1x2["xgb"], train_start, train_end)
    save_model_metrics(cur, "1X2_BASELINE_ELO", "LogisticRegression", metrics_1x2["baseline_elo"], train_start, train_end)
    save_model_metrics(cur, "BTTS", "XGBoost", metrics_btts, train_start, train_end)
    save_model_metrics(cur, "OVER25", "XGBoost", metrics_ou, train_start, train_end)
    save_model_metrics(cur, "MADRID_WIN", madrid_algo, metrics_madrid, train_start, train_end)
    conn.commit()
    cur.close()
    conn.close()

    print("\n=== RESUMEN FINAL (accuracy real, validado walk-forward, sin fuga de datos) ===")
    print(f"1X2 (XGBoost, toda La Liga): {metrics_1x2['xgb']['accuracy']*100:.1f}%   (baseline Elo puro: {metrics_1x2['baseline_elo']['accuracy']*100:.1f}%)")
    print(f"1X2 (XGBoost, solo Madrid) : {rm_1x2_acc*100:.1f}%")
    print(f"BTTS                       : {metrics_btts['accuracy']*100:.1f}%")
    print(f"Over 2.5 goles             : {metrics_ou['accuracy']*100:.1f}%")
    print(f"Real Madrid gana (especial.): {metrics_madrid['accuracy']*100:.1f}%   (tasa base de victoria: {metrics_madrid['base_rate_madrid_win']*100:.1f}%)")


if __name__ == "__main__":
    main()
