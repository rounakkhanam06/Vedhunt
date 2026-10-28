import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Only the core runtime gets a shared chunk. Matching on the package
        // folder matters: a plain includes('react') also caught every library
        // with "react" in its path (charts, editors, toasts…) and shipped the
        // admin panel's libraries to every visitor in one ~950 kB file. Other
        // libraries are left to Vite, so each lands with the pages that use it.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          if (/[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)) {
            return 'vendor-framer';
          }
          if (/[\\/]node_modules[\\/]@splinetool[\\/]/.test(id)) {
            return 'vendor-spline';
          }
        },
      },
    },
  },
});
