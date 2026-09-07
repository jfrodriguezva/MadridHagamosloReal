"""
Tests del predictor Poisson en compare_baseline_predictor.py -- el punto de
comparación que usa el propio proyecto para decidir si el ensemble vale la
pena. Si esta matemática se rompe silenciosamente, la comparación deja de
ser confiable sin que nada lo avise.
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "train"))

from compare_baseline_predictor import predict_match, HOME_ADVANTAGE  # noqa: E402


def test_probabilities_sum_to_one():
    ph, pd_, pa = predict_match(1.5, 1.0, 1.2, 1.1)
    assert math.isclose(ph + pd_ + pa, 1.0, rel_tol=1e-9)


def test_home_advantage_favors_home_with_symmetric_inputs():
    # Mismos números para ambos equipos -- sin ventaja de local, sería 50/50 modulo empate.
    # Con HOME_ADVANTAGE > 1 aplicado al lambda del local, el local debe salir favorito.
    ph, pd_, pa = predict_match(1.3, 1.1, 1.3, 1.1)
    assert ph > pa


def test_no_home_advantage_flag_removes_the_bias():
    ph_with_adv, _, pa_with_adv = predict_match(1.3, 1.1, 1.3, 1.1, home_advantage=True)
    ph_no_adv, _, pa_no_adv = predict_match(1.3, 1.1, 1.3, 1.1, home_advantage=False)
    assert ph_with_adv > ph_no_adv
    assert math.isclose(ph_no_adv, pa_no_adv, rel_tol=1e-6)


def test_stronger_attack_and_weaker_defense_increase_win_probability():
    # Equipo A ataca mucho y defiende mal, equipo B al revés -- A visitante debería
    # tener más probabilidad de ganar que un visitante mediocre "normal".
    ph_strong_away, _, pa_strong_away = predict_match(1.0, 1.0, 3.0, 0.5)
    ph_weak_away, _, pa_weak_away = predict_match(1.0, 1.0, 1.0, 1.0)
    assert pa_strong_away > pa_weak_away


def test_home_advantage_constant_is_greater_than_one():
    # Si esto alguna vez se pone en <= 1, la ventaja de local desaparece o se invierte
    # sin que ningún test lo note -- por eso se protege el valor directamente.
    assert HOME_ADVANTAGE > 1.0
