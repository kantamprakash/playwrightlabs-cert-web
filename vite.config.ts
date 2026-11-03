import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In production Nginx serves the build and proxies /api to Spring Boot on the same origin.
// The dev server does the same, so the session cookie works identically in both.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8085',
    },
  },
})
