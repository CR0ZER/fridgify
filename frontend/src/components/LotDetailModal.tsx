import { useEffect, useId, useState } from 'react'

import { api } from '../api/client'
import type { Categorie, Produit } from '../api/types'
import { formatDateAffichage, joursRestants, libelleJours } from '../utils/date'
import type { ProduitGroupe } from '../utils/grouping'
import { couleurUrgence, urgenceLevel } from '../utils/urgence'
import CategorieSelect from './CategorieSelect'
import DateField from './DateField'
import GlassCard from './GlassCard'
import Icon from './Icon'
import Modal from './Modal'
import StatusDot from './StatusDot'
import { useConfirm } from './ConfirmDialog'
import styles from './LotDetailModal.module.css'

/** Meme repli que `normaliser()` cote serveur. */
const CATEGORIE_DE_REPLI = 'Autre'

type Props = {
  groupe: ProduitGroupe | null
  onClose: () => void
  onRefresh: () => void
  onConsommer: (unite: Produit) => void
  onErreur: (message: string) => void
}

export default function LotDetailModal({
  groupe,
  onClose,
  onRefresh,
  onConsommer,
  onErreur,
}: Props) {
  const [editionLot, setEditionLot] = useState(false)
  const [nomBrouillon, setNomBrouillon] = useState('')
  const [categorieBrouillon, setCategorieBrouillon] = useState('')
  const [categories, setCategories] = useState<Categorie[]>([])
  const [uniteEnEdition, setUniteEnEdition] = useState<number | null>(null)
  const [dlcBrouillon, setDlcBrouillon] = useState('')
  const { confirmer, dialogue } = useConfirm()
  const titreId = useId()

  // La liste fermee ne change jamais : un seul appel, au montage de l'inventaire.
  useEffect(() => {
    api
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const fermer = () => {
    setEditionLot(false)
    setUniteEnEdition(null)
    onClose()
  }

  /** Toute mutation passe par le serveur : on remonte l'erreur plutot que de l'avaler. */
  const executer = async (action: () => Promise<unknown>) => {
    try {
      await action()
      onRefresh()
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : 'Action impossible.')
    }
  }

  if (!groupe) return null

  const commencerEditionLot = () => {
    setNomBrouillon(groupe.nom)
    // Une categorie absente de la liste fermee (ligne anterieure a sa mise en
    // place) retombe sur le defaut : sans cela le select s'afficherait vide.
    const connue = categories.some((c) => c.nom === groupe.categorie)
    setCategorieBrouillon(
      connue ? groupe.categorie! : categories.length > 0 ? CATEGORIE_DE_REPLI : '',
    )
    setEditionLot(true)
  }

  const sauvegarderLot = () =>
    executer(async () => {
      await api.modifierLot(groupe.lot_id, {
        nom: nomBrouillon.trim() || groupe.nom,
        categorie: categorieBrouillon || null,
      })
      setEditionLot(false)
    })

  const sauvegarderDlc = (unite: Produit) =>
    executer(async () => {
      await api.modifierProduit(unite.id, { date_peremption_effective: dlcBrouillon || null })
      setUniteEnEdition(null)
    })

  const marquerJete = async (unite: Produit) => {
    const accepte = await confirmer({
      titre: 'Marquer comme jeté',
      message: `« ${groupe.nom} » sera compté comme jeté dans vos statistiques.`,
      action: 'Confirmer',
      destructif: true,
    })
    if (accepte) await executer(() => api.cloturerProduit(unite.id, 'jete'))
  }

  const supprimerDefinitivement = async (unite: Produit) => {
    const accepte = await confirmer({
      titre: 'Supprimer cette entrée',
      message:
        "Cette action efface définitivement l'unité, sans la compter nulle part. À utiliser en cas d'erreur de saisie, pas pour du gaspillage.",
      action: 'Supprimer',
      destructif: true,
    })
    if (accepte) await executer(() => api.supprimerProduit(unite.id))
  }

  return (
    <>
      <Modal ouvert onClose={fermer} labelledBy={titreId}>
        <GlassCard className={styles.carte}>
          <div className={styles.entete}>
            {editionLot ? (
              <input
                className={styles.nomInput}
                value={nomBrouillon}
                onChange={(e) => setNomBrouillon(e.target.value)}
                aria-label="Nom du lot"
              />
            ) : (
              <h2 className={styles.nom} id={titreId}>
                {groupe.nom}
              </h2>
            )}
            <button
              type="button"
              className={styles.boutonIcone}
              onClick={() => (editionLot ? setEditionLot(false) : commencerEditionLot())}
              aria-label={editionLot ? "Annuler l'édition" : 'Modifier le lot'}
            >
              <Icon nom={editionLot ? 'fermer' : 'crayon'} />
            </button>
          </div>

          {editionLot ? (
            <div className={styles.editionLot}>
              <CategorieSelect
                label="Catégorie"
                valeur={categorieBrouillon}
                categories={categories}
                onChange={setCategorieBrouillon}
              />
              <button type="button" className="btn btn-primaire" onClick={sauvegarderLot}>
                <Icon nom="coche" taille={18} />
                Enregistrer
              </button>
            </div>
          ) : (
            groupe.categorie && <p className={styles.categorie}>{groupe.categorie}</p>
          )}

          <div className={styles.liste}>
            {groupe.unites.map((unite, index) => {
              const jours = joursRestants(unite.date_peremption_effective)
              const couleur = couleurUrgence(urgenceLevel(jours))
              const enEdition = uniteEnEdition === unite.id

              return (
                <div key={unite.id} className={styles.unite}>
                  <div className={styles.uniteHaut}>
                    <span className={styles.uniteTitre}>
                      <StatusDot couleur={couleur} taille={11} />
                      Unité {index + 1}
                    </span>
                    <button
                      type="button"
                      className={styles.boutonIcone}
                      onClick={() => {
                        if (enEdition) {
                          setUniteEnEdition(null)
                        } else {
                          setUniteEnEdition(unite.id)
                          setDlcBrouillon(unite.date_peremption_effective ?? '')
                        }
                      }}
                      aria-label={enEdition ? "Annuler l'édition" : 'Modifier la DLC'}
                    >
                      <Icon nom={enEdition ? 'fermer' : 'crayon'} taille={16} />
                    </button>
                  </div>

                  <p className={styles.uniteCompteur} style={{ color: couleur }}>
                    {libelleJours(jours)}
                  </p>

                  <div className={styles.uniteInfos}>
                    <span className={styles.uniteDate}>
                      DLC : {formatDateAffichage(unite.date_peremption_effective)}
                    </span>
                    <span className={styles.uniteStatut}>
                      Produit {unite.est_ouvert ? 'ouvert' : 'fermé'}
                    </span>
                  </div>

                  {enEdition && (
                    <div className={styles.editionDlc}>
                      <DateField
                        label="Nouvelle DLC"
                        value={dlcBrouillon}
                        onChange={setDlcBrouillon}
                      />
                      <button
                        type="button"
                        className={`btn ${styles.boutonPetit}`}
                        onClick={() => sauvegarderDlc(unite)}
                      >
                        Valider
                      </button>
                    </div>
                  )}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.mini} ${styles.miniMauvais}`}
                      onClick={() => marquerJete(unite)}
                    >
                      <Icon nom="poubelle" taille={16} />
                      Jeté
                    </button>
                    <button
                      type="button"
                      className={`${styles.mini} ${styles.miniBon}`}
                      onClick={() => onConsommer(unite)}
                    >
                      <Icon nom="coche-cercle" taille={16} />
                      Consommé
                    </button>
                    {unite.est_ouvert === 0 && (
                      <button
                        type="button"
                        className={styles.mini}
                        onClick={() => executer(() => api.ouvrirProduit(unite.id))}
                      >
                        <Icon nom="ouvrir" taille={16} />
                        Ouvrir
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.erreurSaisie}
                    onClick={() => supprimerDefinitivement(unite)}
                  >
                    Erreur de saisie, supprimer définitivement
                  </button>
                </div>
              )
            })}
          </div>
        </GlassCard>
      </Modal>
      {dialogue}
    </>
  )
}
