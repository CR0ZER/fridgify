import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import utilisateur_courant
from ..comptes import Utilisateur
from ..db import get_db
from ..models import Course, CourseACreer, CoursePatch

router = APIRouter(prefix="/courses", tags=["courses"])


def _nettoyer_note(note: str | None) -> str | None:
    return (note or "").strip() or None


def _charger(db: sqlite3.Connection, utilisateur: Utilisateur, course_id: int) -> Course:
    ligne = db.execute(
        "SELECT * FROM courses WHERE id = ? AND utilisateur_id = ?;", (course_id, utilisateur.id)
    ).fetchone()
    if ligne is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Envie introuvable.")
    return Course(**dict(ligne))


@router.get("", response_model=list[Course])
def lister_courses(
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> list[Course]:
    """Ce qui reste a acheter dans l'ordre d'ajout, puis les achats du plus recent au plus ancien."""
    lignes = db.execute(
        """
        SELECT * FROM courses
        WHERE utilisateur_id = ?
        ORDER BY CASE statut WHEN 'a_acheter' THEN 0 ELSE 1 END,
                 CASE statut WHEN 'a_acheter' THEN id END ASC,
                 date_achat DESC,
                 id DESC;
        """,
        (utilisateur.id,),
    ).fetchall()
    return [Course(**dict(ligne)) for ligne in lignes]


@router.post("", response_model=Course, status_code=status.HTTP_201_CREATED)
def creer_course(
    corps: CourseACreer,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Course:
    nom = corps.nom.strip()
    if not nom:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Le nom ne peut pas être vide.")

    curseur = db.execute(
        """
        INSERT INTO courses (utilisateur_id, nom, note, statut, date_creation)
        VALUES (?, ?, ?, 'a_acheter', ?);
        """,
        (utilisateur.id, nom, _nettoyer_note(corps.note), date.today().isoformat()),
    )
    return _charger(db, utilisateur, curseur.lastrowid)


@router.delete("/achetes", status_code=status.HTTP_204_NO_CONTENT)
def vider_achetes(
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Response:
    """Retire de la liste tout ce qui a deja ete achete."""
    db.execute(
        "DELETE FROM courses WHERE utilisateur_id = ? AND statut = 'achete';", (utilisateur.id,)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{course_id}", response_model=Course)
def modifier_course(
    course_id: int,
    corps: CoursePatch,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Course:
    _charger(db, utilisateur, course_id)

    champs = corps.model_dump(exclude_unset=True)
    if "nom" in champs:
        champs["nom"] = (champs["nom"] or "").strip()
        if not champs["nom"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Le nom ne peut pas être vide.")
    if "note" in champs:
        champs["note"] = _nettoyer_note(champs["note"])

    if champs:
        assignations = ", ".join(f"{cle} = ?" for cle in champs)
        db.execute(
            f"UPDATE courses SET {assignations} WHERE id = ? AND utilisateur_id = ?;",
            [*champs.values(), course_id, utilisateur.id],
        )
    return _charger(db, utilisateur, course_id)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_course(
    course_id: int,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Response:
    curseur = db.execute(
        "DELETE FROM courses WHERE id = ? AND utilisateur_id = ?;", (course_id, utilisateur.id)
    )
    if curseur.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Envie introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{course_id}/achat", response_model=Course)
def marquer_achete(
    course_id: int,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Course:
    course = _charger(db, utilisateur, course_id)
    if course.statut == "achete":
        raise HTTPException(status.HTTP_409_CONFLICT, "Déjà acheté.")

    db.execute(
        "UPDATE courses SET statut = 'achete', date_achat = ? WHERE id = ?;",
        (date.today().isoformat(), course_id),
    )
    return _charger(db, utilisateur, course_id)


@router.delete("/{course_id}/achat", response_model=Course)
def annuler_achat(
    course_id: int,
    db: sqlite3.Connection = Depends(get_db),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
) -> Course:
    """Remet l'envie dans la liste, par exemple apres un achat coche par erreur."""
    _charger(db, utilisateur, course_id)
    db.execute(
        "UPDATE courses SET statut = 'a_acheter', date_achat = NULL WHERE id = ?;",
        (course_id,),
    )
    return _charger(db, utilisateur, course_id)
