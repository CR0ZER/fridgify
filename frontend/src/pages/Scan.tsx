import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Categorie } from '../api/types'
import { numeroSection } from '../components/BarreNavigation'
import Stepper from '../components/Stepper'
import { ajouterJoursISO, aujourdHuiISO, dateCourte, pluriel } from '../utils/date'
import { compresserImage } from '../utils/image'
import styles from './Scan.module.css'

type Ligne = {
  cle: number
  nom: string
  categorie: string
  quantite: number
  dlc: string
  apresOuverture: number
  /** Une DLC corrigée à la main ne suit plus les changements de catégorie. */
  dlcSaisie: boolean
}

type Etape = 'attente' | 'analyse' | 'rien' | 'echec' | 'resultats'

export default function Scan() {
  const [etape, setEtape] = useState<Etape>('attente')
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [ouverte, setOuverte] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [categories, setCategories] = useState<Categorie[]>([])
  const appareilPhoto = useRef<HTMLInputElement>(null)
  const phototheque = useRef<HTMLInputElement>(null)
  const analyseEnCours = useRef<AbortController | null>(null)
  const naviguer = useNavigate()

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
    return () => analyseEnCours.current?.abort()
  }, [])

  /** Un ticket de caisse ne porte jamais de DLC : on la propose selon la catégorie. */
  const proposition = (nomCategorie: string) => {
    const trouvee = categories.find((c) => c.nom === nomCategorie)
    return {
      dlc: trouvee ? ajouterJoursISO(aujourdHuiISO(), trouvee.conservation_jours) : '',
      apresOuverture: trouvee ? trouvee.apres_ouverture_jours : 3,
    }
  }

  /**
   * Sous iOS, `capture` ouvre directement l'appareil photo ; sans lui, Safari
   * propose la photothèque. Dans les deux cas le HEIC arrive converti en JPEG.
   */
  const analyser = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0]
    // Permet de re-sélectionner la même photo après une erreur.
    event.target.value = ''
    if (!fichier) return

    const controleur = new AbortController()
    analyseEnCours.current = controleur
    setEtape('analyse')
    setErreur(null)

    try {
      const detectes = await api.scannerTicket(await compresserImage(fichier), controleur.signal)
      if (detectes.length === 0) {
        setEtape('rien')
        return
      }
      setLignes(
        detectes.map((produit, index) => ({
          cle: index,
          nom: produit.nom,
          categorie: produit.categorie,
          quantite: Math.max(1, produit.quantite || 1),
          dlcSaisie: false,
          ...proposition(produit.categorie),
        })),
      )
      setOuverte(0)
      setEtape('resultats')
    } catch (e) {
      if (controleur.signal.aborted) return
      setErreur(e instanceof Error ? e.message : 'Le scan a échoué.')
      setEtape('echec')
    }
  }

  const annulerAnalyse = () => {
    analyseEnCours.current?.abort()
    setEtape('attente')
  }

  const modifier = (cle: number, champs: Partial<Ligne>) =>
    setLignes((actuelles) => actuelles.map((l) => (l.cle === cle ? { ...l, ...champs } : l)))

  const changerCategorie = (ligne: Ligne, categorie: string) => {
    const { dlc, apresOuverture } = proposition(categorie)
    modifier(ligne.cle, { categorie, apresOuverture, dlc: ligne.dlcSaisie ? ligne.dlc : dlc })
  }

  const toutEnregistrer = async () => {
    setEnregistrement(true)
    setErreur(null)
    try {
      for (const ligne of lignes) {
        await api.creerLot(
          {
            nom: ligne.nom.trim() || 'Produit',
            categorie: ligne.categorie,
            date_achat: aujourdHuiISO(),
            est_ouvert: 0,
            duree_apres_ouverture: ligne.apresOuverture,
            date_peremption_effective: ligne.dlc || null,
            est_un_reste: 0,
          },
          ligne.quantite,
        )
      }
      naviguer('/')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.")
      setEnregistrement(false)
    }
  }

  const reprendre = () => {
    setLignes([])
    setEtape('attente')
  }

  return (
    <main className="page">
      <header className="entete-page">
        <p className="kicker">{numeroSection('/scan')} · Scan de ticket</p>
        <h1 className="titre">Scanner</h1>
      </header>

      <input ref={appareilPhoto} className={styles.cache} type="file" accept="image/*" capture="environment" onChange={analyser} />
      <input ref={phototheque} className={styles.cache} type="file" accept="image/*" onChange={analyser} />

      {etape === 'attente' && (
        <div className={styles.bloc}>
          <button type="button" className={styles.cadre} onClick={() => appareilPhoto.current?.click()}>
            <span className={styles.viseur} />
            <span className="etiquette">Photo du ticket</span>
          </button>
          <p className="texte-aide">
            Photographiez le ticket entier, bien à plat. Le serveur en extrait les produits frais
            destinés au frigo. Rien n'est enregistré sans votre validation.
          </p>
          <button type="button" className="btn btn-plein btn-grand" onClick={() => appareilPhoto.current?.click()}>
            Prendre une photo
          </button>
          <button type="button" className="btn btn-grand" onClick={() => phototheque.current?.click()}>
            Choisir dans la photothèque
          </button>
        </div>
      )}

      {etape === 'analyse' && (
        <div className={styles.bloc} style={{ gap: 18, paddingTop: 30 }}>
          <div className={styles.progression}>
            <div />
          </div>
          <h2 className={styles.grandTitre}>Analyse du ticket en cours</h2>
          <p className="etiquette">Environ 30 secondes</p>
          <p className="texte-aide">
            Vous pouvez laisser l'écran allumé. Les produits reconnus s'afficheront ici pour
            validation.
          </p>
          <button type="button" className="btn" onClick={annulerAnalyse}>
            Annuler l'analyse
          </button>
        </div>
      )}

      {etape === 'rien' && (
        <div className={styles.bloc} style={{ paddingTop: 40 }}>
          <h2 className={styles.grandTitre}>Aucun produit frais n'a été reconnu sur ce ticket.</h2>
          <p className="texte-aide">Réessayez avec une photo plus nette, ou ajoutez les produits à la main.</p>
          <div className="duo">
            <button type="button" className="btn btn-plein" onClick={reprendre}>
              Reprendre une photo
            </button>
            <button type="button" className="btn" onClick={() => naviguer('/ajout')}>
              Ajout manuel
            </button>
          </div>
        </div>
      )}

      {etape === 'echec' && (
        <div className={styles.bloc} style={{ paddingTop: 40, alignItems: 'flex-start' }}>
          <div className={styles.signe}>!</div>
          <h2 className={styles.grandTitre}>Échec de l'analyse</h2>
          {erreur && <p className="erreur" style={{ margin: 0 }}>{erreur}</p>}
          <button type="button" className="btn btn-plein" onClick={reprendre}>
            Réessayer
          </button>
        </div>
      )}

      {etape === 'resultats' && (
        <>
          <div className={styles.compteLigne}>
            <p className={styles.compte}>
              {pluriel(lignes.length, 'produit')} reconnu{lignes.length > 1 ? 's' : ''}
            </p>
            <button type="button" className="btn-lien" style={{ color: 'var(--muted)' }} onClick={reprendre}>
              Reprendre
            </button>
          </div>
          <p className={`texte-aide ${styles.consigne}`}>
            Corrigez ce qui doit l'être, puis validez : chaque ligne devient un lot.
          </p>

          {lignes.map((ligne, index) => {
            const deplie = ouverte === ligne.cle
            return (
              <section key={ligne.cle} className={styles.ligne}>
                <button
                  type="button"
                  className={styles.ligneTete}
                  aria-expanded={deplie}
                  onClick={() => setOuverte(deplie ? null : ligne.cle)}
                >
                  <span className={styles.numero}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.ligneTextes}>
                    <span className={styles.ligneNom}>{ligne.nom || 'Sans nom'}</span>
                    <span className="meta" style={{ fontSize: 9 }}>
                      {ligne.categorie} · ×{ligne.quantite} · DLC {dateCourte(ligne.dlc)}
                    </span>
                  </span>
                  <span className={deplie ? `${styles.caret} ${styles.caretOuvert}` : styles.caret}>▼</span>
                </button>

                {deplie && (
                  <div className={styles.edition}>
                    <input
                      className="champ"
                      value={ligne.nom}
                      onChange={(e) => modifier(ligne.cle, { nom: e.target.value })}
                      aria-label="Nom du produit"
                    />
                    <div className={styles.deuxColonnes}>
                      <select
                        className="champ"
                        value={ligne.categorie}
                        onChange={(e) => changerCategorie(ligne, e.target.value)}
                        aria-label="Catégorie"
                      >
                        {categories.map((c) => (
                          <option key={c.nom} value={c.nom}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                      <Stepper
                        className={styles.quantite}
                        valeur={ligne.quantite}
                        min={1}
                        max={500}
                        onChange={(quantite) => modifier(ligne.cle, { quantite })}
                        label="une unité"
                      />
                    </div>
                    <div className={styles.dlcTete}>
                      <span className="etiquette">DLC</span>
                      <span className={styles.badge}>{ligne.dlcSaisie ? 'Saisie manuelle' : 'Proposée'}</span>
                    </div>
                    <input
                      className="champ champ-mono"
                      type="date"
                      value={ligne.dlc}
                      onChange={(e) => modifier(ligne.cle, { dlc: e.target.value, dlcSaisie: true })}
                      aria-label="DLC"
                    />
                    <div className={styles.apresOuverture}>
                      <span className="etiquette">Jours après ouverture</span>
                      <Stepper
                        valeur={ligne.apresOuverture}
                        max={99}
                        onChange={(apresOuverture) => modifier(ligne.cle, { apresOuverture })}
                        label="un jour"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-discret"
                      onClick={() => setLignes(lignes.filter((l) => l.cle !== ligne.cle))}
                    >
                      Retirer cette ligne
                    </button>
                  </div>
                )}
              </section>
            )
          })}

          {erreur && <p className="erreur">{erreur}</p>}

          <div className={styles.valider}>
            <button
              type="button"
              className="btn btn-plein btn-grand"
              onClick={toutEnregistrer}
              disabled={enregistrement || lignes.length === 0}
            >
              {enregistrement ? 'Enregistrement…' : `Tout enregistrer · ${pluriel(lignes.length, 'lot')}`}
            </button>
          </div>
        </>
      )}
    </main>
  )
}
