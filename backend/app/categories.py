"""Categories de produits et durees de conservation par defaut.

Source unique de verite : le prompt de scan, l'ecran d'ajout manuel et le
pre-remplissage des DLC lisent tous cette liste. Ajouter une categorie ici la
fait apparaitre partout, sans risque de divergence entre le modele et l'IHM.

Les durees sont des ordres de grandeur pour une conservation au refrigerateur.
Elles ne servent qu'a proposer une date : l'utilisateur la corrige toujours.
"""

import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class Categorie:
    nom: str
    #: Duree de conservation, produit ferme, a compter de l'achat.
    conservation_jours: int
    #: Duree restante une fois l'emballage ouvert.
    apres_ouverture_jours: int


CATEGORIES: tuple[Categorie, ...] = (
    Categorie("Laitage", 7, 3),
    Categorie("Viande", 3, 1),
    Categorie("Poisson", 2, 1),
    Categorie("Légume", 6, 3),
    Categorie("Fruit", 6, 3),
    Categorie("Plat préparé", 3, 2),
    Categorie("Autre", 5, 3),
)

CATEGORIE_PAR_DEFAUT = "Autre"

NOMS = tuple(c.nom for c in CATEGORIES)


def _cle(valeur: str) -> str:
    """Forme comparable d'un nom : sans accent, sans casse, sans pluriel."""
    decompose = unicodedata.normalize("NFKD", valeur)
    sans_accents = "".join(c for c in decompose if not unicodedata.combining(c))
    return sans_accents.casefold().strip().rstrip("s")


_PAR_CLE = {_cle(c.nom): c for c in CATEGORIES}


def normaliser(nom: str | None) -> str:
    """Ramene une categorie libre vers la liste fermee.

    Gemini reste un modele de langage : malgre la consigne, il renvoie parfois
    « Légumes » ou « laitages ». On rattache ces variantes au lieu de laisser
    l'inventaire se fragmenter en filtres quasi identiques ; tout ce qui reste
    inconnu tombe dans « Autre ».
    """
    if not nom or not nom.strip():
        return CATEGORIE_PAR_DEFAUT
    trouvee = _PAR_CLE.get(_cle(nom))
    return trouvee.nom if trouvee else CATEGORIE_PAR_DEFAUT


def categorie(nom: str | None) -> Categorie:
    """Categorie correspondante, celle par defaut si le nom est inconnu."""
    return _PAR_CLE.get(_cle(nom or ""), _PAR_CLE[_cle(CATEGORIE_PAR_DEFAUT)])
