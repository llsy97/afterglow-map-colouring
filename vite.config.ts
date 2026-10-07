import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'fonts/SUIT-Variable.woff2'],
      manifest: {
        name: 'Travel Light Map · 여행 색칠공부',
        short_name: '여행 색칠공부',
        description: 'Light up the places you have been.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b0d',
        theme_color: '#0b0b0d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // map TopoJSON + font are precached so the whole app works offline
        globPatterns: ['**/*.{js,css,html,woff2,json,png,svg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        // the 370 per-country admin-1/2 files (~37 MB) and 읍·면·동 are fetched on demand and cached as you visit them
        globIgnores: ['**/maps/admin[12]/[A-Z][A-Z][A-Z].json', '**/maps/kor/*submunicipalities*', '**/maps/world-states.json'],
        runtimeCaching: [
          {
            urlPattern: /\/maps\/(admin[12]\/[A-Z]{3}|kor\/skorea-submunicipalities[^/]*|world-states)\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'region-maps', expiration: { maxEntries: 400 } },
          },
        ],
      },
    }),
  ],
})
