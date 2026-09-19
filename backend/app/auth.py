import secrets

from fastapi import Header, HTTPException, status

from .config import get_settings


def exiger_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Compare le header X-API-Key au secret du serveur, en temps constant.

    Si API_KEY est vide dans la config, l'API reste ouverte : pratique pour un
    premier demarrage, mais le /api/health le signale explicitement.
    """
    attendu = get_settings().api_key
    if not attendu:
        return

    if not x_api_key or not secrets.compare_digest(x_api_key, attendu):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cle API manquante ou invalide.",
            headers={"WWW-Authenticate": "X-API-Key"},
        )
