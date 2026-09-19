"""Socle des tests : une base neuve par test, jamais celle de production.

Les variables d'environnement sont posees avant l'import de l'application :
`Settings` les lit au premier acces et les met en cache, et les variables
d'environnement priment sur le fichier .env du depot.
"""

import os
import tempfile
from types import SimpleNamespace
from pathlib import Path

import pytest

CLE_TEST = "cle-de-test"

_DOSSIER = tempfile.mkdtemp(prefix="fridgify-tests-")
os.environ["DATABASE_PATH"] = str(Path(_DOSSIER) / "test.db")
os.environ["API_KEY"] = CLE_TEST
os.environ["GEMINI_API_KEY"] = ""
os.environ["CORS_ORIGINS"] = "*"
# Cles VAPID de test : les envois sont toujours simules, seule leur presence
# compte pour que les notifications se declarent disponibles.
os.environ["VAPID_PUBLIC_KEY"] = "cle-publique-de-test"
os.environ["VAPID_PRIVATE_KEY"] = "cle-privee-de-test"
os.environ["NOTIFICATION_SEUIL_JOURS"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import connexion  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    """Client authentifie sur une base videe apres chaque test."""
    with TestClient(app) as c:
        c.headers["X-API-Key"] = CLE_TEST
        yield c

    with connexion() as conn:
        for table in ("courses", "plat_ingredients", "plats", "inventaire_frigo", "settings", "abonnements_push"):
            conn.execute(f"DELETE FROM {table};")


@pytest.fixture()
def creer_lot(client):
    """Fabrique un lot et renvoie son identifiant."""

    def _creer(nom: str, count: int = 1, dlc: str | None = "2026-09-10", **extra) -> str:
        unite = {
            "nom": nom,
            "categorie": extra.pop("categorie", "Autre"),
            "date_achat": "2026-08-29",
            "est_ouvert": 0,
            "duree_apres_ouverture": extra.pop("duree_apres_ouverture", 3),
            "date_peremption_effective": dlc,
            "est_un_reste": 0,
            **extra,
        }
        reponse = client.post("/api/lots", json={"unite": unite, "count": count})
        assert reponse.status_code == 201, reponse.text
        return reponse.json()["lot_id"]

    return _creer


@pytest.fixture()
def push_simule(monkeypatch):
    """Remplace l'envoi reel par un mouchard, et permet de simuler un refus.

    `webpush` est la seule porte vers le reseau : la neutraliser suffit a tester
    toute la logique d'envoi sans jamais joindre un service de push.
    """
    envois: list[dict] = []
    reponses: dict[str, int] = {}

    def faux_webpush(subscription_info, data=None, **_):
        endpoint = subscription_info["endpoint"]
        statut = reponses.get(endpoint)
        if statut is not None:
            from pywebpush import WebPushException

            class _Reponse:
                status_code = statut
                text = "refus simule"

            raise WebPushException("refus simule", response=_Reponse())
        envois.append({"endpoint": endpoint, "data": data})

    monkeypatch.setattr("app.push.webpush", faux_webpush)

    return SimpleNamespace(
        envois=envois,
        #: endpoint -> code HTTP a renvoyer au lieu d'un succes.
        refus=reponses,
    )


@pytest.fixture()
def abonner(client):
    """Enregistre un abonnement push et renvoie son endpoint."""

    def _abonner(endpoint: str = "https://push.example/abc") -> str:
        reponse = client.post(
            "/api/push/abonnements",
            json={"endpoint": endpoint, "keys": {"p256dh": "cle-p256", "auth": "cle-auth"}},
        )
        assert reponse.status_code == 201, reponse.text
        return endpoint

    return _abonner
