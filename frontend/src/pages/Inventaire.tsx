import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import { ErreurServeur, Squelette } from '../components/EtatDonnees'
import { Echeance, Graduations, Tranche } from '../components/Urgence'
import { useDonnees } from '../hooks/useDonnees'
import { dateCourte, joursRestants, pluriel } from '../utils/date'
import {
  grouperParLot,
  reservationsParLot,
  totalReserve,
  uniteLaPlusUrgente,
  type ProduitGroupe,
  type Reservation,
} from '../utils/grouping'
import { niveauUrgence } from '../utils/urgence'
import styles from './Inventaire.module.css'

type Affectation = 'tout' | 'libres' | 'reserves'

/** Inventaire et plats partent ensemble : l'un seul ne dit pas ce qui est réservé. */
export const chargerFrigo = () => Promise.all([api.listerProduits(), api.listerPlats()])

export default function Inventaire() {
  const { donnees, erreur, recharger } = useDonnees(chargerFrigo)
  const [categorie, setCategorie] = useState<string | null>(null)
  const [affectation, setAffectation] = useState<Affectation>('tout')
  const naviguer = useNavigate()

  const groupes = useMemo(() => grouperParLot(donnees?.[0] ?? []), [donnees])
  const reservations = useMemo(() => reservationsParLot(donnees?.[1] ?? []), [donnees])

  if (!donnees) {
    return erreur ? <ErreurServeur message={erreur} onReessayer={recharger} /> : <Squelette />
  }

  const categories = [...new Set(groupes.map((g) => g.categorie).filter((c): c is string => !!c))].sort()
  const visibles = groupes
    .filter((g) => !categorie || g.categorie === categorie)
    .filter((g) => {
      if (affectation === 'tout') return true
      return reservations.has(g.lot_id) === (affectation === 'reserves')
    })

  // Le lot compte au niveau de son unité la plus pressée ; « inconnu » rejoint
  // les « ok » dans la jauge, qui ne parle que de ce qui presse.
  const compte = { critique: 0, attention: 0, ok: 0 }
  for (const groupe of groupes) {
    const niveau = niveauUrgence(joursRestants(uniteLaPlusUrgente(groupe).date_peremption_effective))
    compte[niveau === 'inconnu' ? 'ok' : niveau] += 1
  }
  const unites = groupes.reduce((total, g) => total + g.unites.length, 0)

  return (
    <main className="page">
      <header className={styles.entete}>
        <div className={styles.titreLigne}>
          <div className={styles.titreGroupe}>
            {/* Une version par palette ; le CSS n'affiche que celle du thème actif. */}
            <img className={`${styles.logo} ${styles.logoClair}`} src="/logo-clair.png" alt="" />
            <img className={`${styles.logo} ${styles.logoSombre}`} src="/logo-sombre.png" alt="" />
            <h1 className={styles.titre}>Frigo</h1>
          </div>
          <p className={styles.totaux}>
            {pluriel(groupes.length, 'lot')} · {pluriel(unites, 'unité')}
          </p>
        </div>
        <div className={styles.jauge} aria-hidden>
          {(['critique', 'attention', 'ok'] as const).map((niveau) => (
            <div
              key={niveau}
              className={styles[niveau]}
              style={{
                width: `${(compte[niveau] / Math.max(groupes.length, 1)) * 100}%`,
                minWidth: compte[niveau] ? 6 : 0,
              }}
            />
          ))}
        </div>
        <p className={styles.jaugeLegende}>
          <span className={styles.critiques}>
            {compte.critique ? pluriel(compte.critique, 'critique') : 'rien d’urgent'}
          </span>
          <span>
            {compte.attention} attention · {compte.ok} ok
          </span>
        </p>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      {groupes.length > 0 && (
        <div className={`collant ${styles.filtres}`}>
          {reservations.size > 0 && (
            <div className={styles.affectation} role="group" aria-label="Filtrer par affectation">
              {(
                [
                  ['tout', 'Tout'],
                  ['libres', 'Libres'],
                  ['reserves', 'Réservés'],
                ] as const
              ).map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={affectation === valeur}
                  onClick={() => setAffectation(valeur)}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}
          <div className={styles.categories} role="group" aria-label="Filtrer par catégorie">
            {[null, ...categories].map((valeur) => (
              <button
                key={valeur ?? 'toutes'}
                type="button"
                aria-pressed={categorie === valeur}
                onClick={() => setCategorie(valeur)}
              >
                {valeur ?? 'Toutes'}
              </button>
            ))}
          </div>
        </div>
      )}

      {groupes.length === 0 && (
        <div className="vide">
          <div className="vide-cadre" style={{ height: 90 }} />
          <h2 className="vide-titre">Le frigo est vide.</h2>
          <p className="texte-aide">
            Ajoutez un produit à la main, ou scannez un ticket de caisse pour tout enregistrer d'un
            coup.
          </p>
          <div className="duo" style={{ width: '100%' }}>
            <button type="button" className="btn btn-plein" onClick={() => naviguer('/ajout')}>
              Ajouter
            </button>
            <button type="button" className="btn" onClick={() => naviguer('/scan')}>
              Scanner
            </button>
          </div>
        </div>
      )}

      {groupes.length > 0 && visibles.length === 0 && (
        <div className="vide">
          <h2 className="vide-titre">
            {categorie
              ? `Aucun ${categorie.toLowerCase()}`
              : affectation === 'libres'
                ? 'Tout est réservé'
                : 'Aucun lot réservé'}
          </h2>
          <p className="texte-aide">Aucun lot ne correspond à ce filtre.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCategorie(null)
              setAffectation('tout')
            }}
          >
            Tout afficher
          </button>
        </div>
      )}

      {visibles.map((groupe) => (
        <LigneLot key={groupe.lot_id} groupe={groupe} reservations={reservations.get(groupe.lot_id)} />
      ))}
    </main>
  )
}

/** Libellé d'une réservation : « Poulet curry ×2 · Omelette ×1 ». */
export function libelleReservations(reservations: Reservation[]): string {
  return reservations.map((r) => `${r.nom} ×${r.quantite}`).join(' · ')
}

function LigneLot({ groupe, reservations = [] }: { groupe: ProduitGroupe; reservations?: Reservation[] }) {
  const urgente = uniteLaPlusUrgente(groupe)
  const jours = joursRestants(urgente.date_peremption_effective)
  const niveau = niveauUrgence(jours)
  const reserve = totalReserve(reservations)
  const manque = reserve > groupe.unites.length

  return (
    <Link to={`/lot/${encodeURIComponent(groupe.lot_id)}`} className={styles.lot}>
      <Tranche niveau={niveau} />
      <div className={styles.lotCorps}>
        <div className={styles.lotHaut}>
          <div className={styles.lotTextes}>
            <div className={styles.nom}>{groupe.nom}</div>
            <div className={styles.meta}>
              {groupe.categorie ?? 'Sans catégorie'} · {urgente.est_un_reste ? 'Préparé le' : 'Acheté le'}{' '}
              {dateCourte(urgente.date_achat)}
            </div>
          </div>
          <Echeance jours={jours} />
        </div>
        <div className={styles.lotBas}>
          <Graduations
            nombre={groupe.unites.length}
            reservees={Math.min(reserve, groupe.unites.length)}
            niveau={niveau}
          />
          <span className={styles.compte}>{pluriel(groupe.unites.length, 'unité')}</span>
          {reservations.length > 0 && (
            <span className="pastille" style={{ color: manque ? 'var(--acc)' : 'var(--reserve)' }}>
              {manque && '⚠ '}
              {libelleReservations(reservations)}
              {manque && ' — stock insuffisant'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
