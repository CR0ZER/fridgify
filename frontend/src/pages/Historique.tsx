import { api } from '../api/client'
import { numeroSection } from '../components/BarreNavigation'
import { ErreurServeur, Squelette } from '../components/EtatDonnees'
import { useDonnees } from '../hooks/useDonnees'
import { dateCourte } from '../utils/date'
import styles from './Historique.module.css'

export default function Historique() {
  const { donnees: stats, erreur, recharger } = useDonnees(api.stats)

  if (!stats) {
    return erreur ? <ErreurServeur message={erreur} onReessayer={recharger} /> : <Squelette />
  }

  const total = stats.totalConsomme + stats.totalJete
  const plusJete = Math.max(1, ...stats.topJete.map((t) => t.count))

  return (
    <main className="page">
      <header className="entete-page">
        <p className="kicker">{numeroSection('/historique')} · Historique</p>
        <h1 className="titre">Historique</h1>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      {total === 0 && (
        <div className="vide" style={{ paddingTop: 40 }}>
          <h2 className="vide-titre">Aucune sortie pour l'instant.</h2>
          <p className="texte-aide">
            Dès que vous marquerez un produit consommé ou jeté, il apparaîtra ici.
          </p>
        </div>
      )}

      {total > 0 && (
        <>
          <div className={styles.bilan}>
            <div className={styles.pourcentLigne}>
              <strong className={styles.pourcent}>
                {Math.round((stats.totalConsomme / total) * 100)} %
              </strong>
              <span className="etiquette" style={{ fontSize: 10, paddingBottom: 9 }}>
                consommés
              </span>
            </div>
            <div
              className={styles.barre}
              role="img"
              aria-label={`${stats.totalConsomme} consommés, ${stats.totalJete} jetés`}
            >
              <div style={{ width: `${(stats.totalConsomme / total) * 100}%` }} />
              <div className={styles.jete} style={{ width: `${(stats.totalJete / total) * 100}%` }} />
            </div>
            <p className={styles.legende}>
              <span>{stats.totalConsomme} consommés</span>
              <span className={styles.rouge}>{stats.totalJete} jetés</span>
            </p>
          </div>

          {stats.topJete.length > 0 && (
            <>
              <h2 className="intertitre" style={{ paddingTop: 28 }}>
                Les plus jetés
              </h2>
              {stats.topJete.map((item) => (
                <div key={item.nom} className={styles.ligne}>
                  <span className={styles.nom}>{item.nom}</span>
                  <span className={styles.baton} style={{ width: (item.count / plusJete) * 90 + 10 }} />
                  <span className={styles.nombre}>{item.count}</span>
                </div>
              ))}
            </>
          )}

          {stats.recents.length > 0 && (
            <>
              <h2 className="intertitre" style={{ paddingTop: 28 }}>
                Dernières sorties
              </h2>
              {stats.recents.map((item) => (
                <div key={item.id} className={styles.ligne}>
                  <span className={styles.date}>{dateCourte(item.date_fin)}</span>
                  <span className={styles.nom}>{item.nom}</span>
                  <span
                    className="pastille"
                    style={{
                      alignSelf: 'center',
                      fontSize: 8.5,
                      letterSpacing: '0.1em',
                      color: item.statut_fin === 'jete' ? 'var(--acc)' : 'var(--ink)',
                    }}
                  >
                    {item.statut_fin === 'jete' ? 'Jeté' : 'Consommé'}
                  </span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </main>
  )
}
