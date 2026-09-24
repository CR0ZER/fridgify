"""Comptes, sessions, cloisonnement des frigos.

C'est la partie ou une erreur ne casse rien de visible mais laisse un compte
lire le frigo d'un autre : elle merite d'etre couverte cas par cas.
"""

import pytest
from fastapi.testclient import TestClient

from app import auth, comptes
from app.db import connexion
from app.main import app

from conftest import CLE_TEST, COMPTE, MOT_DE_PASSE


@pytest.fixture()
def anonyme():
    """Client porteur de la cle API, mais sans session ouverte."""
    with TestClient(app) as c:
        c.headers["X-API-Key"] = CLE_TEST
        yield c


# ---- Mots de passe -------------------------------------------------------


def test_le_mot_de_passe_n_est_jamais_stocke_en_clair(client):
    with connexion() as db:
        stocke = db.execute(
            "SELECT mot_de_passe FROM utilisateurs WHERE identifiant = ?;", (COMPTE,)
        ).fetchone()[0]

    assert MOT_DE_PASSE not in stocke
    assert stocke.startswith("scrypt$")
    assert comptes.verifier(MOT_DE_PASSE, stocke)
    assert not comptes.verifier("autre chose", stocke)


def test_deux_comptes_memes_mots_de_passe_donnent_des_condenses_differents():
    """Chaque compte a son sel : deux condenses identiques trahiraient sinon
    que deux personnes ont choisi le meme mot de passe."""
    assert comptes.hacher("motdepasse") != comptes.hacher("motdepasse")


# ---- Connexion -----------------------------------------------------------


def test_inscription_puis_connexion(anonyme):
    assert anonyme.post(
        "/api/auth/inscription", json={"identifiant": "camille", "mot_de_passe": "motdepasse"}
    ).status_code == 201

    anonyme.post("/api/auth/deconnexion")
    reponse = anonyme.post(
        "/api/auth/connexion", json={"identifiant": "camille", "mot_de_passe": "motdepasse"}
    )
    assert reponse.status_code == 200
    assert reponse.json()["identifiant"] == "camille"


def test_identifiant_insensible_a_la_casse(anonyme):
    anonyme.post(
        "/api/auth/inscription", json={"identifiant": "Camille", "mot_de_passe": "motdepasse"}
    )
    assert anonyme.post(
        "/api/auth/inscription", json={"identifiant": "camille", "mot_de_passe": "motdepasse"}
    ).status_code == 409


def test_mot_de_passe_trop_court_refuse(anonyme):
    reponse = anonyme.post(
        "/api/auth/inscription", json={"identifiant": "camille", "mot_de_passe": "court"}
    )
    assert reponse.status_code == 409
    assert "6 caractères" in reponse.json()["detail"]


def test_mauvais_mot_de_passe_puis_blocage(client, anonyme):
    for essai in range(auth.ESSAIS_MAX):
        reponse = anonyme.post(
            "/api/auth/connexion", json={"identifiant": COMPTE, "mot_de_passe": "faux"}
        )
        assert reponse.status_code == 401, essai

    # Au-dela, meme le bon mot de passe attend la fin du blocage : sans cela,
    # la limitation ne freinerait pas une attaque automatique.
    bloque = anonyme.post(
        "/api/auth/connexion", json={"identifiant": COMPTE, "mot_de_passe": MOT_DE_PASSE}
    )
    assert bloque.status_code == 429


def test_session_requise_pour_toucher_au_frigo(anonyme):
    assert anonyme.get("/api/produits").status_code == 401
    assert anonyme.get("/api/plats").status_code == 401
    assert anonyme.post("/api/lots", json={"unite": {"nom": "Tomate"}, "count": 1}).status_code == 401


def test_deconnexion_ferme_la_session(client):
    assert client.get("/api/produits").status_code == 200
    assert client.post("/api/auth/deconnexion").status_code == 204
    assert client.get("/api/produits").status_code == 401


def test_changer_de_mot_de_passe_ferme_les_sessions(client):
    with connexion() as db:
        comptes.changer_mot_de_passe(db, COMPTE, "nouveaumotdepasse")

    assert client.get("/api/produits").status_code == 401


# ---- Cloisonnement -------------------------------------------------------


def test_chaque_compte_ne_voit_que_son_frigo(client, voisin, creer_lot):
    creer_lot("Saumon", count=2)
    voisin.post(
        "/api/lots",
        json={"unite": {"nom": "Tofu", "categorie": "Autre"}, "count": 1},
    )

    assert [p["nom"] for p in client.get("/api/produits").json()] == ["Saumon", "Saumon"]
    assert [p["nom"] for p in voisin.get("/api/produits").json()] == ["Tofu"]


def test_un_compte_ne_peut_pas_toucher_l_unite_d_un_autre(client, voisin, creer_lot):
    creer_lot("Saumon")
    unite = client.get("/api/produits").json()[0]["id"]

    # Vu du voisin, cette unite n'existe pas : 404 plutot que 403, qui
    # confirmerait au passage qu'elle existe ailleurs.
    assert voisin.get(f"/api/lots/{client.get('/api/produits').json()[0]['lot_id']}").status_code == 404
    assert voisin.post(f"/api/produits/{unite}/statut", json={"statut": "jete"}).status_code == 404
    assert voisin.delete(f"/api/produits/{unite}").status_code == 404
    assert voisin.post(f"/api/produits/{unite}/ouvrir").status_code == 404

    assert client.get("/api/produits").json()[0]["statut_fin"] is None


def test_un_plat_ne_peut_pas_reserver_le_lot_d_un_autre(client, voisin, creer_lot):
    lot = creer_lot("Saumon", count=3)

    reponse = voisin.post(
        "/api/plats", json={"nom": "Vol", "ingredients": [{"lot_id": lot, "quantite": 1}]}
    )
    assert reponse.status_code == 400
    assert voisin.get("/api/disponibilites").json() == []


def test_vider_le_frigo_ne_vide_que_le_sien(client, voisin, creer_lot):
    creer_lot("Saumon")
    voisin.post("/api/lots", json={"unite": {"nom": "Tofu"}, "count": 1})

    assert client.delete("/api/produits").status_code == 204

    assert client.get("/api/produits").json() == []
    assert len(voisin.get("/api/produits").json()) == 1


def test_statistiques_et_courses_restent_separees(client, voisin, creer_lot):
    creer_lot("Saumon")
    unite = client.get("/api/produits").json()[0]["id"]
    client.post(f"/api/produits/{unite}/statut", json={"statut": "jete"})
    client.post("/api/courses", json={"nom": "Gnocchis"})

    assert voisin.get("/api/stats").json()["totalJete"] == 0
    assert voisin.get("/api/courses").json() == []


def test_supprimer_un_compte_emporte_son_frigo(client, voisin, creer_lot):
    creer_lot("Saumon", count=2)
    voisin.post("/api/lots", json={"unite": {"nom": "Tofu"}, "count": 1})

    with connexion() as db:
        identifiant = db.execute(
            "SELECT id FROM utilisateurs WHERE identifiant = ?;", (COMPTE,)
        ).fetchone()["id"]
        comptes.supprimer_utilisateur(db, identifiant)
        restants = db.execute("SELECT nom FROM inventaire_frigo;").fetchall()

    assert [ligne["nom"] for ligne in restants] == ["Tofu"]


# ---- Jeton de service (machine) -----------------------------------


def test_jeton_de_service_agit_sur_le_frigo_de_son_compte(client, anonyme, creer_lot, compte_id):
    creer_lot("Saumon")
    with connexion() as db:
        jeton = comptes.creer_jeton_service(db, compte_id, "Tableau de bord")

    anonyme.headers["X-Service-Token"] = jeton

    assert [p["nom"] for p in anonyme.get("/api/produits").json()] == ["Saumon"]

    # Lecture *et* ecriture : un ecran d'affichage marque aussi les produits sortis.
    unite = anonyme.get("/api/produits").json()[0]["id"]
    assert anonyme.post(f"/api/produits/{unite}/statut", json={"statut": "consomme"}).status_code == 200
    assert client.get("/api/produits").json() == []


def test_jeton_revoque_refuse(anonyme, compte_id):
    with connexion() as db:
        jeton = comptes.creer_jeton_service(db, compte_id, "Écran cuisine")
        garde = comptes.creer_jeton_service(db, compte_id, "Script")
        assert comptes.revoquer_jetons(db, compte_id, "écran CUISINE") == 1

    anonyme.headers["X-Service-Token"] = jeton
    assert anonyme.get("/api/produits").status_code == 401
    anonyme.headers["X-Service-Token"] = garde
    assert anonyme.get("/api/produits").status_code == 200


def test_jeton_de_service_invalide_refuse(anonyme):
    anonyme.headers["X-Service-Token"] = "jeton-invente"
    assert anonyme.get("/api/produits").status_code == 401


# ---- Quota de scan -------------------------------------------------------


def test_quota_de_scan_par_compte(client, voisin, compte_id):
    with connexion() as db:
        for _ in range(comptes.SCANS_PAR_JOUR):
            comptes.compter_scan(db, compte_id)

    # Le quota est epuise pour ce compte : le scan est refuse avant d'appeler
    # Gemini, donc sans consommer le quota partage du serveur.
    reponse = client.post(
        "/api/llm/scan", files={"image": ("t.jpg", b"contenu", "image/jpeg")}
    )
    assert reponse.status_code == 429
    assert str(comptes.SCANS_PAR_JOUR) in reponse.json()["detail"]

    # Celui de la voisine est intact : elle bute sur la cle Gemini absente en
    # test, pas sur la limite.
    assert voisin.post(
        "/api/llm/scan", files={"image": ("t.jpg", b"contenu", "image/jpeg")}
    ).status_code != 429


def test_scan_rendu_quand_gemini_est_en_panne(client, compte_id):
    # En test, la cle Gemini est absente : rien n'est analyse, rien n'est du.
    reponse = client.post("/api/llm/scan", files={"image": ("t.jpg", b"contenu", "image/jpeg")})
    assert reponse.status_code == 503
    assert "pas été décompté" in reponse.json()["detail"]
    with connexion() as db:
        assert comptes.scans_restants(db, compte_id) == comptes.SCANS_PAR_JOUR
