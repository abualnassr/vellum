import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: path.resolve(__dirname, '../src/Vellum/wwwroot'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/lang-markdown',
            '@codemirror/language-data',
            '@codemirror/search',
            '@codemirror/autocomplete',
            '@lezer/highlight',
          ],
          katex: ['katex'],
        },
      },
    },
  },
});
