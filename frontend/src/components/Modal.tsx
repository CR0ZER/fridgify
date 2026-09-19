import { useEffect, useRef, type ReactNode } from 'react'

import styles from './Modal.module.css'

/**
 * Nombre de modales ouvertes simultanement.
 *
 * Sauvegarder puis restaurer `body.overflow` dans chaque modale ne tient pas
 * quand elles s'imbriquent, car l'ordre des effets de React entre deux
 * composants n'est pas garanti. Un simple compteur rend l'operation
 * commutative : le defilement revient exactement quand la derniere se ferme.
 */
let modalesOuvertes = 0

function verrouillerDefilement(): () => void {
  if (modalesOuvertes === 0) {
    document.body.style.overflow = 'hidden'
  }
  modalesOuvertes += 1

  let liberee = false
  return () => {
    if (liberee) return
    liberee = true
    modalesOuvertes -= 1
    if (modalesOuvertes === 0) {
      document.body.style.overflow = ''
    }
  }
}

type Props = {
  ouvert: boolean
  onClose: () => void
  children: ReactNode
  /** `feuille` monte du bas de l'écran ; `centre` est une boîte de dialogue. */
  forme?: 'feuille' | 'centre'
  labelledBy?: string
}

export default function Modal({ ouvert, onClose, children, forme = 'feuille', labelledBy }: Props) {
  // Passe par une ref pour que l'effet ne depende que de `ouvert` : sans cela,
  // chaque rendu du parent recreerait `onClose` et relancerait le verrou.
  const fermeture = useRef(onClose)
  fermeture.current = onClose

  useEffect(() => {
    if (!ouvert) return

    const surEchap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fermeture.current()
    }
    document.addEventListener('keydown', surEchap)
    const liberer = verrouillerDefilement()

    return () => {
      document.removeEventListener('keydown', surEchap)
      liberer()
    }
  }, [ouvert])

  if (!ouvert) return null

  return (
    <div
      className={`${styles.voile} ${styles[forme]}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClose}
    >
      <div className={styles.fenetre} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
