import { useCallback, useId, useRef, useState } from 'react'

import Modal from './Modal'
import styles from './ConfirmDialog.module.css'

type Demande = {
  /** Bandeau de tête, par exemple « Confirmer — jeté ». */
  titre: string
  message: string
  /** Libellé du bouton d'action. Défaut : « Confirmer ». */
  action?: string
  destructif?: boolean
}

/**
 * Confirmation avant une action qu'on ne peut pas annuler, sans retomber sur
 * `window.confirm` dont l'apparence ignore le thème.
 *
 * S'utilise de façon impérative :
 *   const { confirmer, dialogue } = useConfirm()
 *   if (await confirmer({ titre: '…', message: '…' })) { … }
 */
export function useConfirm() {
  const [demande, setDemande] = useState<Demande | null>(null)
  const resoudre = useRef<((accepte: boolean) => void) | null>(null)
  const titreId = useId()

  const confirmer = useCallback((options: Demande) => {
    return new Promise<boolean>((resolve) => {
      resoudre.current = resolve
      setDemande(options)
    })
  }, [])

  const repondre = useCallback((accepte: boolean) => {
    resoudre.current?.(accepte)
    resoudre.current = null
    setDemande(null)
  }, [])

  const dialogue = (
    <Modal ouvert={demande !== null} onClose={() => repondre(false)} forme="centre" labelledBy={titreId}>
      {demande && (
        <>
          <h2
            className={demande.destructif ? `${styles.tete} ${styles.danger}` : styles.tete}
            id={titreId}
          >
            {demande.titre}
          </h2>
          <div className={styles.corps}>
            <p className={styles.message}>{demande.message}</p>
            <div className="duo">
              <button type="button" className="btn" onClick={() => repondre(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={`btn ${demande.destructif ? 'btn-plein-danger' : 'btn-plein'} ${styles.action}`}
                onClick={() => repondre(true)}
              >
                {demande.action ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )

  return { confirmer, dialogue }
}
