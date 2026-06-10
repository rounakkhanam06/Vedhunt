import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Admin-only rich text editor — isolated so it never loads on public pages
            if (id.includes('react-quill') || id.includes('quill')) {
              return 'vendor-admin-editor';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer-motion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@splinetool')) {
              return 'vendor-spline';
            }
            // React Query in its own chunk — small and frequently updated
            if (id.includes('@tanstack')) {
              return 'vendor-react-query';
            }
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react-core';
            }
            return 'vendor-libs';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@splinetool/react-spline'],
  }
})
