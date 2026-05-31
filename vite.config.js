import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    allowedHosts: [
      'manual-residency-volley.ngrok-free.dev',
      '*.ngrok-free.dev',
      'localhost'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    'process.env.NGROK_URL': JSON.stringify('')
  }
})
