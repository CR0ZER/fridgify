export type StatutFin = 'consomme' | 'jete'

export type Produit = {
  id: number
  nom: string
  categorie: string | null
  date_achat: string | null
  est_ouvert: number
  duree_apres_ouverture: number | null
  date_peremption_effective: string | null
  est_un_reste: number
  lot_id: string
  statut_fin: StatutFin | null
  date_fin: string | null
}

export type UniteACreer = {
  nom: string
  categorie: string | null
  date_achat: string | null
  est_ouvert: number
  duree_apres_ouverture: number | null
  date_peremption_effective: string | null
  est_un_reste: number
}

export type LotCree = { lot_id: string; unites: Produit[] }

export type TopJete = { nom: string; count: number }

export type MouvementRecent = Pick<Produit, 'id' | 'nom' | 'statut_fin' | 'date_fin'>

export type Stats = {
  totalConsomme: number
  totalJete: number
  topJete: TopJete[]
  recents: MouvementRecent[]
}

export type ProduitDetecte = { nom: string; categorie: string; quantite: number }

/** Catégorie de la liste fermée, avec ses durées de conservation indicatives. */
export type Categorie = {
  nom: string
  conservation_jours: number
  apres_ouverture_jours: number
}

export const CLE_PROMPT_SCAN = 'prompt_scan'

export type StatutCourse = 'a_acheter' | 'achete'

/** Un plat qui fait envie, noté pour les prochaines courses. */
export type Course = {
  id: number
  nom: string
  note: string | null
  statut: StatutCourse
  date_creation: string
  date_achat: string | null
}

export type StatutPlat = 'prevu' | 'prepare'

export type IngredientReserve = {
  lot_id: string
  quantite: number
}

export type IngredientDetaille = IngredientReserve & {
  nom: string
  categorie: string | null
  date_peremption_effective: string | null
  /** Stock encore actif sur ce lot, toutes réservations confondues. */
  stock: number
  /** Le stock est passé sous la quantité réservée depuis la création du plat. */
  insuffisant: boolean
}

export type Plat = {
  id: number
  nom: string
  note: string | null
  statut: StatutPlat
  date_creation: string
  date_preparation: string | null
  lot_resultat: string | null
  /** Portions créées par la préparation, sorties du frigo comprises. */
  portions: number | null
  ingredients: IngredientDetaille[]
  /** DLC la plus proche parmi les ingrédients : la date avant laquelle cuisiner. */
  date_limite: string | null
}

export type DisponibiliteLot = {
  lot_id: string
  nom: string
  categorie: string | null
  date_peremption_effective: string | null
  stock: number
  reserve: number
  disponible: number
}

export type PreparationPlat = {
  portions: number
  date_peremption_effective?: string | null
  duree_apres_ouverture?: number | null
}

export type AppareilAbonne = {
  appareil: string
  date_creation: string
  dernier_succes: string | null
}

export type EtatPush = {
  /** Clé publique VAPID à passer à `pushManager.subscribe`. */
  cle_publique: string | null
  /** Faux si les clés VAPID manquent au serveur. */
  disponible: boolean
  seuil_jours: number
  appareils: AppareilAbonne[]
}

/** Le compte connecté, tel que l'écran « Compte » l'affiche. */
export type Profil = {
  identifiant: string
  date_creation: string
  lots: number
  unites: number
  /** Fin de la session en cours, au format ISO. */
  expiration: string
  /** Scans de ticket encore disponibles aujourd'hui. */
  scans_restants: number
}

export type Identifiants = {
  identifiant: string
  mot_de_passe: string
  rester_connecte: boolean
}
