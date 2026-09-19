import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';

const output = new URL('../../apps/site/project-dist/', import.meta.url);
beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build-pages.mjs']);
});
it('ships only a distinct noindexed static project entry with real links and base-aware assets', () => {
  expect(readdirSync(output).sort()).toEqual([
    '.nojekyll',
    '404.html',
    'build-info.json',
    'favicon.svg',
    'index.html',
    'project.css',
    'robots.txt',
    'sitemap.xml',
  ]);
  const index = readFileSync(new URL('index.html', output), 'utf8');
  for (const name of ['index.html', '404.html']) {
    const html = readFileSync(new URL(name, output), 'utf8');
    expect(html).toMatch(/name="robots" content="noindex, follow"/);
    expect(html).not.toMatch(
      /<(?:script|iframe|form)\b|http-equiv|#sample|\bdemo\b|\bpreview\b|verification pending/i,
    );
    for (const [, path] of html.matchAll(/(?:href|src)="(\/[^"\s]*)"/g)) {
      expect(path).toMatch(/^\/mutuallens\//);
      if (path !== '/mutuallens/')
        expect(() =>
          readFileSync(new URL(path!.replace('/mutuallens/', ''), output)),
        ).not.toThrow();
    }
  }
  expect(index).toContain(
    'rel="canonical" href="https://arhaan2.github.io/mutuallens/"',
  );
  expect(index).toContain('href="https://mutuallens-ddm.pages.dev/"');
  expect(index).toContain('href="https://github.com/Arhaan2/mutuallens"');
  expect(readFileSync(new URL('sitemap.xml', output), 'utf8')).not.toContain(
    '<loc>',
  );
  expect(
    JSON.parse(readFileSync(new URL('build-info.json', output), 'utf8')).host,
  ).toBe('github-pages-project-entry');
});
