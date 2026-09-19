import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import { ErreurServeur, Squelette } from '../components/EtatDonnees'
import Stepper from '../components/Stepper'
import { useDonnees } from '../hooks/useDonnees'
import { ajouterJoursISO, aujourdHuiISO, pluriel } from '../utils/date'
import styles from './PreparerPlat.module.css'

/** Un reste maison se garde trois jours : c'est la DLC proposée aux portions. */
const DUREE_RESTE = 3

export default function PreparerPlat() {
  const id = Number(useParams().platId)
  const { donnees: plat, erreur, recharger } = useDonnees(useCallback(() => api.lirePlat(id), [id]))
  const [portions, setPortions] = useState(2)
  const [dlc, setDlc] = useState(() => ajouterJoursISO(aujourdHuiISO(), DUREE_RESTE))
  const [enCours, setEnCours] = useState(false)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const naviguer = useNavigate()

  if (!plat) {
    return erreur ? <ErreurServeur message={erreur} onReessayer={recharger} /> : <Squelette />
  }
  if (plat.statut !== 'prevu') return <Navigate to="/plats" replace />

  const preparer = async () => {
    setEnCours(true)
    try {
      await api.preparerPlat(plat.id, {
        portions,
        date_peremption_effective: dlc || null,
        duree_apres_ouverture: DUREE_RESTE,
      })
      naviguer('/plats')
    } catch (e) {
      setErreurAction(e instanceof Error ? e.message : 'La préparation a échoué.')
      setEnCours(false)
    }
  }

  // Ce qui partira vraiment : si une unité a été jetée depuis la réservation,
  // la préparation consomme ce qui reste, sans échouer.
  const consommes = plat.ingredients
    .map((i) => `${i.nom} ×${Math.min(i.quantite, i.stock)}`)
    .join(', ')

  return (
    <main className="page">
      <header className="entete-page" style={{ paddingTop: 2 }}>
        <button type="button" className="retour" onClick={() => naviguer(`/plats/${plat.id}`)}>
          ‹&nbsp; Retour
        </button>
        <p className="kicker" style={{ letterSpacing: '0.16em' }}>
          Préparation
        </p>
        <h1 className="titre-moyen" style={{ marginTop: 7 }}>
          {plat.nom}
        </h1>
      </header>

      <div className={styles.champs}>
        <div className="champ-etiquete">
          <span className="etiquette">Portions obtenues</span>
          <Stepper className={styles.portions} valeur={portions} min={1} max={50} onChange={setPortions} label="une portion" />
          <span className={styles.aide}>Entier de 1 à 50.</span>
        </div>
        <label className="champ-etiquete">
          <span className="etiquette">DLC des portions</span>
          <input className="champ champ-mono" type="date" value={dlc} onChange={(e) => setDlc(e.target.value)} />
        </label>
      </div>

      <section className={`encadre ${styles.bilan}`}>
        <h2 className="encadre-titre">Ce qui va se passer</h2>
        <div className={styles.bilanCorps}>
          <p>{consommes} : ces unités quittent l’inventaire et sont comptées comme consommées</p>
          <p>
            {pluriel(portions, 'portion')} de « {plat.nom} » rangée{portions > 1 ? 's' : ''} en reste
            maison
          </p>
        </div>
      </section>

      {erreurAction && <p className="erreur">{erreurAction}</p>}

      <div className={`duo ${styles.actions}`}>
        <button type="button" className="btn" onClick={() => naviguer(`/plats/${plat.id}`)} disabled={enCours}>
          Annuler
        </button>
        <button type="button" className={`btn btn-plein ${styles.valider}`} onClick={preparer} disabled={enCours}>
          {enCours ? 'Préparation…' : 'Valider la préparation'}
        </button>
      </div>
    </main>
  )
}
