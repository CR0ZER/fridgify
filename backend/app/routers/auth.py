"""Creation de compte, connexion, deconnexion."""

import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status

from .. import auth, comptes, push
from ..comptes import Utilisateur
from ..db import get_db
from ..models import Identifiants, Profil

router = APIRouter(prefix="/auth", tags=["auth"])

#: Duree d'une session non persistante. Le cookie meurt avec l'onglet, mais le
#: serveur doit lui aussi oublier la session : sans expiration cote serveur, un
#: jeton vole resterait valable indefiniment.
JOURS_SESSION_COURTE = 1


def _poser_cookie(
    reponse: Response, requete: Request, jeton: str, rester_connecte: bool, duree_jours: int
) -> None:
    reponse.set_cookie(
        auth.COOKIE_SESSION,
        jeton,
        # Sans max_age, le cookie disparait a la fermeture de l'application.
        max_age=duree_jours * 24 * 3600 if rester_connecte else None,
        # Le JavaScript de la page ne doit jamais pouvoir lire le jeton : c'est
        # ce qui limite les degats d'une faille d'injection de script.
        httponly=True,
        # Lax : le cookie ne part pas sur une requete declenchee par un autre
        # site, ce qui ferme la porte aux attaques CSRF.
        samesite="lax",
        secure=auth.cookie_securise(requete),
        path="/",
    )


def _profil(db: sqlite3.Connection, utilisateur: Utilisateur, expiration: str) -> Profil:
    ligne = db.execute(
        """
        SELECT COUNT(DISTINCT lot_id) AS lots, COUNT(*) AS unites
        FROM inventaire_frigo WHERE utilisateur_id = ? AND statut_fin IS NULL;
        """,
        (utilisateur.id,),
    ).fetchone()
    return Profil(
        identifiant=utilisateur.identifiant,
        date_creation=utilisateur.date_creation,
        lots=ligne["lots"],
        unites=ligne["unites"],
        expiration=expiration,
        scans_restants=comptes.scans_restants(db, utilisateur.id),
    )


def _ouvrir(
    db: sqlite3.Connection,
    reponse: Response,
    requete: Request,
    utilisateur: Utilisateur,
    rester_connecte: bool,
    user_agent: str | None,
) -> Profil:
    duree = comptes.JOURS_SESSION if rester_connecte else JOURS_SESSION_COURTE
    jeton, expiration = comptes.ouvrir_session(
        db, utilisateur.id, push.deviner_appareil(user_agent), duree
    )
    _poser_cookie(reponse, requete, jeton, rester_connecte, duree)
    comptes.purger_sessions(db)
    return _profil(db, utilisateur, expiration.isoformat())


@router.post("/inscription", response_model=Profil, status_code=status.HTTP_201_CREATED)
def inscription(
    corps: Identifiants,
    requete: Request,
    reponse: Response,
    db: sqlite3.Connection = Depends(get_db),
    user_agent: str | None = Header(default=None),
) -> Profil:
    """Cree un compte et ouvre directement sa session : son frigo est vide."""
    try:
        utilisateur = comptes.creer_utilisateur(db, corps.identifiant, corps.mot_de_passe)
    except ValueError as erreur:
        raise HTTPException(status.HTTP_409_CONFLICT, str(erreur)) from erreur

    return _ouvrir(db, reponse, requete, utilisateur, corps.rester_connecte, user_agent)


@router.post("/connexion", response_model=Profil)
def connexion(
    corps: Identifiants,
    requete: Request,
    reponse: Response,
    db: sqlite3.Connection = Depends(get_db),
    user_agent: str | None = Header(default=None),
) -> Profil:
    attente = auth.verrou_connexion(corps.identifiant)
    if attente:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Trop d'essais. Réessayez dans {attente} seconde{'s' if attente > 1 else ''}.",
        )

    utilisateur = comptes.authentifier(db, corps.identifiant, corps.mot_de_passe)
    if utilisateur is None:
        restants = auth.noter_echec(corps.identifiant)
        detail = "Identifiant ou mot de passe incorrect."
        if restants:
            detail += f" {restants} essai{'s' if restants > 1 else ''} avant blocage."
        else:
            detail += f" Compte bloqué {auth.BLOCAGE_SECONDES} secondes."
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail)

    auth.oublier_echecs(corps.identifiant)
    return _ouvrir(db, reponse, requete, utilisateur, corps.rester_connecte, user_agent)


@router.post("/deconnexion", status_code=status.HTTP_204_NO_CONTENT)
def deconnexion(
    db: sqlite3.Connection = Depends(get_db),
    fridgify_session: str | None = Cookie(default=None),
) -> Response:
    """Ferme la session courante. Rien n'est supprime du frigo."""
    if fridgify_session:
        comptes.fermer_session(db, fridgify_session)
    reponse = Response(status_code=status.HTTP_204_NO_CONTENT)
    reponse.delete_cookie(auth.COOKIE_SESSION, path="/")
    return reponse


@router.get("/moi", response_model=Profil)
def moi(
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(auth.utilisateur_courant),
) -> Profil:
    """Verifie la session au demarrage de l'application et decrit le compte."""
    ligne = db.execute(
        "SELECT MAX(expiration) AS expiration FROM sessions WHERE utilisateur_id = ?;",
        (utilisateur.id,),
    ).fetchone()
    expiration = ligne["expiration"] or datetime.now(timezone.utc).isoformat()
    return _profil(db, utilisateur, expiration)
