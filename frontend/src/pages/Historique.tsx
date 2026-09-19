import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Stats } from '../api/types'
import GlassCard from '../components/GlassCard'
import Icon from '../components/Icon'
import StatusDot from '../components/StatusDot'
import { useRechargementAuRetour } from '../hooks/useRechargementAuRetour'
import { formatDateAffichage } from '../utils/date'
import styles from './Historique.module.css'

export default function Historique() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const naviguer = useNavigate()

  const charger = useCallback(async () => {
    try {
      setStats(await api.stats())
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])
  useRechargementAuRetour(charger)

  const total = stats ? stats.totalConsomme + stats.totalJete : 0
  const partConsomme = total > 0 ? stats!.totalConsomme / total : 0

  return (
    <main className="page">
      <header className={styles.entete}>
        <button
          type="button"
          className={styles.retour}
          onClick={() => naviguer('/')}
          aria-label="Retour à l'inventaire"
        >
          <Icon nom="retour" taille={24} />
        </button>
        <h1 className="titre-page" style={{ marginBottom: 0 }}>
          Historique
        </h1>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}
      {!stats && !erreur && <div className="spinner" />}

      {stats && total === 0 && <p className="vide">Aucun produit terminé pour l'instant.</p>}

      {stats && total > 0 && (
        <>
          <GlassCard>
            <div className={styles.grandNombre}>
              <strong className={styles.pourcent}>{Math.round(partConsomme * 100)}%</strong>
              <span className={styles.pourcentLabel}>consommé plutôt que jeté</span>
            </div>

            <div
              className={styles.barre}
              role="img"
              aria-label={`${stats.totalConsomme} consommés, ${stats.totalJete} jetés`}
            >
              <div className={styles.barreConsomme} style={{ flex: partConsomme || 0.001 }} />
              <div className={styles.barreJete} style={{ flex: 1 - partConsomme || 0.001 }} />
            </div>

            <div className={styles.legende}>
              <span className={styles.legendeItem}>
                <StatusDot couleur="var(--fresh)" taille={8} />
                {stats.totalConsomme} consommés
              </span>
              <span className={styles.legendeItem}>
                <StatusDot couleur="var(--critical)" taille={8} />
                {stats.totalJete} jetés
              </span>
            </div>
          </GlassCard>

          {stats.topJete.length > 0 && (
            <GlassCard className={styles.carte}>
              <h2 className="section-label">Souvent jetés</h2>
              {stats.topJete.map((item) => (
                <div key={item.nom} className={styles.rangTop}>
                  <span className={styles.topNom}>{item.nom}</span>
                  <span className={styles.topCount}>{item.count}×</span>
                </div>
              ))}
            </GlassCard>
          )}

          {stats.recents.length > 0 && (
            <GlassCard className={styles.carte}>
              <h2 className="section-label">Derniers mouvements</h2>
              {stats.recents.map((item) => (
                <div key={item.id} className={styles.mouvement}>
                  <span
                    className={`${styles.badge} ${
                      item.statut_fin === 'consomme' ? styles.badgeConsomme : styles.badgeJete
                    }`}
                  >
                    {item.statut_fin === 'consomme' ? 'Consommé' : 'Jeté'}
                  </span>
                  <span className={styles.mouvementNom}>{item.nom}</span>
                  <span className={styles.mouvementDate}>{formatDateAffichage(item.date_fin)}</span>
                </div>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </main>
  )
}
