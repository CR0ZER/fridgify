import styles from './EtatDonnees.module.css'

/** Lignes fantômes le temps du premier chargement. */
export function Squelette() {
  return (
    <div className={styles.squelette} aria-busy="true" aria-label="Chargement">
      <div className={styles.titre} />
      {[70, 55, 80, 60, 75].map((largeur) => (
        <div key={largeur} className={styles.ligne}>
          <div className={styles.tranche} />
          <div className={styles.textes}>
            <div className={styles.nom} style={{ width: `${largeur}%` }} />
            <div className={styles.meta} />
          </div>
          <div className={styles.jeton} />
        </div>
      ))}
    </div>
  )
}

/** Écran d'erreur plein, quand rien n'a pu être chargé. */
export function ErreurServeur({ message, onReessayer }: { message: string; onReessayer: () => void }) {
  return (
    <div className={styles.erreur}>
      <div className={styles.signe}>!</div>
      <h1 className={styles.message}>{message}</h1>
      <p className="texte-aide">
        Les données viennent du serveur domestique. Rien n'est stocké sur ce téléphone.
      </p>
      <button type="button" className="btn btn-plein" onClick={onReessayer}>
        Réessayer
      </button>
    </div>
  )
}
