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
  server: {
    proxy: {
      '/hrms/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hrms/, ''),
      },
    },
  },
})
