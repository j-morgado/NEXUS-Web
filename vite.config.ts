import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'NEXUS',
        short_name: 'NEXUS',
        theme_color: '#090b12',
        background_color: '#090b12',
        display: 'standalone'
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 80 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,glb,svg,png,webp,mp4,pdf,otf}']
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
})
