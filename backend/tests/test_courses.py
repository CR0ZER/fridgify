"""Liste de courses : des envies de plats, a acheter puis achetees."""

from datetime import date

from app.db import connexion, init_db


def _envie(client, nom, note=None):
    return client.post("/api/courses", json={"nom": nom, "note": note})


def test_creation_nettoie_et_date(client):
    reponse = _envie(client, "  Burgers maison ", note="  cheddar, bacon  ")
    assert reponse.status_code == 201

    envie = reponse.json()
    assert (envie["nom"], envie["note"], envie["statut"]) == ("Burgers maison", "cheddar, bacon", "a_acheter")
    assert envie["date_creation"] == date.today().isoformat()
    assert envie["date_achat"] is None


def test_note_blanche_devient_nulle(client):
    assert _envie(client, "Gnocchis", note="   ").json()["note"] is None


def test_nom_vide_refuse(client):
    assert _envie(client, "").status_code == 422
    assert _envie(client, "   ").status_code == 400


def test_achat_puis_annulation(client):
    envie = _envie(client, "Gnocchis").json()

    achetee = client.post(f"/api/courses/{envie['id']}/achat").json()
    assert achetee["statut"] == "achete"
    assert achetee["date_achat"] == date.today().isoformat()
    assert client.post(f"/api/courses/{envie['id']}/achat").status_code == 409

    remise = client.delete(f"/api/courses/{envie['id']}/achat").json()
    assert (remise["statut"], remise["date_achat"]) == ("a_acheter", None)


def test_achat_ne_touche_pas_au_frigo(client):
    """Aucun transfert : une envie achetee ne cree ni produit ni plat."""
    envie = _envie(client, "Gnocchis").json()
    client.post(f"/api/courses/{envie['id']}/achat")

    assert client.get("/api/produits").json() == []
    assert client.get("/api/plats").json() == []


def test_ordre_a_acheter_puis_achetes(client):
    premiere = _envie(client, "Première").json()
    _envie(client, "Deuxième")
    _envie(client, "Troisième")
    client.post(f"/api/courses/{premiere['id']}/achat")

    assert [c["nom"] for c in client.get("/api/courses").json()] == ["Deuxième", "Troisième", "Première"]


def test_modification(client):
    envie = _envie(client, "Pâtes", note="pesto").json()

    modifiee = client.patch(f"/api/courses/{envie['id']}", json={"nom": "Pâtes carbo", "note": ""}).json()
    assert (modifiee["nom"], modifiee["note"]) == ("Pâtes carbo", None)

    assert client.patch(f"/api/courses/{envie['id']}", json={"nom": "  "}).status_code == 400
    assert client.patch("/api/courses/9999", json={"nom": "X"}).status_code == 404


def test_suppression(client):
    envie = _envie(client, "Pâtes").json()
    assert client.delete(f"/api/courses/{envie['id']}").status_code == 204
    assert client.delete(f"/api/courses/{envie['id']}").status_code == 404
    assert client.get("/api/courses").json() == []


def test_vider_les_achetes_garde_le_reste(client):
    achetee = _envie(client, "Achetée").json()
    _envie(client, "À acheter")
    client.post(f"/api/courses/{achetee['id']}/achat")

    assert client.delete("/api/courses/achetes").status_code == 204
    assert [c["nom"] for c in client.get("/api/courses").json()] == ["À acheter"]


def test_ancien_prompt_de_recettes_purge_au_demarrage(client):
    client.put("/api/settings/prompt_recipes", json={"value": "vieux prompt"})
    init_db()

    with connexion() as conn:
        assert conn.execute("SELECT 1 FROM settings WHERE key = 'prompt_recipes';").fetchone() is None
