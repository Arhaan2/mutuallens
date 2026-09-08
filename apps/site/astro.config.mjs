import { defineConfig } from 'astro/config';
import { resolveOrigins } from '../../scripts/origins.ts';
const origins = resolveOrigins(process.env);
export default defineConfig({
  site: origins.publicSite,
  output: 'static',
  vite: {
    envDir: false,
    define: {
      'import.meta.env.PUBLIC_SITE_ORIGIN': JSON.stringify(origins.publicSite),
      'import.meta.env.PUBLIC_CHECKER_ORIGIN': JSON.stringify(origins.checker),
    },
    build: { sourcemap: false },
  },
});
