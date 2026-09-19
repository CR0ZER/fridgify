import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Categorie, ProduitDetecte } from '../api/types'
import CategorieSelect from '../components/CategorieSelect'
import DateField from '../components/DateField'
import GlassCard from '../components/GlassCard'
import { ajouterJoursISO, aujourdHuiISO } from '../utils/date'
import { compresserImage } from '../utils/image'
import styles from './Scan.module.css'

type LigneAValider = ProduitDetecte & {
  dateAchat: string
  dlc: string
  dureeApresOuverture: string
  quantiteTexte: string
  /** Une DLC corrigée à la main ne doit plus suivre les changements de catégorie. */
  dlcModifiee: boolean
}

export default function Scan() {
  const [chargement, setChargement] = useState(false)
  const [lignes, setLignes] = useState<LigneAValider[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [categories, setCategories] = useState<Categorie[]>([])
  const inputFichier = useRef<HTMLInputElement>(null)
  const naviguer = useNavigate()

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  /** DLC proposée pour une catégorie : un ticket de caisse n'en porte jamais. */
  const dlcProposee = (nomCategorie: string): string => {
    const trouvee = categories.find((c) => c.nom === nomCategorie)
    return trouvee ? ajouterJoursISO(aujourdHuiISO(), trouvee.conservation_jours) : ''
  }

  const dureeProposee = (nomCategorie: string): string => {
    const trouvee = categories.find((c) => c.nom === nomCategorie)
    return String(trouvee ? trouvee.apres_ouverture_jours : 3)
  }

  /**
   * `<input type="file" accept="image/*">` remplace expo-image-picker : sous iOS,
   * Safari propose au choix l'appareil photo ou la photothèque, et convertit le
   * HEIC en JPEG au passage.
   */
  const analyser = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0]
    // Permet de re-selectionner la meme photo apres une erreur.
    event.target.value = ''
    if (!fichier) return

    setChargement(true)
    setErreur(null)
    setLignes(null)

    try {
      const image = await compresserImage(fichier)
      const detectes = await api.scannerTicket(image)

      if (detectes.length === 0) {
        setErreur("Aucun produit frais n'a été reconnu sur ce ticket.")
        return
      }

      const aujourdHui = aujourdHuiISO()
      setLignes(
        detectes.map((produit) => ({
          ...produit,
          dateAchat: aujourdHui,
          // Sans cette proposition, chaque produit scanné entrait sans date :
          // affiché « Date inconnue », relégué en fin de liste et jamais signalé.
          dlc: dlcProposee(produit.categorie),
          dureeApresOuverture: dureeProposee(produit.categorie),
          quantiteTexte: String(produit.quantite || 1),
          dlcModifiee: false,
        })),
      )
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Le scan a échoué.')
    } finally {
      setChargement(false)
    }
  }

  const modifier = (index: number, champ: keyof LigneAValider, valeur: string) => {
    setLignes((actuelles) =>
      actuelles!.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)),
    )
  }

  const changerCategorie = (index: number, nomCategorie: string) => {
    setLignes((actuelles) =>
      actuelles!.map((ligne, i) =>
        i === index
          ? {
              ...ligne,
              categorie: nomCategorie,
              dureeApresOuverture: dureeProposee(nomCategorie),
              dlc: ligne.dlcModifiee ? ligne.dlc : dlcProposee(nomCategorie),
            }
          : ligne,
      ),
    )
  }

  const validerTout = async () => {
    if (!lignes?.length) return
    setEnregistrement(true)
    setErreur(null)

    try {
      for (const ligne of lignes) {
        await api.creerLot(
          {
            nom: ligne.nom,
            categorie: ligne.categorie,
            date_achat: ligne.dateAchat,
            est_ouvert: 0,
            duree_apres_ouverture: parseInt(ligne.dureeApresOuverture, 10) || 3,
            date_peremption_effective: ligne.dlc || null,
            est_un_reste: 0,
          },
          Math.max(1, parseInt(ligne.quantiteTexte, 10) || 1),
        )
      }
      setLignes(null)
      naviguer('/')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.")
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <main className="page">
      <h1 className="titre-page">Scanner</h1>

      <input
        ref={inputFichier}
        className={styles.inputCache}
        type="file"
        accept="image/*"
        onChange={analyser}
      />

      {!lignes && (
        <>
          <button
            type="button"
            className="btn btn-primaire"
            onClick={() => inputFichier.current?.click()}
            disabled={chargement}
          >
            {chargement ? 'Analyse en cours…' : 'Photographier le ticket'}
          </button>
          <p className={styles.aide}>
            Prenez le ticket en photo ou choisissez une image existante. Seuls les produits frais
            en sont extraits.
          </p>
        </>
      )}

      {chargement && (
        <>
          <div className="spinner" />
          <p className={styles.progression}>Lecture du ticket, cela prend une trentaine de secondes.</p>
        </>
      )}

      {erreur && <p className="erreur">{erreur}</p>}

      {lignes && lignes.length > 0 && (
        <div className={styles.resultats}>
          {lignes.map((ligne, index) => (
            <GlassCard key={index}>
              <input
                className={styles.nomInput}
                value={ligne.nom}
                onChange={(e) => modifier(index, 'nom', e.target.value)}
                aria-label="Nom du produit"
              />
              <div className={styles.champ}>
                <CategorieSelect
                  label="Catégorie"
                  valeur={ligne.categorie}
                  categories={categories}
                  onChange={(nomCategorie) => changerCategorie(index, nomCategorie)}
                />
              </div>

              <div className="ligne">
                <div className={styles.champ}>
                  <DateField
                    label="DLC"
                    value={ligne.dlc}
                    onChange={(v) => {
                      modifier(index, 'dlc', v)
                      setLignes((actuelles) =>
                        actuelles!.map((l, i) => (i === index ? { ...l, dlcModifiee: true } : l)),
                      )
                    }}
                  />
                </div>
                <div className={styles.champ}>
                  <label className="label">Quantité</label>
                  <input
                    className="input-texte input-mono"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={ligne.quantiteTexte}
                    onChange={(e) => modifier(index, 'quantiteTexte', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.champ}>
                <label className="label">Jours après ouverture</label>
                <input
                  className="input-texte input-mono"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={ligne.dureeApresOuverture}
                  onChange={(e) => modifier(index, 'dureeApresOuverture', e.target.value)}
                />
              </div>

              <button
                type="button"
                className={styles.retirer}
                onClick={() => setLignes(lignes.filter((_, i) => i !== index))}
              >
                Retirer ce produit
              </button>
            </GlassCard>
          ))}

          <button
            type="button"
            className="btn btn-primaire"
            onClick={validerTout}
            disabled={enregistrement}
          >
            {enregistrement ? 'Enregistrement…' : `Ajouter au frigo (${lignes.length})`}
          </button>
        </div>
      )}
    </main>
  )
}
