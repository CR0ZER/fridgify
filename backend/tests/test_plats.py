"""Reservation d'ingredients et preparation d'un plat.

C'est la partie du backend ou une erreur fait disparaitre des produits sans
laisser de trace : elle merite la couverture la plus serree.
"""

from datetime import date, timedelta


def _plat(client, nom, ingredients, note=None):
    return client.post("/api/plats", json={"nom": nom, "note": note, "ingredients": ingredients})


def test_reservation_decompte_le_disponible(client, creer_lot):
    lot = creer_lot("Tomates", count=5)
    assert _plat(client, "Salade", [{"lot_id": lot, "quantite": 2}]).status_code == 201

    dispo = client.get("/api/disponibilites").json()[0]
    assert (dispo["stock"], dispo["reserve"], dispo["disponible"]) == (5, 2, 3)


def test_reservation_ne_consomme_rien(client, creer_lot):
    """Un plat prevu n'est qu'une intention : le frigo ne bouge pas."""
    lot = creer_lot("Tomates", count=5)
    _plat(client, "Salade", [{"lot_id": lot, "quantite": 2}])

    assert len(client.get("/api/produits").json()) == 5
    assert client.get("/api/stats").json()["totalConsomme"] == 0


def test_sur_reservation_refusee(client, creer_lot):
    lot = creer_lot("Tomates", count=3)
    _plat(client, "Premier", [{"lot_id": lot, "quantite": 2}])

    reponse = _plat(client, "Second", [{"lot_id": lot, "quantite": 2}])
    assert reponse.status_code == 409
    assert "seulement 1 disponible" in reponse.json()["detail"]


def test_lot_en_double_refuse(client, creer_lot):
    lot = creer_lot("Tomates", count=5)
    reponse = _plat(client, "Doublon", [{"lot_id": lot, "quantite": 1}, {"lot_id": lot, "quantite": 1}])
    assert reponse.status_code == 400


def test_quantite_decimale_refusee(client, creer_lot):
    """L'unite est indivisible depuis l'abandon des demi-portions."""
    lot = creer_lot("Tomates", count=5)
    assert _plat(client, "Demi", [{"lot_id": lot, "quantite": 1.5}]).status_code == 422
    assert _plat(client, "Zero", [{"lot_id": lot, "quantite": 0}]).status_code == 422


def test_lot_inconnu_refuse(client):
    assert _plat(client, "Fantôme", [{"lot_id": "inexistant", "quantite": 1}]).status_code == 400


def test_date_limite_suit_l_ingredient_le_plus_presse(client, creer_lot):
    tomates = creer_lot("Tomates", dlc="2026-09-20")
    creme = creer_lot("Crème", dlc="2026-09-02")

    plat = _plat(
        client,
        "Sauce",
        [{"lot_id": tomates, "quantite": 1}, {"lot_id": creme, "quantite": 1}],
    ).json()

    assert plat["date_limite"] == "2026-09-02"


def test_modifier_un_plat_ne_se_bloque_pas_sur_sa_propre_reservation(client, creer_lot):
    """Le plat doit pouvoir augmenter sa part : ses propres unites ne comptent
    pas comme un obstacle a lui-meme."""
    lot = creer_lot("Tomates", count=4)
    plat = _plat(client, "Salade", [{"lot_id": lot, "quantite": 2}]).json()

    reponse = client.patch(
        f"/api/plats/{plat['id']}", json={"ingredients": [{"lot_id": lot, "quantite": 4}]}
    )
    assert reponse.status_code == 200
    assert client.get("/api/disponibilites").json()[0]["disponible"] == 0


def test_supprimer_un_plat_libere_la_reservation(client, creer_lot):
    lot = creer_lot("Tomates", count=3)
    plat = _plat(client, "Salade", [{"lot_id": lot, "quantite": 3}]).json()
    assert client.get("/api/disponibilites").json()[0]["disponible"] == 0

    assert client.delete(f"/api/plats/{plat['id']}").status_code == 204
    assert client.get("/api/disponibilites").json()[0]["disponible"] == 3
    assert len(client.get("/api/produits").json()) == 3  # rien n'a ete consomme


def test_preparation_consomme_les_unites_les_plus_urgentes(client, creer_lot):
    """Cuisiner doit ecouler ce qui allait perimer en premier.

    L'ordre se verifie *a l'interieur* d'un lot : avec un lot par ingredient, la
    preparation les consommerait tous quel que soit le tri, et le test ne
    prouverait rien.
    """
    lot = creer_lot("Tomates", count=3, dlc="2026-12-01")
    unites = client.get("/api/produits").json()

    # On rend une seule unite urgente, au milieu du lot.
    urgente = unites[1]["id"]
    client.patch(f"/api/produits/{urgente}", json={"date_peremption_effective": "2026-08-30"})

    plat = _plat(client, "Salade", [{"lot_id": lot, "quantite": 1}]).json()
    client.post(f"/api/plats/{plat['id']}/preparer", json={"portions": 1})

    restantes = {p["id"] for p in client.get("/api/produits").json() if p["nom"] == "Tomates"}
    assert urgente not in restantes, "l'unite la plus urgente aurait du partir la premiere"
    assert len(restantes) == 2


def test_preparation_partielle_laisse_le_reste_intact(client, creer_lot):
    lot = creer_lot("Tomates", count=5)
    plat = _plat(client, "Salade", [{"lot_id": lot, "quantite": 2}]).json()
    client.post(f"/api/plats/{plat['id']}/preparer", json={"portions": 3})

    produits = client.get("/api/produits").json()
    tomates = [p for p in produits if p["nom"] == "Tomates"]
    portions = [p for p in produits if p["nom"] == "Salade"]

    assert len(tomates) == 3
    assert len(portions) == 3
    assert all(p["est_un_reste"] == 1 for p in portions)
    assert all(p["categorie"] == "Plat préparé" for p in portions)
    assert client.get("/api/stats").json()["totalConsomme"] == 2


def test_preparation_datee_par_defaut(client, creer_lot):
    lot = creer_lot("Tomates", count=2)
    plat = _plat(client, "Salade", [{"lot_id": lot, "quantite": 1}]).json()
    client.post(f"/api/plats/{plat['id']}/preparer", json={"portions": 1, "duree_apres_ouverture": 4})

    portion = [p for p in client.get("/api/produits").json() if p["nom"] == "Salade"][0]
    assert portion["date_peremption_effective"] == (date.today() + timedelta(days=4)).isoformat()


def test_preparer_deux_fois_refuse(client, creer_lot):
    lot = creer_lot("Tomates", count=2)
    plat = _plat(client, "Salade", [{"lot_id": lot, "quantite": 1}]).json()
    client.post(f"/api/plats/{plat['id']}/preparer", json={"portions": 1})

    assert client.post(f"/api/plats/{plat['id']}/preparer", json={"portions": 1}).status_code == 409
    assert client.patch(f"/api/plats/{plat['id']}", json={"nom": "Autre"}).status_code == 409


def test_plat_sans_ingredient_ne_se_prepare_pas(client):
    plat = _plat(client, "Vide", []).json()
    assert client.post(f"/api/plats/{plat['id']}/preparer", json={"portions": 1}).status_code == 400


def test_ingredient_jete_signale_puis_prepare_ce_qui_reste(client, creer_lot):
    """Le stock peut fondre apres la reservation : le plat le signale, et la
    preparation consomme ce qui existe au lieu d'echouer."""
    lot = creer_lot("Tomates", count=3)
    plat = _plat(client, "Salade", [{"lot_id": lot, "quantite": 3}]).json()

    victime = client.get("/api/produits").json()[0]["id"]
    client.post(f"/api/produits/{victime}/statut", json={"statut": "jete"})

    relu = client.get(f"/api/plats/{plat['id']}").json()
    assert relu["ingredients"][0]["insuffisant"] is True
    assert relu["ingredients"][0]["stock"] == 2

    assert client.post(f"/api/plats/{plat['id']}/preparer", json={"portions": 1}).status_code == 200
    assert [p["nom"] for p in client.get("/api/produits").json()] == ["Salade"]


def test_plats_tries_du_plus_urgent_au_moins_urgent(client, creer_lot):
    tard = creer_lot("Tard", dlc="2026-12-01")
    tot = creer_lot("Tôt", dlc="2026-08-30")

    _plat(client, "Plat lointain", [{"lot_id": tard, "quantite": 1}])
    _plat(client, "Plat urgent", [{"lot_id": tot, "quantite": 1}])

    assert [p["nom"] for p in client.get("/api/plats").json()] == ["Plat urgent", "Plat lointain"]
