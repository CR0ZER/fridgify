import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Plat } from '../api/types'
import { useConfirm } from '../components/ConfirmDialog'
import GlassCard from '../components/GlassCard'
import Icon from '../components/Icon'
import PreparerPlatModal from '../components/PreparerPlatModal'
import StatusDot from '../components/StatusDot'
import { useRechargementAuRetour } from '../hooks/useRechargementAuRetour'
import { formatDateAffichage, joursRestants, libelleJours } from '../utils/date'
import { couleurUrgence, urgenceLevel } from '../utils/urgence'
import styles from './Plats.module.css'

export default function Plats() {
  const [plats, setPlats] = useState<Plat[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [aPreparer, setAPreparer] = useState<Plat | null>(null)
  const { confirmer, dialogue } = useConfirm()
  const naviguer = useNavigate()

  const charger = useCallback(async () => {
    try {
      setPlats(await api.listerPlats())
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])
  useRechargementAuRetour(charger)

  const supprimer = async (plat: Plat) => {
    const accepte = await confirmer({
      titre: plat.statut === 'prevu' ? 'Annuler ce plat' : 'Retirer de l’historique',
      message:
        plat.statut === 'prevu'
          ? `« ${plat.nom} » sera annulé et ses ingrédients redeviendront disponibles. Rien n'est consommé.`
          : `« ${plat.nom} » disparaîtra de l'historique. Les portions déjà rangées au frigo ne sont pas touchées.`,
      action: 'Supprimer',
      destructif: true,
    })
    if (!accepte) return

    try {
      await api.supprimerPlat(plat.id)
      await charger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  const prevus = plats.filter((p) => p.statut === 'prevu')
  const prepares = plats.filter((p) => p.statut === 'prepare')

  return (
    <main className="page">
      <header className={styles.entete}>
        <h1 className="titre-page" style={{ marginBottom: 0 }}>
          Plats
        </h1>
      </header>

      <button type="button" className="btn btn-primaire" onClick={() => naviguer('/plats/nouveau')}>
        <Icon nom="plus" taille={20} epaisseur={2.2} />
        Composer un plat
      </button>

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && <div className="spinner" />}

      {!chargement && !erreur && plats.length === 0 && (
        <p className={styles.vide}>
          <span className={styles.videTitre}>Aucun plat prévu</span>
          Réservez des produits du frigo pour un plat à venir : vous verrez d'un coup d'œil
          combien de temps il vous reste pour le cuisiner, et ce qui reste libre à côté.
        </p>
      )}

      {prevus.length > 0 && <h2 className={styles.section}>À préparer</h2>}
      {prevus.map((plat) => (
        <CartePlat
          key={plat.id}
          plat={plat}
          onPreparer={() => setAPreparer(plat)}
          onModifier={() => naviguer(`/plats/${plat.id}/modifier`)}
          onSupprimer={() => supprimer(plat)}
        />
      ))}

      {prepares.length > 0 && <h2 className={styles.section}>Déjà préparés</h2>}
      {prepares.map((plat) => (
        <CartePlat key={plat.id} plat={plat} onSupprimer={() => supprimer(plat)} />
      ))}

      <PreparerPlatModal
        plat={aPreparer}
        onClose={() => setAPreparer(null)}
        onPrepare={async () => {
          setAPreparer(null)
          await charger()
        }}
        onErreur={setErreur}
      />
      {dialogue}
    </main>
  )
}

type CarteProps = {
  plat: Plat
  onPreparer?: () => void
  onModifier?: () => void
  onSupprimer: () => void
}

function CartePlat({ plat, onPreparer, onModifier, onSupprimer }: CarteProps) {
  const prevu = plat.statut === 'prevu'
  const jours = joursRestants(plat.date_limite)
  const couleur = couleurUrgence(urgenceLevel(jours))
  const incomplet = prevu && plat.ingredients.some((i) => i.insuffisant)

  return (
    <GlassCard
      className={prevu ? styles.carte : `${styles.carte} ${styles.cartePreparee}`}
      style={
        prevu
          ? { boxShadow: `0 5px 10px color-mix(in srgb, ${couleur} 20%, transparent)` }
          : undefined
      }
    >
      <div className={styles.titreLigne}>
        <h3 className={styles.nom}>{plat.nom}</h3>
        {prevu && <StatusDot couleur={couleur} />}
      </div>

      {plat.note && <p className={styles.note}>{plat.note}</p>}

      {prevu && plat.date_limite && (
        <p className={styles.avant}>À cuisiner avant le {formatDateAffichage(plat.date_limite)}</p>
      )}
      {!prevu && plat.date_preparation && (
        <p className={styles.avant}>Préparé le {formatDateAffichage(plat.date_preparation)}</p>
      )}

      {prevu && (
        <p className={styles.compteur} style={{ color: couleur }}>
          {libelleJours(jours)}
        </p>
      )}

      <ul className={styles.ingredients}>
        {plat.ingredients.map((ingredient) => (
          <li
            key={ingredient.lot_id}
            className={
              ingredient.insuffisant && prevu
                ? `${styles.ingredient} ${styles.ingredientManquant}`
                : styles.ingredient
            }
          >
            {ingredient.nom}
            <span className={styles.quantite}>×{ingredient.quantite}</span>
          </li>
        ))}
      </ul>

      {incomplet && (
        <p className={styles.alerte}>
          Le stock est passé sous la quantité réservée. En préparant, seul ce qui reste
          réellement au frigo sera consommé.
        </p>
      )}

      {!prevu && plat.lot_resultat && (
        <p className={styles.resultat}>Les portions ont été rangées dans le frigo.</p>
      )}

      <div className={styles.actions}>
        {prevu && (
          <button type="button" className={`btn btn-primaire ${styles.preparer}`} onClick={onPreparer}>
            <Icon nom="plat" taille={18} />
            Préparer
          </button>
        )}
        {prevu && (
          <button
            type="button"
            className={styles.boutonIcone}
            onClick={onModifier}
            aria-label={`Modifier ${plat.nom}`}
          >
            <Icon nom="crayon" taille={18} />
          </button>
        )}
        <button
          type="button"
          className={`${styles.boutonIcone} ${styles.boutonSupprimer}`}
          onClick={onSupprimer}
          aria-label={prevu ? `Annuler ${plat.nom}` : `Retirer ${plat.nom}`}
          style={prevu ? undefined : { marginLeft: 'auto' }}
        >
          <Icon nom="poubelle" taille={18} />
        </button>
      </div>
    </GlassCard>
  )
}
