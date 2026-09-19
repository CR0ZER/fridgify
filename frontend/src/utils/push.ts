/**
 * Activation des notifications de péremption côté navigateur.
 *
 * Trois conditions doivent être réunies, et chacune échoue différemment :
 * un contexte sécurisé (HTTPS), un service worker, et l'autorisation de
 * l'utilisateur. On les distingue pour pouvoir expliquer ce qui manque plutôt
 * que d'afficher « indisponible ».
 */

export type EtatSupport =
  /** Tout est en place, l'activation peut être proposée. */
  | 'ok'
  /** Servi en HTTP : ni service worker ni push possibles. */
  | 'non-securise'
  /** iOS n'expose le push qu'aux applications ajoutées à l'écran d'accueil. */
  | 'ios-hors-ecran-accueil'
  /** Navigateur sans Web Push. */
  | 'non-supporte'

function estIOS(): boolean {
  // iPadOS se présente comme un Mac : on le reconnaît à son écran tactile.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function surEcranAccueil(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Propriété non standard, seule disponible sous Safari iOS.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export function etatSupport(): EtatSupport {
  if (!window.isSecureContext) return 'non-securise'
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return 'non-supporte'
  if (!('PushManager' in window)) {
    // Sous iOS, PushManager n'existe tout simplement pas dans un onglet Safari.
    return estIOS() && !surEcranAccueil() ? 'ios-hors-ecran-accueil' : 'non-supporte'
  }
  return 'ok'
}

/**
 * La clé publique VAPID voyage en base64url ; l'API navigateur veut des octets.
 *
 * Le tampon est alloué explicitement : depuis TypeScript 5.7, `Uint8Array` est
 * générique sur son tampon, et `applicationServerKey` n'accepte qu'un
 * `ArrayBuffer` — pas le `ArrayBufferLike` que renvoie `Uint8Array.from`.
 */
function versOctets(base64url: string): Uint8Array<ArrayBuffer> {
  const remplissage = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + remplissage).replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(base64)

  const octets = new Uint8Array(new ArrayBuffer(brut.length))
  for (let index = 0; index < brut.length; index += 1) {
    octets[index] = brut.charCodeAt(index)
  }
  return octets
}

export async function abonnementCourant(): Promise<PushSubscription | null> {
  if (etatSupport() !== 'ok') return null
  const enregistrement = await navigator.serviceWorker.ready
  return enregistrement.pushManager.getSubscription()
}

/**
 * Demande l'autorisation puis crée l'abonnement.
 *
 * À appeler depuis un vrai clic : les navigateurs refusent une demande
 * d'autorisation qui ne découle pas d'un geste de l'utilisateur.
 */
export async function activer(clePublique: string): Promise<PushSubscription> {
  const autorisation = await Notification.requestPermission()
  if (autorisation !== 'granted') {
    throw new Error(
      autorisation === 'denied'
        ? "Les notifications ont été refusées pour ce site. Rouvrez l'autorisation dans les réglages du navigateur."
        : 'Autorisation non accordée.',
    )
  }

  const enregistrement = await navigator.serviceWorker.ready
  const existant = await enregistrement.pushManager.getSubscription()
  if (existant) return existant

  return enregistrement.pushManager.subscribe({
    // Obligatoire : nous nous engageons à afficher une notification visible
    // pour chaque message reçu. Le service worker le fait sans exception.
    userVisibleOnly: true,
    applicationServerKey: versOctets(clePublique),
  })
}

/** Renvoie l'endpoint désabonné, pour que le serveur puisse l'oublier aussi. */
export async function desactiver(): Promise<string | null> {
  const abonnement = await abonnementCourant()
  if (!abonnement) return null
  const { endpoint } = abonnement
  await abonnement.unsubscribe()
  return endpoint
}
