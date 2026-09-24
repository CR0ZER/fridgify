"""Extraction du JSON renvoye par Gemini.

Le modele enrobe sa reponse de facons variables ; cette fonction est le seul
rempart avant que les donnees n'entrent dans l'application.
"""

import pytest
from fastapi import HTTPException

from app.gemini import _extraire_json, _extraire_texte, message_http


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


def test_reponse_sans_texte_nomme_la_raison():
    data = {"candidates": [{"content": {"role": "model"}, "finishReason": "MAX_TOKENS"}]}
    with pytest.raises(HTTPException) as erreur:
        _extraire_texte(data)
    assert erreur.value.status_code == 502
    assert "MAX_TOKENS" in erreur.value.detail


@pytest.mark.parametrize("code, attendu", [(503, "surchargé"), (429, "trop de demandes"), (403, "clé API"), (418, "code 418")])
def test_erreur_http_traduite_sans_json_brut(code, attendu):
    message = message_http(code)
    assert attendu in message
    assert "{" not in message
