"""Deux gardes successifs devant l'API.

1. La cle API (`X-API-Key`), ajoutee par nginx, dit que la requete vient d'un
   appareil autorise. Elle protege le port 8000, joignable depuis tout le
   reseau local et le tailnet.
2. La session, elle, dit *qui* parle : c'est elle qui choisit le frigo. Elle
   voyage dans un cookie inaccessible au JavaScript. Une machine (un ecran
   d'affichage, un script) presente a la place un jeton de service.
"""

import secrets
import time
from collections import defaultdict

from fastapi import Cookie, Depends, Header, HTTPException, Request, status

from . import comptes
from .comptes import Utilisateur
from .config import get_settings
from .db import get_db

#: Nom du cookie de session.
COOKIE_SESSION = "fridgify_session"

#: Tentatives de connexion ratees tolerees avant blocage, et duree du blocage.
#: Volontairement court : il s'agit de casser une attaque automatique, pas de
#: punir quelqu'un qui se trompe de mot de passe.
ESSAIS_MAX = 3
BLOCAGE_SECONDES = 60

#: identifiant -> (nombre d'echecs, horodatage du dernier echec). En memoire :
#: un redemarrage remet les compteurs a zero, ce qui est sans consequence a
#: l'echelle d'une maison, et evite une ecriture en base a chaque essai.
_echecs: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))


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


def utilisateur_courant(
    db=Depends(get_db),
    fridgify_session: str | None = Cookie(default=None),
    x_service_token: str | None = Header(default=None),
) -> Utilisateur:
    """Le compte dont on manipule le frigo, ou 401 s'il n'y en a pas."""
    if fridgify_session:
        utilisateur = comptes.utilisateur_de_session(db, fridgify_session)
        if utilisateur is not None:
            return utilisateur

    if x_service_token:
        utilisateur = comptes.utilisateur_de_jeton(db, x_service_token)
        if utilisateur is not None:
            return utilisateur

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expirée ou absente. Reconnectez-vous.",
    )


def verrou_connexion(identifiant: str) -> int:
    """Secondes restantes avant de pouvoir reessayer, 0 si la voie est libre."""
    echecs, dernier = _echecs[identifiant.strip().lower()]
    if echecs < ESSAIS_MAX:
        return 0
    reste = BLOCAGE_SECONDES - (time.monotonic() - dernier)
    return max(0, int(reste) + 1) if reste > 0 else 0


def noter_echec(identifiant: str) -> int:
    """Enregistre un echec et renvoie le nombre d'essais encore permis."""
    cle = identifiant.strip().lower()
    echecs, _ = _echecs[cle]
    # Apres un blocage purge, on repart d'un compteur neuf plutot que de bloquer
    # immediatement au premier essai suivant.
    echecs = 0 if echecs >= ESSAIS_MAX else echecs
    _echecs[cle] = (echecs + 1, time.monotonic())
    return max(0, ESSAIS_MAX - (echecs + 1))


def oublier_echecs(identifiant: str) -> None:
    _echecs.pop(identifiant.strip().lower(), None)


def cookie_securise(requete: Request) -> bool:
    """Vrai quand la page est servie en HTTPS.

    En production, tailscaled termine le TLS puis relaie en clair a nginx : le
    schema vu par l'application est donc `http`, et seul l'en-tete transmis par
    le proxy dit la verite. En developpement (http://localhost), le cookie ne
    doit surtout pas etre marque `Secure`, sinon le navigateur le jette.
    """
    protocole = requete.headers.get("x-forwarded-proto", requete.url.scheme)
    return protocole.split(",")[0].strip() == "https"
