"""
madrid-ml-service -- FastAPI que sirve los modelos entrenados (models/*.pkl)
al Prediction Service (.NET) vía HTTP. Cada modelo fue validado con
walk-forward por temporada (ver train/train_model.py) -- las métricas reales
quedan registradas en dbo.PredictionModels.
"""
import os
import joblib
import numpy as np
import pandas as pd
from scipy.stats import poisson as poisson_dist
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(HERE, "models")

app = FastAPI(title="Madrid Hagámoslo Real - ML Service", version="1.0.0")

_cache = {}


def load_model(name: str):
    if name not in _cache:
        path = os.path.join(MODELS_DIR, f"model_{name}.pkl")
        if not os.path.exists(path):
            raise HTTPException(404, f"Modelo '{name}' no entrenado todavía")
        _cache[name] = joblib.load(path)
    return _cache[name]


class MatchFeatures(BaseModel):
    elo_home: float
    elo_away: float
    home_form5_pts: float
    away_form5_pts: float
    home_form5_gf: float
    home_form5_ga: float
    away_form5_gf: float
    away_form5_ga: float
    home_form10_pts: float
    away_form10_pts: float
    home_form10_gf: float
    home_form10_ga: float
    away_form10_gf: float
    away_form10_ga: float
    home_rest_days: float
    away_rest_days: float
    h2h_balance: float


def derive_row(f: MatchFeatures) -> pd.DataFrame:
    d = f.model_dump()
    d["elo_diff"] = d["elo_home"] - d["elo_away"] + 68
    d["exp_goals_home"] = (d["home_form5_gf"] + d["away_form5_ga"]) / 2.0
    d["exp_goals_away"] = (d["away_form5_gf"] + d["home_form5_ga"]) / 2.0
    d["exp_total_goals"] = d["exp_goals_home"] + d["exp_goals_away"]
    d["combined_leakiness"] = d["home_form5_ga"] + d["away_form5_ga"]
    d["combined_firepower"] = d["home_form5_gf"] + d["away_form5_gf"]
    d["form5_pts_diff"] = d["home_form5_pts"] - d["away_form5_pts"]
    d["form10_pts_diff"] = d["home_form10_pts"] - d["away_form10_pts"]
    d["rest_diff"] = d["home_rest_days"] - d["away_rest_days"]
    return pd.DataFrame([d])


@app.get("/health")
def health():
    return {"status": "ok"}


def poisson_1x2_probs(poisson_bundle, row_full: dict, max_goals: int = 8):
    goal_row = pd.DataFrame([row_full])[poisson_bundle["features"]]
    lam_home = float(np.clip(poisson_bundle["reg_home"].predict(goal_row)[0], 0.15, 6.0))
    lam_away = float(np.clip(poisson_bundle["reg_away"].predict(goal_row)[0], 0.15, 6.0))
    ph = poisson_dist.pmf(np.arange(max_goals + 1), lam_home)
    pa = poisson_dist.pmf(np.arange(max_goals + 1), lam_away)
    mat = np.outer(ph, pa)
    idx = np.arange(mat.shape[0])
    p_home = mat[np.greater.outer(idx, idx)].sum()
    p_away = mat[np.less.outer(idx, idx)].sum()
    p_draw = np.trace(mat)
    return np.array([p_home, p_draw, p_away])


@app.post("/predict/1x2")
def predict_1x2(features: MatchFeatures):
    """Ensamble: XGBoost + Poisson doble, con el peso validado walk-forward
    (ver train/ensemble_model.py) -- el ensamble le gana en log-loss y RPS
    a cualquiera de los dos modelos por separado."""
    bundle = load_model("1x2")
    poisson_bundle = load_model("poisson")
    row_full = derive_row(features).iloc[0].to_dict()

    row_xgb = pd.DataFrame([row_full])[bundle["features"]]
    probs_xgb = bundle["model"].predict_proba(row_xgb)[0]
    probs_poisson = poisson_1x2_probs(poisson_bundle, row_full)
    probs_poisson = probs_poisson / probs_poisson.sum()

    w = poisson_bundle["ensemble_weight_xgb"]
    probs = w * probs_xgb + (1 - w) * probs_poisson
    probs = probs / probs.sum()
    return {"home": round(float(probs[0]), 4), "draw": round(float(probs[1]), 4), "away": round(float(probs[2]), 4)}


@app.post("/predict/btts")
def predict_btts(features: MatchFeatures):
    bundle = load_model("btts")
    row = derive_row(features)[bundle["features"]]
    p = bundle["model"].predict_proba(row)[0][1]
    return {"btts_yes": round(float(p), 4)}


@app.post("/predict/over25")
def predict_over25(features: MatchFeatures):
    bundle = load_model("over25")
    row = derive_row(features)[bundle["features"]]
    p = bundle["model"].predict_proba(row)[0][1]
    return {"over_2_5": round(float(p), 4)}


class MadridMatchFeatures(BaseModel):
    team_elo: float
    opp_elo: float
    is_home: int
    team_form5_pts: float
    opp_form5_pts: float
    team_form5_gf: float
    team_form5_ga: float
    opp_form5_gf: float
    opp_form5_ga: float
    team_rest_days: float
    opp_rest_days: float
    h2h_balance: float


@app.post("/predict/madrid-win")
def predict_madrid_win(features: MadridMatchFeatures):
    bundle = load_model("madrid_win")
    d = features.model_dump()
    d["elo_diff_team"] = d["team_elo"] - d["opp_elo"] + d["is_home"] * 68
    d["exp_goals_team"] = (d["team_form5_gf"] + d["opp_form5_ga"]) / 2.0
    d["exp_goals_opp"] = (d["opp_form5_gf"] + d["team_form5_ga"]) / 2.0
    d["exp_goal_diff"] = d["exp_goals_team"] - d["exp_goals_opp"]
    d["form5_pts_diff"] = d["team_form5_pts"] - d["opp_form5_pts"]
    row = pd.DataFrame([d])[bundle["features"]]
    p = bundle["model"].predict_proba(row)[0][1]
    return {"madrid_win": round(float(p), 4)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8010)
