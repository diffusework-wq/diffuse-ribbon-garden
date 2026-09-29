import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  optimizeDeps: { exclude: ['three'] },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
