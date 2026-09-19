import random
import sqlite3
import time
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..categories import CATEGORIES, normaliser
from ..db import get_db
from ..models import (
    LotACreer,
    LotCree,
    LotPatch,
    MouvementRecent,
    Produit,
    ProduitPatch,
    Stats,
    CategorieDefaut,
    StatutPatch,
    TopJete,
    UniteACreer,
)

router = APIRouter(prefix="/produits", tags=["produits"])
router_lots = APIRouter(prefix="/lots", tags=["lots"])

CHAMPS_PATCHABLES = {
    "nom",
    "categorie",
    "date_achat",
    "date_peremption_effective",
    "est_un_reste",
}


def _nouveau_lot_id() -> str:
    return f"{int(time.time() * 1000)}_{random.randbytes(4).hex()}"


def _aujourdhui() -> str:
    return date.today().isoformat()


@router.get("", response_model=list[Produit])
def lister_produits(db: sqlite3.Connection = Depends(get_db)) -> list[Produit]:
    """Inventaire actif, du plus urgent au moins urgent.

    Les unites sans DLC sont renvoyees en dernier plutot qu'en tete : en SQLite,
    NULL trie avant toute valeur, ce que l'on neutralise avec le CASE.
    """
    lignes = db.execute(
        """
        SELECT * FROM inventaire_frigo
        WHERE statut_fin IS NULL
        ORDER BY
            CASE WHEN date_peremption_effective IS NULL THEN 1 ELSE 0 END,
            date_peremption_effective ASC,
            id ASC;
        """
    ).fetchall()
    return [Produit(**dict(ligne)) for ligne in lignes]


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def vider_frigo(db: sqlite3.Connection = Depends(get_db)) -> Response:
    """Supprime tout l'inventaire, historique compris (bouton "Vider le frigo")."""
    db.execute("DELETE FROM inventaire_frigo;")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{produit_id}", response_model=Produit)
def modifier_produit(
    produit_id: int,
    patch: ProduitPatch,
    db: sqlite3.Connection = Depends(get_db),
) -> Produit:
    champs = {
        cle: valeur
        for cle, valeur in patch.model_dump(exclude_unset=True).items()
        if cle in CHAMPS_PATCHABLES
    }
    if "categorie" in champs:
        champs["categorie"] = normaliser(champs["categorie"])
    if champs:
        assignations = ", ".join(f"{cle} = ?" for cle in champs)
        db.execute(
            f"UPDATE inventaire_frigo SET {assignations} WHERE id = ?;",
            [*champs.values(), produit_id],
        )
    return _charger(db, produit_id)


@router.post("/{produit_id}/ouvrir", response_model=Produit)
def ouvrir_produit(produit_id: int, db: sqlite3.Connection = Depends(get_db)) -> Produit:
    """Marque l'unite ouverte et recalcule sa DLC effective depuis aujourd'hui."""
    produit = _charger(db, produit_id)
    duree = produit.duree_apres_ouverture if produit.duree_apres_ouverture is not None else 3
    nouvelle_dlc = date.fromordinal(date.today().toordinal() + duree).isoformat()

    db.execute(
        "UPDATE inventaire_frigo SET est_ouvert = 1, date_peremption_effective = ? WHERE id = ?;",
        (nouvelle_dlc, produit_id),
    )
    return _charger(db, produit_id)


@router.post("/{produit_id}/statut", response_model=Produit)
def cloturer_produit(
    produit_id: int,
    corps: StatutPatch,
    db: sqlite3.Connection = Depends(get_db),
) -> Produit:
    _charger(db, produit_id)
    db.execute(
        "UPDATE inventaire_frigo SET statut_fin = ?, date_fin = ? WHERE id = ?;",
        (corps.statut, _aujourdhui(), produit_id),
    )
    return _charger(db, produit_id)


@router.delete("/{produit_id}/statut", response_model=Produit)
def rouvrir_produit(produit_id: int, db: sqlite3.Connection = Depends(get_db)) -> Produit:
    """Annulation du "consomme"/"jete" : remet l'unite dans l'inventaire actif."""
    _charger(db, produit_id)
    db.execute(
        "UPDATE inventaire_frigo SET statut_fin = NULL, date_fin = NULL WHERE id = ?;",
        (produit_id,),
    )
    return _charger(db, produit_id)


@router.delete("/{produit_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_produit(produit_id: int, db: sqlite3.Connection = Depends(get_db)) -> Response:
    """Effacement definitif : reserve aux erreurs de saisie, pas au gaspillage."""
    curseur = db.execute("DELETE FROM inventaire_frigo WHERE id = ?;", (produit_id,))
    if curseur.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produit introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def inserer_lot(db: sqlite3.Connection, unite: UniteACreer, count: int) -> str:
    """Insere `count` unites physiques individuelles partageant un meme lot_id.

    Expose au niveau du module car la preparation d'un plat range elle aussi le
    resultat dans le frigo, sous la forme d'un lot de portions.
    """
    lot_id = _nouveau_lot_id()

    db.executemany(
        """
        INSERT INTO inventaire_frigo
            (nom, categorie, date_achat, est_ouvert, duree_apres_ouverture,
             date_peremption_effective, est_un_reste, lot_id, statut_fin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL);
        """,
        [
            (
                unite.nom,
                normaliser(unite.categorie),
                unite.date_achat,
                unite.est_ouvert,
                unite.duree_apres_ouverture,
                unite.date_peremption_effective,
                unite.est_un_reste,
                lot_id,
            )
        ]
        * count,
    )
    return lot_id


@router_lots.post("", response_model=LotCree, status_code=status.HTTP_201_CREATED)
def creer_lot(corps: LotACreer, db: sqlite3.Connection = Depends(get_db)) -> LotCree:
    """Cree `count` unites physiques individuelles partageant un meme lot_id."""
    lot_id = inserer_lot(db, corps.unite, corps.count)
    return LotCree(lot_id=lot_id, unites=_charger_lot(db, lot_id))


@router_lots.get("/{lot_id}", response_model=list[Produit])
def lire_lot(lot_id: str, db: sqlite3.Connection = Depends(get_db)) -> list[Produit]:
    return _charger_lot(db, lot_id)


@router_lots.patch("/{lot_id}", response_model=list[Produit])
def modifier_lot(
    lot_id: str,
    patch: LotPatch,
    db: sqlite3.Connection = Depends(get_db),
) -> list[Produit]:
    """Renomme / recategorise toutes les unites du lot d'un coup."""
    champs = patch.model_dump(exclude_unset=True)
    if "categorie" in champs:
        champs["categorie"] = normaliser(champs["categorie"])
    if champs:
        assignations = ", ".join(f"{cle} = ?" for cle in champs)
        db.execute(
            f"UPDATE inventaire_frigo SET {assignations} WHERE lot_id = ?;",
            [*champs.values(), lot_id],
        )
    return _charger_lot(db, lot_id)


reference_router = APIRouter(tags=["reference"])


@reference_router.get("/categories", response_model=list[CategorieDefaut])
def lister_categories() -> list[CategorieDefaut]:
    """Liste fermee des categories et durees de conservation par defaut.

    L'IHM s'en sert pour la liste deroulante et pour proposer une DLC des que
    l'utilisateur choisit une categorie.
    """
    return [
        CategorieDefaut(
            nom=c.nom,
            conservation_jours=c.conservation_jours,
            apres_ouverture_jours=c.apres_ouverture_jours,
        )
        for c in CATEGORIES
    ]


stats_router = APIRouter(tags=["stats"])


@stats_router.get("/stats", response_model=Stats)
def lire_stats(db: sqlite3.Connection = Depends(get_db)) -> Stats:
    compteurs = dict(
        db.execute(
            """
            SELECT statut_fin, COUNT(*) FROM inventaire_frigo
            WHERE statut_fin IS NOT NULL GROUP BY statut_fin;
            """
        ).fetchall()
    )

    top = db.execute(
        """
        SELECT nom, COUNT(*) AS count FROM inventaire_frigo
        WHERE statut_fin = 'jete'
        GROUP BY nom ORDER BY count DESC, nom ASC LIMIT 5;
        """
    ).fetchall()

    recents = db.execute(
        """
        SELECT id, nom, statut_fin, date_fin FROM inventaire_frigo
        WHERE statut_fin IS NOT NULL
        ORDER BY date_fin DESC, id DESC LIMIT 10;
        """
    ).fetchall()

    return Stats(
        totalConsomme=compteurs.get("consomme", 0),
        totalJete=compteurs.get("jete", 0),
        topJete=[TopJete(**dict(r)) for r in top],
        recents=[MouvementRecent(**dict(r)) for r in recents],
    )


def _charger(db: sqlite3.Connection, produit_id: int) -> Produit:
    ligne = db.execute("SELECT * FROM inventaire_frigo WHERE id = ?;", (produit_id,)).fetchone()
    if ligne is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produit introuvable.")
    return Produit(**dict(ligne))


def _charger_lot(db: sqlite3.Connection, lot_id: str) -> list[Produit]:
    lignes = db.execute(
        "SELECT * FROM inventaire_frigo WHERE lot_id = ? ORDER BY id ASC;", (lot_id,)
    ).fetchall()
    if not lignes:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lot introuvable.")
    return [Produit(**dict(ligne)) for ligne in lignes]
