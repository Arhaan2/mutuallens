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
