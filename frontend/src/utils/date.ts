const JOURS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']

export function formatDateAffichage(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const [annee, mois, jour] = isoDate.split('-').map(Number)
  if (!annee || !mois || !jour) return isoDate
  const date = new Date(annee, mois - 1, jour)
  const dd = String(jour).padStart(2, '0')
  const mm = String(mois).padStart(2, '0')
  return `${JOURS[date.getDay()]} ${dd}/${mm}`
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
  const maintenant = new Date()
  const decalage = maintenant.getTimezoneOffset() * 60_000
  return new Date(maintenant.getTime() - decalage).toISOString().slice(0, 10)
}

export function ajouterJoursISO(iso: string, jours: number): string {
  const [annee, mois, jour] = iso.split('-').map(Number)
  const date = new Date(annee, mois - 1, jour + jours)
  return aujourdHuiISOde(date)
}

function aujourdHuiISOde(date: Date): string {
  const decalage = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - decalage).toISOString().slice(0, 10)
}

export function libelleJours(jours: number | null): string {
  if (jours === null) return 'Date inconnue'
  if (jours < 0) return `Périmé depuis ${Math.abs(jours)}j`
  if (jours === 0) return "Périme aujourd'hui"
  return `J-${jours}`
}
