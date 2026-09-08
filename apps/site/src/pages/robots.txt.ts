import type { APIRoute } from 'astro';
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\nSitemap: ${import.meta.env.PUBLIC_SITE_ORIGIN || 'http://localhost:4321'}/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
