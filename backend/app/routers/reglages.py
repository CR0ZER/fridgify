import sqlite3

from fastapi import APIRouter, Depends, Response, status

from ..auth import utilisateur_courant
from ..comptes import Utilisateur
from ..db import get_db
from ..models import Reglage, ReglageValeur
from ..prompts import DEFAULTS

router = APIRouter(prefix="/settings", tags=["reglages"])


def lire_reglage(db: sqlite3.Connection, utilisateur_id: int, cle: str) -> str | None:
    """Valeur choisie par ce compte, ou defaut du serveur, ou None."""
    ligne = db.execute(
        "SELECT valeur FROM reglages WHERE utilisateur_id = ? AND cle = ?;",
        (utilisateur_id, cle),
    ).fetchone()
    if ligne is not None:
        return ligne["valeur"]
    return DEFAULTS.get(cle)


def ecrire_reglage(db: sqlite3.Connection, utilisateur_id: int, cle: str, valeur: str) -> None:
    db.execute(
        """
        INSERT INTO reglages (utilisateur_id, cle, valeur) VALUES (?, ?, ?)
        ON CONFLICT(utilisateur_id, cle) DO UPDATE SET valeur = excluded.valeur;
        """,
        (utilisateur_id, cle, valeur),
    )


@router.get("/defaults", response_model=dict[str, str])
def lire_defauts() -> dict[str, str]:
    """Prompts d'origine, pour le bouton "Reinitialiser au defaut"."""
    return DEFAULTS


@router.get("/{cle}", response_model=Reglage)
def lire(
    cle: str,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Reglage:
    return Reglage(key=cle, value=lire_reglage(db, utilisateur.id, cle))


@router.put("/{cle}", response_model=Reglage)
def ecrire(
    cle: str,
    corps: ReglageValeur,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Reglage:
    ecrire_reglage(db, utilisateur.id, cle, corps.value)
    return Reglage(key=cle, value=corps.value)


@router.delete("/{cle}", status_code=status.HTTP_204_NO_CONTENT)
def effacer(
    cle: str,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Response:
    """Retire la surcharge : la valeur repasse au defaut du serveur."""
    db.execute(
        "DELETE FROM reglages WHERE utilisateur_id = ? AND cle = ?;", (utilisateur.id, cle)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
