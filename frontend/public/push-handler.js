/*
 * Gestionnaire de notifications, importé par le service worker que Workbox
 * génère (voir `workbox.importScripts` dans vite.config.ts).
 *
 * Ce fichier vit hors de `src/` à dessein : il s'exécute dans le service
 * worker, un contexte séparé de la page, sans DOM ni accès au bundle React.
 */

/** Repli affiché si la charge utile est absente ou illisible. */
const REPLI = {
  titre: 'Frigo',
  corps: 'Un produit arrive à péremption.',
  url: '/',
}

function lireCharge(event) {
  if (!event.data) return REPLI
  try {
    return { ...REPLI, ...event.data.json() }
  } catch {
    return { ...REPLI, corps: event.data.text() || REPLI.corps }
  }
}

self.addEventListener('push', (event) => {
  const { titre, corps, url } = lireCharge(event)

  // iOS révoque l'autorisation d'un site qui reçoit un push sans rien afficher :
  // on montre donc toujours une notification, même en cas de charge illisible.
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: corps,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Un tag constant fait que l'alerte du jour remplace celle de la veille
      // au lieu d'empiler les rappels sur l'écran de verrouillage.
      tag: 'fridgify-peremption',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const cible = event.notification.data?.url ?? '/'

  // Si l'application est déjà ouverte, on la ramène au premier plan plutôt que
  // d'en ouvrir une seconde instance.
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const fenetre of fenetres) {
        if ('focus' in fenetre) {
          if ('navigate' in fenetre && new URL(fenetre.url).pathname !== cible) {
            await fenetre.navigate(cible)
          }
          return fenetre.focus()
        }
      }
      return self.clients.openWindow(cible)
    })(),
  )
})
