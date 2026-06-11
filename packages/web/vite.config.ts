import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@redact/shared'],
    // Worker-only deps must be explicitly included so Vite pre-bundles them on
    // startup. Without this, dynamic (or static) imports inside workers resolve
    // to un-pre-bundled CJS files, causing "Failed to fetch" errors in dev.
    include: ['jszip', 'mammoth', 'pdf-lib', 'pdfjs-dist', 'tesseract.js', 'xlsx'],
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router'],
          state: ['zustand', '@tanstack/react-query'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react'],
        },
      },
    },
  },
});
