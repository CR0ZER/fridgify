"""Abonnements Web Push et envoi de test."""

import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status

from .. import push
from ..config import get_settings
from ..db import get_db
from ..models import (
    AbonnementPush,
    AppareilAbonne,
    DesabonnementPush,
    EtatPush,
    ResultatEnvoi,
)
from ..notifications import composer, produits_urgents

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/etat", response_model=EtatPush)
def lire_etat(db: sqlite3.Connection = Depends(get_db)) -> EtatPush:
    """Cle publique, disponibilite et appareils deja abonnes."""
    settings = get_settings()
    return EtatPush(
        cle_publique=settings.vapid_public_key or None,
        disponible=push.configure(),
        seuil_jours=settings.notification_seuil_jours,
        appareils=[
            AppareilAbonne(
                appareil=ligne["appareil"] or "Appareil",
                date_creation=ligne["date_creation"],
                dernier_succes=ligne["dernier_succes"],
            )
            for ligne in push.lister_abonnements(db)
        ],
    )


@router.post("/abonnements", status_code=status.HTTP_201_CREATED, response_model=EtatPush)
def enregistrer(
    corps: AbonnementPush,
    db: sqlite3.Connection = Depends(get_db),
    user_agent: str | None = Header(default=None),
) -> EtatPush:
    """Enregistre ou rafraichit l'abonnement de cet appareil.

    Le navigateur peut renouveler ses cles sans rien demander a personne :
    l'endpoint etant la cle primaire, un reabonnement met simplement a jour.
    """
    if not push.configure():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Cles VAPID absentes du serveur : notifications indisponibles.",
        )

    db.execute(
        """
        INSERT INTO abonnements_push (endpoint, p256dh, auth, date_creation, appareil)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            appareil = excluded.appareil;
        """,
        (
            corps.endpoint,
            corps.keys.p256dh,
            corps.keys.auth,
            date.today().isoformat(),
            push.deviner_appareil(user_agent),
        ),
    )
    return lire_etat(db)


@router.delete("/abonnements", status_code=status.HTTP_204_NO_CONTENT)
def oublier(corps: DesabonnementPush, db: sqlite3.Connection = Depends(get_db)) -> Response:
    """Retire l'abonnement. Idempotent : un endpoint inconnu n'est pas une erreur."""
    db.execute("DELETE FROM abonnements_push WHERE endpoint = ?;", (corps.endpoint,))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test", response_model=ResultatEnvoi)
def envoyer_test(db: sqlite3.Connection = Depends(get_db)) -> ResultatEnvoi:
    """Diffuse l'alerte telle qu'elle serait envoyee aujourd'hui.

    Le message reprend le contenu reel quand quelque chose perime, pour verifier
    la formulation autant que le transport.
    """
    if not push.configure():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Cles VAPID absentes du serveur : notifications indisponibles.",
        )
    if not push.lister_abonnements(db):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Aucun appareil abonne : activez les notifications sur cet appareil d'abord.",
        )

    settings = get_settings()
    urgents = produits_urgents(db, settings.notification_seuil_jours, date.today())

    if urgents:
        titre, corps = composer(urgents)
    else:
        titre = "Fridgify est prêt"
        corps = "Rien ne périme dans les prochains jours. Ce test confirme le transport."

    return ResultatEnvoi(**push.envoyer_a_tous(db, titre, corps))
