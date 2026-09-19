import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { api } from '../api/client'
import type { Course } from '../api/types'
import { useConfirm } from '../components/ConfirmDialog'
import GlassCard from '../components/GlassCard'
import Icon from '../components/Icon'
import { useRechargementAuRetour } from '../hooks/useRechargementAuRetour'
import { formatDateAffichage } from '../utils/date'
import styles from './Courses.module.css'

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [note, setNote] = useState('')
  const [ajoutEnCours, setAjoutEnCours] = useState(false)
  const champNom = useRef<HTMLInputElement>(null)
  const { confirmer, dialogue } = useConfirm()

  const charger = useCallback(async () => {
    try {
      setCourses(await api.listerCourses())
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

  const agir = async (action: () => Promise<unknown>, echec: string) => {
    try {
      await action()
      await charger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : echec)
    }
  }

  const ajouter = async (event: FormEvent) => {
    event.preventDefault()
    if (!nom.trim()) return

    setAjoutEnCours(true)
    await agir(async () => {
      await api.creerCourse(nom.trim(), note.trim() || null)
      setNom('')
      setNote('')
      champNom.current?.focus()
    }, 'Ajout impossible.')
    setAjoutEnCours(false)
  }

  const supprimer = async (course: Course) => {
    const accepte = await confirmer({
      titre: 'Retirer de la liste',
      message: `« ${course.nom} » sera retiré de la liste de courses.`,
      action: 'Retirer',
      destructif: true,
    })
    if (accepte) await agir(() => api.supprimerCourse(course.id), 'Suppression impossible.')
  }

  const viderAchetes = async () => {
    const accepte = await confirmer({
      titre: 'Vider les achats',
      message: 'Tout ce qui est déjà acheté disparaîtra de la liste.',
      action: 'Vider',
      destructif: true,
    })
    if (accepte) await agir(() => api.viderAchetes(), 'Suppression impossible.')
  }

  const aAcheter = courses.filter((c) => c.statut === 'a_acheter')
  const achetes = courses.filter((c) => c.statut === 'achete')

  return (
    <main className="page">
      <h1 className="titre-page">Courses</h1>

      <GlassCard className={styles.carte}>
        <form className="pile" onSubmit={ajouter}>
          <div>
            <label className="label" htmlFor="nom-envie">
              Un plat qui vous fait envie
            </label>
            <input
              id="nom-envie"
              ref={champNom}
              className="input-texte"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Gnocchis chèvre miel"
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="note-envie">
              À acheter pour ce plat (facultatif)
            </label>
            <input
              id="note-envie"
              className="input-texte"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Gnocchis, chèvre, crème fraîche, lardons"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primaire"
            disabled={ajoutEnCours || !nom.trim()}
          >
            <Icon nom="plus" taille={20} epaisseur={2.2} />
            Ajouter à la liste
          </button>
        </form>
      </GlassCard>

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && <div className="spinner" />}

      {!chargement && !erreur && courses.length === 0 && (
        <p className={styles.vide}>
          <span className={styles.videTitre}>La liste est vide</span>
          Notez ici les plats qui vous font envie, et ce qu'il faudra acheter pour les cuisiner.
        </p>
      )}

      {aAcheter.length > 0 && <h2 className={styles.section}>À acheter</h2>}
      {aAcheter.map((course) => (
        <CarteCourse
          key={course.id}
          course={course}
          onAchat={() => agir(() => api.marquerAchete(course.id), 'Action impossible.')}
          onModifier={(champs) =>
            agir(() => api.modifierCourse(course.id, champs), 'Modification impossible.')
          }
          onSupprimer={() => supprimer(course)}
        />
      ))}

      {achetes.length > 0 && (
        <div className={styles.sectionLigne}>
          <h2 className={styles.section}>Achetés</h2>
          <button type="button" className={styles.vider} onClick={viderAchetes}>
            Vider
          </button>
        </div>
      )}
      {achetes.map((course) => (
        <CarteCourse
          key={course.id}
          course={course}
          onAchat={() => agir(() => api.annulerAchat(course.id), 'Action impossible.')}
          onSupprimer={() => agir(() => api.supprimerCourse(course.id), 'Suppression impossible.')}
        />
      ))}

      {dialogue}
    </main>
  )
}

type CarteProps = {
  course: Course
  /** Coche l'achat, ou le décoche pour une envie déjà achetée. */
  onAchat: () => Promise<void>
  onModifier?: (champs: { nom: string; note: string | null }) => Promise<void>
  onSupprimer: () => void
}

function CarteCourse({ course, onAchat, onModifier, onSupprimer }: CarteProps) {
  const [edition, setEdition] = useState(false)
  const [nom, setNom] = useState(course.nom)
  const [note, setNote] = useState(course.note ?? '')
  const [enCours, setEnCours] = useState(false)
  const achetee = course.statut === 'achete'

  const ouvrirEdition = () => {
    setNom(course.nom)
    setNote(course.note ?? '')
    setEdition(true)
  }

  const enregistrer = async (event: FormEvent) => {
    event.preventDefault()
    if (!onModifier || !nom.trim()) return
    setEnCours(true)
    await onModifier({ nom: nom.trim(), note: note.trim() || null })
    setEnCours(false)
    setEdition(false)
  }

  const basculerAchat = async () => {
    setEnCours(true)
    await onAchat()
    setEnCours(false)
  }

  if (edition) {
    return (
      <GlassCard className={styles.carte}>
        <form className="pile" onSubmit={enregistrer}>
          <input
            className="input-texte"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            aria-label="Nom du plat"
            maxLength={120}
            required
            autoFocus
          />
          <input
            className="input-texte"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="À acheter pour ce plat"
            placeholder="À acheter pour ce plat (facultatif)"
          />
          <div className={styles.actions}>
            <button
              type="submit"
              className={`btn btn-primaire ${styles.principal}`}
              disabled={enCours || !nom.trim()}
            >
              Enregistrer
            </button>
            <button
              type="button"
              className={`btn btn-secondaire ${styles.principal}`}
              onClick={() => setEdition(false)}
              disabled={enCours}
            >
              Annuler
            </button>
          </div>
        </form>
      </GlassCard>
    )
  }

  return (
    <GlassCard className={achetee ? `${styles.carte} ${styles.carteAchetee}` : styles.carte}>
      <h3 className={styles.nom}>{course.nom}</h3>
      {course.note && <p className={styles.note}>{course.note}</p>}
      {achetee && course.date_achat && (
        <p className={styles.date}>Acheté le {formatDateAffichage(course.date_achat)}</p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={`btn ${achetee ? 'btn-secondaire' : 'btn-primaire'} ${styles.principal}`}
          onClick={basculerAchat}
          disabled={enCours}
        >
          {achetee ? (
            'Remettre dans la liste'
          ) : (
            <>
              <Icon nom="coche" taille={18} epaisseur={2.2} />
              Acheté
            </>
          )}
        </button>
        {!achetee && onModifier && (
          <button
            type="button"
            className={styles.boutonIcone}
            onClick={ouvrirEdition}
            aria-label={`Modifier ${course.nom}`}
          >
            <Icon nom="crayon" taille={18} />
          </button>
        )}
        <button
          type="button"
          className={`${styles.boutonIcone} ${styles.boutonSupprimer}`}
          onClick={onSupprimer}
          aria-label={`Retirer ${course.nom}`}
        >
          <Icon nom="poubelle" taille={18} />
        </button>
      </div>
    </GlassCard>
  )
}
