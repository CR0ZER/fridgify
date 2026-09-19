import { useEffect, useId, useState } from 'react'

import GlassCard from './GlassCard'
import Modal from './Modal'
import styles from './PromptEditorModal.module.css'

type Props = {
  ouvert: boolean
  titre: string
  valeurCourante: string
  valeurParDefaut: string
  onClose: () => void
  onSave: (valeur: string) => void
  onReset: () => void
}

export default function PromptEditorModal({
  ouvert,
  titre,
  valeurCourante,
  valeurParDefaut,
  onClose,
  onSave,
  onReset,
}: Props) {
  const [texte, setTexte] = useState(valeurCourante)
  const titreId = useId()

  useEffect(() => {
    setTexte(valeurCourante)
  }, [valeurCourante, ouvert])

  return (
    <Modal ouvert={ouvert} onClose={onClose} dense labelledBy={titreId}>
      <GlassCard className={styles.carte}>
        <h2 className={styles.titre} id={titreId}>
          {titre}
        </h2>
        <textarea
          className={styles.zone}
          value={texte}
          onChange={(event) => setTexte(event.target.value)}
          spellCheck={false}
          aria-label={titre}
        />
        <div className={styles.actions}>
          <button type="button" className="btn btn-primaire" onClick={() => onSave(texte)}>
            Enregistrer
          </button>
          <button
            type="button"
            className="btn btn-secondaire"
            onClick={() => {
              setTexte(valeurParDefaut)
              onReset()
            }}
          >
            Réinitialiser au défaut
          </button>
        </div>
      </GlassCard>
    </Modal>
  )
}
