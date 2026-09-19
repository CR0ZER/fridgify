import { useCallback, useEffect, useState } from 'react'

import { api } from '../api/client'
import type { EtatPush } from '../api/types'
import { abonnementCourant, activer, desactiver, etatSupport, type EtatSupport } from '../utils/push'
import GlassCard from './GlassCard'
import Icon from './Icon'
import StatusDot from './StatusDot'
import styles from './NotificationsPeremption.module.css'

/** Ce qui manque, expliqué plutôt que résumé en « indisponible ». */
const OBSTACLES: Record<Exclude<EtatSupport, 'ok'>, string> = {
  'non-securise':
    "Fridgify est ouvert en HTTP. Les notifications web exigent une connexion chiffrée : rouvrez l'application depuis son adresse HTTPS, puis réessayez ici.",
  'ios-hors-ecran-accueil':
    "Sous iOS, seules les applications ajoutées à l'écran d'accueil peuvent recevoir des notifications. Touchez Partager → « Sur l'écran d'accueil », puis ouvrez Fridgify depuis son icône.",
  'non-supporte': "Ce navigateur ne gère pas les notifications web.",
}

export default function NotificationsPeremption({
  onErreur,
}: {
  onErreur: (message: string) => void
}) {
  const [support] = useState<EtatSupport>(etatSupport)
  const [etat, setEtat] = useState<EtatPush | null>(null)
  const [actifIci, setActifIci] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const [serveur, abonnement] = await Promise.all([api.etatPush(), abonnementCourant()])
      setEtat(serveur)
      // Un abonnement peut exister côté navigateur sans être connu du serveur
      // (base réinitialisée, clés VAPID changées) : les deux doivent concorder.
      const connu = abonnement !== null && serveur.appareils.length > 0
      setActifIci(connu)
    } catch (e) {
      onErreur(e instanceof Error ? e.message : 'Lecture impossible.')
    }
  }, [onErreur])

  useEffect(() => {
    void charger()
  }, [charger])

  const basculer = async () => {
    setEnCours(true)
    setMessage(null)
    try {
      if (actifIci) {
        const endpoint = await desactiver()
        if (endpoint) await api.desabonnerPush(endpoint)
        setMessage('Notifications désactivées sur cet appareil.')
      } else {
        if (!etat?.cle_publique) throw new Error('Le serveur ne fournit pas de clé publique.')
        const abonnement = await activer(etat.cle_publique)
        await api.abonnerPush(abonnement)
        setMessage('Cet appareil recevra les alertes de péremption.')
      }
      await charger()
    } catch (e) {
      onErreur(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setEnCours(false)
    }
  }

  const tester = async () => {
    setEnCours(true)
    setMessage(null)
    try {
      const resultat = await api.testerPush()
      setMessage(
        resultat.envoyes > 0
          ? `Envoyé à ${resultat.envoyes} appareil${resultat.envoyes > 1 ? 's' : ''}.`
          : 'Aucun envoi n’a abouti.',
      )
      if (resultat.echecs.length > 0) onErreur(resultat.echecs.join(' · '))
      if (resultat.supprimes > 0) await charger()
    } catch (e) {
      onErreur(e instanceof Error ? e.message : 'Envoi impossible.')
    } finally {
      setEnCours(false)
    }
  }

  const indisponibleServeur = etat !== null && !etat.disponible

  return (
    <GlassCard className={styles.carte}>
      <h2 className="section-label">Notifications de péremption</h2>

      {support !== 'ok' && <p className={styles.note}>{OBSTACLES[support]}</p>}

      {support === 'ok' && indisponibleServeur && (
        <p className={styles.note}>
          Le serveur n'a pas de clés VAPID. Générez-les avec{' '}
          <code>python -m app.push</code>, reportez-les dans <code>backend/.env</code>, puis
          redémarrez l'API.
        </p>
      )}

      {support === 'ok' && etat?.disponible && (
        <>
          <div className={styles.diagnostic}>
            <span>Sur cet appareil</span>
            <span className={styles.valeur}>
              <StatusDot couleur={actifIci ? 'var(--fresh)' : 'var(--text-secondary)'} taille={8} />
              {actifIci ? 'activées' : 'désactivées'}
            </span>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={actifIci ? 'btn btn-secondaire' : 'btn btn-primaire'}
              onClick={basculer}
              disabled={enCours}
            >
              {!actifIci && <Icon nom="cloche" taille={18} />}
              {actifIci ? 'Désactiver sur cet appareil' : 'Activer les notifications'}
            </button>

            {etat.appareils.length > 0 && (
              <button
                type="button"
                className={styles.boutonTest}
                onClick={tester}
                disabled={enCours}
              >
                Envoyer une notification de test
              </button>
            )}
          </div>

          {etat.appareils.length > 0 && (
            <ul className={styles.appareils}>
              {etat.appareils.map((appareil) => (
                <li key={`${appareil.appareil}-${appareil.date_creation}`}>
                  <span>{appareil.appareil}</span>
                  <span className={styles.depuis}>
                    {appareil.dernier_succes
                      ? `dernière alerte le ${appareil.dernier_succes}`
                      : 'jamais alerté'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {message && <p className={styles.confirmation}>{message}</p>}

          <p className={styles.aide}>
            Une alerte par jour, à 9 h, pour ce qui périme sous{' '}
            {etat.seuil_jours <= 1 ? 'un jour' : `${etat.seuil_jours} jours`} — et pour ce qui est
            déjà périmé. Rien ne part si le frigo est sain.
          </p>
        </>
      )}
    </GlassCard>
  )
}
