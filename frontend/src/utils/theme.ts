/**
 * Thème clair / sombre, choisi dans les réglages et mémorisé sur l'appareil.
 *
 * « Selon le téléphone » ne pose aucun attribut : le CSS suit alors
 * `prefers-color-scheme`. Les deux autres choix posent `data-theme` sur <html>,
 * qui prime sur la media query (voir styles/theme.css).
 *
 * Le même script est dupliqué en ligne dans index.html pour appliquer le thème
 * avant le premier rendu : sans cela, l'application clignoterait dans la
 * mauvaise palette à chaque ouverture.
 */

export type PreferenceTheme = 'auto' | 'clair' | 'sombre'

const CLE = 'fridgify-theme'
const FOND = { clair: '#e4e9e3', sombre: '#16191a' } as const

const sombreSysteme = window.matchMedia('(prefers-color-scheme: dark)')

export function lirePreference(): PreferenceTheme {
  try {
    const valeur = localStorage.getItem(CLE)
    return valeur === 'clair' || valeur === 'sombre' ? valeur : 'auto'
  } catch {
    return 'auto'
  }
}

export function choisirTheme(preference: PreferenceTheme): void {
  try {
    if (preference === 'auto') localStorage.removeItem(CLE)
    else localStorage.setItem(CLE, preference)
  } catch {
    /* navigation privée : le choix vaut pour la session seulement */
  }
  appliquerTheme()
}

export function appliquerTheme(): void {
  const preference = lirePreference()
  const theme = preference === 'auto' ? (sombreSysteme.matches ? 'sombre' : 'clair') : preference

  if (preference === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', preference)

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', FOND[theme])
  // iOS lit l'icône au moment de l'ajout à l'écran d'accueil : la changer ici
  // prépare la prochaine installation, pas l'icône déjà posée.
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', `/apple-touch-icon-${theme}.png`)
  document.querySelector('link[rel="icon"]')?.setAttribute('href', `/favicon-${theme}.png`)
}

// En mode automatique, suivre le téléphone quand il bascule pendant l'usage.
sombreSysteme.addEventListener('change', appliquerTheme)
