import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Categorie } from '../api/types'
import CategorieSelect from '../components/CategorieSelect'
import DateField from '../components/DateField'
import GlassCard from '../components/GlassCard'
import Icon from '../components/Icon'
import { ajouterJoursISO, aujourdHuiISO } from '../utils/date'
import styles from './AjoutManuel.module.css'

export default function AjoutManuel() {
  const naviguer = useNavigate()

  const [nom, setNom] = useState('')
  const [categories, setCategories] = useState<Categorie[]>([])
  const [categorie, setCategorie] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [dateAchat, setDateAchat] = useState(aujourdHuiISO())
  const [dlc, setDlc] = useState('')
  const [dureeApresOuverture, setDureeApresOuverture] = useState('3')
  const [estUnReste, setEstUnReste] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Une fois la date ou la durée saisie à la main, changer de catégorie ne doit
  // plus rien écraser : la proposition n'a de sens que tant qu'on ne l'a pas
  // contredite. Des refs plutôt que du state, la valeur ne pilote aucun rendu.
  const dlcModifiee = useRef(false)
  const dureeModifiee = useRef(false)

  const appliquerCategorie = (choisie: Categorie) => {
    setCategorie(choisie.nom)
    if (!dlcModifiee.current) {
      setDlc(ajouterJoursISO(aujourdHuiISO(), choisie.conservation_jours))
    }
    if (!dureeModifiee.current) {
      setDureeApresOuverture(String(choisie.apres_ouverture_jours))
    }
  }

  useEffect(() => {
    api
      .categories()
      .then((liste) => {
        setCategories(liste)
        const depart = liste.find((c) => c.nom === 'Autre') ?? liste[0]
        if (depart) appliquerCategorie(depart)
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
    // Au montage uniquement : la sélection suivante passe par CategorieSelect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sauvegarder = async (event: FormEvent) => {
    event.preventDefault()
    if (!nom.trim()) return

    setEnregistrement(true)
    setErreur(null)

    try {
      await api.creerLot(
        {
          nom: nom.trim(),
          categorie: categorie || null,
          date_achat: dateAchat || null,
          est_ouvert: 0,
          duree_apres_ouverture: parseInt(dureeApresOuverture, 10) || 3,
          date_peremption_effective: dlc || null,
          est_un_reste: estUnReste ? 1 : 0,
        },
        Math.max(1, parseInt(quantite, 10) || 1),
      )
      naviguer('/')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.")
      setEnregistrement(false)
    }
  }

  return (
    <main className="page">
      <form onSubmit={sauvegarder}>
        <header className={styles.entete}>
          <h1 className="titre-page" style={{ marginBottom: 0 }}>
            Ajout manuel
          </h1>
          <button
            type="button"
            className={styles.fermer}
            onClick={() => naviguer(-1)}
            aria-label="Fermer"
          >
            <Icon nom="fermer" taille={24} />
          </button>
        </header>

        <GlassCard>
          <div className={styles.formulaire}>
            <div>
              <label className="label" htmlFor="nom">
                Nom du produit
              </label>
              <input
                id="nom"
                className="input-texte"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Tomates"
                required
                autoFocus
              />
            </div>

            <CategorieSelect
              label="Catégorie"
              valeur={categorie}
              categories={categories}
              onChange={(nomCategorie) => {
                const choisie = categories.find((c) => c.nom === nomCategorie)
                if (choisie) appliquerCategorie(choisie)
              }}
            />

            <div className="ligne">
              <DateField label="Acheté / Préparé le" value={dateAchat} onChange={setDateAchat} />
              <div>
                <DateField
                  label="DLC"
                  value={dlc}
                  onChange={(valeur) => {
                    dlcModifiee.current = true
                    setDlc(valeur)
                  }}
                />
                {!dlcModifiee.current && dlc && (
                  <p className={styles.indice}>Proposée d'après la catégorie</p>
                )}
              </div>
            </div>

            <div className="ligne">
              <div>
                <label className="label" htmlFor="quantite">
                  Quantité
                </label>
                <input
                  id="quantite"
                  className="input-texte input-mono"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="duree">
                  Jours après ouverture
                </label>
                <input
                  id="duree"
                  className="input-texte input-mono"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={dureeApresOuverture}
                  onChange={(e) => {
                    dureeModifiee.current = true
                    setDureeApresOuverture(e.target.value)
                  }}
                />
              </div>
            </div>

            <label className={styles.bascule}>
              <input
                type="checkbox"
                checked={estUnReste}
                onChange={(e) => setEstUnReste(e.target.checked)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />
              <span className={estUnReste ? `${styles.case} ${styles.caseCochee}` : styles.case}>
                {estUnReste && <Icon nom="coche" taille={14} epaisseur={2.5} />}
              </span>
              <span className={styles.basculeLabel}>C'est un reste maison</span>
            </label>
          </div>
        </GlassCard>

        {erreur && <p className="erreur">{erreur}</p>}

        <button
          type="submit"
          className={`btn btn-primaire ${styles.sauvegarder}`}
          disabled={enregistrement || !nom.trim()}
        >
          {enregistrement ? 'Enregistrement…' : 'Ajouter au frigo'}
        </button>
      </form>
    </main>
  )
}
