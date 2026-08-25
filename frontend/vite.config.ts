import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Studio SPA. Frontend + backend now ship as ONE image: Spring Boot serves this
// build from its static resources and exposes /api on the same origin. In production the
// SPA calls /api relatively (same origin). In dev, `npm run dev` proxies /api and
// /actuator to the backend on :8090 so the same relative calls work.
export default defineConfig({
  // Relative base so the build also works when served under a subpath
  // (e.g. Cave static hosting at /gargantua-studio/).
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8090',
      '/actuator': 'http://localhost:8090',
    },
  },
})
