import { db } from './client';

export function initSettingsSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(`SELECT value FROM settings WHERE key = ?;`, [key]);
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  db.runSync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value]
  );
}

export function deleteSetting(key: string) {
  db.runSync(`DELETE FROM settings WHERE key = ?;`, [key]);
}