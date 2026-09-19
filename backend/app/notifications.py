"""Alerte quotidienne de peremption.

Lance par le minuteur systemd `fridgify-notifications.timer`, une fois par jour.
C'est la piece qui manquait pour que l'application previenne au lieu d'attendre
qu'on pense a l'ouvrir.

    .venv/bin/python -m app.notifications            # envoi reel
    .venv/bin/python -m app.notifications --simuler  # affiche sans envoyer
    .venv/bin/python -m app.notifications --force    # ignore le garde-fou du jour
"""

import argparse
import logging
import sqlite3
from datetime import date, timedelta

from .config import get_settings
from .db import connexion, init_db
from .push import configure, envoyer_a_tous

logger = logging.getLogger(__name__)

#: Marqueur du dernier envoi, dans la table settings. Le minuteur systemd est
#: `Persistent=true` : apres une Raspberry restee eteinte, il rattrape l'horaire
#: manque des l'allumage. Sans ce garde-fou, un redemarrage le meme jour
#: renotifierait.
CLE_DERNIER_ENVOI = "derniere_notification_peremption"


def _lire_marqueur(db: sqlite3.Connection) -> str | None:
    """Lecture directe plutot que via le router des reglages : ce module doit
    rester utilisable en ligne de commande, sans dependre d'une couche HTTP."""
    ligne = db.execute(
        "SELECT value FROM settings WHERE key = ?;", (CLE_DERNIER_ENVOI,)
    ).fetchone()
    return ligne["value"] if ligne else None


def _poser_marqueur(db: sqlite3.Connection, jour: date) -> None:
    db.execute(
        """
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """,
        (CLE_DERNIER_ENVOI, jour.isoformat()),
    )


def _jours(dlc: str, aujourdhui: date) -> int:
    annee, mois, jour = (int(p) for p in dlc.split("-"))
    return (date(annee, mois, jour) - aujourdhui).days


def produits_urgents(db: sqlite3.Connection, seuil: int, aujourdhui: date) -> list[dict]:
    """Lots actifs dont la DLC tombe dans les `seuil` prochains jours, ou est passee.

    Regroupe par nom plutot que par lot : deux barquettes de saumon achetees
    separement se disent « Saumon ×2 », pas deux fois « Saumon ».
    """
    limite = (aujourdhui + timedelta(days=seuil)).isoformat()

    lignes = db.execute(
        """
        SELECT nom,
               COUNT(*) AS unites,
               MIN(date_peremption_effective) AS dlc
        FROM inventaire_frigo
        WHERE statut_fin IS NULL
          AND date_peremption_effective IS NOT NULL
          AND date_peremption_effective <= ?
        GROUP BY nom
        ORDER BY dlc ASC, nom ASC;
        """,
        (limite,),
    ).fetchall()

    return [
        {"nom": l["nom"], "unites": l["unites"], "jours": _jours(l["dlc"], aujourdhui)}
        for l in lignes
    ]


def _etiquette(produit: dict) -> str:
    return f"{produit['nom']} ×{produit['unites']}" if produit["unites"] > 1 else produit["nom"]


def composer(urgents: list[dict]) -> tuple[str, str]:
    """Titre et corps de la notification.

    Un seul produit se raconte en une phrase ; plusieurs se resument par un
    compte, le detail passant dans le corps regroupe par echeance.
    """
    if len(urgents) == 1:
        seul = urgents[0]
        jours = seul["jours"]
        if jours < 0:
            quand = "a périmé hier" if jours == -1 else f"a périmé il y a {abs(jours)} jours"
        elif jours == 0:
            quand = "périme aujourd'hui"
        elif jours == 1:
            quand = "périme demain"
        else:
            quand = f"périme dans {jours} jours"
        return f"{_etiquette(seul)} {quand}", "Ouvrez Fridgify pour le retrouver."

    total = sum(p["unites"] for p in urgents)
    titre = f"{total} produits à consommer" if total > 1 else "1 produit à consommer"

    groupes: list[str] = []
    for libelle, predicat in (
        ("Périmé", lambda j: j < 0),
        ("Aujourd'hui", lambda j: j == 0),
        ("Demain", lambda j: j == 1),
        ("Bientôt", lambda j: j > 1),
    ):
        noms = [_etiquette(p) for p in urgents if predicat(p["jours"])]
        if noms:
            groupes.append(f"{libelle} : {', '.join(noms)}")

    return titre, " · ".join(groupes)


def executer(force: bool = False, simuler: bool = False) -> dict:
    """Calcule l'alerte du jour et la diffuse. Renvoie ce qui s'est passe."""
    settings = get_settings()
    aujourdhui = date.today()

    with connexion() as db:
        deja = _lire_marqueur(db)
        if deja == aujourdhui.isoformat() and not force:
            return {"statut": "deja_envoye", "date": deja}

        urgents = produits_urgents(db, settings.notification_seuil_jours, aujourdhui)
        if not urgents:
            return {"statut": "rien_a_signaler"}

        titre, corps = composer(urgents)

        if simuler:
            return {"statut": "simulation", "titre": titre, "corps": corps}

        if not configure():
            return {"statut": "vapid_absent", "titre": titre, "corps": corps}

        resultat = envoyer_a_tous(db, titre, corps)

        # Le marqueur n'est pose que si un appareil a bien recu l'alerte : sans
        # abonne joignable, il faut pouvoir retenter (au prochain allumage, par
        # exemple) plutot que de considerer la journee comme traitee.
        if resultat["envoyes"] > 0:
            _poser_marqueur(db, aujourdhui)

        return {"statut": "envoye", "titre": titre, "corps": corps, **resultat}


def main() -> None:
    analyseur = argparse.ArgumentParser(description="Alerte quotidienne de peremption Fridgify.")
    analyseur.add_argument("--force", action="store_true", help="ignore le garde-fou du jour")
    analyseur.add_argument("--simuler", action="store_true", help="affiche sans envoyer")
    arguments = analyseur.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    init_db()
    resultat = executer(force=arguments.force, simuler=arguments.simuler)
    logger.info("%s", resultat)


if __name__ == "__main__":
    main()
