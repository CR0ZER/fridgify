import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Plat, Produit } from '../api/types'
import Icon from '../components/Icon'
import LotDetailModal from '../components/LotDetailModal'
import ProductGroupCard from '../components/ProductGroupCard'
import UndoSnackbar from '../components/UndoSnackbar'
import { useRechargementAuRetour } from '../hooks/useRechargementAuRetour'
import { grouperParLot } from '../utils/grouping'
import styles from './Inventaire.module.css'

export default function Inventaire() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [plats, setPlats] = useState<Plat[]>([])
  const [affectation, setAffectation] = useState<'tout' | 'libres' | 'reserves'>('tout')
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [lotSelectionne, setLotSelectionne] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<string | null>(null)
  const [uniteAnnulable, setUniteAnnulable] = useState<Produit | null>(null)
  const naviguer = useNavigate()

  const charger = useCallback(async () => {
    try {
      // Les deux appels partent ensemble : l'inventaire seul ne dit pas ce qui
      // est deja engage dans un plat.
      const [inventaire, menus] = await Promise.all([api.listerProduits(), api.listerPlats()])
      setProduits(inventaire)
      setPlats(menus)
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])
  useRechargementAuRetour(charger)

  const groupes = useMemo(() => grouperParLot(produits), [produits])

  /** lot_id -> plats prévus qui en réservent une part. */
  const reservations = useMemo(() => {
    const index = new Map<string, { nom: string; quantite: number }[]>()
    for (const plat of plats) {
      if (plat.statut !== 'prevu') continue
      for (const ingredient of plat.ingredients) {
        const liste = index.get(ingredient.lot_id) ?? []
        liste.push({ nom: plat.nom, quantite: ingredient.quantite })
        index.set(ingredient.lot_id, liste)
      }
    }
    return index
  }, [plats])

  const categories = useMemo(
    () => [...new Set(groupes.map((g) => g.categorie).filter((c): c is string => !!c))].sort(),
    [groupes],
  )

  const groupesFiltres = useMemo(
    () =>
      groupes
        .filter((g) => !filtre || g.categorie === filtre)
        .filter((g) => {
          if (affectation === 'tout') return true
          const reserve = reservations.has(g.lot_id)
          return affectation === 'reserves' ? reserve : !reserve
        }),
    [groupes, filtre, affectation, reservations],
  )
  const groupeSelectionne = groupes.find((g) => g.lot_id === lotSelectionne) ?? null

  const consommer = async (unite: Produit) => {
    try {
      await api.cloturerProduit(unite.id, 'consomme')
      setUniteAnnulable(unite)
      await charger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible.')
    }
  }

  const annuler = async () => {
    if (!uniteAnnulable) return
    try {
      await api.annulerCloture(uniteAnnulable.id)
      await charger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Annulation impossible.")
    } finally {
      setUniteAnnulable(null)
    }
  }

  return (
    <main className="page">
      <header className={styles.entete}>
        <div className={styles.titreGroupe}>
          <img className={styles.logo} src="/logo-mark.png" alt="" />
          <h1 className={styles.titre}>Fridgify</h1>
        </div>
        <div className={styles.actionsEntete}>
          <button
            type="button"
            className={styles.boutonEntete}
            onClick={() => naviguer('/historique')}
            aria-label="Voir l'historique"
          >
            <Icon nom="stats" />
          </button>
          <button
            type="button"
            className={styles.boutonEntete}
            onClick={() => naviguer('/reglages')}
            aria-label="Ouvrir les réglages"
          >
            <Icon nom="engrenage" />
          </button>
        </div>
      </header>

      {reservations.size > 0 && (
        <div className={styles.segments} role="group" aria-label="Filtrer par affectation">
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
              className={
                affectation === valeur ? `${styles.segment} ${styles.segmentActif}` : styles.segment
              }
              onClick={() => setAffectation(valeur)}
              aria-pressed={affectation === valeur}
            >
              {libelle}
            </button>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className={styles.filtres}>
          <button
            type="button"
            className={filtre === null ? `${styles.chip} ${styles.chipActif}` : styles.chip}
            onClick={() => setFiltre(null)}
          >
            Tous
          </button>
          {categories.map((categorie) => (
            <button
              key={categorie}
              type="button"
              className={filtre === categorie ? `${styles.chip} ${styles.chipActif}` : styles.chip}
              onClick={() => setFiltre(filtre === categorie ? null : categorie)}
            >
              {categorie}
            </button>
          ))}
        </div>
      )}

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && <div className="spinner" />}

      {!chargement &&
        !erreur &&
        (groupesFiltres.length === 0 ? (
          <p className="vide">
            {affectation === 'libres'
              ? 'Tout est déjà réservé pour un plat.'
              : affectation === 'reserves'
                ? 'Aucun produit réservé pour le moment.'
                : "Frigo vide pour l'instant."}
          </p>
        ) : (
          groupesFiltres.map((groupe) => (
            <ProductGroupCard
              key={groupe.lot_id}
              groupe={groupe}
              reservations={reservations.get(groupe.lot_id)}
              onPress={() => setLotSelectionne(groupe.lot_id)}
            />
          ))
        ))}

      <LotDetailModal
        groupe={groupeSelectionne}
        onClose={() => setLotSelectionne(null)}
        onRefresh={charger}
        onConsommer={consommer}
        onErreur={setErreur}
      />

      <UndoSnackbar
        message={uniteAnnulable ? `${uniteAnnulable.nom} marqué consommé` : null}
        onUndo={annuler}
        onTimeout={() => setUniteAnnulable(null)}
      />
    </main>
  )
}
