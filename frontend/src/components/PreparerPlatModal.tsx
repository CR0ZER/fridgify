import { useEffect, useId, useState } from 'react'

import { api } from '../api/client'
import type { Plat } from '../api/types'
import { ajouterJoursISO, aujourdHuiISO } from '../utils/date'
import DateField from './DateField'
import GlassCard from './GlassCard'
import Icon from './Icon'
import Modal from './Modal'
import Stepper from './Stepper'
import styles from './PreparerPlatModal.module.css'

const DUREE_RESTE_PAR_DEFAUT = 3

type Props = {
  plat: Plat | null
  onClose: () => void
  onPrepare: () => void | Promise<void>
  onErreur: (message: string) => void
}

export default function PreparerPlatModal({ plat, onClose, onPrepare, onErreur }: Props) {
  const [portions, setPortions] = useState(2)
  const [dlc, setDlc] = useState('')
  const [enCours, setEnCours] = useState(false)
  const titreId = useId()

  useEffect(() => {
    if (!plat) return
    setPortions(2)
    setDlc(ajouterJoursISO(aujourdHuiISO(), DUREE_RESTE_PAR_DEFAUT))
  }, [plat])

  if (!plat) return null

  const preparer = async () => {
    setEnCours(true)
    try {
      await api.preparerPlat(plat.id, {
        portions,
        date_peremption_effective: dlc || null,
        duree_apres_ouverture: DUREE_RESTE_PAR_DEFAUT,
      })
      await onPrepare()
    } catch (e) {
      onErreur(e instanceof Error ? e.message : 'La préparation a échoué.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal ouvert onClose={onClose} labelledBy={titreId}>
      <GlassCard className={styles.carte}>
        <h2 className={styles.titre} id={titreId}>
          Préparer « {plat.nom} »
        </h2>
        <p className={styles.sousTitre}>
          Les ingrédients réservés quittent le frigo, et le plat cuisiné y entre à leur place sous
          forme de portions.
        </p>

        <div className={styles.champ}>
          <span className={styles.champLabel}>Portions obtenues</span>
          <Stepper
            valeur={portions}
            max={50}
            label="portion"
            onChange={(v) => setPortions(Math.max(1, v))}
          />
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <DateField label="À consommer avant" value={dlc} onChange={setDlc} />
        </div>

        <div className={styles.bilan}>
          <p className={styles.bilanTitre}>Ce qui va se passer</p>
          <p className={styles.bilanLigne}>
            <span className={styles.puceConsomme}>
              <Icon nom="moins" taille={16} epaisseur={2.4} />
            </span>
            <span>
              {plat.ingredients.map((i) => `${i.nom} ×${i.quantite}`).join(', ')} — ces unités
              quittent l'inventaire et sont comptées comme consommées.
            </span>
          </p>
          <p className={styles.bilanLigne}>
            <span className={styles.puceAjoute}>
              <Icon nom="plus" taille={16} epaisseur={2.4} />
            </span>
            <span>
              {portions} portion{portions > 1 ? 's' : ''} de « {plat.nom} », rangée
              {portions > 1 ? 's' : ''} en reste maison.
            </span>
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primaire"
            onClick={preparer}
            disabled={enCours}
          >
            {enCours ? 'Préparation…' : 'C’est préparé'}
          </button>
          <button type="button" className="btn btn-secondaire" onClick={onClose} disabled={enCours}>
            Annuler
          </button>
        </div>
      </GlassCard>
    </Modal>
  )
}
