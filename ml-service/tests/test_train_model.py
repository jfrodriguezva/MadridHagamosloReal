"""
Tests de las piezas más frágiles de train_model.py: el orden de clases usado
para 1X2 (ya causó un bug real -- ver comentario en el propio archivo sobre
LabelEncoder invirtiendo home/away) y el cálculo de RPS. No corren el
entrenamiento completo (necesita SQL Server con datos reales) -- solo la
matemática y las constantes que, si cambian sin querer, invalidan todo el
walk-forward sin que se note hasta ver números raros en producción.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "train"))

from train_model import rps_3class, RESULT_TO_IDX, TEST_SEASONS  # noqa: E402


def test_result_to_idx_matches_fixed_order_not_alphabetical():
    # A(way)/D(raw)/H(ome) es el orden alfabético que un LabelEncoder produciría
    # y que ya causó el bug de home/away invertidos -- este mapeo debe seguir
    # siendo explícito H=0, D=1, A=2 para siempre.
    assert RESULT_TO_IDX == {"H": 0, "D": 1, "A": 2}


def test_test_seasons_is_chronological_with_no_duplicates():
    # El walk-forward asume "solo entrenar con temporadas anteriores" -- una lista
    # desordenada o con duplicados no rompe el código hoy, pero rompe la semántica
    # de "nunca mezclar el orden temporal" que el propio docstring promete.
    assert TEST_SEASONS == sorted(set(TEST_SEASONS))


def test_rps_is_zero_for_a_perfect_prediction():
    probs = np.array([[1.0, 0.0, 0.0]])
    actual_idx = np.array([0])
    assert rps_3class(probs, actual_idx) == 0.0


def test_rps_is_worse_for_a_confident_wrong_prediction_than_a_close_call():
    actual_idx = np.array([0])  # home ganó
    confident_wrong = rps_3class(np.array([[0.0, 0.0, 1.0]]), actual_idx)  # dijo "away" seguro
    close_call = rps_3class(np.array([[0.4, 0.3, 0.3]]), actual_idx)  # dudó, pero favoreció home
    assert confident_wrong > close_call
