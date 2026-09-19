/** Date courte « 15/09 », à la manière des étiquettes de la maquette. */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [, mois, jour] = iso.slice(0, 10).split('-')
  if (!mois || !jour) return iso
  return `${jour}/${mois}`
}

/**
 * Nombre de jours entre aujourd'hui et la DLC.
 *
 * La date ISO est reconstruite composante par composante plutot que via
 * `new Date(iso)` : ce dernier interprete "2026-08-28" en UTC, ce qui decale
 * d'un jour le resultat des le fuseau francais.
 */
export function joursRestants(dateEffective: string | null | undefined): number | null {
  if (!dateEffective) return null
  const [annee, mois, jour] = dateEffective.split('-').map(Number)
  if (!annee || !mois || !jour) return null

  const aujourdHui = new Date()
  aujourdHui.setHours(0, 0, 0, 0)
  const expiration = new Date(annee, mois - 1, jour)

  return Math.round((expiration.getTime() - aujourdHui.getTime()) / 86_400_000)
}

/** Date du jour au format ISO, dans le fuseau local. */
export function aujourdHuiISO(): string {
  return versISO(new Date())
}

export function ajouterJoursISO(iso: string, jours: number): string {
  const [annee, mois, jour] = iso.split('-').map(Number)
  return versISO(new Date(annee, mois - 1, jour + jours))
}

function versISO(date: Date): string {
  const decalage = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - decalage).toISOString().slice(0, 10)
}

/** Compte à rebours compact : « J-3 », « J-0 », « J+2 » une fois périmé. */
export function jeton(jours: number | null): string {
  if (jours === null) return '—'
  if (jours < 0) return `J+${-jours}`
  return `J-${jours}`
}

/** Ce que le jeton veut dire, en toutes lettres. */
export function legende(jours: number | null): string {
  if (jours === null) return 'date inconnue'
  if (jours < 0) return `périmé depuis ${-jours}j`
  if (jours === 0) return 'périme aujourd’hui'
  if (jours === 1) return 'périme demain'
  return 'jours restants'
}

/** « 1 unité », « 3 unités »… */
export function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`
}
