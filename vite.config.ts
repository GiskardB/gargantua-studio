import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Studio is a client-only SPA for now: it produces gargantua.ai/v1 manifests
// in the browser and has no backend until the Control Plane (Phase 2) exists.
export default defineConfig({
  // Relative base so the built site works when served under a subpath
  // (Cave static hosting serves it at /gargantua-studio/).
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
