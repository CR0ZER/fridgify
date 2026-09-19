import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { DisponibiliteLot } from '../api/types'
import { Squelette } from '../components/EtatDonnees'
import Stepper from '../components/Stepper'
import { dateCourte, jeton, joursRestants } from '../utils/date'
import { niveauUrgence } from '../utils/urgence'
import styles from './ComposerPlat.module.css'

/** Sert à la fois à créer un plat et à modifier un plat déjà prévu. */
export default function ComposerPlat() {
  const { platId } = useParams()
  const naviguer = useNavigate()
  const retour = platId ? `/plats/${platId}` : '/plats'

  const [nom, setNom] = useState('')
  const [note, setNote] = useState('')
  const [lots, setLots] = useState<DisponibiliteLot[] | null>(null)
  const [quantites, setQuantites] = useState<Record<string, number>>({})
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    const charger = async () => {
      try {
        const disponibilites = await api.disponibilites()
        if (!platId) {
          setLots(disponibilites)
          return
        }
        const plat = await api.lirePlat(Number(platId))
        setNom(plat.nom)
        setNote(plat.note ?? '')

        // Un lot entièrement consommé depuis la création du plat a disparu des
        // disponibilités. On l'écarte : le garder ferait échouer
        // l'enregistrement sur un lot introuvable, sans moyen de le retirer.
        const existants = new Set(disponibilites.map((lot) => lot.lot_id))
        const sien = new Map(
          plat.ingredients.filter((i) => existants.has(i.lot_id)).map((i) => [i.lot_id, i.quantite]),
        )
        setQuantites(Object.fromEntries(sien))
        // Les quantités déjà réservées par ce plat lui restent accessibles :
        // sans cela, ses propres ingrédients apparaîtraient épuisés.
        setLots(
          disponibilites.map((lot) => ({ ...lot, disponible: lot.disponible + (sien.get(lot.lot_id) ?? 0) })),
        )
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
        setLots((actuels) => actuels ?? [])
      }
    }
    void charger()
  }, [platId])

  const selection = useMemo(() => Object.entries(quantites).filter(([, q]) => q > 0), [quantites])

  /** Échéance du plat : la DLC la plus proche parmi les produits retenus. */
  const dateLimite = useMemo(() => {
    const dates = selection
      .map(([lotId]) => lots?.find((l) => l.lot_id === lotId)?.date_peremption_effective)
      .filter((d): d is string => !!d)
    return dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null
  }, [selection, lots])

  const valide = !!nom.trim() && selection.length > 0

  const enregistrer = async (event: FormEvent) => {
    event.preventDefault()
    if (!valide) return
    setEnregistrement(true)
    setErreur(null)
    const ingredients = selection.map(([lot_id, quantite]) => ({ lot_id, quantite }))
    try {
      if (platId) {
        await api.modifierPlat(Number(platId), { nom: nom.trim(), note: note.trim() || null, ingredients })
      } else {
        await api.creerPlat(nom.trim(), note.trim() || null, ingredients)
      }
      naviguer(retour)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.")
      setEnregistrement(false)
    }
  }

  if (!lots) return <Squelette />

  const joursLimite = joursRestants(dateLimite)

  return (
    <main className="page">
      <form onSubmit={enregistrer}>
        <header className="entete-page" style={{ paddingTop: 2 }}>
          <button type="button" className="retour" onClick={() => naviguer(retour)}>
            ‹&nbsp; Plats
          </button>
          <h1 className="titre-moyen">{platId ? 'Modifier le plat' : 'Nouveau plat'}</h1>
        </header>

        <div className={styles.champs}>
          <label className="champ-etiquete">
            <span className="etiquette">Nom du plat</span>
            <input
              className={`champ ${styles.nom}`}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              maxLength={120}
              required
              autoFocus={!platId}
            />
          </label>
          <label className="champ-etiquete">
            <span className="etiquette">Note (facultative)</span>
            <input
              className={`champ ${styles.note}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Pour dimanche midi"
            />
          </label>
        </div>

        <div className={styles.titreIngredients}>
          <h2 className="etiquette" style={{ fontSize: 9.5 }}>
            Ingrédients
          </h2>
          <span
            className={styles.limite}
            style={{
              color:
                selection.length === 0
                  ? 'var(--muted)'
                  : niveauUrgence(joursLimite) === 'critique'
                    ? 'var(--acc)'
                    : 'var(--ink)',
            }}
          >
            {selection.length === 0
              ? 'Aucun ingrédient'
              : dateLimite
                ? `Date limite ${dateCourte(dateLimite)} · ${jeton(joursLimite)}`
                : 'Sans date limite'}
          </span>
        </div>

        {lots.length === 0 && (
          <p className="texte-aide" style={{ padding: '0 20px' }}>
            Le frigo est vide. Ajoutez des produits avant de composer un plat.
          </p>
        )}

        {lots.map((lot) => {
          const retenu = quantites[lot.lot_id] ?? 0
          const epuise = lot.disponible <= 0 && retenu === 0
          return (
            <div
              key={lot.lot_id}
              className={styles.lot}
              data-retenu={retenu > 0}
              data-epuise={epuise}
            >
              <div className={styles.lotTextes}>
                <span className={styles.lotNom}>{lot.nom}</span>
                <span className={styles.lotStock}>
                  {epuise
                    ? 'déjà tout réservé'
                    : `${lot.disponible} disponible${lot.disponible > 1 ? 's' : ''} sur ${lot.stock}`}
                </span>
              </div>
              {!epuise && (
                <Stepper
                  valeur={retenu}
                  max={lot.disponible}
                  label={lot.nom}
                  onChange={(valeur) => setQuantites((actuelles) => ({ ...actuelles, [lot.lot_id]: valeur }))}
                />
              )}
            </div>
          )
        })}

        {erreur && <p className="erreur">{erreur}</p>}

        <div className={`duo ${styles.actions}`}>
          <button type="button" className="btn" onClick={() => naviguer(retour)}>
            Annuler
          </button>
          <button type="submit" className={`btn btn-plein ${styles.valider}`} disabled={enregistrement || !valide}>
            {enregistrement ? 'Enregistrement…' : platId ? 'Enregistrer' : 'Créer le plat'}
          </button>
        </div>
      </form>
    </main>
  )
}
