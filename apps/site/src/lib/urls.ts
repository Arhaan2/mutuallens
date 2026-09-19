import { isPublicReleaseIndexable } from '../../../../scripts/origins';

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

export function checkerUrl(fragment: 'import' | 'automatic' | 'history') {
  const url = new URL('/', checkerOrigin);
  url.hash = fragment;
  return url.href;
}

/** Keep browser-facing robots metadata aligned with deployment headers. */
export const publicReleaseIndexable = isPublicReleaseIndexable({
  PUBLIC_INDEXABLE: import.meta.env.PUBLIC_INDEXABLE,
  PUBLIC_SITE_ORIGIN: siteOrigin,
});
