import { useCallback } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useConfirm } from '../components/ConfirmDialog'
import { ErreurServeur, Squelette } from '../components/EtatDonnees'
import { Jeton } from '../components/Urgence'
import { useAction, useDonnees } from '../hooks/useDonnees'
import { dateCourte, joursRestants } from '../utils/date'
import styles from './DetailPlat.module.css'

export default function DetailPlat() {
  const id = Number(useParams().platId)
  const { donnees: plat, erreur, recharger } = useDonnees(useCallback(() => api.lirePlat(id), [id]))
  const { agir, erreur: erreurAction } = useAction(recharger)
  const { confirmer, dialogue } = useConfirm()
  const naviguer = useNavigate()

  if (!plat) {
    return erreur ? <ErreurServeur message={erreur} onReessayer={recharger} /> : <Squelette />
  }
  // Un plat préparé n'a plus rien à réserver : sa trace vit dans la liste.
  if (plat.statut !== 'prevu') return <Navigate to="/plats" replace />

  const insuffisant = plat.ingredients.some((i) => i.insuffisant)

  const annuler = async () => {
    const accepte = await confirmer({
      titre: 'Confirmer — annulation',
      message: `« ${plat.nom} » sera annulé et ses ingrédients redeviendront disponibles. Rien n’est consommé.`,
      action: 'Annuler le plat',
      destructif: true,
    })
    if (accepte && (await agir(() => api.supprimerPlat(plat.id)))) naviguer('/plats')
  }

  return (
    <main className="page">
      <header className={`collant ${styles.entete}`}>
        <button type="button" className="retour" onClick={() => naviguer('/plats')}>
          ‹&nbsp; Plats
        </button>
        <h1 className={styles.nom}>{plat.nom}</h1>
        <div className={styles.limite}>
          <Jeton jours={joursRestants(plat.date_limite)} />
          <span className="meta">
            {plat.date_limite ? `Date limite ${dateCourte(plat.date_limite)}` : 'Sans date limite'}
          </span>
        </div>
      </header>

      {plat.note && <p className={styles.note}>{plat.note}</p>}
      {(erreur || erreurAction) && <p className="erreur">{erreur ?? erreurAction}</p>}

      <h2 className="intertitre" style={{ paddingTop: 18 }}>
        Ingrédients réservés
      </h2>
      {plat.ingredients.map((ingredient) => (
        <div
          key={ingredient.lot_id}
          className={ingredient.insuffisant ? `${styles.ingredient} ${styles.manque}` : styles.ingredient}
        >
          <div className={styles.ingredientTextes}>
            <span className={styles.ingredientNom}>{ingredient.nom}</span>
            <span className="meta" style={{ fontSize: 9 }}>
              {ingredient.stock} en stock{ingredient.insuffisant && ' — insuffisant'}
            </span>
          </div>
          <span className={styles.quantite}>×{ingredient.quantite}</span>
        </div>
      ))}

      {insuffisant && (
        <p className={styles.alerte}>
          Le stock est passé sous la quantité réservée. En préparant, seul ce qui reste réellement au
          frigo sera consommé.
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-plein btn-grand"
          onClick={() => naviguer(`/plats/${plat.id}/preparer`)}
        >
          Préparer ce plat
        </button>
        <button type="button" className="btn" onClick={() => naviguer(`/plats/${plat.id}/modifier`)}>
          Modifier
        </button>
        <button type="button" className="btn btn-danger" onClick={annuler}>
          Annuler le plat
        </button>
      </div>
      {dialogue}
    </main>
  )
}
