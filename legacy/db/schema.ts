import { db } from './client';

export function initSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS inventaire_frigo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      categorie TEXT,
      quantite REAL DEFAULT 1,
      date_achat TEXT,
      date_peremption_initiale TEXT,
      est_ouvert INTEGER DEFAULT 0,
      duree_apres_ouverture INTEGER,
      date_peremption_effective TEXT,
      est_un_reste INTEGER DEFAULT 0,
      lot_id TEXT,
      statut_fin TEXT
    );
  `);

  const colonnes = db.getAllSync<{ name: string }>(`PRAGMA table_info(inventaire_frigo);`);
  const noms = colonnes.map((c) => c.name);

  if (!noms.includes('lot_id')) {
    db.execSync(`ALTER TABLE inventaire_frigo ADD COLUMN lot_id TEXT;`);
    db.execSync(`UPDATE inventaire_frigo SET lot_id = 'legacy_' || id WHERE lot_id IS NULL;`);
  }
  if (!noms.includes('statut_fin')) {
    db.execSync(`ALTER TABLE inventaire_frigo ADD COLUMN statut_fin TEXT;`);
  }
  if (!noms.includes('date_fin')) {
    db.execSync(`ALTER TABLE inventaire_frigo ADD COLUMN date_fin TEXT;`);
  }
}