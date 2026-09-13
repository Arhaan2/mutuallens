import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { sourceStamp } from './source-stamp.mjs';
import { resolvePublicBasePath } from './origins.ts';

const output = new URL('../apps/site/dist/', import.meta.url);
const origin = process.env.PUBLIC_SITE_ORIGIN;
const base = resolvePublicBasePath(process.env);
if (!origin || !base || base === '/')
  throw new Error(
    'The GitHub Pages artifact requires PUBLIC_SITE_ORIGIN and a non-root PUBLIC_SITE_BASE_PATH.',
  );
const canonicalRoot = new URL(`${base}/`, `${origin}/`).href;

// Cloudflare deployment controls are inert on GitHub Pages. Excluding them
// avoids implying that Pages applies headers, redirects, Functions or D1.
await Promise.all(
  ['_headers', '_redirects', '_routes.json', '_worker.js'].map((name) =>
    rm(new URL(name, output), { force: true }),
  ),
);
await writeFile(new URL('.nojekyll', output), '');
await writeFile(
  new URL('build-info.json', output),
  JSON.stringify({ ...(await sourceStamp()), host: 'github-pages-demo' }),
);

async function htmlFiles(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), folder);
    if (entry.isDirectory()) files.push(...(await htmlFiles(url)));
    else if (entry.name.endsWith('.html')) files.push(url);
  }
  return files;
}
for (const file of await htmlFiles(output)) {
  const html = await readFile(file, 'utf8');
  if (
    !/<meta\s+name="robots"\s+content="noindex,\s*follow"\s*\/?\s*>/i.test(html)
  )
    throw new Error(
      `GitHub Pages demo noindex is missing from ${file.pathname}.`,
    );
  const absoluteReferences = [
    ...html.matchAll(/\b(?:href|src)="(\/[^"\s]*)"/gi),
  ].map((match) => match[1]);
  if (
    absoluteReferences.some(
      (reference) => reference !== base && !reference.startsWith(`${base}/`),
    )
  )
    throw new Error(
      `A root-relative asset or link escaped ${base} in ${file.pathname}.`,
    );
}
const [robots, sitemap] = await Promise.all([
  readFile(new URL('robots.txt', output), 'utf8'),
  readFile(new URL('sitemap.xml', output), 'utf8'),
]);
if (!robots.includes(`Sitemap: ${canonicalRoot}sitemap.xml`))
  throw new Error('The GitHub Pages robots.txt sitemap URL is not base-aware.');
if (sitemap.includes('<loc>'))
  throw new Error('The noindexed GitHub Pages demo sitemap must stay empty.');
const homepage = await readFile(new URL('index.html', output), 'utf8');
if (!homepage.includes(`<link rel="canonical" href="${canonicalRoot}">`))
  throw new Error('The GitHub Pages homepage canonical is not base-aware.');
