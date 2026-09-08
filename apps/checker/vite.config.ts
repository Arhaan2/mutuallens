import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveOrigins } from '../../scripts/origins';
const origins = resolveOrigins(process.env);
export default defineConfig({
  envDir: false,
  define: {
    'import.meta.env.VITE_SITE_ORIGIN': JSON.stringify(origins.publicSite),
  },
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8788' } },
  build: { sourcemap: false },
  worker: { format: 'es' },
});
