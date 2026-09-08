import type { APIRoute } from 'astro';
const routes = [
  '/',
  '/instagram-follow-back-checker/',
  '/guides/download-instagram-followers/',
  '/guides/followers-vs-following/',
  '/guides/not-following-back-vs-unfollowed/',
  '/guides/instagram-export-troubleshooting/',
  '/about/',
  '/privacy/',
  '/terms/',
  '/contact/',
];
export const GET: APIRoute = () => {
  const origin = import.meta.env.PUBLIC_SITE_ORIGIN || 'http://localhost:4321';
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${escape(new URL(route, origin).href)}</loc></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
