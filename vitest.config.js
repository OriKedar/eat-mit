import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Separate from vite.config.js so the PWA plugin (service worker generation,
// manifest injection) never runs under test — it has no bearing on unit/
// component tests and only slows the run down.
export default defineConfig({
  base: '/eat-mit/',
  plugins: [react()],
  resolve: {
    alias: {
      // vite-plugin-pwa injects this virtual module at build time; it
      // doesn't exist under Vitest, so point it at a local stand-in.
      'virtual:pwa-register/react': '/src/test/pwa-register-mock.js',
    },
  },
  test: {
    environment: 'jsdom',
    // jsdom only implements window.localStorage when it has a URL to scope
    // storage to — without this, MapView's basemap-persistence tests would
    // see `localStorage` as undefined.
    environmentOptions: { jsdom: { url: 'http://localhost:3000/eat-mit/' } },
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
