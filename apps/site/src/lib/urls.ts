const siteOrigin =
  import.meta.env.PUBLIC_SITE_ORIGIN || 'http://localhost:4321';
const checkerOrigin =
  import.meta.env.PUBLIC_CHECKER_ORIGIN || 'http://localhost:5173';
export const checkerRootUrl = new URL('/', checkerOrigin).href;

function normalizeBasePath(value: string | undefined) {
  const withLeadingSlash = `/${(value || '/').replace(/^\/+|\/+$/g, '')}`;
  return withLeadingSlash === '/' ? '/' : `${withLeadingSlash}/`;
}

export const siteBasePath = normalizeBasePath(import.meta.env.BASE_URL);

/** Build a public-page URL that keeps working when Astro is given a base path. */
export function sitePath(pathname: string) {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (siteBasePath === '/') return normalized;
  if (
    normalized === siteBasePath.slice(0, -1) ||
    normalized.startsWith(siteBasePath)
  )
    return normalized;
  return normalized === '/'
    ? siteBasePath
    : `${siteBasePath}${normalized.slice(1)}`;
}

export function siteUrl(pathname: string) {
  return new URL(sitePath(pathname), siteOrigin).href;
}

export function checkerUrl(
  fragment: 'import' | 'automatic' | 'sample' | 'history',
) {
  const url = new URL('/', checkerOrigin);
  url.hash = fragment;
  return url.href;
}

const siteHost = new URL(siteOrigin).hostname.toLowerCase();
const duplicateOrPreviewHost =
  siteHost === 'localhost' ||
  siteHost === '127.0.0.1' ||
  siteHost === '[::1]' ||
  siteHost.endsWith('.pages.dev') ||
  siteHost.endsWith('.github.io');

/**
 * Indexing is a two-key release decision. Preview/project hosts remain noindex
 * even if a build accidentally receives the production flag.
 */
export const publicReleaseIndexable =
  import.meta.env.PUBLIC_INDEXABLE === 'true' && !duplicateOrPreviewHost;
