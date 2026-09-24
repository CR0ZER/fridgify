import logging
import sqlite3

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import ValidationError

from .. import comptes, gemini
from ..auth import utilisateur_courant
from ..categories import normaliser
from ..comptes import Utilisateur
from ..db import get_db
from ..models import ProduitDetecte
from ..prompts import CLE_PROMPT_SCAN
from .reglages import lire_reglage

router = APIRouter(prefix="/llm", tags=["llm"])
logger = logging.getLogger(__name__)

TAILLE_MAX = 12 * 1024 * 1024
MIMES_ACCEPTES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


@router.post("/scan", response_model=list[ProduitDetecte])
async def scanner_ticket(
    image: UploadFile = File(...),
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> list[ProduitDetecte]:
    """Photo de ticket -> liste de produits frais detectes, prets a valider."""
    # La cle Gemini est partagee par tous les comptes du serveur : sans plafond,
    # un seul compte pourrait epuiser le quota de tout le monde.
    if comptes.scans_restants(db, utilisateur.id) == 0:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Limite de {comptes.SCANS_PAR_JOUR} scans par jour atteinte."
            " Ajoutez les produits à la main, ou réessayez demain.",
        )

    mime = (image.content_type or "").lower()
    if mime not in MIMES_ACCEPTES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Format d'image non supporte : {mime or 'inconnu'}.",
        )

    contenu = await image.read()
    if not contenu:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image vide.")
    if len(contenu) > TAILLE_MAX:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Image trop lourde ({len(contenu) // 1024} Ko, maximum {TAILLE_MAX // 1024} Ko).",
        )

    prompt = lire_reglage(db, utilisateur.id, CLE_PROMPT_SCAN) or ""
    # Compte avant l'appel, pour que deux scans lances en meme temps ne passent
    # pas tous deux sous la limite. Rendu si Gemini n'a rien analyse (panne,
    # surcharge) ; une photo illisible, elle, a bien ete analysee et reste due.
    comptes.compter_scan(db, utilisateur.id)
    try:
        brut = await gemini.analyser_ticket(contenu, mime, prompt)
    except gemini.GeminiEnPanne:
        comptes.rendre_scan(db, utilisateur.id)
        raise
    detectes = _valider(brut, ProduitDetecte, "produits detectes")

    # Malgre la consigne du prompt, le modele s'ecarte parfois de la liste : on
    # rattache avant que la valeur n'atteigne l'inventaire.
    for produit in detectes:
        produit.categorie = normaliser(produit.categorie)
    return detectes


def _valider(brut: object, modele: type, quoi: str) -> list:
    """Le JSON vient d'un LLM : on le valide avant de le laisser entrer."""
    illisible = HTTPException(
        status.HTTP_502_BAD_GATEWAY,
        "Gemini n'a pas su lire ce ticket. Reprenez la photo, à plat et bien nette.",
    )
    if not isinstance(brut, list):
        logger.warning("Gemini : %s attendus en liste, recu %r", quoi, brut)
        raise illisible
    try:
        return [modele(**element) for element in brut]
    except (ValidationError, TypeError) as exc:
        logger.warning("Gemini : format inattendu pour les %s : %s", quoi, exc)
        raise illisible from exc
