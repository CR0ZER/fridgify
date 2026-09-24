"""Abonnements Web Push : enregistrement, envoi, purge des expires."""

from app import push
from app.db import connexion


def envoyer(compte_id):
    with connexion() as db:
        return push.envoyer_a_tous(db, compte_id, "Titre", "Corps")


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


def test_abonnement_expire_est_supprime(client, abonner, push_simule, compte_id):
    """410 Gone est la seule facon d'apprendre qu'une application a disparu."""
    vivant = abonner("https://push.example/vivant")
    mort = abonner("https://push.example/mort")
    push_simule.refus[mort] = 410

    resultat = envoyer(compte_id)

    assert resultat["envoyes"] == 1
    assert resultat["supprimes"] == 1
    assert len(client.get("/api/push/etat").json()["appareils"]) == 1
    assert push_simule.envois[0]["endpoint"] == vivant


def test_echec_transitoire_conserve_l_abonnement(client, abonner, push_simule, compte_id):
    """Un 500 du service de push est passager : l'appareil reste abonne."""
    endpoint = abonner()
    push_simule.refus[endpoint] = 500

    resultat = envoyer(compte_id)

    assert resultat["envoyes"] == 0
    assert resultat["supprimes"] == 0
    assert len(resultat["echecs"]) == 1
    assert len(client.get("/api/push/etat").json()["appareils"]) == 1


def test_refus_403_explique_la_cause(abonner, push_simule, compte_id):
    """« 403 » seul n'aide personne : le message doit dire ou chercher."""
    endpoint = abonner()
    push_simule.refus[endpoint] = 403

    resultat = envoyer(compte_id)

    assert resultat["envoyes"] == 0
    assert "VAPID_SUBJECT" in resultat["echecs"][0]
