/** The two browser origins are a privacy boundary, including during preview. */
export function resolveOrigins(env: Record<string, string | undefined>) {
  const values = [
    env.PUBLIC_SITE_ORIGIN,
    env.PUBLIC_CHECKER_ORIGIN,
    env.VITE_SITE_ORIGIN,
  ];
  if (values.some(Boolean) && !values.every(Boolean))
    throw new Error(
      'Set all three build origins together: PUBLIC_SITE_ORIGIN, PUBLIC_CHECKER_ORIGIN, VITE_SITE_ORIGIN.',
    );
  const publicSite = values[0] || 'http://localhost:4321';
  const checker = values[1] || 'http://localhost:5173';
  const checkerSiteLink = values[2] || publicSite;
  for (const value of [publicSite, checker, checkerSiteLink]) {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin !== value ||
      (url.protocol !== 'https:' &&
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    ) {
      throw new Error(
        'Build origins must be plain HTTPS origins without paths, credentials, queries or trailing slashes; HTTP is allowed only on localhost.',
      );
    }
  }
  if (publicSite === checker)
    throw new Error(
      'Public site and checker must use different browser origins.',
    );
  if (checkerSiteLink !== publicSite)
    throw new Error('VITE_SITE_ORIGIN must match PUBLIC_SITE_ORIGIN.');
  return { publicSite, checker };
}

/** Astro's base is a path, not an origin. Keep it separate so project-site
 * builds cannot accidentally weaken the public/checker origin boundary. */
export function resolvePublicBasePath(
  env: Record<string, string | undefined>,
): string {
  const value = env.PUBLIC_SITE_BASE_PATH || '/';
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\') ||
    value.split('/').some((part) => part === '.' || part === '..')
  )
    throw new Error(
      'PUBLIC_SITE_BASE_PATH must be a plain absolute path without a query, fragment, backslash or traversal segment.',
    );
  const normalized = value === '/' ? '/' : value.replace(/\/+$/, '');
  if (
    !normalized ||
    !/^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)?$/.test(normalized)
  )
    throw new Error('PUBLIC_SITE_BASE_PATH contains unsupported characters.');
  return normalized;
}

/** Indexing is released only by an explicit flag on a non-preview hostname. */
export function isPublicReleaseIndexable(
  env: Record<string, string | undefined>,
): boolean {
  if (env.PUBLIC_INDEXABLE !== 'true') return false;
  const origin = env.PUBLIC_SITE_ORIGIN || 'http://localhost:4321';
  const url = new URL(origin);
  if (url.origin !== origin)
    throw new Error('PUBLIC_SITE_ORIGIN must be a plain origin.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  return !(
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.pages.dev') ||
    hostname.endsWith('.github.io')
  );
}
