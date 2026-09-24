"""Abonnements Web Push."""

import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status

from .. import push
from ..auth import utilisateur_courant
from ..comptes import Utilisateur
from ..config import get_settings
from ..db import get_db
from ..models import AbonnementPush, AppareilAbonne, DesabonnementPush, EtatPush

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/etat", response_model=EtatPush)
def lire_etat(
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> EtatPush:
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
            for ligne in push.lister_abonnements(db, utilisateur.id)
        ],
    )


@router.post("/abonnements", status_code=status.HTTP_201_CREATED, response_model=EtatPush)
def enregistrer(
    corps: AbonnementPush,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
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
        INSERT INTO abonnements_push
            (endpoint, utilisateur_id, p256dh, auth, date_creation, appareil)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
            -- Un appareil prete a un autre compte change de proprietaire : sans
            -- cela, ses alertes continueraient de parler du frigo precedent.
            utilisateur_id = excluded.utilisateur_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            appareil = excluded.appareil;
        """,
        (
            corps.endpoint,
            utilisateur.id,
            corps.keys.p256dh,
            corps.keys.auth,
            date.today().isoformat(),
            push.deviner_appareil(user_agent),
        ),
    )
    return lire_etat(db, utilisateur)


@router.delete("/abonnements", status_code=status.HTTP_204_NO_CONTENT)
def oublier(
    corps: DesabonnementPush,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Response:
    """Retire l'abonnement. Idempotent : un endpoint inconnu n'est pas une erreur."""
    db.execute(
        "DELETE FROM abonnements_push WHERE endpoint = ? AND utilisateur_id = ?;",
        (corps.endpoint, utilisateur.id),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

