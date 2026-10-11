import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: 'plugins-dist/paint',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/plugins-source/Paint/Paint.tsx'),
      name: 'PaintPlugin',
      fileName: 'paint.plugin',
      formats: ['umd']
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'lucide-react'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'lucide-react': 'LucideReact'
        }
      }
    },
    minify: 'esbuild' 
  }
});
