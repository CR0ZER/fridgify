import styles from './StatusDot.module.css'

type Props = { couleur: string; taille?: number }

export default function StatusDot({ couleur, taille = 10 }: Props) {
  return (
    <span
      className={styles.dot}
      style={{ width: taille, height: taille, color: couleur }}
      aria-hidden="true"
    />
  )
}
