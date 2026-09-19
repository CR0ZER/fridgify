from typing import Literal

from pydantic import BaseModel, Field

StatutFin = Literal["consomme", "jete"]


class Produit(BaseModel):
    id: int
    nom: str
    categorie: str | None = None
    date_achat: str | None = None
    est_ouvert: int = 0
    duree_apres_ouverture: int | None = None
    date_peremption_effective: str | None = None
    est_un_reste: int = 0
    lot_id: str
    statut_fin: StatutFin | None = None
    date_fin: str | None = None


class UniteACreer(BaseModel):
    nom: str = Field(min_length=1)
    categorie: str | None = None
    date_achat: str | None = None
    est_ouvert: int = 0
    duree_apres_ouverture: int | None = 3
    date_peremption_effective: str | None = None
    est_un_reste: int = 0


class LotACreer(BaseModel):
    unite: UniteACreer
    count: int = Field(default=1, ge=1, le=500)


class LotCree(BaseModel):
    lot_id: str
    unites: list[Produit]


class ProduitPatch(BaseModel):
    nom: str | None = None
    categorie: str | None = None
    date_achat: str | None = None
    date_peremption_effective: str | None = None
    est_un_reste: int | None = None


class LotPatch(BaseModel):
    nom: str | None = None
    categorie: str | None = None


class StatutPatch(BaseModel):
    statut: StatutFin


class TopJete(BaseModel):
    nom: str
    count: int


class MouvementRecent(BaseModel):
    id: int
    nom: str
    statut_fin: StatutFin | None = None
    date_fin: str | None = None


class Stats(BaseModel):
    totalConsomme: int
    totalJete: int
    topJete: list[TopJete]
    recents: list[MouvementRecent]


class Reglage(BaseModel):
    key: str
    value: str | None = None


class ReglageValeur(BaseModel):
    value: str


class CategorieDefaut(BaseModel):
    """Categorie proposee a l'IHM, avec ses durees de conservation indicatives."""

    nom: str
    conservation_jours: int
    apres_ouverture_jours: int


class ProduitDetecte(BaseModel):
    nom: str
    categorie: str
    quantite: int = 1


StatutCourse = Literal["a_acheter", "achete"]


class Course(BaseModel):
    id: int
    nom: str
    note: str | None = None
    statut: StatutCourse
    date_creation: str
    date_achat: str | None = None


class CourseACreer(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    note: str | None = None


class CoursePatch(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=120)
    note: str | None = None


StatutPlat = Literal["prevu", "prepare"]


class IngredientReserve(BaseModel):
    """Ce que l'utilisateur affecte a un plat, en nombre d'unites du lot.

    L'unite est indivisible : sur un lot de 5 tomates, en reserver 2 en laisse
    3 disponibles. Une unite est prise en entier ou pas du tout.
    """

    lot_id: str
    quantite: int = Field(gt=0, le=999)


class IngredientDetaille(IngredientReserve):
    nom: str
    categorie: str | None = None
    date_peremption_effective: str | None = None
    #: Unites encore actives sur ce lot, toutes reservations confondues.
    stock: int = 0
    #: Vrai si le stock est passe sous la quantite reservee (unite jetee depuis).
    insuffisant: bool = False


class Plat(BaseModel):
    id: int
    nom: str
    note: str | None = None
    statut: StatutPlat
    date_creation: str
    date_preparation: str | None = None
    lot_resultat: str | None = None
    ingredients: list[IngredientDetaille] = Field(default_factory=list)
    #: DLC la plus proche parmi les ingredients : la date avant laquelle cuisiner.
    date_limite: str | None = None


class PlatACreer(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    note: str | None = None
    ingredients: list[IngredientReserve] = Field(default_factory=list)


class PlatPatch(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=120)
    note: str | None = None
    #: Remplace integralement la composition quand il est fourni.
    ingredients: list[IngredientReserve] | None = None


class PreparationPlat(BaseModel):
    """Transforme le plat prevu en reste maison range dans le frigo."""

    portions: int = Field(default=1, ge=1, le=50)
    date_peremption_effective: str | None = None
    duree_apres_ouverture: int | None = 3


class DisponibiliteLot(BaseModel):
    lot_id: str
    nom: str
    categorie: str | None = None
    date_peremption_effective: str | None = None
    #: Unites actives dans le frigo pour ce lot.
    stock: int
    #: Deja affectees a des plats prevus.
    reserve: int
    #: stock - reserve, borne a zero.
    disponible: int


class ClesAbonnement(BaseModel):
    """Cles fournies par le navigateur, propres a cet abonnement."""

    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)


class AbonnementPush(BaseModel):
    """Forme exacte de `PushSubscription.toJSON()` cote navigateur."""

    endpoint: str = Field(min_length=1)
    keys: ClesAbonnement


class DesabonnementPush(BaseModel):
    endpoint: str = Field(min_length=1)


class AppareilAbonne(BaseModel):
    appareil: str
    date_creation: str
    dernier_succes: str | None = None


class EtatPush(BaseModel):
    """Ce dont l'IHM a besoin pour afficher et piloter les notifications."""

    #: Cle publique VAPID, a passer a `pushManager.subscribe`. Publique par
    #: nature : elle ne permet que de verifier la signature du serveur.
    cle_publique: str | None = None
    #: Faux si les cles VAPID manquent au serveur : rien ne peut fonctionner.
    disponible: bool = False
    seuil_jours: int = 1
    appareils: list[AppareilAbonne] = Field(default_factory=list)


class ResultatEnvoi(BaseModel):
    envoyes: int
    supprimes: int
    echecs: list[str] = Field(default_factory=list)
