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
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,glb,svg,png,webp,mp4,otf}']
      }
    })
  ],
  build: {
    // The 3D engine is a lazy route dependency; keep its stable vendor payload
    // separate so application-only releases do not invalidate the full engine.
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-engine': ['three', 'three-mesh-bvh'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
})
