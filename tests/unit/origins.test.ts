import { expect, it } from 'vitest';
import { resolveOrigins } from '../../scripts/origins';
it('enforces different browser origins and matching navigation before building', () => {
  expect(resolveOrigins({})).toEqual({
    publicSite: 'http://localhost:4321',
    checker: 'http://localhost:5173',
  });
  for (const checker of [
    'https://site.test',
    'https://checker.test?username=secret',
    'https://user:pass@checker.test',
    'javascript:alert(1)',
    'http://checker.test',
  ]) {
    expect(() =>
      resolveOrigins({
        PUBLIC_SITE_ORIGIN: 'https://site.test',
        PUBLIC_CHECKER_ORIGIN: checker,
        VITE_SITE_ORIGIN: 'https://site.test',
      }),
    ).toThrow();
  }
  expect(() =>
    resolveOrigins({ PUBLIC_SITE_ORIGIN: 'https://site.test' }),
  ).toThrow();
  expect(() =>
    resolveOrigins({
      PUBLIC_SITE_ORIGIN: 'https://site.test',
      PUBLIC_CHECKER_ORIGIN: 'https://checker.test',
      VITE_SITE_ORIGIN: 'https://wrong.test',
    }),
  ).toThrow();
});
