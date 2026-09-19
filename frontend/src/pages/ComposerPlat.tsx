import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { DisponibiliteLot } from '../api/types'
import GlassCard from '../components/GlassCard'
import Icon from '../components/Icon'
import Stepper from '../components/Stepper'
import { formatDateAffichage, joursRestants, libelleJours } from '../utils/date'
import { couleurUrgence, urgenceLevel } from '../utils/urgence'
import styles from './ComposerPlat.module.css'

/** Sert à la fois à créer un plat et à modifier un plat déjà prévu. */
export default function ComposerPlat() {
  const { platId } = useParams()
  const naviguer = useNavigate()
  const enEdition = platId !== undefined

  const [nom, setNom] = useState('')
  const [note, setNote] = useState('')
  const [lots, setLots] = useState<DisponibiliteLot[]>([])
  const [quantites, setQuantites] = useState<Record<string, number>>({})
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const disponibilites = await api.disponibilites()

      if (platId) {
        const plat = await api.lirePlat(Number(platId))
        setNom(plat.nom)
        setNote(plat.note ?? '')

        // Un lot entièrement consommé depuis la création du plat a disparu des
        // disponibilités. On l'écarte de la sélection : le laisser ferait
        // échouer l'enregistrement sur un lot introuvable, sans que l'écran
        // offre le moindre moyen de le retirer.
        const existants = new Set(disponibilites.map((lot) => lot.lot_id))
        const encoreLa = plat.ingredients.filter((i) => existants.has(i.lot_id))

        setQuantites(Object.fromEntries(encoreLa.map((i) => [i.lot_id, i.quantite])))

        // Les quantités déjà réservées par ce plat lui restent accessibles :
        // sans cela, rouvrir un plat afficherait ses propres ingrédients comme
        // épuisés et interdirait d'en augmenter la part.
        const sien = new Map(encoreLa.map((i) => [i.lot_id, i.quantite]))
        setLots(
          disponibilites.map((lot) => ({
            ...lot,
            disponible: lot.disponible + (sien.get(lot.lot_id) ?? 0),
          })),
        )
      } else {
        setLots(disponibilites)
      }
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [platId])

  useEffect(() => {
    void charger()
  }, [charger])

  const selection = useMemo(
    () => Object.entries(quantites).filter(([, q]) => q > 0),
    [quantites],
  )

  /** Échéance du plat : la DLC la plus proche parmi les produits retenus. */
  const dateLimite = useMemo(() => {
    const dates = selection
      .map(([lotId]) => lots.find((l) => l.lot_id === lotId)?.date_peremption_effective)
      .filter((d): d is string => !!d)
    return dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null
  }, [selection, lots])

  const enregistrer = async (event: FormEvent) => {
    event.preventDefault()
    if (!nom.trim() || selection.length === 0) return

    setEnregistrement(true)
    setErreur(null)

    const ingredients = selection.map(([lot_id, quantite]) => ({ lot_id, quantite }))

    try {
      if (platId) {
        await api.modifierPlat(Number(platId), {
          nom: nom.trim(),
          note: note.trim() || null,
          ingredients,
        })
      } else {
        await api.creerPlat(nom.trim(), note.trim() || null, ingredients)
      }
      naviguer('/plats')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.")
      setEnregistrement(false)
    }
  }

  const joursLimite = joursRestants(dateLimite)

  return (
    <main className="page">
      <form onSubmit={enregistrer}>
        <header className={styles.entete}>
          <h1 className="titre-page" style={{ marginBottom: 0 }}>
            {enEdition ? 'Modifier le plat' : 'Composer un plat'}
          </h1>
          <button
            type="button"
            className={styles.fermer}
            onClick={() => naviguer('/plats')}
            aria-label="Fermer"
          >
            <Icon nom="fermer" taille={24} />
          </button>
        </header>

        <GlassCard className={styles.carte}>
          <div className="pile">
            <div>
              <label className="label" htmlFor="nom-plat">
                Nom du plat
              </label>
              <input
                id="nom-plat"
                className="input-texte"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ratatouille"
                required
                autoFocus={!enEdition}
              />
            </div>
            <div>
              <label className="label" htmlFor="note-plat">
                Note (facultatif)
              </label>
              <input
                id="note-plat"
                className="input-texte"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Pour dimanche midi"
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard className={styles.carte}>
          <h2 className="section-label">Produits à réserver</h2>

          {chargement && <div className="spinner" />}

          {!chargement && lots.length === 0 && (
            <p className={styles.vide}>
              Le frigo est vide. Ajoutez des produits avant de composer un plat.
            </p>
          )}

          {lots.map((lot) => {
            const jours = joursRestants(lot.date_peremption_effective)
            const couleur = couleurUrgence(urgenceLevel(jours))
            const retenu = quantites[lot.lot_id] ?? 0
            const epuise = lot.disponible <= 0 && retenu <= 0

            return (
              <div
                key={lot.lot_id}
                className={epuise ? `${styles.produit} ${styles.epuise}` : styles.produit}
              >
                <div className={styles.produitInfos}>
                  <span className={styles.produitNom}>{lot.nom}</span>
                  <span className={styles.produitMeta}>
                    <span className={styles.jours} style={{ color: couleur }}>
                      {libelleJours(jours)}
                    </span>
                    <span>·</span>
                    <span>
                      {epuise
                        ? 'déjà tout réservé'
                        : `${lot.disponible} disponible${lot.disponible > 1 ? 's' : ''}`}
                    </span>
                  </span>
                </div>
                <Stepper
                  valeur={retenu}
                  max={lot.disponible}
                  label={lot.nom}
                  onChange={(valeur) =>
                    setQuantites((actuelles) => ({ ...actuelles, [lot.lot_id]: valeur }))
                  }
                />
              </div>
            )
          })}
        </GlassCard>

        {erreur && <p className="erreur">{erreur}</p>}

        <div className={styles.recap}>
          <p className={styles.recapLigne}>
            <span>Produits retenus</span>
            <span className={styles.recapValeur}>{selection.length}</span>
          </p>
          <p className={styles.recapLigne}>
            <span>À cuisiner avant</span>
            <span
              className={styles.limite}
              style={{ color: dateLimite ? couleurUrgence(urgenceLevel(joursLimite)) : undefined }}
            >
              {dateLimite ? `${formatDateAffichage(dateLimite)} · ${libelleJours(joursLimite)}` : '—'}
            </span>
          </p>
          <button
            type="submit"
            className="btn btn-primaire"
            disabled={enregistrement || !nom.trim() || selection.length === 0}
          >
            {enregistrement
              ? 'Enregistrement…'
              : enEdition
                ? 'Enregistrer les modifications'
                : 'Créer le plat'}
          </button>
        </div>
      </form>
    </main>
  )
}
