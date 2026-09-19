import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Categorie } from '../api/types'
import { numeroSection } from '../components/BarreNavigation'
import Stepper from '../components/Stepper'
import { ajouterJoursISO, aujourdHuiISO, pluriel } from '../utils/date'
import styles from './AjoutManuel.module.css'

export default function AjoutManuel() {
  const naviguer = useNavigate()
  const [categories, setCategories] = useState<Categorie[]>([])
  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState('Autre')
  const [dateAchat, setDateAchat] = useState(aujourdHuiISO())
  const [dlc, setDlc] = useState('')
  // Une fois la DLC saisie à la main, changer de catégorie ne l'écrase plus :
  // la proposition n'a de sens que tant qu'on ne l'a pas contredite.
  const [dlcSaisie, setDlcSaisie] = useState(false)
  const [quantite, setQuantite] = useState(1)
  const [apresOuverture, setApresOuverture] = useState(3)
  const [resteMaison, setResteMaison] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const choisie = categories.find((c) => c.nom === categorie)

  const appliquerCategorie = (nomCategorie: string, liste = categories) => {
    const trouvee = liste.find((c) => c.nom === nomCategorie)
    setCategorie(nomCategorie)
    if (!trouvee) return
    setApresOuverture(trouvee.apres_ouverture_jours)
    if (!dlcSaisie) setDlc(ajouterJoursISO(aujourdHuiISO(), trouvee.conservation_jours))
  }

  useEffect(() => {
    api
      .categories()
      .then((liste) => {
        setCategories(liste)
        appliquerCategorie('Autre', liste)
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
    // Au montage uniquement : la sélection suivante passe par le select.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enregistrer = async (event: FormEvent) => {
    event.preventDefault()
    if (!nom.trim()) return
    setEnregistrement(true)
    setErreur(null)
    try {
      await api.creerLot(
        {
          nom: nom.trim(),
          categorie,
          date_achat: dateAchat || null,
          est_ouvert: 0,
          duree_apres_ouverture: apresOuverture,
          date_peremption_effective: dlc || null,
          est_un_reste: resteMaison ? 1 : 0,
        },
        quantite,
      )
      naviguer('/')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.")
      setEnregistrement(false)
    }
  }

  return (
    <main className="page">
      <form onSubmit={enregistrer}>
        <header className="entete-page">
          <p className="kicker">{numeroSection('/ajout')} · Ajout manuel</p>
          <h1 className="titre-moyen" style={{ marginTop: 7 }}>
            Ajouter
          </h1>
        </header>

        <div className={styles.liste}>
          <label className={styles.ligne}>
            <span className="etiquette">Nom</span>
            <input
              className={styles.valeur}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du produit"
              maxLength={120}
              required
              autoFocus
            />
          </label>

          <label className={styles.ligne}>
            <span className="etiquette">Catégorie</span>
            <select
              className={styles.valeur}
              value={categorie}
              onChange={(e) => appliquerCategorie(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.nom} value={c.nom}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.ligne}>
            <span className="etiquette">{resteMaison ? 'Date de préparation' : 'Date d’achat'}</span>
            <input
              className={`${styles.valeur} ${styles.date}`}
              type="date"
              value={dateAchat}
              onChange={(e) => setDateAchat(e.target.value)}
            />
          </label>

          <div className={styles.ligneDlc}>
            <label className={styles.ligne}>
              <span className="etiquette">DLC</span>
              <input
                className={`${styles.valeur} ${styles.date}`}
                type="date"
                value={dlc}
                onChange={(e) => {
                  setDlcSaisie(true)
                  setDlc(e.target.value)
                }}
              />
            </label>
            <p className={dlcSaisie ? `${styles.indice} ${styles.saisi}` : styles.indice}>
              {dlcSaisie
                ? 'Saisie manuelle'
                : choisie && `Proposée par la catégorie · +${choisie.conservation_jours} j`}
            </p>
          </div>

          <div className={styles.ligne}>
            <span className={`etiquette ${styles.libre}`}>Quantité</span>
            <Stepper valeur={quantite} min={1} max={500} onChange={setQuantite} label="une unité" />
          </div>
          <p className={styles.aide}>Crée un lot de {pluriel(quantite, 'unité')}.</p>

          <div className={styles.ligne}>
            <span className={`etiquette ${styles.libre}`}>Jours après ouverture</span>
            <Stepper valeur={apresOuverture} max={99} onChange={setApresOuverture} label="un jour" />
          </div>

          <div className={styles.ligne}>
            <span className={`etiquette ${styles.libre}`} id="reste-maison">
              Reste maison
            </span>
            <button
              type="button"
              role="switch"
              className="interrupteur"
              aria-checked={resteMaison}
              aria-labelledby="reste-maison"
              onClick={() => setResteMaison(!resteMaison)}
            />
          </div>
        </div>

        {erreur && <p className="erreur">{erreur}</p>}

        <div className={styles.actions}>
          <button type="button" className={`btn-lien ${styles.annuler}`} onClick={() => naviguer('/')}>
            Annuler
          </button>
          <button type="submit" className="btn btn-plein" disabled={enregistrement || !nom.trim()}>
            {enregistrement
              ? 'Enregistrement…'
              : quantite > 1
                ? `Enregistrer ${quantite} unités`
                : 'Enregistrer'}
          </button>
        </div>
      </form>
    </main>
  )
}
