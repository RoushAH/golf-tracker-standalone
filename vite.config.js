import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/golf-tracker-standalone/, so every URL the
// app and the service worker emit has to sit under this prefix, not the domain root.
const BASE = '/golf-tracker-standalone/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['*.png', 'favicon.ico', 'golf-icon.svg', 'offline.html'],
      injectRegister: 'auto',
      // Generated (not a hand-maintained public/manifest.json) so that start_url,
      // scope and icon paths all pick up BASE automatically.
      manifest: {
        name: 'Golf Tracker - Practice Logger',
        short_name: 'Golf Tracker',
        description: 'Track your golf chipping and putting practice sessions',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2e7d32',
        orientation: 'portrait-primary',
        lang: 'en',
        categories: ['sports', 'health'],
        icons: [
          {
            src: 'golf-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'golf-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Start Practice',
            short_name: 'Practice',
            description: 'Start a new practice session',
            url: '?action=practice',
            icons: [{ src: 'golf-icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'View Results',
            short_name: 'Results',
            description: 'View your practice results',
            url: '?action=results',
            icons: [{ src: 'golf-icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Must be a precached URL under BASE. A bare '/index.html' is not in the
        // precache manifest when the app is hosted in a subdirectory, which makes
        // every offline navigation fail.
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true
  }
});
