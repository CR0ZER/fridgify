import type { Produit } from '../api/types'
import { joursRestants } from './date'

export type ProduitGroupe = {
  lot_id: string
  nom: string
  categorie: string | null
  unites: Produit[]
}

/** Une unite sans DLC ne doit jamais passer devant une unite datee. */
const SANS_DLC = Number.POSITIVE_INFINITY

export function urgenceDuGroupe(groupe: ProduitGroupe): number {
  return Math.min(...groupe.unites.map((u) => joursRestants(u.date_peremption_effective) ?? SANS_DLC))
}

export function uniteLaPlusUrgente(groupe: ProduitGroupe): Produit {
  return [...groupe.unites].sort(
    (a, b) =>
      (joursRestants(a.date_peremption_effective) ?? SANS_DLC) -
      (joursRestants(b.date_peremption_effective) ?? SANS_DLC),
  )[0]
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
    .sort((a, b) => urgenceDuGroupe(a) - urgenceDuGroupe(b))
}
