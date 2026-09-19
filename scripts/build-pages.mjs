import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { sourceStamp } from './source-stamp.mjs';
import { resolveOrigins, resolvePublicBasePath } from './origins.ts';

// A separate static project showcase, never the application or a proxy for it.
const origin = process.env.GITHUB_PAGES_ORIGIN || 'https://arhaan2.github.io';
if (origin !== 'https://arhaan2.github.io')
  throw new Error('Use the existing authorized GitHub Pages origin.');
const base = resolvePublicBasePath({
  PUBLIC_SITE_BASE_PATH: process.env.GITHUB_PAGES_BASE_PATH || '/mutuallens',
});
if (base !== '/mutuallens')
  throw new Error('Use the existing MutualLens project path.');
const { publicSite } = resolveOrigins({
  PUBLIC_SITE_ORIGIN: 'https://mutuallens-ddm.pages.dev',
  PUBLIC_CHECKER_ORIGIN: 'https://mutuallens-app.pages.dev',
  VITE_SITE_ORIGIN: 'https://mutuallens-ddm.pages.dev',
});
const output = new URL('../apps/site/project-dist/', import.meta.url);
const canonical = `${origin}${base}/`;
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const head = (title, description) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow"><meta name="referrer" content="no-referrer"><meta name="description" content="${description}"><title>${title}</title><link rel="icon" href="${base}/favicon.svg"><link rel="stylesheet" href="${base}/project.css">`;
const homepage = `${head('MutualLens · Instagram relationship comparison', 'Explore the open-source MutualLens project for comparing Instagram follower and following files.')}<link rel="canonical" href="${canonical}"><meta property="og:title" content="MutualLens"><meta property="og:description" content="An open-source project for comparing Instagram relationship files."><meta property="og:url" content="${canonical}"></head><body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="${base}/"><img src="${base}/favicon.svg" alt="" width="40" height="40">MutualLens</a><a href="https://github.com/Arhaan2/mutuallens">Source code</a></header><main id="main"><p class="eyebrow">The MutualLens project</p><h1>A clearer view of your Instagram connections.</h1><p class="lede">MutualLens is an open-source tool that compares follower and following files in your browser. Find accounts that don’t follow you back, explore mutual followers, and download your results.</p><p>The website and checker are hosted on Cloudflare. This page introduces the project and links to its source.</p><a class="button" href="${publicSite}/">Visit MutualLens <span aria-hidden="true">↗</span></a><section aria-labelledby="project-title"><h2 id="project-title">Built around your files</h2><ul><li>Supports Instagram JSON, HTML, ZIP archives, and split files.</li><li>Compares files locally, with optional snapshots saved on your device.</li><li>Explains missing input and known limitations alongside results.</li></ul><p>Automatic checking is currently unavailable. File comparison is available on the website.</p></section></main><footer><p>Independent project. Not affiliated with Instagram or Meta.</p><a href="https://github.com/Arhaan2/mutuallens">Read the source and documentation</a></footer></body></html>`;
const notFound = `${head('Page not found · MutualLens', 'Return to the MutualLens project.')}</head><body><main id="main"><h1>Page not found</h1><p>This address is not part of the MutualLens project site.</p><a class="button" href="${base}/">Return to MutualLens</a></main></body></html>`;
const css = `:root{font-family:system-ui,sans-serif;color:#263020;background:#f7f8f5;line-height:1.65}*{box-sizing:border-box}body{margin:0}a{color:#365725;text-underline-offset:.2em}a:focus-visible{outline:3px solid #365725;outline-offset:5px}header,main,footer{width:min(100% - 3rem,960px);margin:auto}header{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1.5rem 0;border-bottom:1px solid #d7dece}.brand{display:flex;align-items:center;gap:.6rem;font-weight:750;font-size:1.3rem;text-decoration:none}main{padding:4rem 0}.eyebrow{font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}h1{font-size:clamp(2.25rem,6vw,4.5rem);line-height:1.08;letter-spacing:-.045em;max-width:800px;margin:1rem 0 1.5rem}.lede{font-size:1.25rem;max-width:720px}p{max-width:750px}.button{display:inline-block;padding:.8rem 1.25rem;margin:1rem 0;color:#fff;background:#3c5b29;border-radius:8px;text-decoration:none;font-weight:650}section{margin-top:3rem;padding:1.5rem;background:#edf1e8;border:1px solid #d7dece;border-radius:12px}h2{margin-top:0}li{margin:.5rem 0}footer{padding:1.5rem 0 2.5rem;border-top:1px solid #d7dece;font-size:.9rem}.skip{position:absolute;top:-100px;left:1rem;background:#fff;padding:.75rem}.skip:focus{top:1rem}@media(max-width:480px){header,main,footer{width:calc(100% - 2rem)}header{font-size:.875rem}main{padding:2.5rem 0}section{padding:1rem}}`;
await Promise.all([
  writeFile(new URL('index.html', output), homepage),
  writeFile(new URL('404.html', output), notFound),
  writeFile(new URL('project.css', output), css),
  copyFile(
    new URL('../apps/site/public/favicon.svg', import.meta.url),
    new URL('favicon.svg', output),
  ),
  writeFile(new URL('.nojekyll', output), ''),
  writeFile(
    new URL('robots.txt', output),
    `User-agent: *\nAllow: /\nSitemap: ${canonical}sitemap.xml\n`,
  ),
  writeFile(
    new URL('sitemap.xml', output),
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
  ),
  writeFile(
    new URL('build-info.json', output),
    JSON.stringify({
      ...(await sourceStamp()),
      host: 'github-pages-project-entry',
    }),
  ),
]);
console.log('Built static MutualLens project entry at apps/site/project-dist.');
