import GlassCard from './GlassCard'
import Icon from './Icon'
import StatusDot from './StatusDot'
import { formatDateAffichage, joursRestants, libelleJours } from '../utils/date'
import { couleurUrgence, urgenceLevel } from '../utils/urgence'
import { uniteLaPlusUrgente, type ProduitGroupe } from '../utils/grouping'
import styles from './ProductGroupCard.module.css'

type Props = {
  groupe: ProduitGroupe
  onPress: () => void
  /** Plats prévus qui ont réservé une part de ce lot. */
  reservations?: { nom: string; quantite: number }[]
}

export default function ProductGroupCard({ groupe, onPress, reservations = [] }: Props) {
  const urgente = uniteLaPlusUrgente(groupe)
  const jours = joursRestants(urgente.date_peremption_effective)
  const couleur = couleurUrgence(urgenceLevel(jours))

  return (
    <button
      type="button"
      className={styles.bouton}
      onClick={onPress}
      style={{ boxShadow: `0 5px 10px color-mix(in srgb, ${couleur} 20%, transparent)` }}
    >
      <GlassCard>
        <div className={styles.entete}>
          <span className={styles.nom}>{groupe.nom}</span>
          <span className={styles.enteteDroite}>
            {groupe.unites.length > 1 && (
              <span className={styles.badge}>x{groupe.unites.length}</span>
            )}
            <StatusDot couleur={couleur} />
          </span>
        </div>
        <p className={styles.dateAchat}>
          {/* `est_un_reste` etait ecrit puis jamais relu : la case a cocher de
              l'ajout manuel ne produisait aucun effet observable. Elle change
              desormais le libelle, ce qui distingue un produit achete d'un plat
              cuisine — y compris les portions issues d'une preparation. */}
          {urgente.est_un_reste ? 'Préparé le ' : 'Acheté le '}
          {formatDateAffichage(urgente.date_achat)}
        </p>
        <p className={styles.compteur} style={{ color: couleur }}>
          {libelleJours(jours)}
        </p>

        {reservations.length > 0 && (
          <p className={styles.reserve}>
            <Icon nom="plat" taille={14} />
            <span className={styles.reserveNoms}>
              {reservations.map((r) => r.nom).join(', ')}
            </span>
            <span className={styles.reservePart}>
              ×{reservations.reduce((total, r) => total + r.quantite, 0)}
            </span>
          </p>
        )}
      </GlassCard>
    </button>
  )
}
