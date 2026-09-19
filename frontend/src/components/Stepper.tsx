import Icon from './Icon'
import styles from './Stepper.module.css'

type Props = {
  valeur: number
  max: number
  pas?: number
  onChange: (valeur: number) => void
  label: string
}

export default function Stepper({ valeur, max, pas = 1, onChange, label }: Props) {
  // Une unite est indivisible : on ne compte qu'en entiers, bornes comprises.
  const cadrer = (v: number) => Math.round(Math.min(Math.max(v, 0), max))

  return (
    <div className={valeur > 0 ? `${styles.stepper} ${styles.actif}` : styles.stepper}>
      <button
        type="button"
        className={styles.bouton}
        onClick={() => onChange(cadrer(valeur - pas))}
        disabled={valeur <= 0}
        aria-label={`Retirer ${label}`}
      >
        <Icon nom="moins" taille={18} epaisseur={2.2} />
      </button>
      <span className={styles.valeur} aria-live="polite">
        {valeur}
      </span>
      <button
        type="button"
        className={styles.bouton}
        onClick={() => onChange(cadrer(valeur + pas))}
        disabled={valeur >= max}
        aria-label={`Ajouter ${label}`}
      >
        <Icon nom="plus" taille={18} epaisseur={2.2} />
      </button>
    </div>
  )
}
