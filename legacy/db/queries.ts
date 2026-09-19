import { db } from './client';

export type Produit = {
  id: number;
  nom: string;
  categorie: string | null;
  quantite: number;
  date_achat: string | null;
  date_peremption_initiale: string | null;
  est_ouvert: number;
  duree_apres_ouverture: number | null;
  date_peremption_effective: string | null;
  est_un_reste: number;
  lot_id: string;
  statut_fin: string | null; // 'consomme' | 'jete' | null (actif)
  date_fin: string | null;
};

function generateLotId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function insertLot(
  unite: Omit<Produit, 'id' | 'lot_id' | 'statut_fin'>,
  count: number
): string {
  const lotId = generateLotId();
  for (let i = 0; i < count; i++) {
    db.runSync(
      `INSERT INTO inventaire_frigo
        (nom, categorie, quantite, date_achat, date_peremption_initiale, est_ouvert, duree_apres_ouverture, date_peremption_effective, est_un_reste, lot_id, statut_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
      [
        unite.nom,
        unite.categorie,
        1,
        unite.date_achat,
        unite.date_peremption_initiale,
        unite.est_ouvert,
        unite.duree_apres_ouverture,
        unite.date_peremption_effective,
        unite.est_un_reste,
        lotId,
      ]
    );
  }
  return lotId;
}

export function getAllProduits(): Produit[] {
  return db.getAllSync<Produit>(
    `SELECT * FROM inventaire_frigo WHERE statut_fin IS NULL ORDER BY date_peremption_effective ASC;`
  );
}

export function getProduitsByLot(lotId: string): Produit[] {
  return db.getAllSync<Produit>(`SELECT * FROM inventaire_frigo WHERE lot_id = ? ORDER BY id ASC;`, [lotId]);
}

export function getProduitById(id: number): Produit | null {
  return db.getFirstSync<Produit>(`SELECT * FROM inventaire_frigo WHERE id = ?;`, [id]) ?? null;
}

export function toggleOuvert(id: number, nouvelleDateEffective: string) {
  db.runSync(
    `UPDATE inventaire_frigo SET est_ouvert = 1, date_peremption_effective = ? WHERE id = ?;`,
    [nouvelleDateEffective, id]
  );
}

export function updateProduit(
  id: number,
  champs: Partial<Pick<Produit, 'nom' | 'categorie' | 'quantite' | 'date_achat' | 'date_peremption_effective' | 'est_un_reste'>>
) {
  const cles = Object.keys(champs);
  if (cles.length === 0) return;
  const setClause = cles.map((cle) => `${cle} = ?`).join(', ');
  const valeurs = cles.map((cle) => (champs as any)[cle]);
  db.runSync(`UPDATE inventaire_frigo SET ${setClause} WHERE id = ?;`, [...valeurs, id]);
}

export function markUnitFini(id: number, statut: 'consomme' | 'jete') {
  const aujourdHui = new Date().toISOString().split('T')[0];
  db.runSync(`UPDATE inventaire_frigo SET statut_fin = ?, date_fin = ? WHERE id = ?;`, [statut, aujourdHui, id]);
}

export type MouvementRecent = Pick<Produit, 'id' | 'nom' | 'statut_fin' | 'date_fin'>;

export function getRecentMouvements(limit = 10): MouvementRecent[] {
  return db.getAllSync<MouvementRecent>(
    `SELECT id, nom, statut_fin, date_fin FROM inventaire_frigo WHERE statut_fin IS NOT NULL ORDER BY date_fin DESC, id DESC LIMIT ?;`,
    [limit]
  );
}

export function deleteProduit(id: number) {
  db.runSync(`DELETE FROM inventaire_frigo WHERE id = ?;`, [id]);
}

export function unmarkUnitFini(id: number) {
  db.runSync(`UPDATE inventaire_frigo SET statut_fin = NULL, date_fin = NULL WHERE id = ?;`, [id]);
}

export type Stats = {
  totalConsomme: number;
  totalJete: number;
};

export function getStats(): Stats {
  const consomme = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM inventaire_frigo WHERE statut_fin = 'consomme';`);
  const jete = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM inventaire_frigo WHERE statut_fin = 'jete';`);
  return {
    totalConsomme: consomme?.count ?? 0,
    totalJete: jete?.count ?? 0,
  };
}

export type TopJete = { nom: string; count: number };

export function getTopJete(limit = 5): TopJete[] {
  return db.getAllSync<TopJete>(
    `SELECT nom, COUNT(*) as count FROM inventaire_frigo WHERE statut_fin = 'jete' GROUP BY nom ORDER BY count DESC LIMIT ?;`,
    [limit]
  );
}