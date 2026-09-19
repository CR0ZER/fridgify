import { Link, useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Plat } from '../api/types'
import { numeroSection } from '../components/BarreNavigation'
import { useConfirm } from '../components/ConfirmDialog'
import { ErreurServeur, Squelette } from '../components/EtatDonnees'
import { Echeance, Tranche } from '../components/Urgence'
import { useAction, useDonnees } from '../hooks/useDonnees'
import { dateCourte, joursRestants, pluriel } from '../utils/date'
import { niveauUrgence } from '../utils/urgence'
import styles from './Plats.module.css'

/** « Tomates ×2 · Feta ×1 » */
export const libelleIngredients = (plat: Plat) =>
  plat.ingredients.map((i) => `${i.nom} ×${i.quantite}`).join(' · ')

export default function Plats() {
  const { donnees: plats, erreur, recharger } = useDonnees(api.listerPlats)
  const { agir, erreur: erreurAction } = useAction(recharger)
  const { confirmer, dialogue } = useConfirm()
  const naviguer = useNavigate()

  if (!plats) {
    return erreur ? <ErreurServeur message={erreur} onReessayer={recharger} /> : <Squelette />
  }

  // L'API renvoie déjà les plats prévus du plus urgent au moins urgent.
  const prevus = plats.filter((p) => p.statut === 'prevu')
  const prepares = plats.filter((p) => p.statut === 'prepare')

  const retirer = async (plat: Plat) => {
    const accepte = await confirmer({
      titre: 'Confirmer — retrait',
      message: `« ${plat.nom} » disparaîtra de l’historique. Les portions déjà rangées au frigo ne sont pas touchées.`,
      action: 'Retirer',
    })
    if (accepte) await agir(() => api.supprimerPlat(plat.id))
  }

  return (
    <main className="page">
      <header className="entete-page">
        <p className="kicker">{numeroSection('/plats')} · Plats</p>
        <h1 className="titre">Plats</h1>
      </header>
      <div className={styles.nouveau}>
        <button type="button" className="btn btn-plein" onClick={() => naviguer('/plats/nouveau')}>
          Nouveau plat
        </button>
      </div>

      {(erreur || erreurAction) && <p className="erreur">{erreur ?? erreurAction}</p>}

      {plats.length === 0 && (
        <div className="vide">
          <div className="vide-cadre" />
          <h2 className="vide-titre">Aucun plat prévu.</h2>
          <p className="texte-aide">
            Un plat réserve des produits déjà au frigo, sans rien consommer. Vous les consommez à la
            préparation.
          </p>
        </div>
      )}

      {prevus.length > 0 && <h2 className="intertitre" style={{ paddingTop: 6 }}>À préparer ({prevus.length})</h2>}
      {prevus.map((plat) => {
        const jours = joursRestants(plat.date_limite)
        return (
          <Link key={plat.id} to={`/plats/${plat.id}`} className={styles.plat}>
            <Tranche niveau={niveauUrgence(jours)} />
            <div className={styles.platCorps}>
              <div className={styles.platHaut}>
                <div className={styles.platTextes}>
                  <div className={styles.nom}>{plat.nom}</div>
                  {plat.note && <div className={styles.note}>{plat.note}</div>}
                </div>
                <Echeance jours={jours} />
              </div>
              <div className="meta">{libelleIngredients(plat)}</div>
              {plat.ingredients.some((i) => i.insuffisant) && (
                <span className="pastille" style={{ color: 'var(--danger)' }}>
                  Stock insuffisant
                </span>
              )}
            </div>
          </Link>
        )
      })}

      {prepares.length > 0 && <h2 className="intertitre">Préparés ({prepares.length})</h2>}
      {prepares.map((plat) => (
        <section key={plat.id} className={styles.prepare}>
          <h3 className={styles.prepareNom}>{plat.nom}</h3>
          <p className="meta">
            Préparé le {dateCourte(plat.date_preparation)}
            {plat.portions ? ` · ${pluriel(plat.portions, 'portion')} rangée${plat.portions > 1 ? 's' : ''}` : ''}
          </p>
          <p className={styles.note}>{libelleIngredients(plat)}</p>
          <button type="button" className={`btn btn-discret ${styles.retirer}`} onClick={() => retirer(plat)}>
            Retirer de l'historique
          </button>
        </section>
      ))}

      {dialogue}
    </main>
  )
}
