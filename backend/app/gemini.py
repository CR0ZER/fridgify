import base64
import json
import re

import httpx
from fastapi import HTTPException, status

from .config import get_settings

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT = httpx.Timeout(120.0, connect=10.0)

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

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Reponse Gemini illisible : {nettoye[:400]}",
    )


async def _appeler(parts: list[dict]) -> list:
    settings = get_settings()

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY absente du .env du serveur.",
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
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"Gemini injoignable : {exc}",
            ) from exc

    if reponse.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erreur API Gemini ({reponse.status_code}) : {reponse.text[:400]}",
        )

    data = reponse.json()
    try:
        texte = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Reponse Gemini vide ou mal formee.",
        ) from exc

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
