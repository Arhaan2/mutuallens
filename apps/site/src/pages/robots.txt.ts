import type { APIRoute } from 'astro';
import { publicReleaseIndexable, siteUrl } from '../lib/urls';

export const GET: APIRoute = () => {
  const sitemap = publicReleaseIndexable
    ? `Sitemap: ${siteUrl('/sitemap.xml')}\n`
    : '# Preview/demo: pages remain crawlable so robots can read noindex.\n';
  return new Response(`User-agent: *\nAllow: /\n${sitemap}`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
