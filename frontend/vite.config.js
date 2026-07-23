import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],
  test: {
    globals: true,
    environment: 'node',
  },
  server: {
    port: 5173,
    host: true,
    headers: {
      // Allow Firebase Auth popups (Google/GitHub sign-in) to communicate
      // with the opener window. Without this, the COOP policy blocks
      // window.closed checks and popup auth flows break.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    proxy: {
      // Forward /uploads/ requests to the backend (local storage files)
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Forward /api/ requests to the backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
