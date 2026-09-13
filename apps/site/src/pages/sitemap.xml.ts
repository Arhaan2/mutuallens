import type { APIRoute } from 'astro';
import { publicReleaseIndexable, siteUrl } from '../lib/urls';

const routes = [
  '/',
  '/guides/',
  '/guides/download-instagram-followers/',
  '/guides/followers-vs-following/',
  '/guides/not-following-back-vs-unfollowed/',
  '/guides/instagram-export-troubleshooting/',
  '/guides/reading-snapshot-history/',
  '/about/',
  '/privacy/',
  '/terms/',
  '/contact/',
];
export const GET: APIRoute = () => {
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicReleaseIndexable ? routes.map((route) => `<url><loc>${escape(siteUrl(route))}</loc></url>`).join('') : ''}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
