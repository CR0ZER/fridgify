import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import styles from './BarreNavigation.module.css'

/** Les sept sections, dans l'ordre de leur numéro. */
export const SECTIONS = [
  { chemin: '/', libelle: 'Frigo' },
  { chemin: '/ajout', libelle: 'Ajouter' },
  { chemin: '/scan', libelle: 'Scanner' },
  { chemin: '/plats', libelle: 'Plats' },
  { chemin: '/courses', libelle: 'Courses' },
  { chemin: '/historique', libelle: 'Historique' },
  { chemin: '/reglages', libelle: 'Réglages' },
]

/** Numéro de section « 01 »…« 07 », repris en tête de chaque écran. */
export const numeroSection = (chemin: string) =>
  String(SECTIONS.findIndex((s) => s.chemin === chemin) + 1).padStart(2, '0')

/** Le détail d'un lot appartient au Frigo, celui d'un plat aux Plats. */
function sectionCourante(pathname: string) {
  const racine = pathname === '/' || pathname.startsWith('/lot/') ? '/' : `/${pathname.split('/')[1]}`
  return SECTIONS.find((s) => s.chemin === racine) ?? SECTIONS[0]
}

/** Barre basse : la section courante, qui ouvre la liste des sections. */
export default function BarreNavigation() {
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const [ouverte, setOuverte] = useState(false)
  const courante = sectionCourante(pathname)

  useEffect(() => {
    setOuverte(false)
  }, [pathname])

  return (
    <>
      {ouverte && (
        <div className={styles.voile} onClick={() => setOuverte(false)}>
          <nav className={styles.menu} aria-label="Sections" onClick={(e) => e.stopPropagation()}>
            {SECTIONS.map((section) => {
              const active = section === courante
              return (
                <button
                  key={section.chemin}
                  type="button"
                  className={active ? `${styles.entree} ${styles.active}` : styles.entree}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => (active ? setOuverte(false) : naviguer(section.chemin))}
                >
                  <span className={styles.numero}>{numeroSection(section.chemin)}</span>
                  <span className={styles.libelle}>{section.libelle}</span>
                  {active && <span className={styles.marque}>●</span>}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      <div className={styles.barre}>
        <div className={styles.rangee}>
          <button
            type="button"
            className={styles.section}
            onClick={() => setOuverte(!ouverte)}
            aria-expanded={ouverte}
            aria-label={`${courante.libelle}, changer de section`}
          >
            <span className={styles.index}>{numeroSection(courante.chemin)}</span>
            <span className={styles.courante}>{courante.libelle}</span>
            <span className={ouverte ? `${styles.caret} ${styles.caretOuvert}` : styles.caret}>▲</span>
          </button>
        </div>
      </div>
    </>
  )
}
