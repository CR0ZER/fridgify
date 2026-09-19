import sqlite3

from fastapi import APIRouter, Depends, Response, status

from ..db import get_db
from ..models import Reglage, ReglageValeur
from ..prompts import DEFAULTS

router = APIRouter(prefix="/settings", tags=["reglages"])


def lire_reglage(db: sqlite3.Connection, cle: str) -> str | None:
    """Valeur stockee, ou defaut connu, ou None."""
    ligne = db.execute("SELECT value FROM settings WHERE key = ?;", (cle,)).fetchone()
    if ligne is not None:
        return ligne["value"]
    return DEFAULTS.get(cle)


@router.get("/defaults", response_model=dict[str, str])
def lire_defauts() -> dict[str, str]:
    """Prompts d'origine, pour le bouton "Reinitialiser au defaut"."""
    return DEFAULTS


@router.get("/{cle}", response_model=Reglage)
def lire(cle: str, db: sqlite3.Connection = Depends(get_db)) -> Reglage:
    return Reglage(key=cle, value=lire_reglage(db, cle))


@router.put("/{cle}", response_model=Reglage)
def ecrire(
    cle: str,
    corps: ReglageValeur,
    db: sqlite3.Connection = Depends(get_db),
) -> Reglage:
    db.execute(
        """
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """,
        (cle, corps.value),
    )
    return Reglage(key=cle, value=corps.value)


@router.delete("/{cle}", status_code=status.HTTP_204_NO_CONTENT)
def effacer(cle: str, db: sqlite3.Connection = Depends(get_db)) -> Response:
    """Retire la surcharge : la valeur repasse au defaut du serveur."""
    db.execute("DELETE FROM settings WHERE key = ?;", (cle,))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
