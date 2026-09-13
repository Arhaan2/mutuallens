import type { APIRoute } from 'astro';
import { publicReleaseIndexable, siteUrl } from '../lib/urls';

export const GET: APIRoute = () => {
  const release = publicReleaseIndexable
    ? '# Accepted public release.\n'
    : '# Preview/demo: pages remain crawlable so robots can read noindex.\n';
  return new Response(
    `User-agent: *\nAllow: /\n${release}Sitemap: ${siteUrl('/sitemap.xml')}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
