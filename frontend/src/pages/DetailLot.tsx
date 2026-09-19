import { useEffect, useId, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { Categorie, Produit } from '../api/types'
import { useConfirm } from '../components/ConfirmDialog'
import { ErreurServeur, Squelette } from '../components/EtatDonnees'
import Modal from '../components/Modal'
import { useAnnulation } from '../components/UndoSnackbar'
import { Echeance, Graduations, Jeton } from '../components/Urgence'
import { useAction, useDonnees } from '../hooks/useDonnees'
import { dateCourte, joursRestants, pluriel } from '../utils/date'
import { grouperParLot, reservationsParLot, totalReserve, uniteLaPlusUrgente } from '../utils/grouping'
import { niveauUrgence } from '../utils/urgence'
import { chargerFrigo, libelleReservations } from './Inventaire'
import styles from './DetailLot.module.css'

/** Au-delà de trois unités identiques, on les résume au lieu de les empiler. */
const SEUIL_REGROUPEMENT = 3

export default function DetailLot() {
  const { lotId = '' } = useParams()
  const { donnees, erreur, recharger } = useDonnees(chargerFrigo)
  const { agir, erreur: erreurAction } = useAction(recharger)
  const { confirmer, dialogue } = useConfirm()
  const proposerAnnulation = useAnnulation()
  const naviguer = useNavigate()
  const [deplie, setDeplie] = useState(false)
  const [editionLot, setEditionLot] = useState(false)
  const [uniteDlc, setUniteDlc] = useState<Produit | null>(null)

  const groupe = useMemo(
    () => grouperParLot(donnees?.[0] ?? []).find((g) => g.lot_id === lotId) ?? null,
    [donnees, lotId],
  )
  const reservations = useMemo(
    () => reservationsParLot(donnees?.[1] ?? []).get(lotId) ?? [],
    [donnees, lotId],
  )

  if (!donnees) {
    return erreur ? <ErreurServeur message={erreur} onReessayer={recharger} /> : <Squelette />
  }
  // Dernière unité sortie, ou lien périmé : le lot n'a plus rien à montrer.
  if (!groupe) return <Navigate to="/" replace />

  const unites = groupe.unites
  const urgente = uniteLaPlusUrgente(groupe)
  const niveauLot = niveauUrgence(joursRestants(urgente.date_peremption_effective))
  const reserve = totalReserve(reservations)
  const manque = reserve > unites.length
  const resteMaison = unites.some((u) => u.est_un_reste)
  const identiques =
    unites.length > SEUIL_REGROUPEMENT &&
    unites.every(
      (u) =>
        u.date_peremption_effective === unites[0].date_peremption_effective &&
        u.est_ouvert === unites[0].est_ouvert,
    )
  const regroupe = identiques && !deplie

  const consommer = (unite: Produit) =>
    agir(async () => {
      await api.cloturerProduit(unite.id, 'consomme')
      proposerAnnulation(`« ${groupe.nom} » : 1 unité comptée comme consommée.`, async () => {
        await api.annulerCloture(unite.id)
      })
    })

  const jeter = async (unite: Produit) => {
    const accepte = await confirmer({
      titre: 'Confirmer — jeté',
      message: `« ${groupe.nom} » sera compté comme jeté dans vos statistiques.`,
      action: 'Jeter',
      destructif: true,
    })
    if (accepte) await agir(() => api.cloturerProduit(unite.id, 'jete'))
  }

  const supprimer = async (unite: Produit) => {
    const accepte = await confirmer({
      titre: 'Confirmer — suppression définitive',
      message:
        'Cette action efface définitivement l’unité, sans la compter nulle part. À utiliser en cas d’erreur de saisie, pas pour du gaspillage.',
      action: 'Supprimer',
    })
    if (accepte) await agir(() => api.supprimerProduit(unite.id))
  }

  return (
    <main className="page">
      <header className={`collant ${styles.entete}`}>
        <div className={styles.barreHaut}>
          <button type="button" className="retour" onClick={() => naviguer('/')}>
            ‹&nbsp; Frigo
          </button>
          <button type="button" className={`btn ${styles.modifier}`} onClick={() => setEditionLot(true)}>
            Modifier le lot
          </button>
        </div>
        <h1 className={styles.nom}>{groupe.nom}</h1>
        <p className={styles.meta}>
          {groupe.categorie ?? 'Sans catégorie'} · {pluriel(unites.length, 'unité')}
          {resteMaison && ' · Reste maison'}
        </p>
        {reservations.length > 0 && (
          <p className={`pastille ${styles.reservation}`} style={{ color: manque ? 'var(--acc)' : 'var(--reserve)' }}>
            {manque ? '⚠ Stock insuffisant — ' : 'Réservé — '}
            {libelleReservations(reservations)}
          </p>
        )}
      </header>

      {erreurAction && <p className="erreur">{erreurAction}</p>}

      {regroupe && (
        <section className={styles.groupe}>
          <div className={styles.groupeCorps}>
            <div className={styles.groupeTitre}>
              <span>{unites.length} unités identiques</span>
              <Jeton jours={joursRestants(unites[0].date_peremption_effective)} />
            </div>
            <Graduations nombre={unites.length} reservees={Math.min(reserve, unites.length)} niveau={niveauLot} />
            <p className={styles.groupeTexte}>
              Toutes {unites[0].est_ouvert ? 'ouvertes' : 'fermées'}, DLC{' '}
              {dateCourte(unites[0].date_peremption_effective)}. Les actions portent sur une unité à
              la fois.
            </p>
          </div>
          <div className={styles.groupeActions}>
            <button type="button" className={styles.consommer} onClick={() => consommer(unites[0])}>
              Consommé ×1
            </button>
            <button type="button" className={styles.jeter} onClick={() => jeter(unites[0])}>
              Jeté ×1
            </button>
          </div>
          <button type="button" className={styles.deplier} onClick={() => setDeplie(true)}>
            Afficher les {unites.length} unités
          </button>
        </section>
      )}

      {!regroupe &&
        unites.map((unite, index) => {
          const jours = joursRestants(unite.date_peremption_effective)
          return (
            <section key={unite.id} className={styles.unite}>
              <div className={styles.uniteTete} data-critique={niveauUrgence(jours) === 'critique'}>
                <span>
                  Unité {index + 1} / {unites.length}
                </span>
                <span className={styles.badge}>{unite.est_ouvert ? 'Ouverte' : 'Fermée'}</span>
              </div>
              <div className={styles.uniteCorps}>
                <div className={styles.uniteDates}>
                  <span className="meta">
                    {unite.est_un_reste ? 'Préparé le ' : 'Acheté le '}
                    {dateCourte(unite.date_achat)}
                  </span>
                  <span className="meta">
                    {unite.est_ouvert
                      ? 'Ouverte · DLC recalculée'
                      : `Après ouverture : ${unite.duree_apres_ouverture ?? 3} j`}
                  </span>
                </div>
                <Echeance jours={jours} />
              </div>
              <div className={`duo ${styles.rangee}`}>
                <button
                  type="button"
                  className="btn"
                  disabled={!!unite.est_ouvert}
                  onClick={() => agir(() => api.ouvrirProduit(unite.id))}
                >
                  {unite.est_ouvert ? 'Déjà ouverte' : 'Ouvrir'}
                </button>
                <button type="button" className="btn" onClick={() => setUniteDlc(unite)}>
                  Modifier DLC
                </button>
              </div>
              <div className={`duo ${styles.rangee} ${styles.rangeeFin}`}>
                <button type="button" className={`btn btn-plein ${styles.large}`} onClick={() => consommer(unite)}>
                  Consommé
                </button>
                <button type="button" className="btn btn-danger" onClick={() => jeter(unite)}>
                  Jeté
                </button>
                <button
                  type="button"
                  className={`btn btn-discret ${styles.croix}`}
                  onClick={() => supprimer(unite)}
                  aria-label="Supprimer définitivement (erreur de saisie)"
                >
                  ×
                </button>
              </div>
            </section>
          )
        })}

      {identiques && deplie && (
        <button type="button" className={`${styles.deplier} ${styles.replier}`} onClick={() => setDeplie(false)}>
          Replier
        </button>
      )}

      <p className={styles.note}>
        {manque
          ? 'Le stock est passé sous la quantité réservée. En préparant, seul ce qui reste réellement au frigo sera consommé.'
          : 'Une unité est indivisible. Supprimer définitivement n’est à utiliser qu’en cas d’erreur de saisie.'}
      </p>

      <FeuilleLot
        ouverte={editionLot}
        nom={groupe.nom}
        categorie={groupe.categorie}
        nombre={unites.length}
        onClose={() => setEditionLot(false)}
        onSave={(champs) =>
          agir(async () => {
            await api.modifierLot(groupe.lot_id, champs)
            setEditionLot(false)
          })
        }
      />
      <FeuilleDlc
        unite={uniteDlc}
        onClose={() => setUniteDlc(null)}
        onSave={(dlc) =>
          agir(async () => {
            await api.modifierProduit(uniteDlc!.id, { date_peremption_effective: dlc || null })
            setUniteDlc(null)
          })
        }
      />
      {dialogue}
    </main>
  )
}

/** Même repli que `normaliser()` côté serveur. */
const CATEGORIE_DE_REPLI = 'Autre'

function FeuilleLot({
  ouverte,
  nom,
  categorie,
  nombre,
  onClose,
  onSave,
}: {
  ouverte: boolean
  nom: string
  categorie: string | null
  nombre: number
  onClose: () => void
  onSave: (champs: { nom: string; categorie: string }) => void
}) {
  const [categories, setCategories] = useState<Categorie[]>([])
  const [nomBrouillon, setNomBrouillon] = useState(nom)
  const [categorieBrouillon, setCategorieBrouillon] = useState('')
  const titreId = useId()

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!ouverte) return
    setNomBrouillon(nom)
    // Une catégorie hors liste fermée (ligne antérieure à sa mise en place)
    // retombe sur le défaut : sans cela le select s'afficherait vide.
    setCategorieBrouillon(
      categories.some((c) => c.nom === categorie) ? categorie! : CATEGORIE_DE_REPLI,
    )
  }, [ouverte, nom, categorie, categories])

  return (
    <Modal ouvert={ouverte} onClose={onClose} labelledBy={titreId}>
      <h2 className={styles.feuilleTitre} id={titreId}>
        Modifier le lot
      </h2>
      <p className="texte-aide" style={{ fontSize: 11.5 }}>
        Le nom et la catégorie s'appliquent {nombre > 1 ? `aux ${nombre} unités` : 'à l’unité'} du lot.
      </p>
      <label className="champ-etiquete">
        <span className="etiquette">Nom</span>
        <input
          className="champ"
          value={nomBrouillon}
          maxLength={120}
          onChange={(e) => setNomBrouillon(e.target.value)}
        />
      </label>
      <label className="champ-etiquete">
        <span className="etiquette">Catégorie</span>
        <select
          className="champ"
          value={categorieBrouillon}
          onChange={(e) => setCategorieBrouillon(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.nom} value={c.nom}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="duo">
        <button type="button" className="btn" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className={`btn btn-plein ${styles.large}`}
          onClick={() => onSave({ nom: nomBrouillon.trim() || nom, categorie: categorieBrouillon })}
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  )
}

function FeuilleDlc({
  unite,
  onClose,
  onSave,
}: {
  unite: Produit | null
  onClose: () => void
  onSave: (dlc: string) => void
}) {
  const [dlc, setDlc] = useState('')
  const titreId = useId()

  useEffect(() => {
    setDlc(unite?.date_peremption_effective ?? '')
  }, [unite])

  return (
    <Modal ouvert={unite !== null} onClose={onClose} labelledBy={titreId}>
      <h2 className={styles.feuilleTitre} id={titreId}>
        Modifier la DLC d’une unité
      </h2>
      <label className="champ-etiquete">
        <span className="etiquette">Date limite de consommation</span>
        <input className="champ champ-mono" type="date" value={dlc} onChange={(e) => setDlc(e.target.value)} />
      </label>
      <p className="texte-aide" style={{ fontSize: 11.5 }}>
        Le sélecteur natif d'iOS s'ouvre au tap. Laissez vide si la date est inconnue.
      </p>
      <div className="duo">
        <button type="button" className="btn" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className={`btn btn-plein ${styles.large}`} onClick={() => onSave(dlc)}>
          Enregistrer
        </button>
      </div>
    </Modal>
  )
}
