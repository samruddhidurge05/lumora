import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Also process .js files that contain React hooks / JSX
      include: ['**/*.jsx', '**/*.js', '**/*.tsx', '**/*.ts'],
    }),
  ],
  server: {
    port: 5173,
    host: true,
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
