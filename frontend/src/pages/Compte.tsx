import { useEffect, useState } from 'react'

import { numeroSection } from '../components/BarreNavigation'
import { oublierCompte, useAuth } from '../components/Authentification'
import { useConfirm } from '../components/ConfirmDialog'
import { Squelette } from '../components/EtatDonnees'
import { dateCourte, pluriel } from '../utils/date'
import {
  activerVerrou,
  oublierVerrou,
  verrouActif,
  verrouPossible,
} from '../utils/verrouillage'
import styles from './Compte.module.css'

export default function Compte() {
  const { profil, deconnexion } = useAuth()
  const { confirmer, dialogue } = useConfirm()
  const [verrouDisponible, setVerrouDisponible] = useState(false)
  const [verrouille, setVerrouille] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void verrouPossible().then(setVerrouDisponible)
    if (profil) setVerrouille(verrouActif(profil.identifiant))
  }, [profil])

  if (!profil) return <Squelette />

  const basculerVerrou = async () => {
    setErreur(null)
    if (verrouille) {
      oublierVerrou(profil.identifiant)
      setVerrouille(false)
      return
    }
    try {
      await activerVerrou(profil.identifiant)
      setVerrouille(true)
    } catch (e) {
      setErreur(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Demande annulée sur l’appareil.'
          : "Cet appareil n'a pas pu enregistrer le verrouillage.",
      )
    }
  }

  const seDeconnecter = async () => {
    const accepte = await confirmer({
      titre: 'Confirmer — déconnexion',
      message: `La session de « ${profil.identifiant} » sera fermée sur cet appareil. L’inventaire reste intact côté serveur et revient à la prochaine connexion.`,
      action: 'Se déconnecter',
      destructif: true,
    })
    if (accepte) await deconnexion()
  }

  const retirerDeLAppareil = async () => {
    const accepte = await confirmer({
      titre: 'Confirmer — retrait de l’appareil',
      message: `« ${profil.identifiant} » n’apparaîtra plus dans la liste des comptes de cet appareil. Le compte et ses données continuent d’exister sur le serveur.`,
      action: 'Retirer',
    })
    if (!accepte) return
    oublierCompte(profil.identifiant)
    await deconnexion()
  }

  const lignes: [string, string][] = [
    ['Frigo', `${pluriel(profil.lots, 'lot')} · ${pluriel(profil.unites, 'unité')}`],
    ['Compte créé le', dateCourte(profil.date_creation)],
    ['Session jusqu’au', dateCourte(profil.expiration)],
    ['Scans restants aujourd’hui', String(profil.scans_restants)],
  ]

  return (
    <main className="page">
      <header className={styles.entete}>
        <p className="kicker">{numeroSection('/compte')} · Compte</p>
        <div className={styles.identite}>
          <span className={styles.avatar}>{profil.identifiant.slice(0, 2).toUpperCase()}</span>
          <h1 className={styles.nom}>{profil.identifiant}</h1>
        </div>
      </header>

      <div className={styles.lignes}>
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className={styles.ligne}>
            <span className="etiquette">{libelle}</span>
            <span className={styles.valeur}>{valeur}</span>
          </div>
        ))}
      </div>

      {verrouDisponible && (
        <>
          <h2 className="intertitre">Verrouillage</h2>
          <div className={styles.ligne}>
            <span className={`etiquette ${styles.libre}`} id="verrou">
              Face ID à l’ouverture
            </span>
            <button
              type="button"
              role="switch"
              className="interrupteur"
              aria-checked={verrouille}
              aria-labelledby="verrou"
              onClick={basculerVerrou}
            />
          </div>
          <p className={styles.aide}>
            Demande Face ID, Touch ID ou votre empreinte à chaque ouverture de l'application sur cet
            appareil. Le mot de passe reste nécessaire pour ouvrir une nouvelle session.
          </p>
        </>
      )}

      {erreur && <p className="erreur">{erreur}</p>}

      <section className={`encadre ${styles.donnees}`}>
        <h2 className="encadre-titre">Vos données</h2>
        <div className={styles.donneesCorps}>
          <p>
            Votre inventaire est isolé : aucun autre compte du serveur n'y accède, et vous ne voyez
            rien des leurs.
          </p>
          <p>
            Se déconnecter ne supprime rien : tout est conservé côté serveur et revient à la
            prochaine connexion.
          </p>
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className="btn btn-danger" onClick={seDeconnecter}>
          Se déconnecter
        </button>
        <button type="button" className={`btn-lien ${styles.retirer}`} onClick={retirerDeLAppareil}>
          Retirer ce compte de l'appareil
        </button>
      </div>
      {dialogue}
    </main>
  )
}
