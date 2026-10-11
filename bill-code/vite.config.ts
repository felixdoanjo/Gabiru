import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        // Aumenta o limite para arquivos grandes (App.tsx tem 500KB+)
        compact: false,
        generatorOpts: {
          compact: false,
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Aumenta o limite de chunk size warning
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
  },
});
