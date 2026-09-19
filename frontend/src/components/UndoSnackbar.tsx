import { useEffect } from 'react'

import styles from './UndoSnackbar.module.css'

type Props = {
  message: string | null
  onUndo: () => void
  onTimeout: () => void
  dureeMs?: number
}

export default function UndoSnackbar({ message, onUndo, onTimeout, dureeMs = 4000 }: Props) {
  useEffect(() => {
    if (!message) return
    const minuterie = setTimeout(onTimeout, dureeMs)
    return () => clearTimeout(minuterie)
  }, [message, onTimeout, dureeMs])

  if (!message) return null

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <div className={styles.barre}>
        <span className={styles.texte}>{message}</span>
        <button type="button" className={styles.annuler} onClick={onUndo}>
          Annuler
        </button>
      </div>
    </div>
  )
}
