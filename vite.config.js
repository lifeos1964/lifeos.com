import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020'
  },
  server: {
    port: 3000
  }
});
