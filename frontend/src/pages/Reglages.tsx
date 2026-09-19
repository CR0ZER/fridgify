import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, type Health } from '../api/client'
import { CLE_PROMPT_SCAN } from '../api/types'
import { useConfirm } from '../components/ConfirmDialog'
import GlassCard from '../components/GlassCard'
import Icon from '../components/Icon'
import NotificationsPeremption from '../components/NotificationsPeremption'
import PromptEditorModal from '../components/PromptEditorModal'
import StatusDot from '../components/StatusDot'
import styles from './Reglages.module.css'

type PromptEnEdition = { cle: string; titre: string; valeur: string; defaut: string }

export default function Reglages() {
  const [defauts, setDefauts] = useState<Record<string, string>>({})
  const [sante, setSante] = useState<Health | null>(null)
  const [edition, setEdition] = useState<PromptEnEdition | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const { confirmer, dialogue } = useConfirm()
  const naviguer = useNavigate()

  const charger = useCallback(async () => {
    try {
      const [reglages, etat] = await Promise.all([api.reglagesParDefaut(), api.health()])
      setDefauts(reglages)
      setSante(etat)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  const ouvrirPrompt = async (cle: string, titre: string) => {
    try {
      const { value } = await api.lireReglage(cle)
      setEdition({ cle, titre, valeur: value ?? defauts[cle] ?? '', defaut: defauts[cle] ?? '' })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Lecture impossible.')
    }
  }

  const viderFrigo = async () => {
    const accepte = await confirmer({
      titre: 'Vider le frigo',
      message:
        'Ceci supprime tous les produits enregistrés, historique et statistiques compris. Action irréversible.',
      action: 'Supprimer tout',
      destructif: true,
    })
    if (!accepte) return

    try {
      await api.viderFrigo()
      setMessage('Inventaire vidé.')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

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
          Réglages
        </h1>
      </header>

      <GlassCard className={styles.carte}>
        <h2 className="section-label">Prompt personnalisé</h2>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.boutonPrompt}
            onClick={() => ouvrirPrompt(CLE_PROMPT_SCAN, 'Prompt — Scan de ticket')}
          >
            Modifier le prompt de scan
          </button>
        </div>
        <p className={styles.aide}>
          Le prompt est enregistré sur la Raspberry, donc partagé par tous vos appareils.
        </p>
      </GlassCard>

      <NotificationsPeremption onErreur={setErreur} />

      <GlassCard className={styles.carte}>
        <h2 className="section-label">Serveur</h2>
        <div className={styles.diagnostic}>
          <span>Connexion à l'API</span>
          <span className={styles.valeur}>
            <StatusDot couleur={sante ? 'var(--fresh)' : 'var(--critical)'} taille={8} />
            {sante ? 'établie' : 'indisponible'}
          </span>
        </div>
        <div className={styles.diagnostic}>
          <span>Clé Gemini</span>
          <span className={styles.valeur}>
            <StatusDot
              couleur={sante?.gemini_configure ? 'var(--fresh)' : 'var(--warning)'}
              taille={8}
            />
            {sante?.gemini_configure ? 'configurée' : 'absente'}
          </span>
        </div>
        <div className={styles.diagnostic}>
          <span>Clés de notification</span>
          <span className={styles.valeur}>
            <StatusDot
              couleur={sante?.push_configure ? 'var(--fresh)' : 'var(--warning)'}
              taille={8}
            />
            {sante?.push_configure ? 'configurées' : 'absentes'}
          </span>
        </div>
        <div className={styles.diagnostic}>
          <span>Authentification API</span>
          <span className={styles.valeur}>
            <StatusDot
              couleur={sante?.auth_active ? 'var(--fresh)' : 'var(--warning)'}
              taille={8}
            />
            {sante?.auth_active ? 'active' : 'désactivée'}
          </span>
        </div>
        <p className={styles.aide}>
          Le modèle utilisé pour le scan se règle côté serveur, dans{' '}
          <code>backend/.env</code>.
        </p>
      </GlassCard>

      <GlassCard className={styles.carte}>
        <h2 className="section-label">Données</h2>
        <button type="button" className="btn btn-danger" onClick={viderFrigo}>
          Vider le frigo
        </button>
        {message && <p className={styles.aide}>{message}</p>}
      </GlassCard>

      {erreur && <p className="erreur">{erreur}</p>}

      <PromptEditorModal
        ouvert={edition !== null}
        titre={edition?.titre ?? ''}
        valeurCourante={edition?.valeur ?? ''}
        valeurParDefaut={edition?.defaut ?? ''}
        onClose={() => setEdition(null)}
        onSave={async (valeur) => {
          if (!edition) return
          try {
            await api.ecrireReglage(edition.cle, valeur)
            setEdition(null)
            setMessage('Prompt enregistré.')
          } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
          }
        }}
        onReset={async () => {
          if (!edition) return
          try {
            await api.reinitialiserReglage(edition.cle)
          } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Réinitialisation impossible.')
          }
        }}
      />
      {dialogue}
    </main>
  )
}
