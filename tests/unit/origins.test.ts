import { expect, it } from 'vitest';
import {
  isPublicReleaseIndexable,
  resolveOrigins,
  resolvePublicBasePath,
} from '../../scripts/origins';
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

it('accepts a normalized project-site base path and rejects URL-like input', () => {
  expect(resolvePublicBasePath({})).toBe('/');
  expect(resolvePublicBasePath({ PUBLIC_SITE_BASE_PATH: '/mutuallens/' })).toBe(
    '/mutuallens',
  );
  for (const value of [
    'mutuallens',
    '//mutuallens',
    '/mutuallens?account=private',
    '/mutuallens#result',
    '/mutuallens/../private',
    '/mutuallens\\private',
    '/mutual lens',
  ]) {
    expect(() =>
      resolvePublicBasePath({ PUBLIC_SITE_BASE_PATH: value }),
    ).toThrow();
  }
});

it('requires both the production flag and a non-preview host for indexing', () => {
  expect(
    isPublicReleaseIndexable({
      PUBLIC_INDEXABLE: 'true',
      PUBLIC_SITE_ORIGIN: 'https://mutuallens.example',
    }),
  ).toBe(true);
  for (const origin of [
    'http://localhost:4321',
    'https://mutuallens.pages.dev',
    'https://mutuallens.pages.dev.',
    'https://arhaan2.github.io',
    'https://arhaan2.github.io.',
  ]) {
    expect(
      isPublicReleaseIndexable({
        PUBLIC_INDEXABLE: 'true',
        PUBLIC_SITE_ORIGIN: origin,
      }),
    ).toBe(false);
  }
  expect(
    isPublicReleaseIndexable({
      PUBLIC_SITE_ORIGIN: 'https://mutuallens.example',
    }),
  ).toBe(false);
});
