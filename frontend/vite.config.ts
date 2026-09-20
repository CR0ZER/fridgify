import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * En production, c'est nginx qui ajoute le header X-API-Key sur /api/ : le secret
 * ne quitte donc jamais la Raspberry. En developpement il n'y a pas de nginx, on
 * relit donc la cle depuis backend/.env pour que le proxy Vite fasse le meme
 * travail. Ce code s'execute dans Node, jamais dans le bundle envoye au navigateur.
 */
function cleApiDev(): string {
  try {
    const env = readFileSync(resolve(__dirname, '../backend/.env'), 'utf-8')
    return env.match(/^API_KEY=(.*)$/m)?.[1].trim() ?? ''
  } catch {
    return ''
  }
}

export default defineConfig(() => {
  const cle = cleApiDev()

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-*.png', 'apple-touch-icon-*.png'],
        manifest: {
          name: 'Frigo',
          short_name: 'Frigo',
          description: 'Inventaire du frigo, suivi des peremptions et liste de courses.',
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#16191a',
          theme_color: '#16191a',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
          // Ajoute les gestionnaires `push` et `notificationclick` au service
          // worker genere. Passer par importScripts evite de basculer en
          // strategie injectManifest, qui obligerait a reecrire tout le
          // precaching a la main.
          importScripts: ['/push-handler.js'],
          // L'inventaire doit toujours refleter la base : jamais de reponse d'API
          // servie depuis le cache, sous peine d'afficher un frigo perime.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          headers: cle ? { 'X-API-Key': cle } : undefined,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
