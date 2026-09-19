import { jeton, legende } from '../utils/date'
import { niveauUrgence, type Niveau } from '../utils/urgence'
import styles from './Urgence.module.css'

/** Barre verticale en bord de ligne, colorée selon l'urgence. */
export function Tranche({ niveau }: { niveau: Niveau }) {
  return <div className={styles.tranche} data-niveau={niveau} aria-hidden />
}

/** « J-3 » et sa légende, alignés à droite d'une ligne. */
export function Echeance({ jours, grand = false }: { jours: number | null; grand?: boolean }) {
  const niveau = niveauUrgence(jours)
  return (
    <div className={styles.echeance}>
      <div className={grand ? `${styles.jeton} ${styles.grand}` : styles.jeton} data-niveau={niveau}>
        {jeton(jours)}
      </div>
      <div className={styles.legende} data-niveau={niveau}>
        {legende(jours)}
      </div>
    </div>
  )
}

/** Le jeton seul, pour les en-têtes où la légende est écrite à côté. */
export function Jeton({ jours }: { jours: number | null }) {
  return (
    <span className={styles.jeton} data-niveau={niveauUrgence(jours)}>
      {jeton(jours)}
    </span>
  )
}

/**
 * Une graduation par unité du lot : on voit d'un coup d'œil combien il en reste
 * et, en bleu, combien sont déjà promises à un plat.
 */
export function Graduations({
  nombre,
  reservees,
  niveau,
}: {
  nombre: number
  reservees: number
  niveau: Niveau
}) {
  // Au-delà de 14, les traits ne se comptent plus à l'œil : le libellé prend le relais.
  const traits = Array.from({ length: Math.min(nombre, 14) }, (_, index) => index < reservees)
  return (
    <div className={styles.graduations} data-niveau={niveau} aria-hidden>
      {traits.map((reserve, index) => (
        <div key={index} className={reserve ? `${styles.trait} ${styles.reserve}` : styles.trait} />
      ))}
    </div>
  )
}
