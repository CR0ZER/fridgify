import { useEffect } from 'react'

/**
 * Recharge les donnees quand l'utilisateur revient sur l'application.
 *
 * Equivalent web du `useFocusEffect` d'expo-router : une PWA ajoutee a l'ecran
 * d'accueil reste en memoire pendant des jours, et sans ce rappel l'inventaire
 * afficherait des "J-3" calcules la veille.
 */
export function useRechargementAuRetour(recharger: () => void) {
  useEffect(() => {
    const auRetour = () => {
      if (document.visibilityState === 'visible') recharger()
    }
    document.addEventListener('visibilitychange', auRetour)
    return () => document.removeEventListener('visibilitychange', auRetour)
  }, [recharger])
}
