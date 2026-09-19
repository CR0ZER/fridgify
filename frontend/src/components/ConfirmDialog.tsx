import { useCallback, useId, useRef, useState } from 'react'

import GlassCard from './GlassCard'
import Modal from './Modal'
import styles from './ConfirmDialog.module.css'

type Demande = {
  titre: string
  message: string
  /** Libelle du bouton d'action. Defaut : "Confirmer". */
  action?: string
  destructif?: boolean
}

/**
 * Remplace `Alert.alert` de React Native, qui n'existe pas sur le web, sans
 * retomber sur `window.confirm` dont l'apparence casse le theme sombre.
 *
 * S'utilise de facon imperative :
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
    <Modal ouvert={demande !== null} onClose={() => repondre(false)} labelledBy={titreId}>
      {demande && (
        <GlassCard className={styles.carte}>
          <h2 className={styles.titre} id={titreId}>
            {demande.titre}
          </h2>
          <p className={styles.message}>{demande.message}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={`btn ${demande.destructif ? styles.destructif : 'btn-primaire'}`}
              onClick={() => repondre(true)}
            >
              {demande.action ?? 'Confirmer'}
            </button>
            <button type="button" className="btn btn-secondaire" onClick={() => repondre(false)}>
              Annuler
            </button>
          </div>
        </GlassCard>
      )}
    </Modal>
  )

  return { confirmer, dialogue }
}
