import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        // Use VPS backend - set VITE_API_URL env var for remote, defaults to local Docker
        target: process.env.VITE_API_URL || 'http://localhost:3010',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_API_URL || 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
})
