"""Alerte quotidienne : selection des produits, formulation, garde-fou du jour."""

from datetime import date, timedelta

from app.notifications import CLE_DERNIER_ENVOI, composer, executer, produits_urgents
from app.db import connexion

from conftest import COMPTE


def _resultat(**kwargs) -> dict:
    """L'alerte parcourt tous les comptes : ici, il n'y en a qu'un."""
    return executer(**kwargs)["comptes"][COMPTE]


def _marqueur(compte_id: int):
    with connexion() as db:
        return db.execute(
            "SELECT 1 FROM reglages WHERE utilisateur_id = ? AND cle = ?;",
            (compte_id, CLE_DERNIER_ENVOI),
        ).fetchone()

AUJOURDHUI = date(2026, 9, 6)


def _dlc(decalage: int) -> str:
    return (AUJOURDHUI + timedelta(days=decalage)).isoformat()


def test_selection_respecte_le_seuil(client, creer_lot, compte_id):
    creer_lot("Saumon", dlc=_dlc(0))
    creer_lot("Yaourt", dlc=_dlc(1))
    creer_lot("Carotte", dlc=_dlc(5))

    with connexion() as db:
        urgents = produits_urgents(db, compte_id, seuil=1, aujourdhui=AUJOURDHUI)

    assert [u["nom"] for u in urgents] == ["Saumon", "Yaourt"]


def test_selection_signale_les_perimes(client, creer_lot, compte_id):
    creer_lot("Steak", dlc=_dlc(-3))

    with connexion() as db:
        urgents = produits_urgents(db, compte_id, seuil=1, aujourdhui=AUJOURDHUI)

    assert urgents == [{"nom": "Steak", "unites": 1, "jours": -3}]


def test_selection_ignore_clotures_et_sans_dlc(client, creer_lot, compte_id):
    creer_lot("Sans date", dlc=None)
    lot = creer_lot("Consomme", dlc=_dlc(0))

    produits = client.get("/api/produits").json()
    identifiant = next(p["id"] for p in produits if p["lot_id"] == lot)
    client.post(f"/api/produits/{identifiant}/statut", json={"statut": "consomme"})

    with connexion() as db:
        assert produits_urgents(db, compte_id, seuil=1, aujourdhui=AUJOURDHUI) == []


def test_selection_regroupe_par_nom(client, creer_lot, compte_id):
    creer_lot("Yaourt", count=4, dlc=_dlc(1))
    creer_lot("Yaourt", count=2, dlc=_dlc(0))

    with connexion() as db:
        urgents = produits_urgents(db, compte_id, seuil=1, aujourdhui=AUJOURDHUI)

    # Un seul poste, six unites, et l'echeance retenue est la plus proche.
    assert urgents == [{"nom": "Yaourt", "unites": 6, "jours": 0}]


def test_formulation_produit_unique():
    assert composer([{"nom": "Saumon", "unites": 1, "jours": 0}])[0] == (
        "Saumon périme aujourd'hui"
    )
    assert composer([{"nom": "Saumon", "unites": 1, "jours": 1}])[0] == "Saumon périme demain"
    assert composer([{"nom": "Saumon", "unites": 1, "jours": -1}])[0] == "Saumon a périmé hier"
    assert composer([{"nom": "Saumon", "unites": 1, "jours": -4}])[0] == (
        "Saumon a périmé il y a 4 jours"
    )
    assert composer([{"nom": "Yaourt", "unites": 3, "jours": 1}])[0] == (
        "Yaourt ×3 périme demain"
    )


def test_formulation_plusieurs_produits_groupes_par_echeance():
    titre, corps = composer(
        [
            {"nom": "Steak", "unites": 1, "jours": -1},
            {"nom": "Saumon", "unites": 2, "jours": 0},
            {"nom": "Yaourt", "unites": 1, "jours": 1},
        ]
    )
    assert titre == "4 produits à consommer"
    assert corps == "Périmé : Steak · Aujourd'hui : Saumon ×2 · Demain : Yaourt"


def test_rien_a_signaler_quand_le_frigo_est_sain(client, creer_lot, push_simule):
    creer_lot("Carotte", dlc=(date.today() + timedelta(days=10)).isoformat())

    assert _resultat()["statut"] == "rien_a_signaler"
    assert push_simule.envois == []


def test_envoi_puis_garde_fou_du_jour(client, creer_lot, abonner, push_simule):
    abonner()
    creer_lot("Saumon", dlc=date.today().isoformat())

    premier = _resultat()
    assert premier["statut"] == "envoye"
    assert premier["envoyes"] == 1
    assert len(push_simule.envois) == 1

    # Deuxieme passage le meme jour : rien ne repart.
    assert _resultat()["statut"] == "deja_envoye"
    assert len(push_simule.envois) == 1

    # --force outrepasse le marqueur.
    assert _resultat(force=True)["statut"] == "envoye"
    assert len(push_simule.envois) == 2


def test_simulation_n_envoie_rien_et_ne_pose_pas_le_marqueur(
    client, creer_lot, abonner, push_simule, compte_id
):
    abonner()
    creer_lot("Saumon", dlc=date.today().isoformat())

    resultat = _resultat(simuler=True)
    assert resultat["statut"] == "simulation"
    assert resultat["titre"] == "Saumon périme aujourd'hui"
    assert push_simule.envois == []
    assert _marqueur(compte_id) is None


def test_marqueur_non_pose_si_aucun_envoi_n_aboutit(
    client, creer_lot, abonner, push_simule, compte_id
):
    """Sans abonne joignable, la journee doit rester a retenter."""
    endpoint = abonner()
    push_simule.refus[endpoint] = 500
    creer_lot("Saumon", dlc=date.today().isoformat())

    assert _resultat()["envoyes"] == 0
    assert _marqueur(compte_id) is None
