import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/alandoku/', // Ensures it works on GitHub Pages
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Automatically updates the app when you push new code
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'], // Cache your images
      manifest: {
        name: 'Alandoku',
        short_name: 'Alandoku',
        description: 'The ultimate ad-free Sudoku experience.',
        theme_color: '#f9fafb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // This tells the service worker to cache all JS, CSS, and HTML files for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})