import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In production Nginx serves the build and passes /api to the gateway on the same origin. The dev server
// routes like the gateway does, straight to the services running in dev mode, so the session cookie works
// identically in both. (More specific paths first.)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/auth': 'http://localhost:8087',
      '/api/admin/users': 'http://localhost:8087',
      '/api': 'http://localhost:8085',
    },
  },
})
