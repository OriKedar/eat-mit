import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Repo is served from https://<user>.github.io/eat-mit/, so assets need that base.
export default defineConfig({
  base: '/eat-mit/',
  resolve: {
    // shadcn-generated components (src/components/ui/**) import via "@/...".
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Food Map',
        short_name: 'Food Map',
        description: 'Restaurants you want to try, and ones you already did.',
        start_url: '/eat-mit/',
        scope: '/eat-mit/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1A1410',
        theme_color: '#1A1410',
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
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: '/eat-mit/index.html',
        runtimeCaching: [
          {
            // Map tiles: serve from cache when possible, refresh in background.
            // Makes a revisited area usable with no connection.
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'carto-tiles',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase data must never be served stale — an offline read that
            // silently returns yesterday's list is worse than a visible error.
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
