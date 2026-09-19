import { useState, type FormEvent } from 'react'

import { api } from '../api/client'
import type { Course } from '../api/types'
import { numeroSection } from '../components/BarreNavigation'
import { useConfirm } from '../components/ConfirmDialog'
import { ErreurServeur, Squelette } from '../components/EtatDonnees'
import { useAction, useDonnees } from '../hooks/useDonnees'
import { dateCourte } from '../utils/date'
import styles from './Courses.module.css'

export default function Courses() {
  const { donnees: courses, erreur, recharger } = useDonnees(api.listerCourses)
  const { agir, erreur: erreurAction } = useAction(recharger)
  const { confirmer, dialogue } = useConfirm()
  const [nouvelle, setNouvelle] = useState('')
  const [enEdition, setEnEdition] = useState<number | null>(null)

  if (!courses) {
    return erreur ? <ErreurServeur message={erreur} onReessayer={recharger} /> : <Squelette />
  }

  const ajouter = async (event: FormEvent) => {
    event.preventDefault()
    const nom = nouvelle.trim()
    if (!nom) return
    if (await agir(() => api.creerCourse(nom, null))) setNouvelle('')
  }

  const supprimer = async (course: Course) => {
    const accepte = await confirmer({
      titre: 'Confirmer — suppression',
      message: `« ${course.nom} » sera retiré de la liste de courses.`,
      action: 'Supprimer',
      destructif: true,
    })
    if (accepte && (await agir(() => api.supprimerCourse(course.id)))) setEnEdition(null)
  }

  const viderAchetes = async () => {
    const accepte = await confirmer({
      titre: 'Confirmer — vider',
      message: 'Tous les éléments déjà achetés seront retirés de la liste.',
      action: 'Vider',
      destructif: true,
    })
    if (accepte) await agir(() => api.viderAchetes())
  }

  const aAcheter = courses.filter((c) => c.statut === 'a_acheter')
  const achetes = courses
    .filter((c) => c.statut === 'achete')
    .sort((a, b) => (b.date_achat ?? '').localeCompare(a.date_achat ?? ''))

  return (
    <main className="page">
      <header className="entete-page">
        <p className="kicker">{numeroSection('/courses')} · Liste de courses</p>
        <h1 className="titre">Courses</h1>
      </header>

      <form className={`duo ${styles.ajout}`} onSubmit={ajouter}>
        <input
          className={`champ ${styles.saisie}`}
          value={nouvelle}
          onChange={(e) => setNouvelle(e.target.value)}
          placeholder="Un plat qui fait envie…"
          maxLength={120}
          aria-label="Un plat qui fait envie"
        />
        <button type="submit" className={`btn btn-plein ${styles.ajouter}`} disabled={!nouvelle.trim()}>
          Ajouter
        </button>
      </form>

      {(erreur || erreurAction) && <p className="erreur">{erreur ?? erreurAction}</p>}

      {courses.length === 0 && (
        <div className="vide" style={{ paddingTop: 40 }}>
          <div className="vide-cadre" />
          <h2 className="vide-titre">Rien sur la liste.</h2>
          <p className="texte-aide">
            Notez les plats qui vous font envie et ce qu'il faut acheter pour les faire. Cette liste
            est indépendante du frigo.
          </p>
        </div>
      )}

      {aAcheter.map((course) =>
        enEdition === course.id ? (
          <EditionCourse
            key={course.id}
            course={course}
            onAnnuler={() => setEnEdition(null)}
            onSupprimer={() => supprimer(course)}
            onEnregistrer={async (champs) => {
              if (await agir(() => api.modifierCourse(course.id, champs))) setEnEdition(null)
            }}
          />
        ) : (
          <div key={course.id} className={styles.course}>
            <button
              type="button"
              className={styles.case}
              onClick={() => agir(() => api.marquerAchete(course.id))}
              aria-label={`Marquer « ${course.nom} » comme acheté`}
            />
            <button type="button" className={styles.textes} onClick={() => setEnEdition(course.id)}>
              <span className={styles.nom}>{course.nom}</span>
              {course.note && <span className={styles.note}>{course.note}</span>}
            </button>
          </div>
        ),
      )}

      {achetes.length > 0 && (
        <div className={styles.titreAchetes}>
          <h2 className="etiquette" style={{ fontSize: 9.5 }}>
            Achetés ({achetes.length})
          </h2>
          <button type="button" className="btn-lien" style={{ color: 'var(--danger)' }} onClick={viderAchetes}>
            Vider
          </button>
        </div>
      )}
      {achetes.map((course) => (
        <div key={course.id} className={`${styles.course} ${styles.achetee}`}>
          <span className={`${styles.case} ${styles.cochee}`} aria-hidden>
            ✓
          </span>
          <div className={styles.textes}>
            <span className={styles.nom}>{course.nom}</span>
            <span className="meta" style={{ fontSize: 9 }}>
              Acheté le {dateCourte(course.date_achat)}
            </span>
          </div>
          <button
            type="button"
            className={`btn btn-discret ${styles.remettre}`}
            onClick={() => agir(() => api.annulerAchat(course.id))}
          >
            Remettre
          </button>
        </div>
      ))}

      {dialogue}
    </main>
  )
}

function EditionCourse({
  course,
  onAnnuler,
  onSupprimer,
  onEnregistrer,
}: {
  course: Course
  onAnnuler: () => void
  onSupprimer: () => void
  onEnregistrer: (champs: { nom: string; note: string | null }) => void
}) {
  const [nom, setNom] = useState(course.nom)
  const [note, setNote] = useState(course.note ?? '')

  const enregistrer = (event: FormEvent) => {
    event.preventDefault()
    if (nom.trim()) onEnregistrer({ nom: nom.trim(), note: note.trim() || null })
  }

  return (
    <form className={styles.edition} onSubmit={enregistrer}>
      <input
        className="champ"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        maxLength={120}
        required
        autoFocus
        aria-label="Nom du plat"
      />
      <input
        className={`champ ${styles.champNote}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ce qu'il faut acheter"
        aria-label="Ce qu'il faut acheter"
      />
      <div className="duo">
        <button
          type="button"
          className={`btn btn-danger ${styles.croix}`}
          onClick={onSupprimer}
          aria-label="Supprimer de la liste"
        >
          ×
        </button>
        <button type="button" className="btn" onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className={`btn btn-plein ${styles.enregistrer}`} disabled={!nom.trim()}>
          Enregistrer
        </button>
      </div>
    </form>
  )
}
