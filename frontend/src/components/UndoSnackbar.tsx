import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { demanderActualisation } from '../hooks/useDonnees'
import styles from './UndoSnackbar.module.css'

const DUREE_MS = 4000

type Proposition = { message: string; annuler: () => Promise<void> | void; cle: number }

const Contexte = createContext<(message: string, annuler: Proposition['annuler']) => void>(() => {})

/**
 * Propose d'annuler la dernière action pendant 4 secondes.
 *
 * Vit au niveau de l'application et non de l'écran : consommer la dernière
 * unité d'un lot ramène à l'inventaire, et l'annulation doit survivre à ce
 * changement d'écran.
 */
export function AnnulationProvider({ children }: { children: ReactNode }) {
  const [proposition, setProposition] = useState<Proposition | null>(null)
  const compteur = useRef(0)

  const proposer = useCallback((message: string, annuler: Proposition['annuler']) => {
    compteur.current += 1
    setProposition({ message, annuler, cle: compteur.current })
  }, [])

  useEffect(() => {
    if (!proposition) return
    const minuterie = setTimeout(() => setProposition(null), DUREE_MS)
    return () => clearTimeout(minuterie)
  }, [proposition])

  const annuler = async () => {
    const courante = proposition
    setProposition(null)
    await courante?.annuler()
    demanderActualisation()
  }

  return (
    <Contexte.Provider value={proposer}>
      {children}
      {proposition && (
        <div className={styles.barre} role="status" aria-live="polite" key={proposition.cle}>
          <div className={styles.contenu}>
            <span className={styles.texte}>{proposition.message}</span>
            <button type="button" className={styles.annuler} onClick={annuler}>
              Annuler
            </button>
          </div>
          <div className={styles.jauge}>
            <div className={styles.niveau} style={{ animationDuration: `${DUREE_MS}ms` }} />
          </div>
        </div>
      )}
    </Contexte.Provider>
  )
}

export const useAnnulation = () => useContext(Contexte)
