"""Extraction du JSON renvoye par Gemini.

Le modele enrobe sa reponse de facons variables ; cette fonction est le seul
rempart avant que les donnees n'entrent dans l'application.
"""

import pytest
from fastapi import HTTPException

from app.gemini import _extraire_json


def test_json_nu():
    assert _extraire_json('[{"nom": "Lait"}]') == [{"nom": "Lait"}]


def test_balises_markdown():
    assert _extraire_json('```json\n[{"nom": "Lait"}]\n```') == [{"nom": "Lait"}]


def test_balises_sans_langage():
    assert _extraire_json('```\n[{"nom": "Lait"}]\n```') == [{"nom": "Lait"}]


def test_bavardage_autour_du_tableau():
    texte = 'Voici les produits :\n[{"nom": "Lait"}]\nBonne journée !'
    assert _extraire_json(texte) == [{"nom": "Lait"}]


def test_reponse_illisible():
    with pytest.raises(HTTPException) as erreur:
        _extraire_json("je ne peux pas répondre à cette demande")
    assert erreur.value.status_code == 502
