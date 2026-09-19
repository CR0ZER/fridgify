import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..db import get_db
from ..models import (
    DisponibiliteLot,
    IngredientDetaille,
    IngredientReserve,
    Plat,
    PlatACreer,
    PlatPatch,
    PreparationPlat,
    UniteACreer,
)
from .produits import inserer_lot

router = APIRouter(prefix="/plats", tags=["plats"])
router_dispo = APIRouter(tags=["plats"])

def _aujourdhui() -> str:
    return date.today().isoformat()


def _stock_par_lot(db: sqlite3.Connection) -> dict[str, dict]:
    """Etat courant du frigo, agrege par lot.

    Le stock est un nombre d'unites : chaque ligne d'inventaire_frigo represente
    une unite physique indivisible.
    """
    lignes = db.execute(
        """
        SELECT lot_id,
               MIN(nom) AS nom,
               MIN(categorie) AS categorie,
               COUNT(*) AS stock,
               MIN(date_peremption_effective) AS dlc
        FROM inventaire_frigo
        WHERE statut_fin IS NULL
        GROUP BY lot_id;
        """
    ).fetchall()
    return {ligne["lot_id"]: dict(ligne) for ligne in lignes}


def _reserve_par_lot(db: sqlite3.Connection, hors_plat: int | None = None) -> dict[str, int]:
    """Quantites deja affectees a des plats encore a preparer.

    `hors_plat` exclut un plat du calcul : lors d'une modification, ses propres
    reservations ne doivent pas se compter comme un obstacle a elles-memes.
    """
    requete = """
        SELECT i.lot_id, SUM(i.quantite) AS reserve
        FROM plat_ingredients i
        JOIN plats p ON p.id = i.plat_id
        WHERE p.statut = 'prevu'
    """
    parametres: list = []
    if hors_plat is not None:
        requete += " AND p.id != ?"
        parametres.append(hors_plat)
    requete += " GROUP BY i.lot_id;"

    return {row["lot_id"]: int(row["reserve"]) for row in db.execute(requete, parametres)}


def _verifier_disponibilite(
    db: sqlite3.Connection,
    ingredients: list[IngredientReserve],
    hors_plat: int | None = None,
) -> None:
    """Refuse d'affecter a un plat plus que ce que le frigo contient."""
    lots_vus: set[str] = set()
    stock = _stock_par_lot(db)
    reserve = _reserve_par_lot(db, hors_plat)

    for ingredient in ingredients:
        if ingredient.lot_id in lots_vus:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Le lot {ingredient.lot_id} est présent deux fois dans le plat.",
            )
        lots_vus.add(ingredient.lot_id)

        if ingredient.lot_id not in stock:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Le lot {ingredient.lot_id} n'est plus dans le frigo.",
            )

        libre = stock[ingredient.lot_id]["stock"] - reserve.get(ingredient.lot_id, 0)
        if ingredient.quantite > libre:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"« {stock[ingredient.lot_id]['nom']} » : {ingredient.quantite} "
                f"demandé mais seulement {max(libre, 0)} disponible.",
            )


def _charger_plat(db: sqlite3.Connection, plat_id: int) -> Plat:
    ligne = db.execute("SELECT * FROM plats WHERE id = ?;", (plat_id,)).fetchone()
    if ligne is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plat introuvable.")
    return _composer(db, ligne, _stock_par_lot(db))


def _composer(db: sqlite3.Connection, ligne: sqlite3.Row, stock: dict[str, dict]) -> Plat:
    """Assemble un plat avec ses ingredients resolus et sa date limite."""
    reserves = db.execute(
        "SELECT lot_id, quantite FROM plat_ingredients WHERE plat_id = ? ORDER BY rowid;",
        (ligne["id"],),
    ).fetchall()

    ingredients: list[IngredientDetaille] = []
    echeances: list[str] = []

    for reserve in reserves:
        lot = stock.get(reserve["lot_id"])
        disponible = lot["stock"] if lot else 0

        ingredients.append(
            IngredientDetaille(
                lot_id=reserve["lot_id"],
                quantite=int(reserve["quantite"]),
                nom=lot["nom"] if lot else _nom_historique(db, reserve["lot_id"]),
                categorie=lot["categorie"] if lot else None,
                date_peremption_effective=lot["dlc"] if lot else None,
                stock=disponible,
                insuffisant=int(reserve["quantite"]) > disponible,
            )
        )
        if lot and lot["dlc"]:
            echeances.append(lot["dlc"])

    return Plat(
        id=ligne["id"],
        nom=ligne["nom"],
        note=ligne["note"],
        statut=ligne["statut"],
        date_creation=ligne["date_creation"],
        date_preparation=ligne["date_preparation"],
        lot_resultat=ligne["lot_resultat"],
        portions=_compter_unites(db, ligne["lot_resultat"]),
        ingredients=ingredients,
        # La date limite est celle de l'ingredient le plus presse : au-dela, le
        # plat ne peut plus etre realise tel qu'il a ete prevu.
        date_limite=min(echeances) if echeances else None,
    )


def _nom_historique(db: sqlite3.Connection, lot_id: str) -> str:
    """Nom d'un lot sorti du frigo.

    Consommer ou jeter une unite ne l'efface pas : elle garde son nom, marquee
    d'un statut de fin. Un plat prepare retrouve donc ses ingredients meme une
    fois leurs lots entierement ecoules. Seule une suppression definitive (erreur
    de saisie, frigo vide) fait perdre le nom.
    """
    ligne = db.execute(
        "SELECT MIN(nom) AS nom FROM inventaire_frigo WHERE lot_id = ?;", (lot_id,)
    ).fetchone()
    return ligne["nom"] or "Produit retiré du frigo"


def _compter_unites(db: sqlite3.Connection, lot_id: str | None) -> int | None:
    """Portions rangees au frigo par la preparation, sorties comprises."""
    if lot_id is None:
        return None
    return db.execute(
        "SELECT COUNT(*) FROM inventaire_frigo WHERE lot_id = ?;", (lot_id,)
    ).fetchone()[0]


def _ecrire_ingredients(
    db: sqlite3.Connection, plat_id: int, ingredients: list[IngredientReserve]
) -> None:
    db.execute("DELETE FROM plat_ingredients WHERE plat_id = ?;", (plat_id,))
    if ingredients:
        db.executemany(
            "INSERT INTO plat_ingredients (plat_id, lot_id, quantite) VALUES (?, ?, ?);",
            [(plat_id, i.lot_id, i.quantite) for i in ingredients],
        )


@router_dispo.get("/disponibilites", response_model=list[DisponibiliteLot], tags=["plats"])
def lister_disponibilites(db: sqlite3.Connection = Depends(get_db)) -> list[DisponibiliteLot]:
    """Ce que chaque lot peut encore fournir a un nouveau plat."""
    stock = _stock_par_lot(db)
    reserve = _reserve_par_lot(db)

    lots = [
        DisponibiliteLot(
            lot_id=lot_id,
            nom=lot["nom"],
            categorie=lot["categorie"],
            date_peremption_effective=lot["dlc"],
            stock=lot["stock"],
            reserve=reserve.get(lot_id, 0),
            disponible=max(lot["stock"] - reserve.get(lot_id, 0), 0),
        )
        for lot_id, lot in stock.items()
    ]
    # Le plus urgent en premier : c'est ce qu'il faut cuisiner en priorite.
    lots.sort(key=lambda lot: (lot.date_peremption_effective is None, lot.date_peremption_effective or ""))
    return lots


@router.get("", response_model=list[Plat])
def lister_plats(db: sqlite3.Connection = Depends(get_db)) -> list[Plat]:
    stock = _stock_par_lot(db)
    lignes = db.execute(
        """
        SELECT * FROM plats
        ORDER BY CASE statut WHEN 'prevu' THEN 0 ELSE 1 END,
                 date_preparation DESC,
                 id DESC;
        """
    ).fetchall()
    plats = [_composer(db, ligne, stock) for ligne in lignes]

    # Parmi les plats prevus, le plus urgent d'abord ; ceux sans date ferment la
    # marche. Le tri SQL a deja isole les plats prepares en fin de liste.
    prevus = [p for p in plats if p.statut == "prevu"]
    prevus.sort(key=lambda p: (p.date_limite is None, p.date_limite or ""))
    return prevus + [p for p in plats if p.statut != "prevu"]


@router.post("", response_model=Plat, status_code=status.HTTP_201_CREATED)
def creer_plat(corps: PlatACreer, db: sqlite3.Connection = Depends(get_db)) -> Plat:
    _verifier_disponibilite(db, corps.ingredients)

    curseur = db.execute(
        "INSERT INTO plats (nom, note, statut, date_creation) VALUES (?, ?, 'prevu', ?);",
        (corps.nom.strip(), (corps.note or "").strip() or None, _aujourdhui()),
    )
    plat_id = curseur.lastrowid
    _ecrire_ingredients(db, plat_id, corps.ingredients)
    return _charger_plat(db, plat_id)


@router.get("/{plat_id}", response_model=Plat)
def lire_plat(plat_id: int, db: sqlite3.Connection = Depends(get_db)) -> Plat:
    return _charger_plat(db, plat_id)


@router.patch("/{plat_id}", response_model=Plat)
def modifier_plat(
    plat_id: int, corps: PlatPatch, db: sqlite3.Connection = Depends(get_db)
) -> Plat:
    plat = _charger_plat(db, plat_id)
    if plat.statut != "prevu":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ce plat a déjà été préparé, sa composition ne peut plus changer.",
        )

    champs = corps.model_dump(exclude_unset=True, exclude={"ingredients"})
    if "nom" in champs and champs["nom"]:
        champs["nom"] = champs["nom"].strip()
    if "note" in champs:
        champs["note"] = (champs["note"] or "").strip() or None

    if champs:
        assignations = ", ".join(f"{cle} = ?" for cle in champs)
        db.execute(
            f"UPDATE plats SET {assignations} WHERE id = ?;", [*champs.values(), plat_id]
        )

    if corps.ingredients is not None:
        _verifier_disponibilite(db, corps.ingredients, hors_plat=plat_id)
        _ecrire_ingredients(db, plat_id, corps.ingredients)

    return _charger_plat(db, plat_id)


@router.delete("/{plat_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_plat(plat_id: int, db: sqlite3.Connection = Depends(get_db)) -> Response:
    """Annule un plat. Les ingredients reserves redeviennent disponibles."""
    curseur = db.execute("DELETE FROM plats WHERE id = ?;", (plat_id,))
    if curseur.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plat introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{plat_id}/preparer", response_model=Plat)
def preparer_plat(
    plat_id: int, corps: PreparationPlat, db: sqlite3.Connection = Depends(get_db)
) -> Plat:
    """Consomme les ingredients reserves et range le plat cuisine dans le frigo."""
    plat = _charger_plat(db, plat_id)
    if plat.statut != "prevu":
        raise HTTPException(status.HTTP_409_CONFLICT, "Ce plat a déjà été préparé.")
    if not plat.ingredients:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Ce plat n'a aucun ingrédient : rien à consommer.",
        )

    for ingredient in plat.ingredients:
        _consommer(db, ingredient.lot_id, ingredient.quantite)

    aujourdhui = _aujourdhui()
    duree = corps.duree_apres_ouverture if corps.duree_apres_ouverture is not None else 3
    dlc = corps.date_peremption_effective or date.fromordinal(
        date.today().toordinal() + duree
    ).isoformat()

    lot_resultat = inserer_lot(
        db,
        UniteACreer(
            nom=plat.nom,
            categorie="Plat préparé",
            date_achat=aujourdhui,
            est_ouvert=0,
            duree_apres_ouverture=duree,
            date_peremption_effective=dlc,
            est_un_reste=1,
        ),
        corps.portions,
    )

    db.execute(
        "UPDATE plats SET statut = 'prepare', date_preparation = ?, lot_resultat = ? WHERE id = ?;",
        (aujourdhui, lot_resultat, plat_id),
    )
    return _charger_plat(db, plat_id)


def _consommer(db: sqlite3.Connection, lot_id: str, quantite: int) -> None:
    """Consomme `quantite` unites du lot, de la plus urgente a la moins urgente.

    Cuisiner doit d'abord ecouler ce qui allait perimer. Le LIMIT couvre le cas
    ou des unites ont ete jetees depuis la reservation : on consomme ce qui
    reste, sans echouer.
    """
    unites = db.execute(
        """
        SELECT id FROM inventaire_frigo
        WHERE lot_id = ? AND statut_fin IS NULL
        ORDER BY
            CASE WHEN date_peremption_effective IS NULL THEN 1 ELSE 0 END,
            date_peremption_effective ASC,
            id ASC
        LIMIT ?;
        """,
        (lot_id, quantite),
    ).fetchall()

    if not unites:
        return

    aujourdhui = _aujourdhui()
    db.executemany(
        "UPDATE inventaire_frigo SET statut_fin = 'consomme', date_fin = ? WHERE id = ?;",
        [(aujourdhui, unite["id"]) for unite in unites],
    )
