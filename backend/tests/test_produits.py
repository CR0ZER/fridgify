"""Cycle de vie d'un produit : creation, ouverture, cloture, statistiques."""

from datetime import date, timedelta


def test_authentification_exigee(client):
    reponse = client.get("/api/produits", headers={"X-API-Key": "mauvaise"})
    assert reponse.status_code == 401


def test_health_reste_ouvert(client):
    reponse = client.get("/api/health", headers={"X-API-Key": "mauvaise"})
    assert reponse.status_code == 200


def test_lot_cree_autant_d_unites_que_demande(client, creer_lot):
    creer_lot("Yaourt", count=6)
    produits = client.get("/api/produits").json()
    assert len(produits) == 6
    assert len({p["lot_id"] for p in produits}) == 1


def test_les_unites_sans_dlc_passent_en_dernier(client, creer_lot):
    """NULL trie avant tout en SQLite : sans correctif, un produit sans date
    apparaitrait comme le plus urgent de l'inventaire."""
    creer_lot("Sans date", dlc=None)
    creer_lot("Urgent", dlc="2026-08-30")
    creer_lot("Lointain", dlc="2026-12-01")

    noms = [p["nom"] for p in client.get("/api/produits").json()]
    assert noms == ["Urgent", "Lointain", "Sans date"]


def test_ouvrir_rapproche_la_dlc(client, creer_lot):
    creer_lot("Crème", dlc="2026-12-01", duree_apres_ouverture=2)
    produit = client.get("/api/produits").json()[0]

    ouvert = client.post(f"/api/produits/{produit['id']}/ouvrir").json()
    attendu = (date.today() + timedelta(days=2)).isoformat()

    assert ouvert["est_ouvert"] == 1
    assert ouvert["date_peremption_effective"] == attendu


def test_cloture_puis_annulation(client, creer_lot):
    creer_lot("Jambon")
    produit = client.get("/api/produits").json()[0]

    client.post(f"/api/produits/{produit['id']}/statut", json={"statut": "consomme"})
    assert client.get("/api/produits").json() == []
    assert client.get("/api/stats").json()["totalConsomme"] == 1

    client.delete(f"/api/produits/{produit['id']}/statut")
    assert len(client.get("/api/produits").json()) == 1
    assert client.get("/api/stats").json()["totalConsomme"] == 0


def test_statistiques(client, creer_lot):
    creer_lot("Salade", count=3)
    ids = [p["id"] for p in client.get("/api/produits").json()]
    client.post(f"/api/produits/{ids[0]}/statut", json={"statut": "consomme"})
    client.post(f"/api/produits/{ids[1]}/statut", json={"statut": "jete"})

    stats = client.get("/api/stats").json()
    assert stats["totalConsomme"] == 1
    assert stats["totalJete"] == 1
    assert stats["topJete"] == [{"nom": "Salade", "count": 1}]
    assert len(stats["recents"]) == 2


def test_modifier_un_lot_touche_toutes_ses_unites(client, creer_lot):
    lot = creer_lot("Tomate", count=3)
    client.patch(f"/api/lots/{lot}", json={"nom": "Tomates cerises"})
    assert {p["nom"] for p in client.get("/api/produits").json()} == {"Tomates cerises"}


def test_champ_non_modifiable_ignore(client, creer_lot):
    """Un PATCH ne doit pouvoir toucher que la liste blanche de champs."""
    creer_lot("Beurre")
    produit = client.get("/api/produits").json()[0]

    client.patch(f"/api/produits/{produit['id']}", json={"nom": "Beurre doux", "lot_id": "pirate"})
    apres = client.get("/api/produits").json()[0]

    assert apres["nom"] == "Beurre doux"
    assert apres["lot_id"] == produit["lot_id"]


def test_produit_inexistant(client):
    assert client.delete("/api/produits/9999").status_code == 404
    assert client.post("/api/produits/9999/ouvrir").status_code == 404
