import type { Plat, Produit } from '../api/types'
import { joursRestants } from './date'

export type ProduitGroupe = {
  lot_id: string
  nom: string
  categorie: string | null
  unites: Produit[]
}

/** Une unite sans DLC ne doit jamais passer devant une unite datee. */
const SANS_DLC = Number.POSITIVE_INFINITY

const urgence = (unite: Produit) => joursRestants(unite.date_peremption_effective) ?? SANS_DLC

export function uniteLaPlusUrgente(groupe: ProduitGroupe): Produit {
  return [...groupe.unites].sort((a, b) => urgence(a) - urgence(b))[0]
}

export function grouperParLot(produits: Produit[]): ProduitGroupe[] {
  const parLot = new Map<string, Produit[]>()
  for (const produit of produits) {
    const unites = parLot.get(produit.lot_id)
    if (unites) unites.push(produit)
    else parLot.set(produit.lot_id, [produit])
  }

  return Array.from(parLot.values())
    .map((unites) => ({
      lot_id: unites[0].lot_id,
      nom: unites[0].nom,
      categorie: unites[0].categorie,
      unites,
    }))
    .sort((a, b) => urgence(uniteLaPlusUrgente(a)) - urgence(uniteLaPlusUrgente(b)))
}

export type Reservation = { nom: string; quantite: number }

/** lot_id -> plats prévus qui en réservent une part. */
export function reservationsParLot(plats: Plat[]): Map<string, Reservation[]> {
  const index = new Map<string, Reservation[]>()
  for (const plat of plats) {
    if (plat.statut !== 'prevu') continue
    for (const ingredient of plat.ingredients) {
      const liste = index.get(ingredient.lot_id) ?? []
      liste.push({ nom: plat.nom, quantite: ingredient.quantite })
      index.set(ingredient.lot_id, liste)
    }
  }
  return index
}

export const totalReserve = (reservations: Reservation[] = []) =>
  reservations.reduce((total, r) => total + r.quantite, 0)
