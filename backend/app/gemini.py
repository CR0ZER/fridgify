import base64
import json
import logging
import re

import httpx
from fastapi import HTTPException, status

from .config import get_settings

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT = httpx.Timeout(120.0, connect=10.0)

logger = logging.getLogger(__name__)

#: Les messages s'adressent a quelqu'un qui n'a acces ni au code ni au serveur :
#: ils nomment Gemini, mais le detail technique part au journal.
NON_DECOMPTE = " Ce scan n'a pas été décompté."


class GeminiEnPanne(HTTPException):
    """Gemini n'a rien analyse : le scan est rendu au quota du compte."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail + NON_DECOMPTE)


_BLOC_MARKDOWN = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _extraire_json(texte: str) -> list:
    """Gemini enrobe parfois sa reponse de balises markdown ou de bavardage.

    On retire les fences, puis a defaut on isole le premier tableau JSON complet.
    """
    nettoye = _BLOC_MARKDOWN.sub("", texte).strip()

    try:
        return json.loads(nettoye)
    except json.JSONDecodeError:
        pass

    debut = nettoye.find("[")
    fin = nettoye.rfind("]")
    if debut != -1 and fin > debut:
        try:
            return json.loads(nettoye[debut : fin + 1])
        except json.JSONDecodeError:
            pass

    logger.warning("Gemini : reponse non exploitable en JSON : %s", nettoye[:500])
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Gemini n'a pas su lire ce ticket. Reprenez la photo, à plat et bien nette.",
    )


def _extraire_texte(data: dict) -> str:
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        # Un modele qui "reflechit" peut epuiser son budget de sortie avant
        # d'ecrire quoi que ce soit : la reponse est alors valide, mais sans
        # aucune part de texte. Le finishReason est ce qui le dit.
        candidat = (data.get("candidates") or [{}])[0]
        raison = candidat.get("finishReason", "inconnu")
        logger.warning(
            "Gemini n'a renvoye aucun texte (finishReason=%s, usage=%s)",
            raison,
            data.get("usageMetadata"),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini n'a rien renvoyé (raison : {raison}). Réessayez.",
        ) from exc


def message_http(code: int) -> str:
    """Ce que l'utilisateur lit quand Gemini repond par une erreur HTTP.

    Le corps de la reponse, un JSON en anglais, part au journal. Seuls 429 et
    5xx passent avec le temps ; le reste (cle refusee, modele inconnu) demande
    l'intervention de l'administrateur, a qui le code servira.
    """
    if code == 429:
        return "Gemini reçoit trop de demandes, ou le quota du serveur est épuisé. Réessayez plus tard."
    if code >= 500:
        return "Gemini est surchargé en ce moment. Réessayez dans quelques minutes."
    if code in (401, 403):
        return "Gemini refuse la clé API du serveur. Prévenez l'administrateur."
    if code == 404:
        return "Modèle Gemini introuvable. Prévenez l'administrateur."
    return f"Gemini a refusé la demande (code {code})."


async def _appeler(parts: list[dict]) -> list:
    settings = get_settings()

    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY absente du .env du serveur.")
        raise GeminiEnPanne(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Aucune clé API Gemini sur le serveur. Prévenez l'administrateur.",
        )

    url = f"{BASE_URL}/{settings.gemini_model}:generateContent"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            reponse = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": settings.gemini_api_key,
                },
                json={"contents": [{"parts": parts}]},
            )
        except httpx.RequestError as exc:
            logger.warning("Gemini injoignable : %r", exc)
            raise GeminiEnPanne(
                status.HTTP_504_GATEWAY_TIMEOUT,
                "Gemini injoignable depuis le serveur. Réessayez dans un moment.",
            ) from exc

    if reponse.status_code != 200:
        logger.warning("Gemini a repondu %s : %s", reponse.status_code, reponse.text[:500])
        raise GeminiEnPanne(status.HTTP_502_BAD_GATEWAY, message_http(reponse.status_code))

    texte = _extraire_texte(reponse.json())
    return _extraire_json(texte)


async def analyser_ticket(image: bytes, mime_type: str, prompt: str) -> list:
    return await _appeler(
        [
            {"text": prompt},
            {
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(image).decode("ascii"),
                }
            },
        ]
    )
