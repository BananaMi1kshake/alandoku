import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/alandoku/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // This helps test PWA in dev mode
      },
      manifest: {
        name: 'Alandoku',
        short_name: 'Alandoku',
        description: 'The ultimate ad-free Sudoku experience.',
        theme_color: '#f9fafb',
        background_color: '#ffffff',
        display: 'standalone'
      }
    })
  ],
})