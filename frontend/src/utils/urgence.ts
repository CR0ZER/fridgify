/**
 * Trois niveaux d'urgence, plus l'absence de date.
 *
 * `inconnu` se distingue de `ok` à l'affichage (gris neutre plutôt que vert) :
 * un produit sans DLC n'est pas pour autant un produit sain.
 */
export type Niveau = 'critique' | 'attention' | 'ok' | 'inconnu'

export function niveauUrgence(jours: number | null): Niveau {
  if (jours === null) return 'inconnu'
  if (jours <= 1) return 'critique'
  if (jours <= 3) return 'attention'
  return 'ok'
}
