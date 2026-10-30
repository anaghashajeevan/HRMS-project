// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // HRMS is served only beneath the authenticated SSO portal route.
  base: '/hrms/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
