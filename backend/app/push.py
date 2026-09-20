"""Envoi de notifications Web Push.

Le Web Push repose sur deux secrets asymetriques : une paire de cles VAPID qui
identifie *le serveur* aupres du service de push (Apple, Google...), et une cle
propre a chaque abonnement, fournie par le navigateur, qui chiffre le contenu de
bout en bout. Le service de push relaie sans jamais pouvoir lire le message.

Generer la paire VAPID (une seule fois par installation) :

    .venv/bin/python -m app.push

Changer ces cles ensuite invalide tous les abonnements existants : les
navigateurs devront se reabonner.
"""

import base64
import json
import logging
import sqlite3
from datetime import date

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPushException, webpush

from .config import get_settings

logger = logging.getLogger(__name__)

#: Duree de vie du message dans la file du service de push. Une alerte de
#: peremption n'a plus d'interet le lendemain.
TTL = 12 * 3600


def _b64(donnees: bytes) -> str:
    """Base64 URL-safe sans remplissage, la forme attendue par le Web Push."""
    return base64.urlsafe_b64encode(donnees).rstrip(b"=").decode("ascii")


def generer_paire() -> tuple[str, str]:
    """Nouvelle paire VAPID (publique, privee), toutes deux en base64url.

    La courbe P-256 n'est pas un choix : la specification Web Push l'impose.
    """
    cle = ec.generate_private_key(ec.SECP256R1())
    publique = _b64(
        cle.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        )
    )
    privee = _b64(cle.private_numbers().private_value.to_bytes(32, "big"))
    return publique, privee


def configure() -> bool:
    """Vrai si les deux cles VAPID sont presentes dans la configuration."""
    settings = get_settings()
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def lister_abonnements(db: sqlite3.Connection, utilisateur_id: int) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM abonnements_push WHERE utilisateur_id = ? ORDER BY date_creation ASC;",
        (utilisateur_id,),
    ).fetchall()


def envoyer_a_tous(
    db: sqlite3.Connection, utilisateur_id: int, titre: str, corps: str, url: str = "/"
) -> dict:
    """Diffuse une notification aux appareils d'un compte.

    Renvoie le detail des envois. Un abonnement que le service de push declare
    disparu (404) ou expire (410) est supprime : c'est la seule facon d'apprendre
    qu'une application a ete desinstallee, le navigateur ne prevenant personne.
    """
    if not configure():
        raise RuntimeError("Cles VAPID absentes de la configuration du serveur.")

    # ensure_ascii=False : les accents partent en UTF-8 plutot qu'en \uXXXX, ce
    # qui divise leur poids par trois dans une charge plafonnee a 4 Ko.
    charge = json.dumps({"titre": titre, "corps": corps, "url": url}, ensure_ascii=False)
    settings = get_settings()

    envoyes, perimes, echecs = 0, [], []

    for abonnement in lister_abonnements(db, utilisateur_id):
        try:
            webpush(
                subscription_info={
                    "endpoint": abonnement["endpoint"],
                    "keys": {"p256dh": abonnement["p256dh"], "auth": abonnement["auth"]},
                },
                data=charge,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
                ttl=TTL,
                timeout=20,
            )
        except WebPushException as exc:
            statut = exc.response.status_code if exc.response is not None else None
            if statut in (404, 410):
                perimes.append(abonnement["endpoint"])
            else:
                echecs.append(f"{_appareil(abonnement)} : {statut or exc}")
                logger.warning("Push refuse (%s) pour %s", statut, abonnement["endpoint"][:60])
            continue

        envoyes += 1
        db.execute(
            "UPDATE abonnements_push SET dernier_succes = ? WHERE endpoint = ?;",
            (date.today().isoformat(), abonnement["endpoint"]),
        )

    for endpoint in perimes:
        db.execute("DELETE FROM abonnements_push WHERE endpoint = ?;", (endpoint,))
        logger.info("Abonnement expire supprime : %s", endpoint[:60])

    return {"envoyes": envoyes, "supprimes": len(perimes), "echecs": echecs}


def _appareil(abonnement: sqlite3.Row) -> str:
    return abonnement["appareil"] or "Appareil inconnu"


def deviner_appareil(user_agent: str | None) -> str:
    """Etiquette lisible pour distinguer les appareils dans les reglages."""
    ua = (user_agent or "").lower()
    for marqueur, etiquette in (
        ("iphone", "iPhone"),
        ("ipad", "iPad"),
        ("android", "Android"),
        ("macintosh", "Mac"),
        ("windows", "Windows"),
        ("linux", "Linux"),
    ):
        if marqueur in ua:
            return etiquette
    return "Appareil"


if __name__ == "__main__":
    publique, privee = generer_paire()
    # Sortie directement collable dans backend/.env, ou redirigeable dedans :
    # les commentaires restent lisibles une fois dans le fichier.
    print(f"\n# Cles VAPID generees le {date.today().isoformat()}.")
    print(f"VAPID_PUBLIC_KEY={publique}")
    print(f"VAPID_PRIVATE_KEY={privee}")
