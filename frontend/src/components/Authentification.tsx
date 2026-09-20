import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { api, SESSION_PERDUE } from '../api/client'
import type { Identifiants, Profil } from '../api/types'
import { oublierVerrou } from '../utils/verrouillage'

/** Comptes déjà vus sur cet appareil, pour la liste de l'écran de connexion. */
const CLE_COMPTES = 'fridgify-comptes'

type Contexte = {
  /** `undefined` tant que la session n'a pas été vérifiée au démarrage. */
  profil: Profil | null | undefined
  connexion: (corps: Identifiants) => Promise<void>
  inscription: (corps: Identifiants) => Promise<void>
  deconnexion: () => Promise<void>
  rafraichir: () => Promise<void>
}

const AuthContexte = createContext<Contexte>({
  profil: null,
  connexion: async () => {},
  inscription: async () => {},
  deconnexion: async () => {},
  rafraichir: async () => {},
})

export function lireComptesConnus(): string[] {
  try {
    const brut = localStorage.getItem(CLE_COMPTES)
    return brut ? (JSON.parse(brut) as string[]) : []
  } catch {
    return []
  }
}

function retenirCompte(identifiant: string): void {
  const connus = lireComptesConnus().filter((c) => c !== identifiant)
  try {
    localStorage.setItem(CLE_COMPTES, JSON.stringify([identifiant, ...connus]))
  } catch {
    /* navigation privée : la liste vaut pour la session seulement */
  }
}

/** Retire un compte de la liste de l'appareil. Le compte reste sur le serveur. */
export function oublierCompte(identifiant: string): void {
  try {
    localStorage.setItem(
      CLE_COMPTES,
      JSON.stringify(lireComptesConnus().filter((c) => c !== identifiant)),
    )
  } catch {
    /* rien à oublier */
  }
  oublierVerrou(identifiant)
}

/**
 * Qui est connecté, et comment en changer.
 *
 * La session vit dans un cookie que le JavaScript ne peut pas lire : le seul
 * moyen de savoir si elle tient encore est de le demander au serveur, ce que
 * fait `/auth/moi` au démarrage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profil, setProfil] = useState<Profil | null | undefined>(undefined)

  const rafraichir = useCallback(async () => {
    try {
      setProfil(await api.moi())
    } catch {
      // Session absente ou expirée, ou serveur injoignable : dans les trois
      // cas, il n'y a rien à afficher d'autre que l'écran de connexion.
      setProfil(null)
    }
  }, [])

  useEffect(() => {
    void rafraichir()
    const perdue = () => setProfil(null)
    window.addEventListener(SESSION_PERDUE, perdue)
    return () => window.removeEventListener(SESSION_PERDUE, perdue)
  }, [rafraichir])

  const entrer = async (corps: Identifiants, appel: (c: Identifiants) => Promise<Profil>) => {
    const nouveau = await appel(corps)
    retenirCompte(nouveau.identifiant)
    setProfil(nouveau)
  }

  const valeur: Contexte = {
    profil,
    connexion: (corps) => entrer(corps, api.connexion),
    inscription: (corps) => entrer(corps, api.inscription),
    deconnexion: async () => {
      try {
        await api.deconnexion()
      } finally {
        // Même si le serveur ne répond pas, l'application doit se fermer ici :
        // l'utilisateur a demandé à sortir.
        setProfil(null)
      }
    },
    rafraichir,
  }

  return <AuthContexte.Provider value={valeur}>{children}</AuthContexte.Provider>
}

export const useAuth = () => useContext(AuthContexte)
