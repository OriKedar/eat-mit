import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo is served from https://<user>.github.io/eat-mit/, so assets need that base.
export default defineConfig({
  plugins: [react()],
  base: '/eat-mit/',
})
