import type {
  Categorie,
  Identifiants,
  Course,
  DisponibiliteLot,
  EtatPush,
  IngredientReserve,
  LotCree,
  Plat,
  PreparationPlat,
  Produit,
  ProduitDetecte,
  Profil,
  ResultatEnvoi,
  Stats,
  StatutFin,
  UniteACreer,
} from './types'

/**
 * Meme origine que la page : c'est nginx qui relaie /api vers FastAPI et qui
 * ajoute le header X-API-Key. Le secret ne transite donc jamais par le
 * navigateur. En developpement, le proxy de Vite joue le meme role.
 */
const BASE = '/api'

const INJOIGNABLE = 'Serveur injoignable. La Raspberry est-elle allumée ?'

/**
 * Signale une session devenue invalide : expirée, fermée ailleurs, ou effacée
 * par un changement de mot de passe. Le fournisseur d'authentification écoute
 * et ramène à l'écran de connexion, depuis n'importe quel écran.
 */
export const SESSION_PERDUE = 'fridgify:session-perdue'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function requete<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(`${BASE}${chemin}`, options)
  } catch {
    throw new ApiError(INJOIGNABLE, 0)
  }

  // nginx répond lui-même 502 quand l'API est arrêtée : pour l'utilisateur,
  // c'est la même panne qu'une Raspberry éteinte.
  if ([502, 503, 504].includes(reponse.status)) {
    throw new ApiError(INJOIGNABLE, reponse.status)
  }
  if (!reponse.ok) {
    const message = await messageErreur(reponse)
    // Un 401 signe une session absente ou expirée, d'où qu'il vienne : l'écran
    // affiché n'a alors rien à réessayer, il faut ramener à la connexion. Seuls
    // la connexion et l'inscription y échappent : leur 401 dit « mot de passe
    // refusé », pas « session perdue ».
    const tentative = chemin === '/auth/connexion' || chemin === '/auth/inscription'
    if (reponse.status === 401 && !tentative) {
      window.dispatchEvent(new Event(SESSION_PERDUE))
    }
    throw new ApiError(message, reponse.status)
  }

  if (reponse.status === 204) return undefined as T
  return (await reponse.json()) as T
}

/** FastAPI renvoie {detail: ...} ; le detail est parfois une liste de validations. */
async function messageErreur(reponse: Response): Promise<string> {
  try {
    const corps = await reponse.json()
    const detail = corps?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', ')
    }
  } catch {
    /* corps non JSON : on retombe sur le message generique */
  }
  return `Erreur serveur (${reponse.status}).`
}

function json(methode: string, corps: unknown): RequestInit {
  return {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }
}

export type Health = {
  status: string
  auth_active: boolean
  gemini_configure: boolean
  push_configure: boolean
}

export const api = {
  health: () => requete<Health>('/health'),

  inscription: (corps: Identifiants) => requete<Profil>('/auth/inscription', json('POST', corps)),

  connexion: (corps: Identifiants) => requete<Profil>('/auth/connexion', json('POST', corps)),

  deconnexion: () => requete<void>('/auth/deconnexion', { method: 'POST' }),

  moi: () => requete<Profil>('/auth/moi'),

  listerProduits: () => requete<Produit[]>('/produits'),

  categories: () => requete<Categorie[]>('/categories'),

  creerLot: (unite: UniteACreer, count: number) =>
    requete<LotCree>('/lots', json('POST', { unite, count })),

  modifierLot: (lotId: string, champs: { nom?: string; categorie?: string | null }) =>
    requete<Produit[]>(`/lots/${encodeURIComponent(lotId)}`, json('PATCH', champs)),

  modifierProduit: (id: number, champs: Partial<Produit>) =>
    requete<Produit>(`/produits/${id}`, json('PATCH', champs)),

  ouvrirProduit: (id: number) => requete<Produit>(`/produits/${id}/ouvrir`, { method: 'POST' }),

  cloturerProduit: (id: number, statut: StatutFin) =>
    requete<Produit>(`/produits/${id}/statut`, json('POST', { statut })),

  annulerCloture: (id: number) =>
    requete<Produit>(`/produits/${id}/statut`, { method: 'DELETE' }),

  supprimerProduit: (id: number) => requete<void>(`/produits/${id}`, { method: 'DELETE' }),

  viderFrigo: () => requete<void>('/produits', { method: 'DELETE' }),

  stats: () => requete<Stats>('/stats'),

  lireReglage: (cle: string) =>
    requete<{ key: string; value: string | null }>(`/settings/${encodeURIComponent(cle)}`),

  ecrireReglage: (cle: string, value: string) =>
    requete<{ key: string; value: string }>(
      `/settings/${encodeURIComponent(cle)}`,
      json('PUT', { value }),
    ),

  reinitialiserReglage: (cle: string) =>
    requete<void>(`/settings/${encodeURIComponent(cle)}`, { method: 'DELETE' }),

  reglagesParDefaut: () => requete<Record<string, string>>('/settings/defaults'),

  listerPlats: () => requete<Plat[]>('/plats'),

  lirePlat: (id: number) => requete<Plat>(`/plats/${id}`),

  disponibilites: () => requete<DisponibiliteLot[]>('/disponibilites'),

  creerPlat: (nom: string, note: string | null, ingredients: IngredientReserve[]) =>
    requete<Plat>('/plats', json('POST', { nom, note, ingredients })),

  modifierPlat: (
    id: number,
    champs: { nom?: string; note?: string | null; ingredients?: IngredientReserve[] },
  ) => requete<Plat>(`/plats/${id}`, json('PATCH', champs)),

  supprimerPlat: (id: number) => requete<void>(`/plats/${id}`, { method: 'DELETE' }),

  preparerPlat: (id: number, corps: PreparationPlat) =>
    requete<Plat>(`/plats/${id}/preparer`, json('POST', corps)),

  listerCourses: () => requete<Course[]>('/courses'),

  creerCourse: (nom: string, note: string | null) =>
    requete<Course>('/courses', json('POST', { nom, note })),

  modifierCourse: (id: number, champs: { nom?: string; note?: string | null }) =>
    requete<Course>(`/courses/${id}`, json('PATCH', champs)),

  supprimerCourse: (id: number) => requete<void>(`/courses/${id}`, { method: 'DELETE' }),

  marquerAchete: (id: number) => requete<Course>(`/courses/${id}/achat`, { method: 'POST' }),

  annulerAchat: (id: number) => requete<Course>(`/courses/${id}/achat`, { method: 'DELETE' }),

  viderAchetes: () => requete<void>('/courses/achetes', { method: 'DELETE' }),

  etatPush: () => requete<EtatPush>('/push/etat'),

  abonnerPush: (abonnement: PushSubscription) =>
    requete<EtatPush>('/push/abonnements', json('POST', abonnement.toJSON())),

  desabonnerPush: (endpoint: string) =>
    requete<void>('/push/abonnements', json('DELETE', { endpoint })),

  testerPush: () => requete<ResultatEnvoi>('/push/test', { method: 'POST' }),

  scannerTicket: (image: Blob, signal?: AbortSignal) => {
    const form = new FormData()
    form.append('image', image, 'ticket.jpg')
    return requete<ProduitDetecte[]>('/llm/scan', { method: 'POST', body: form, signal })
  },
}
