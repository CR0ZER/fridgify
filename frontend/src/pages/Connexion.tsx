import { useState, type FormEvent } from 'react'

import { lireComptesConnus, useAuth } from '../components/Authentification'
import styles from './Connexion.module.css'

type Vue = 'comptes' | 'connexion' | 'creation'

/** Deux premières lettres, comme l'avatar de la maquette. */
const initiales = (identifiant: string) => identifiant.slice(0, 2).toUpperCase()

export default function Connexion({ message }: { message?: string | null }) {
  const { connexion, inscription } = useAuth()
  const connus = lireComptesConnus()
  // Avec plusieurs comptes connus, on commence par demander lequel ; avec un
  // seul, autant aller droit au mot de passe.
  const [vue, setVue] = useState<Vue>(connus.length > 1 ? 'comptes' : 'connexion')
  const [choisi, setChoisi] = useState<string | null>(connus[0] ?? null)

  if (vue === 'comptes') {
    return (
      <main className={`page ${styles.page}`}>
        {message && <p className={styles.avis}>{message}</p>}
        <Enseigne />
        <h2 className={`etiquette ${styles.section}`}>Comptes sur cet appareil</h2>
        <div className={styles.liste}>
          {connus.map((identifiant) => (
            <button
              key={identifiant}
              type="button"
              className={styles.compte}
              onClick={() => {
                setChoisi(identifiant)
                setVue('connexion')
              }}
            >
              <span className={styles.avatar}>{initiales(identifiant)}</span>
              <span className={styles.compteNom}>{identifiant}</span>
              <span className={styles.chevron}>›</span>
            </button>
          ))}
          <button
            type="button"
            className={styles.compte}
            onClick={() => {
              setChoisi(null)
              setVue('connexion')
            }}
          >
            <span className={`${styles.avatar} ${styles.avatarVide}`}>+</span>
            <span className={styles.autre}>Un autre compte</span>
          </button>
        </div>
        <p className={styles.note}>
          Chaque compte a son propre inventaire. Rien n'est partagé entre les comptes listés ici.
        </p>
      </main>
    )
  }

  if (vue === 'creation') {
    return (
      <Creation
        retour={() => setVue(connus.length > 1 ? 'comptes' : 'connexion')}
        retourLibelle={connus.length > 1 ? '‹  Comptes' : '‹  Connexion'}
        onCreer={inscription}
      />
    )
  }

  return (
    <Formulaire
      compte={choisi}
      message={message}
      plusieursComptes={connus.length > 1}
      onRetour={() => setVue('comptes')}
      onCreer={() => setVue('creation')}
      onConnexion={connexion}
    />
  )
}

function Enseigne() {
  return (
    <header className={styles.enseigne}>
      <div className={styles.marque} aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div>
        <h1 className={styles.titre}>Frigo</h1>
        <p className="etiquette" style={{ marginTop: 8 }}>
          Un compte · un frigo
        </p>
      </div>
    </header>
  )
}

type FormulaireProps = {
  compte: string | null
  message?: string | null
  plusieursComptes: boolean
  onRetour: () => void
  onCreer: () => void
  onConnexion: (corps: {
    identifiant: string
    mot_de_passe: string
    rester_connecte: boolean
  }) => Promise<void>
}

function Formulaire({
  compte,
  message,
  plusieursComptes,
  onRetour,
  onCreer,
  onConnexion,
}: FormulaireProps) {
  const [identifiant, setIdentifiant] = useState(compte ?? '')
  const [motDePasse, setMotDePasse] = useState('')
  const [resterConnecte, setResterConnecte] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [oubliOuvert, setOubliOuvert] = useState(false)

  const envoyer = async (event: FormEvent) => {
    event.preventDefault()
    if (!identifiant.trim() || !motDePasse) return
    setEnCours(true)
    setErreur(null)
    try {
      await onConnexion({
        identifiant: identifiant.trim(),
        mot_de_passe: motDePasse,
        rester_connecte: resterConnecte,
      })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.')
      setMotDePasse('')
      setEnCours(false)
    }
  }

  return (
    <main className={`page ${styles.page}`}>
      <form onSubmit={envoyer}>
        {plusieursComptes && (
          <div className={styles.retourLigne}>
            <button type="button" className="retour" onClick={onRetour}>
              ‹&nbsp; Comptes
            </button>
          </div>
        )}
        {message && <p className={styles.avis}>{message}</p>}

        <header className={styles.entete}>
          {compte ? (
            <span className={`${styles.avatar} ${styles.avatarGrand}`}>{initiales(compte)}</span>
          ) : (
            <div className={styles.marque} aria-hidden>
              <span />
              <span />
              <span />
            </div>
          )}
          <div className={styles.enteteTextes}>
            <h1 className={styles.titreCompte}>{compte ?? 'Frigo'}</h1>
            <p className="etiquette">{compte ? 'Votre frigo' : 'Un compte · un frigo'}</p>
          </div>
        </header>

        <div className={styles.champs}>
          {!compte && (
            <label className={styles.ligne}>
              <span className="etiquette">Identifiant</span>
              <input
                className={styles.valeur}
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="camille"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                maxLength={40}
                required
                autoFocus
              />
            </label>
          )}
          <label className={styles.ligne}>
            <span className="etiquette">Mot de passe</span>
            <input
              className={`${styles.valeur} ${styles.motDePasse}`}
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              required
              autoFocus={!!compte}
            />
          </label>
          <div className={styles.ligne}>
            <span className={`etiquette ${styles.libre}`} id="rester-connecte">
              Rester connecté
            </span>
            <button
              type="button"
              role="switch"
              className="interrupteur"
              aria-checked={resterConnecte}
              aria-labelledby="rester-connecte"
              onClick={() => setResterConnecte(!resterConnecte)}
            />
          </div>
        </div>

        {erreur && (
          <div className={styles.erreur}>
            <p className={styles.erreurTitre}>Connexion refusée</p>
            <p className={styles.erreurCorps}>{erreur}</p>
          </div>
        )}

        <div className={styles.valider}>
          <button
            type="submit"
            className="btn btn-plein btn-grand"
            disabled={enCours || !motDePasse || !identifiant.trim()}
          >
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>

        <div className={styles.liens}>
          <button type="button" className="btn-lien" onClick={onCreer}>
            Créer un compte
          </button>
          <button
            type="button"
            className={`btn-lien ${styles.discret}`}
            onClick={() => setOubliOuvert(!oubliOuvert)}
          >
            Mot de passe oublié
          </button>
          {oubliOuvert && (
            <p className="texte-aide">
              Il n'y a pas d'envoi d'e-mail : le serveur tourne à la maison. Demandez une
              réinitialisation à la personne qui l'administre.
            </p>
          )}
        </div>
      </form>
    </main>
  )
}

function Creation({
  retour,
  retourLibelle,
  onCreer,
}: {
  retour: () => void
  retourLibelle: string
  onCreer: (corps: {
    identifiant: string
    mot_de_passe: string
    rester_connecte: boolean
  }) => Promise<void>
}) {
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const complet = !!identifiant.trim() && !!motDePasse && !!confirmation

  const creer = async (event: FormEvent) => {
    event.preventDefault()
    if (!complet) return
    if (motDePasse !== confirmation) {
      setErreur('Les deux saisies ne correspondent pas.')
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      await onCreer({
        identifiant: identifiant.trim(),
        mot_de_passe: motDePasse,
        rester_connecte: true,
      })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Création impossible.')
      setEnCours(false)
    }
  }

  return (
    <main className={`page ${styles.page}`}>
      <form onSubmit={creer}>
        <div className={styles.retourLigne}>
          <button type="button" className="retour" onClick={retour}>
            {retourLibelle}
          </button>
        </div>
        <header className="entete-page" style={{ paddingTop: 10 }}>
          <p className="kicker">Nouveau compte</p>
          <h1 className="titre-moyen" style={{ marginTop: 8 }}>
            Votre propre frigo
          </h1>
        </header>

        <div className={styles.champs}>
          <label className={styles.ligne}>
            <span className="etiquette">Identifiant</span>
            <input
              className={styles.valeur}
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              placeholder="camille"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              maxLength={40}
              required
              autoFocus
            />
          </label>
          <label className={styles.ligne}>
            <span className="etiquette">Mot de passe</span>
            <input
              className={`${styles.valeur} ${styles.motDePasse}`}
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
              required
            />
          </label>
          <div className={styles.ligneConfirmation}>
            <label className={styles.ligne}>
              <span className="etiquette">Confirmer</span>
              <input
                className={`${styles.valeur} ${styles.motDePasse}`}
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="••••••"
                autoComplete="new-password"
                required
              />
            </label>
            <p className={styles.indice}>Six caractères minimum. Aucune récupération par e-mail.</p>
          </div>
        </div>

        {erreur && (
          <div className={styles.erreur}>
            <p className={styles.erreurTitre}>Création refusée</p>
            <p className={styles.erreurCorps}>{erreur}</p>
          </div>
        )}

        <div className={styles.valider}>
          <button type="submit" className="btn btn-plein btn-grand" disabled={enCours || !complet}>
            {enCours ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
        <p className={`texte-aide ${styles.pied}`}>
          Le compte démarre avec un frigo vide. Vos produits, plats, courses et statistiques ne sont
          visibles que par vous.
        </p>
      </form>
    </main>
  )
}
