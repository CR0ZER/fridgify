"""Comptes, sessions et jetons de service.

Un compte, un frigo : `utilisateur_id` cloisonne l'inventaire, les plats, les
courses, les reglages et les abonnements aux notifications.

Les mots de passe sont haches avec `scrypt`, qui vient de la bibliotheque
standard : pas de dependance a installer sur la Raspberry, et une fonction
volontairement lente a calculer, donc penible a attaquer par force brute.

En ligne de commande, sur le serveur :

    .venv/bin/python -m app.comptes lister
    .venv/bin/python -m app.comptes creer <identifiant>
    .venv/bin/python -m app.comptes mot-de-passe <identifiant>
    .venv/bin/python -m app.comptes supprimer <identifiant>
    .venv/bin/python -m app.comptes jeton <identifiant> "Tableau de bord"
    .venv/bin/python -m app.comptes revoquer <identifiant> "Tableau de bord"
"""

import argparse
import getpass
import hashlib
import secrets
import sqlite3
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from .db import connexion, init_db

#: Parametres scrypt. n = 2^14 tient en ~16 Mo et prend une fraction de seconde
#: sur une Raspberry Pi 4, ce qui reste imperceptible a la connexion tout en
#: rendant une attaque hors ligne tres couteuse.
_N, _R, _P = 2**14, 8, 1

#: Six caracteres minimum, comme l'annonce l'ecran de creation de compte.
LONGUEUR_MOT_DE_PASSE = 6

#: Duree d'une session « rester connecte ». Sans cela, elle meurt avec l'onglet.
JOURS_SESSION = 90

#: Scans de ticket autorises par compte et par jour : la cle Gemini est partagee.
SCANS_PAR_JOUR = 5


@dataclass(frozen=True)
class Utilisateur:
    id: int
    identifiant: str
    date_creation: str


def hacher(mot_de_passe: str) -> str:
    sel = secrets.token_bytes(16)
    condense = hashlib.scrypt(mot_de_passe.encode(), salt=sel, n=_N, r=_R, p=_P)
    return f"scrypt${_N}${_R}${_P}${sel.hex()}${condense.hex()}"


def verifier(mot_de_passe: str, stocke: str) -> bool:
    try:
        _, n, r, p, sel, condense = stocke.split("$")
        calcule = hashlib.scrypt(
            mot_de_passe.encode(), salt=bytes.fromhex(sel), n=int(n), r=int(r), p=int(p)
        )
    except (ValueError, TypeError):
        return False
    # Comparaison en temps constant : le temps de reponse ne doit pas trahir
    # combien de caracteres du condense sont corrects.
    return secrets.compare_digest(calcule.hex(), condense)


def _empreinte(jeton: str) -> str:
    """Ce qui est stocke en base. Le jeton en clair ne vit que dans le cookie."""
    return hashlib.sha256(jeton.encode()).hexdigest()


def _maintenant() -> datetime:
    return datetime.now(timezone.utc)


# ---- Comptes -------------------------------------------------------------


def lire_utilisateur(db: sqlite3.Connection, identifiant: str) -> sqlite3.Row | None:
    return db.execute(
        "SELECT * FROM utilisateurs WHERE identifiant = ?;", (identifiant.strip(),)
    ).fetchone()


def creer_utilisateur(db: sqlite3.Connection, identifiant: str, mot_de_passe: str) -> Utilisateur:
    """Cree un compte. Le premier cree adopte les donnees d'avant les comptes."""
    identifiant = identifiant.strip()
    if not identifiant:
        raise ValueError("L'identifiant ne peut pas être vide.")
    if len(mot_de_passe) < LONGUEUR_MOT_DE_PASSE:
        raise ValueError(f"Le mot de passe fait {LONGUEUR_MOT_DE_PASSE} caractères minimum.")
    if lire_utilisateur(db, identifiant) is not None:
        raise ValueError("Cet identifiant est déjà pris.")

    premier = db.execute("SELECT COUNT(*) FROM utilisateurs;").fetchone()[0] == 0
    curseur = db.execute(
        "INSERT INTO utilisateurs (identifiant, mot_de_passe, date_creation) VALUES (?, ?, ?);",
        (identifiant, hacher(mot_de_passe), date.today().isoformat()),
    )
    utilisateur_id = curseur.lastrowid
    if premier:
        _adopter_l_existant(db, utilisateur_id)

    return Utilisateur(utilisateur_id, identifiant, date.today().isoformat())


def _adopter_l_existant(db: sqlite3.Connection, utilisateur_id: int) -> None:
    """Rattache au premier compte le frigo d'avant les comptes.

    La mise en place des comptes laisse les anciennes lignes sans proprietaire.
    Elles reviennent au premier compte cree, qui est celui de l'administrateur
    du serveur : c'est son frigo qui existait avant.
    """
    for table in ("inventaire_frigo", "plats", "courses", "abonnements_push"):
        db.execute(
            f"UPDATE {table} SET utilisateur_id = ? WHERE utilisateur_id IS NULL;",
            (utilisateur_id,),
        )

    tables = {
        ligne["name"]
        for ligne in db.execute("SELECT name FROM sqlite_master WHERE type='table';")
    }
    if "settings" in tables:
        db.execute(
            """
            INSERT OR IGNORE INTO reglages (utilisateur_id, cle, valeur)
            SELECT ?, key, value FROM settings WHERE key != 'prompt_recipes';
            """,
            (utilisateur_id,),
        )
        db.execute("DROP TABLE settings;")


def supprimer_utilisateur(db: sqlite3.Connection, utilisateur_id: int) -> None:
    """Efface le compte et tout ce qui lui appartient.

    Les effacements sont explicites plutot que confies aux cles etrangeres : sur
    une base anterieure aux comptes, la colonne utilisateur_id a ete ajoutee par
    ALTER TABLE, qui ne sait pas poser de contrainte ON DELETE CASCADE.
    """
    db.execute(
        "DELETE FROM plat_ingredients WHERE plat_id IN (SELECT id FROM plats WHERE utilisateur_id = ?);",
        (utilisateur_id,),
    )
    for table in (
        "inventaire_frigo",
        "plats",
        "courses",
        "abonnements_push",
        "reglages",
        "sessions",
        "jetons_service",
        "scans_journaliers",
    ):
        db.execute(f"DELETE FROM {table} WHERE utilisateur_id = ?;", (utilisateur_id,))
    db.execute("DELETE FROM utilisateurs WHERE id = ?;", (utilisateur_id,))


def changer_mot_de_passe(db: sqlite3.Connection, identifiant: str, mot_de_passe: str) -> None:
    if len(mot_de_passe) < LONGUEUR_MOT_DE_PASSE:
        raise ValueError(f"Le mot de passe fait {LONGUEUR_MOT_DE_PASSE} caractères minimum.")
    ligne = lire_utilisateur(db, identifiant)
    if ligne is None:
        raise ValueError("Compte introuvable.")
    db.execute(
        "UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?;",
        (hacher(mot_de_passe), ligne["id"]),
    )
    # Changer de mot de passe ferme les sessions ouvertes ailleurs : c'est le
    # geste que l'on fait justement quand on soupconne qu'une session traine.
    db.execute("DELETE FROM sessions WHERE utilisateur_id = ?;", (ligne["id"],))


def authentifier(db: sqlite3.Connection, identifiant: str, mot_de_passe: str) -> Utilisateur | None:
    ligne = lire_utilisateur(db, identifiant)
    if ligne is None:
        # Hachage a vide : un identifiant inconnu doit couter le meme temps
        # qu'un mot de passe faux, sinon la reponse revele qui existe.
        hacher(mot_de_passe)
        return None
    if not verifier(mot_de_passe, ligne["mot_de_passe"]):
        return None
    db.execute(
        "UPDATE utilisateurs SET derniere_connexion = ? WHERE id = ?;",
        (date.today().isoformat(), ligne["id"]),
    )
    return Utilisateur(ligne["id"], ligne["identifiant"], ligne["date_creation"])


# ---- Sessions ------------------------------------------------------------


def ouvrir_session(
    db: sqlite3.Connection, utilisateur_id: int, appareil: str | None, duree_jours: int
) -> tuple[str, datetime]:
    """Cree une session et renvoie le jeton en clair, a poser dans le cookie."""
    jeton = secrets.token_urlsafe(32)
    expiration = _maintenant() + timedelta(days=duree_jours)
    db.execute(
        """
        INSERT INTO sessions (jeton, utilisateur_id, date_creation, expiration, appareil)
        VALUES (?, ?, ?, ?, ?);
        """,
        (
            _empreinte(jeton),
            utilisateur_id,
            _maintenant().isoformat(),
            expiration.isoformat(),
            appareil,
        ),
    )
    return jeton, expiration


def utilisateur_de_session(db: sqlite3.Connection, jeton: str) -> Utilisateur | None:
    ligne = db.execute(
        """
        SELECT u.id, u.identifiant, u.date_creation, s.expiration
        FROM sessions s JOIN utilisateurs u ON u.id = s.utilisateur_id
        WHERE s.jeton = ?;
        """,
        (_empreinte(jeton),),
    ).fetchone()
    if ligne is None:
        return None
    if datetime.fromisoformat(ligne["expiration"]) < _maintenant():
        db.execute("DELETE FROM sessions WHERE jeton = ?;", (_empreinte(jeton),))
        return None
    return Utilisateur(ligne["id"], ligne["identifiant"], ligne["date_creation"])


def fermer_session(db: sqlite3.Connection, jeton: str) -> None:
    db.execute("DELETE FROM sessions WHERE jeton = ?;", (_empreinte(jeton),))


def purger_sessions(db: sqlite3.Connection) -> int:
    curseur = db.execute("DELETE FROM sessions WHERE expiration < ?;", (_maintenant().isoformat(),))
    return curseur.rowcount


# ---- Jetons de service ---------------------------------------------------


def creer_jeton_service(db: sqlite3.Connection, utilisateur_id: int, libelle: str) -> str:
    """Jeton pour une machine (ecran d'affichage, script). Affiche une seule fois."""
    jeton = secrets.token_urlsafe(32)
    db.execute(
        """
        INSERT INTO jetons_service (jeton, utilisateur_id, libelle, date_creation)
        VALUES (?, ?, ?, ?);
        """,
        (_empreinte(jeton), utilisateur_id, libelle, date.today().isoformat()),
    )
    return jeton


def utilisateur_de_jeton(db: sqlite3.Connection, jeton: str) -> Utilisateur | None:
    empreinte = _empreinte(jeton)
    ligne = db.execute(
        """
        SELECT u.id, u.identifiant, u.date_creation
        FROM jetons_service j JOIN utilisateurs u ON u.id = j.utilisateur_id
        WHERE j.jeton = ?;
        """,
        (empreinte,),
    ).fetchone()
    if ligne is None:
        return None
    db.execute(
        "UPDATE jetons_service SET dernier_acces = ? WHERE jeton = ?;",
        (date.today().isoformat(), empreinte),
    )
    return Utilisateur(ligne["id"], ligne["identifiant"], ligne["date_creation"])


def revoquer_jetons(db: sqlite3.Connection, utilisateur_id: int, libelle: str) -> int:
    """Supprime les jetons du compte portant ce libelle, et renvoie leur nombre.

    Le jeton en clair n'est pas conserve : c'est le libelle donne a la creation
    qui le designe. Deux jetons au meme libelle tombent ensemble. La casse est
    ignoree en Python : COLLATE NOCASE ne replie que l'ASCII (« É » != « é »).
    """
    cible = libelle.strip().casefold()
    empreintes = [
        (ligne["jeton"],)
        for ligne in db.execute(
            "SELECT jeton, libelle FROM jetons_service WHERE utilisateur_id = ?;", (utilisateur_id,)
        )
        if ligne["libelle"].strip().casefold() == cible
    ]
    db.executemany("DELETE FROM jetons_service WHERE jeton = ?;", empreintes)
    return len(empreintes)


def lister_jetons(db: sqlite3.Connection, utilisateur_id: int) -> list[sqlite3.Row]:
    return db.execute(
        """
        SELECT libelle, date_creation, dernier_acces FROM jetons_service
        WHERE utilisateur_id = ? ORDER BY date_creation, libelle;
        """,
        (utilisateur_id,),
    ).fetchall()


# ---- Quota de scan -------------------------------------------------------


def compter_scan(db: sqlite3.Connection, utilisateur_id: int) -> int:
    """Incremente le compteur du jour et renvoie le nombre de scans utilises."""
    jour = date.today().isoformat()
    db.execute(
        """
        INSERT INTO scans_journaliers (utilisateur_id, jour, nombre) VALUES (?, ?, 1)
        ON CONFLICT(utilisateur_id, jour) DO UPDATE SET nombre = nombre + 1;
        """,
        (utilisateur_id, jour),
    )
    return db.execute(
        "SELECT nombre FROM scans_journaliers WHERE utilisateur_id = ? AND jour = ?;",
        (utilisateur_id, jour),
    ).fetchone()[0]


def scans_restants(db: sqlite3.Connection, utilisateur_id: int) -> int:
    ligne = db.execute(
        "SELECT nombre FROM scans_journaliers WHERE utilisateur_id = ? AND jour = ?;",
        (utilisateur_id, date.today().isoformat()),
    ).fetchone()
    return max(0, SCANS_PAR_JOUR - (ligne[0] if ligne else 0))


# ---- Ligne de commande ---------------------------------------------------


def _demander_mot_de_passe() -> str:
    mot_de_passe = getpass.getpass("Mot de passe : ")
    if mot_de_passe != getpass.getpass("Confirmer : "):
        print("Les deux saisies diffèrent.", file=sys.stderr)
        raise SystemExit(1)
    return mot_de_passe


def main() -> None:
    analyseur = argparse.ArgumentParser(description="Comptes Frigo.")
    sous = analyseur.add_subparsers(dest="commande", required=True)
    sous.add_parser("lister", help="comptes existants")
    for nom, aide in (
        ("creer", "cree un compte"),
        ("mot-de-passe", "change le mot de passe"),
        ("supprimer", "supprime un compte et tout son frigo"),
    ):
        p = sous.add_parser(nom, help=aide)
        p.add_argument("identifiant")
    p = sous.add_parser("jeton", help="jeton de service pour une machine")
    p.add_argument("identifiant")
    p.add_argument("libelle", nargs="?", default="Machine")
    p = sous.add_parser("revoquer", help="revoque le jeton de service d'une machine")
    p.add_argument("identifiant")
    p.add_argument("libelle")

    arguments = analyseur.parse_args()
    init_db()

    with connexion() as db:
        if arguments.commande == "lister":
            lignes = db.execute(
                """
                SELECT u.id, u.identifiant, u.date_creation, u.derniere_connexion,
                       (SELECT COUNT(*) FROM inventaire_frigo i
                        WHERE i.utilisateur_id = u.id AND i.statut_fin IS NULL) AS unites
                FROM utilisateurs u ORDER BY u.id;
                """
            ).fetchall()
            if not lignes:
                print("Aucun compte. Créez-en un : python -m app.comptes creer <identifiant>")
            for ligne in lignes:
                print(
                    f"{ligne['identifiant']:<20} créé le {ligne['date_creation']}"
                    f" · {ligne['unites']} unités"
                    f" · dernière connexion {ligne['derniere_connexion'] or 'jamais'}"
                )
                for jeton in lister_jetons(db, ligne["id"]):
                    print(
                        f"    jeton « {jeton['libelle']} » créé le {jeton['date_creation']}"
                        f" · dernier accès {jeton['dernier_acces'] or 'jamais'}"
                    )
            return

        try:
            if arguments.commande == "creer":
                utilisateur = creer_utilisateur(db, arguments.identifiant, _demander_mot_de_passe())
                print(f"Compte « {utilisateur.identifiant} » créé.")
            elif arguments.commande == "mot-de-passe":
                changer_mot_de_passe(db, arguments.identifiant, _demander_mot_de_passe())
                print("Mot de passe changé. Les sessions ouvertes ont été fermées.")
            elif arguments.commande == "supprimer":
                ligne = lire_utilisateur(db, arguments.identifiant)
                if ligne is None:
                    raise ValueError("Compte introuvable.")
                attendu = f"supprimer {ligne['identifiant']}"
                print("Ceci efface le compte et tout son frigo, sans retour possible.")
                if input(f"Tapez « {attendu} » pour confirmer : ").strip() != attendu:
                    print("Annulé.")
                    return
                supprimer_utilisateur(db, ligne["id"])
                print("Compte supprimé.")
            elif arguments.commande == "jeton":
                ligne = lire_utilisateur(db, arguments.identifiant)
                if ligne is None:
                    raise ValueError("Compte introuvable.")
                jeton = creer_jeton_service(db, ligne["id"], arguments.libelle)
                print(f"\nJeton de service pour « {ligne['identifiant']} » ({arguments.libelle}) :\n")
                print(f"    {jeton}\n")
                print("Notez-le maintenant : il n'est pas récupérable ensuite.")
                print("À envoyer dans l'en-tête X-Service-Token de chaque requête.")
            elif arguments.commande == "revoquer":
                ligne = lire_utilisateur(db, arguments.identifiant)
                if ligne is None:
                    raise ValueError("Compte introuvable.")
                if not revoquer_jetons(db, ligne["id"], arguments.libelle):
                    libelles = [j["libelle"] for j in lister_jetons(db, ligne["id"])]
                    raise ValueError(
                        f"Aucun jeton « {arguments.libelle} » pour ce compte."
                        + (f" Jetons existants : {', '.join(libelles)}." if libelles else "")
                    )
                print(f"Jeton « {arguments.libelle} » révoqué : la machine n'a plus accès au frigo.")
        except ValueError as erreur:
            print(erreur, file=sys.stderr)
            raise SystemExit(1) from erreur


if __name__ == "__main__":
    main()
