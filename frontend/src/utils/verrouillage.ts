/**
 * Verrouillage de l'application par Face ID ou empreinte.
 *
 * On s'appuie sur WebAuthn et l'authentificateur intégré au téléphone. La clé
 * créée ne quitte jamais l'appareil et n'est pas vérifiée par le serveur :
 * ce verrou protège l'ouverture de l'application sur un téléphone déverrouillé,
 * il ne remplace pas le mot de passe, qui reste la seule preuve d'identité
 * acceptée par le serveur.
 *
 * Exige un contexte sécurisé (HTTPS) : sur l'adresse locale en http, la
 * fonction n'est tout simplement pas proposée.
 */

const CLE = 'fridgify-verrou'

type Verrou = { identifiant: string; credentialId: string }

function lire(): Verrou | null {
  try {
    const brut = localStorage.getItem(CLE)
    return brut ? (JSON.parse(brut) as Verrou) : null
  } catch {
    return null
  }
}

/** Vrai si le téléphone propose Face ID, Touch ID ou une empreinte. */
export async function verrouPossible(): Promise<boolean> {
  if (!window.isSecureContext || !window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function verrouActif(identifiant: string): boolean {
  return lire()?.identifiant === identifiant
}

export function oublierVerrou(identifiant?: string): void {
  if (identifiant && !verrouActif(identifiant)) return
  try {
    localStorage.removeItem(CLE)
  } catch {
    /* rien à oublier */
  }
}

/**
 * Depuis TypeScript 5.7, `Uint8Array` est générique sur son tampon, et WebAuthn
 * n'accepte qu'un vrai `ArrayBuffer` : on l'alloue explicitement.
 */
function octets(taille: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(taille)))
}

const enBase64 = (donnees: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(donnees)))

function depuisBase64(texte: string): Uint8Array<ArrayBuffer> {
  const brut = atob(texte)
  const tampon = new Uint8Array(new ArrayBuffer(brut.length))
  for (let index = 0; index < brut.length; index += 1) tampon[index] = brut.charCodeAt(index)
  return tampon
}

/** Enregistre Face ID pour ce compte, sur cet appareil. */
export async function activerVerrou(identifiant: string): Promise<void> {
  const cle = (await navigator.credentials.create({
    publicKey: {
      challenge: octets(32),
      rp: { name: 'Frigo' },
      user: { id: octets(16), name: identifiant, displayName: identifiant },
      // ES256 puis RS256 : les deux algorithmes que tous les authentificateurs
      // connaissent.
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        // L'authentificateur du téléphone, pas une clé USB.
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      // Demande explicitement l'appareil lui-même. iOS confie malgré tout la
      // création au gestionnaire de mots de passe défini par défaut quand il y
      // en a un : le standard ne permet pas de l'exclure, seulement de dire sa
      // préférence. Ignoré par les navigateurs qui ne connaissent pas `hints`.
      hints: ['client-device'],
      timeout: 60_000,
    } as PublicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null

  if (!cle) throw new Error("L'appareil n'a pas confirmé l'enregistrement.")
  localStorage.setItem(
    CLE,
    JSON.stringify({ identifiant, credentialId: enBase64(cle.rawId) } satisfies Verrou),
  )
}

/** Demande Face ID. Renvoie faux si l'utilisateur annule ou échoue. */
export async function demanderDeverrouillage(): Promise<boolean> {
  const verrou = lire()
  if (!verrou) return true

  try {
    const preuve = await navigator.credentials.get({
      publicKey: {
        challenge: octets(32),
        allowCredentials: [{ type: 'public-key', id: depuisBase64(verrou.credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return preuve !== null
  } catch {
    return false
  }
}

export const verrouEnregistre = (): boolean => lire() !== null
