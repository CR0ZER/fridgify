"""Abonnements Web Push : enregistrement, purge des expires, envoi de test."""

from datetime import date, timedelta


def test_etat_expose_la_cle_publique(client):
    etat = client.get("/api/push/etat").json()
    assert etat["disponible"] is True
    assert etat["cle_publique"] == "cle-publique-de-test"
    assert etat["seuil_jours"] == 1
    assert etat["appareils"] == []


def test_health_signale_les_notifications(client):
    assert client.get("/api/health").json()["push_configure"] is True


def test_abonnement_puis_reabonnement_ne_duplique_pas(client):
    corps = {
        "endpoint": "https://push.example/abc",
        "keys": {"p256dh": "premiere", "auth": "auth1"},
    }
    assert client.post("/api/push/abonnements", json=corps).status_code == 201

    # Le navigateur renouvelle ses cles de son propre chef : meme endpoint,
    # nouvelles cles, un seul appareil au final.
    corps["keys"] = {"p256dh": "seconde", "auth": "auth2"}
    etat = client.post("/api/push/abonnements", json=corps).json()

    assert len(etat["appareils"]) == 1


def test_appareil_devine_depuis_le_user_agent(client):
    client.post(
        "/api/push/abonnements",
        json={"endpoint": "https://push.example/ios", "keys": {"p256dh": "a", "auth": "b"}},
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"},
    )
    etat = client.get("/api/push/etat").json()
    assert etat["appareils"][0]["appareil"] == "iPhone"


def test_desabonnement_est_idempotent(client, abonner):
    endpoint = abonner()

    assert client.request("DELETE", "/api/push/abonnements", json={"endpoint": endpoint}).status_code == 204
    assert client.get("/api/push/etat").json()["appareils"] == []

    # Rejouer la suppression ne doit pas echouer : le navigateur peut avoir
    # perdu son abonnement de son cote et redemander l'oubli.
    assert client.request("DELETE", "/api/push/abonnements", json={"endpoint": endpoint}).status_code == 204


def test_test_refuse_sans_abonne(client):
    reponse = client.post("/api/push/test")
    assert reponse.status_code == 409
    assert "Aucun appareil" in reponse.json()["detail"]


def test_test_envoie_le_contenu_reel(client, creer_lot, abonner, push_simule):
    abonner()
    creer_lot("Saumon", dlc=date.today().isoformat())

    resultat = client.post("/api/push/test").json()

    assert resultat == {"envoyes": 1, "supprimes": 0, "echecs": []}
    assert "Saumon périme aujourd'hui" in push_simule.envois[0]["data"]


def test_test_confirme_le_transport_quand_rien_ne_perime(client, creer_lot, abonner, push_simule):
    abonner()
    creer_lot("Carotte", dlc=(date.today() + timedelta(days=30)).isoformat())

    assert client.post("/api/push/test").json()["envoyes"] == 1
    assert "Fridgify est prêt" in push_simule.envois[0]["data"]


def test_abonnement_expire_est_supprime(client, abonner, push_simule):
    """410 Gone est la seule facon d'apprendre qu'une application a disparu."""
    vivant = abonner("https://push.example/vivant")
    mort = abonner("https://push.example/mort")
    push_simule.refus[mort] = 410

    resultat = client.post("/api/push/test").json()

    assert resultat["envoyes"] == 1
    assert resultat["supprimes"] == 1

    restants = [a["appareil"] for a in client.get("/api/push/etat").json()["appareils"]]
    assert len(restants) == 1
    assert push_simule.envois[0]["endpoint"] == vivant


def test_echec_transitoire_conserve_l_abonnement(client, abonner, push_simule):
    """Un 500 du service de push est passager : l'appareil reste abonne."""
    endpoint = abonner()
    push_simule.refus[endpoint] = 500

    resultat = client.post("/api/push/test").json()

    assert resultat["envoyes"] == 0
    assert resultat["supprimes"] == 0
    assert len(resultat["echecs"]) == 1
    assert len(client.get("/api/push/etat").json()["appareils"]) == 1
