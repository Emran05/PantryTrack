import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendor libs change far less often than app code — splitting them
        // keeps the app-code chunk small and lets browsers cache the heavy
        // dependencies across deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
  }
})
