import { Produit } from '../db/queries';

export type ProduitGroupe = {
  lot_id: string;
  nom: string;
  categorie: string | null;
  unites: Produit[];
};

export function grouperParLot(produits: Produit[]): ProduitGroupe[] {
  const map = new Map<string, Produit[]>();
  for (const p of produits) {
    if (!map.has(p.lot_id)) map.set(p.lot_id, []);
    map.get(p.lot_id)!.push(p);
  }
  return Array.from(map.values()).map((unites) => ({
    lot_id: unites[0].lot_id,
    nom: unites[0].nom,
    categorie: unites[0].categorie,
    unites,
  }));
}