const COTE_MAX = 1600
const QUALITE = 0.8

/**
 * Reduit une photo de ticket avant l'envoi.
 *
 * Un cliche d'iPhone pese plusieurs mega-octets pour une resolution dont Gemini
 * n'a pas besoin : on plafonne le plus grand cote et on reencode en JPEG, ce qui
 * divise le temps d'upload par dix sur un reseau domestique. En cas d'echec
 * (format exotique, canvas indisponible), on renvoie le fichier d'origine.
 */
export async function compresserImage(fichier: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(fichier)
    const facteur = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height))

    const largeur = Math.round(bitmap.width * facteur)
    const hauteur = Math.round(bitmap.height * facteur)

    const canvas = document.createElement('canvas')
    canvas.width = largeur
    canvas.height = hauteur

    const contexte = canvas.getContext('2d')
    if (!contexte) return fichier
    contexte.drawImage(bitmap, 0, 0, largeur, hauteur)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITE),
    )
    return blob ?? fichier
  } catch {
    return fichier
  }
}
