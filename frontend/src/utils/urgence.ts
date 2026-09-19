export type NiveauUrgence = 'fresh' | 'warning' | 'critical'

export function urgenceLevel(jours: number | null): NiveauUrgence {
  if (jours === null) return 'fresh'
  if (jours <= 1) return 'critical'
  if (jours <= 3) return 'warning'
  return 'fresh'
}

/** Renvoie la variable CSS correspondante, utilisable en style inline. */
export function couleurUrgence(niveau: NiveauUrgence): string {
  return `var(--${niveau})`
}
