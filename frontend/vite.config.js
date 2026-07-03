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
  },
  build: {
    outDir: 'dist',
  },
});
