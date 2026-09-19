"""La liste fermee des categories et le rattachement des variantes."""

import pytest

from app.categories import CATEGORIES, NOMS, categorie, normaliser


@pytest.mark.parametrize(
    ("saisie", "attendu"),
    [
        ("Légume", "Légume"),
        ("Légumes", "Légume"),  # le pluriel que Gemini renvoie regulierement
        ("legumes", "Légume"),  # sans accent
        ("LAITAGE", "Laitage"),
        ("laitages", "Laitage"),
        ("Plat preparé", "Plat préparé"),
        ("  Viande  ", "Viande"),
        ("Épicerie", "Autre"),  # hors liste
        ("", "Autre"),
        (None, "Autre"),
    ],
)
def test_normalisation(saisie, attendu):
    assert normaliser(saisie) == attendu


def test_toute_categorie_est_son_propre_point_fixe():
    """Normaliser une categorie canonique ne doit jamais la deplacer."""
    for nom in NOMS:
        assert normaliser(nom) == nom


def test_durees_coherentes():
    """Un produit ouvert ne peut pas se conserver plus longtemps que ferme."""
    for c in CATEGORIES:
        assert c.conservation_jours > 0
        assert c.apres_ouverture_jours > 0
        assert c.apres_ouverture_jours <= c.conservation_jours


def test_categorie_inconnue_retombe_sur_le_defaut():
    assert categorie("n'importe quoi").nom == "Autre"


def test_endpoint_expose_la_liste(client):
    reponse = client.get("/api/categories")
    assert reponse.status_code == 200
    noms = [c["nom"] for c in reponse.json()]
    assert noms == list(NOMS)
    assert all(c["conservation_jours"] > 0 for c in reponse.json())


def test_categorie_libre_est_fermee_a_l_ecriture(client, creer_lot):
    """Une categorie hors liste ne doit pas atteindre l'inventaire telle quelle."""
    creer_lot("Courgettes", categorie="Légumes")
    creer_lot("Riz", categorie="Épicerie sèche")

    categories = {p["categorie"] for p in client.get("/api/produits").json()}
    assert categories == {"Légume", "Autre"}


def test_le_prompt_de_scan_annonce_la_meme_liste():
    """Le prompt et le modele ne doivent pas pouvoir diverger."""
    from app.prompts import DEFAULT_SCAN_PROMPT

    for nom in NOMS:
        assert nom in DEFAULT_SCAN_PROMPT
