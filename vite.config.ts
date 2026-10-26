import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works on GitHub Pages under any repo name.
  base: './',
  plugins: [
    react(),
    // "Install app" on phone and desktop: manifest + service worker that caches the app shell.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'logo-mark.png', 'apple-touch-icon.png', 'flac/*'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,wasm}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      manifest: {
        name: 'Teach&Go',
        short_name: 'Teach&Go',
        description: 'Teach and go. We keep the thread.',
        theme_color: '#FFF8F1',
        background_color: '#FFF8F1',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
