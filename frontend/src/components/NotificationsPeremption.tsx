import { useCallback, useEffect, useState } from 'react'

import { api } from '../api/client'
import type { EtatPush } from '../api/types'
import { abonnementCourant, activer, desactiver, etatSupport, type EtatSupport } from '../utils/push'
import styles from './NotificationsPeremption.module.css'

/** Ce qui manque, expliqué plutôt que résumé en « indisponible ». */
const OBSTACLES: Record<Exclude<EtatSupport, 'ok'>, { texte: string; geste?: string }> = {
  'non-securise': {
    texte:
      "Frigo est ouvert en HTTP. Les notifications web exigent une connexion chiffrée : rouvrez l'application depuis son adresse HTTPS.",
  },
  'ios-hors-ecran-accueil': {
    texte:
      "Frigo est ouvert dans Safari, pas installé sur l'écran d'accueil. iOS n'autorise les notifications que pour les applications installées.",
    geste: "Partager → Sur l'écran d'accueil",
  },
  'non-supporte': { texte: 'Ce navigateur ne gère pas les notifications web.' },
}

export default function NotificationsPeremption({ onErreur }: { onErreur: (message: string) => void }) {
  const [support] = useState<EtatSupport>(etatSupport)
  const [etat, setEtat] = useState<EtatPush | null>(null)
  const [actifIci, setActifIci] = useState(false)
  const [enCours, setEnCours] = useState(false)

  const charger = useCallback(async () => {
    try {
      // L'état du serveur d'abord : `abonnementCourant` attend le service
      // worker, qui peut ne jamais être prêt (serveur de développement).
      const serveur = await api.etatPush()
      setEtat(serveur)
      const abonnement = await abonnementCourant()
      // Un abonnement peut exister côté navigateur sans être connu du serveur
      // (base réinitialisée, clés VAPID changées) : les deux doivent concorder.
      setActifIci(abonnement !== null && serveur.appareils.length > 0)
    } catch (e) {
      onErreur(e instanceof Error ? e.message : 'Lecture impossible.')
    }
  }, [onErreur])

  useEffect(() => {
    void charger()
  }, [charger])

  const basculer = async () => {
    setEnCours(true)
    try {
      if (actifIci) {
        const endpoint = await desactiver()
        if (endpoint) await api.desabonnerPush(endpoint)
      } else {
        if (!etat?.cle_publique) throw new Error('Le serveur ne fournit pas de clé publique.')
        await api.abonnerPush(await activer(etat.cle_publique))
      }
      await charger()
    } catch (e) {
      onErreur(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setEnCours(false)
    }
  }

  const obstacle = support !== 'ok' ? OBSTACLES[support] : null
  const sansCles = support === 'ok' && etat !== null && !etat.disponible
  const bloque = obstacle !== null || sansCles
  const seuil = etat && etat.seuil_jours > 1 ? `${etat.seuil_jours} jours` : 'un jour'

  return (
    <>
      {(obstacle || sansCles) && (
        <section className={`encadre ${styles.obstacle}`}>
          <h3 className="encadre-titre">Activation impossible</h3>
          <div className={styles.obstacleCorps}>
            <p>
              {obstacle
                ? obstacle.texte
                : "Le serveur n'a pas de clés VAPID. Générez-les avec python -m app.push, reportez-les dans backend/.env, puis redémarrez l'API."}
            </p>
            {obstacle?.geste && <p className={styles.geste}>{obstacle.geste}</p>}
          </div>
        </section>
      )}

      <div className={styles.alerte} data-bloque={bloque}>
        <div className={styles.alerteTextes}>
          <span className={styles.alerteTitre} id="alerte-quotidienne">
            Alerte quotidienne à 9 h
          </span>
          <span className={styles.alerteAide}>
            Sur cet appareil, pour ce qui périme sous {seuil} ou est déjà périmé. Rien n'est envoyé
            si aucun produit n'est concerné.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          className="interrupteur"
          aria-checked={actifIci && !bloque}
          aria-labelledby="alerte-quotidienne"
          onClick={basculer}
          disabled={bloque || enCours || etat === null}
        />
      </div>
    </>
  )
}
