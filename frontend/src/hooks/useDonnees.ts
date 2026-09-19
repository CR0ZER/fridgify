import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Événement qui demande à l'écran affiché de relire ses données : une
 * annulation peut aboutir après que l'écran qui l'a proposée a disparu.
 */
const ACTUALISER = 'fridgify:actualiser'
export const demanderActualisation = () => window.dispatchEvent(new Event(ACTUALISER))

/**
 * Charge les données d'un écran et les recharge au retour dans l'application.
 *
 * Une PWA ajoutée à l'écran d'accueil reste en mémoire pendant des jours : sans
 * ce rappel, l'inventaire afficherait des « J-3 » calculés la veille.
 *
 * `donnees` reste celle du dernier succès : une erreur de rechargement
 * n'efface pas l'écran, elle s'affiche par-dessus.
 */
export function useDonnees<T>(charger: () => Promise<T>) {
  const [donnees, setDonnees] = useState<T | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const source = useRef(charger)
  source.current = charger

  const recharger = useCallback(async () => {
    try {
      setDonnees(await source.current())
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
    }
  }, [])

  useEffect(() => {
    void recharger()
    const auRetour = () => {
      if (document.visibilityState === 'visible') void recharger()
    }
    const surActualisation = () => void recharger()
    document.addEventListener('visibilitychange', auRetour)
    window.addEventListener(ACTUALISER, surActualisation)
    return () => {
      document.removeEventListener('visibilitychange', auRetour)
      window.removeEventListener(ACTUALISER, surActualisation)
    }
  }, [recharger])

  return { donnees, erreur, recharger }
}

/** Exécute une mutation et remonte son erreur plutôt que de l'avaler. */
export function useAction(apres: () => unknown) {
  const [erreur, setErreur] = useState<string | null>(null)

  const agir = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      try {
        await action()
        setErreur(null)
        await apres()
        return true
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Action impossible.')
        return false
      }
    },
    [apres],
  )

  return { agir, erreur, setErreur }
}
