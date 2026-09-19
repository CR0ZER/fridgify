import { useEffect, useState } from 'react'

import { api, type Health } from '../api/client'
import { CLE_PROMPT_SCAN } from '../api/types'
import { numeroSection } from '../components/BarreNavigation'
import { useConfirm } from '../components/ConfirmDialog'
import NotificationsPeremption from '../components/NotificationsPeremption'
import { choisirTheme, lirePreference, type PreferenceTheme } from '../utils/theme'
import styles from './Reglages.module.css'

const THEMES: [PreferenceTheme, string][] = [
  ['auto', 'Téléphone'],
  ['clair', 'Clair'],
  ['sombre', 'Sombre'],
]

export default function Reglages() {
  const [sante, setSante] = useState<Health | null>(null)
  const [theme, setTheme] = useState(lirePreference)
  const [promptOuvert, setPromptOuvert] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [promptDefaut, setPromptDefaut] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const { confirmer, dialogue } = useConfirm()

  const signaler = (e: unknown, repli: string) => setErreur(e instanceof Error ? e.message : repli)

  useEffect(() => {
    // Sans réponse, l'API est injoignable : le diagnostic le dit tel quel.
    api.health().then(setSante).catch(() => setSante(null))
  }, [])

  const changerTheme = (preference: PreferenceTheme) => {
    choisirTheme(preference)
    setTheme(preference)
  }

  const basculerPrompt = async () => {
    if (promptOuvert) {
      setPromptOuvert(false)
      return
    }
    try {
      const [{ value }, defauts] = await Promise.all([api.lireReglage(CLE_PROMPT_SCAN), api.reglagesParDefaut()])
      setPromptDefaut(defauts[CLE_PROMPT_SCAN] ?? '')
      setPrompt(value ?? defauts[CLE_PROMPT_SCAN] ?? '')
      setPromptOuvert(true)
    } catch (e) {
      signaler(e, 'Lecture impossible.')
    }
  }

  const enregistrerPrompt = async () => {
    try {
      await api.ecrireReglage(CLE_PROMPT_SCAN, prompt)
      setPromptOuvert(false)
      setMessage('Prompt enregistré.')
    } catch (e) {
      signaler(e, 'Enregistrement impossible.')
    }
  }

  const reinitialiserPrompt = async () => {
    try {
      await api.reinitialiserReglage(CLE_PROMPT_SCAN)
      setPrompt(promptDefaut)
      setMessage('Prompt par défaut rétabli.')
    } catch (e) {
      signaler(e, 'Réinitialisation impossible.')
    }
  }

  const viderFrigo = async () => {
    const accepte = await confirmer({
      titre: 'Confirmer — vider le frigo',
      message: 'Tous les produits et tout l’historique seront supprimés. Cette action est irréversible.',
      action: 'Tout supprimer',
      destructif: true,
    })
    if (!accepte) return
    try {
      await api.viderFrigo()
      setMessage('Inventaire vidé.')
    } catch (e) {
      signaler(e, 'Suppression impossible.')
    }
  }

  const diagnostic: [string, boolean][] = [
    ['API joignable', sante !== null],
    ['Clé IA configurée', !!sante?.gemini_configure],
    ['Clés de notification configurées', !!sante?.push_configure],
    ['Authentification active', !!sante?.auth_active],
  ]

  return (
    <main className="page">
      <header className="entete-page">
        <p className="kicker">{numeroSection('/reglages')} · Réglages</p>
        <h1 className="titre">Réglages</h1>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}

      <h2 className="intertitre" style={{ paddingTop: 8 }}>
        Notifications de péremption
      </h2>
      <NotificationsPeremption onErreur={setErreur} />

      <h2 className="intertitre" style={{ paddingTop: 28 }}>
        Apparence
      </h2>
      <div className={styles.themes} role="radiogroup" aria-label="Thème">
        {THEMES.map(([valeur, libelle]) => (
          <button
            key={valeur}
            type="button"
            role="radio"
            aria-checked={theme === valeur}
            onClick={() => changerTheme(valeur)}
          >
            {libelle}
          </button>
        ))}
      </div>
      <p className={styles.aide}>
        {theme === 'auto'
          ? 'Suit le mode clair ou sombre du téléphone.'
          : `Toujours ${theme}, quel que soit le réglage du téléphone.`}{' '}
        L'icône de l'écran d'accueil prend la couleur du thème au moment de l'installation.
      </p>

      <h2 className="intertitre" style={{ paddingTop: 28 }}>
        Diagnostic serveur
      </h2>
      {diagnostic.map(([libelle, ok]) => (
        <div key={libelle} className={styles.diagnostic}>
          <span>{libelle}</span>
          <span className={ok ? styles.oui : styles.non}>{ok ? 'Oui' : 'Non'}</span>
        </div>
      ))}

      <div className={styles.titrePrompt}>
        <h2 className="etiquette" style={{ fontSize: 9.5 }}>
          Prompt de scan
        </h2>
        <button type="button" className="btn-lien" onClick={basculerPrompt} aria-expanded={promptOuvert}>
          {promptOuvert ? 'Replier' : 'Afficher'}
        </button>
      </div>
      {promptOuvert && (
        <div className={styles.prompt}>
          <p className={styles.aide} style={{ padding: 0 }}>
            Réglage avancé. Ce texte est envoyé à l'IA avec la photo du ticket. Il est enregistré sur
            la Raspberry, donc partagé par tous vos appareils.
          </p>
          <textarea
            className="champ"
            rows={9}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="Prompt de scan"
          />
          <div className="duo">
            <button type="button" className="btn" onClick={reinitialiserPrompt}>
              Texte par défaut
            </button>
            <button type="button" className="btn btn-plein" onClick={enregistrerPrompt}>
              Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className={styles.danger}>
        <h2 className="etiquette" style={{ fontSize: 9.5, color: 'var(--danger)' }}>
          Zone dangereuse
        </h2>
        <button type="button" className="btn btn-danger" onClick={viderFrigo}>
          Vider le frigo
        </button>
        <p className={styles.aide} style={{ padding: 0 }}>
          Supprime tous les produits et l'historique. Irréversible.
        </p>
      </div>

      {dialogue}
    </main>
  )
}
