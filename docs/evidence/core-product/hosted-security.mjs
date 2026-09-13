/* global localStorage, sessionStorage, window, indexedDB -- evaluated in the isolated browser page context. */
import { Buffer } from 'node:buffer';
// Independent deployed preview security checks. Anonymous/synthetic only.
// No provider request, credential, account mutation, deployment or local server.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const publicOrigin = 'https://codex-ui-functional-repair.mutuallens-ddm.pages.dev';
const checkerOrigin = 'https://codex-ui-functional-repair.mutuallens-app.pages.dev';
const expected = { commit: 'f0165de28d71180f9018eed8c1bd30633bfd6415', sourceHash: 'ffbc199edb1b72999beae53778e41f8b9f29b50d2652d6d82bd14df18643b1e1' };
const observations = [], assertions = [], assets = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function check(name, condition) { assertions.push({ name, passed: !!condition }); if (!condition) throw new Error(`Security assertion failed: ${name}`); }
async function read(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new Error('Public response exceeded review budget.');
  const fields = ['content-type', 'content-security-policy', 'x-robots-tag', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'cache-control', 'access-control-allow-origin', 'strict-transport-security'];
  const headers = Object.fromEntries(fields.map(field => [field, response.headers.get(field)]));
  observations.push({ url, method: options.method ?? 'GET', status: response.status, headers, setsCookie: response.headers.has('set-cookie'), bytes: Buffer.byteLength(text), sha256: sha256(text) });
  return { response, text, headers };
}
function privateApi(name, value) {
  check(`${name}: private/no-store`, /private/.test(value.headers['cache-control'] ?? '') && /no-store/.test(value.headers['cache-control'] ?? ''));
  check(`${name}: noindex`, /noindex/.test(value.headers['x-robots-tag'] ?? ''));
  check(`${name}: inert CSP`, value.headers['content-security-policy'] === "default-src 'none'; frame-ancestors 'none'");
  check(`${name}: no CORS grant`, value.headers['access-control-allow-origin'] === null);
  check(`${name}: no session cookie`, !value.response.headers.has('set-cookie'));
}
const evidence = { kind: 'ACTUAL_HOSTED_PREVIEW_SECURITY', startedAt: new Date().toISOString(), expected, origins: { public: publicOrigin, checker: checkerOrigin }, observations, assets, assertions, liveProviderRuns: 0, realInstagramTargets: 0 };
let browser;
try {
  const documents = await Promise.all([read(`${publicOrigin}/`), read(`${checkerOrigin}/`)]);
  for (const [index, doc] of documents.entries()) {
    const label = index === 0 ? 'public' : 'checker';
    check(`${label}: HTTPS document200`, doc.response.status === 200 && doc.response.url.startsWith('https:'));
    check(`${label}: noindex header and HTML`, /noindex/.test(doc.headers['x-robots-tag'] ?? '') && /<meta\b[^>]*name=["']robots["'][^>]*noindex/i.test(doc.text));
    check(`${label}: self script/connect, no frames/objects`, ["script-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "object-src 'none'"].every(part => doc.headers['content-security-policy']?.includes(part)));
    check(`${label}: nosniff and no-referrer`, doc.headers['x-content-type-options'] === 'nosniff' && doc.headers['referrer-policy'] === 'no-referrer');
  }
  check('public and checker use separate origins', publicOrigin !== checkerOrigin);
  const builds = await Promise.all([
    read(`${publicOrigin}/build-info.json`), read(`${checkerOrigin}/build-info.json`),
    read('https://10037ccf.mutuallens-ddm.pages.dev/build-info.json'), read('https://80455a41.mutuallens-app.pages.dev/build-info.json'),
  ]);
  for (const [index, value] of builds.entries()) {
    const stamp = JSON.parse(value.text);
    check(`build${index + 1}: exact commit/source`, value.response.status === 200 && stamp.commit === expected.commit && stamp.sourceHash === expected.sourceHash);
  }
  for (const origin of [publicOrigin, checkerOrigin]) {
    const robots = await read(`${origin}/robots.txt`);
    // Crawling may remain allowed so crawlers can read the enforced noindex.
    // robots.txt Disallow is not required to satisfy the preview noindex gate.
    check(`${new URL(origin).hostname}: explicit robots policy`, robots.response.status === 200 && /User-agent:\s*\*/i.test(robots.text) && /(?:Allow|Disallow):\s*\//i.test(robots.text));
  }
  const capability = await read(`${checkerOrigin}/api/capabilities`);
  const caps = JSON.parse(capability.text);
  check('automatic and advertising disabled before any synthetic mutation', capability.response.status === 200 && caps.release === 'preview' && caps.automatic?.enabled === false && caps.automatic?.status === 'blocked' && caps.ads === false);
  privateApi('capabilities', capability);
  const id = '00000000-0000-4000-8000-000000000001';
  for (const [name, path, options] of [
    ['disabled GET scan', '/api/scans', {}],
    ['disabled result', `/api/scans/${id}/result?direction=followers&offset=0`, { headers: { Origin: publicOrigin } }],
    ['disabled same-origin session', '/api/session', { method: 'POST', headers: { Origin: checkerOrigin, 'Sec-Fetch-Site': 'same-origin' } }],
    ['disabled synthetic start', '/api/scans', { method: 'POST', headers: { Origin: checkerOrigin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'synthetic_security_fixture', idempotencyKey: id }) }],
  ]) {
    const value = await read(`${checkerOrigin}${path}`, options), body = JSON.parse(value.text);
    check(`${name}:503/null/incomplete`, value.response.status === 503 && body.code === 'AUTOMATIC_UNAVAILABLE' && body.results === null && body.complete === false);
    check(`${name}: no private/provider fields`, !/apify_api_|APIFY_TOKEN|Bearer\s|defaultDatasetId|session_hash|chargedEventCounts/.test(value.text));
    privateApi(name, value);
  }
  for (const [name, headers] of [
    ['public origin', { Origin: publicOrigin, 'Sec-Fetch-Site': 'same-site' }],
    ['absent origin', {}],
    ['cross-site context', { Origin: checkerOrigin, 'Sec-Fetch-Site': 'cross-site' }],
  ]) {
    const value = await read(`${checkerOrigin}/api/session`, { method: 'POST', headers });
    check(`${name}: mutation403`, value.response.status === 403 && JSON.parse(value.text).code === 'ORIGIN_REJECTED');
    privateApi(name, value);
  }
  const scriptUrls = new Set();
  for (const [index, doc] of documents.entries()) {
    for (const match of doc.text.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)) scriptUrls.add(new URL(match[1], index === 0 ? publicOrigin : checkerOrigin).href);
  }
  const forbidden = ['api.apify.com', 'APIFY_TOKEN', 'HIKER_API_KEY', 'apify-actor-start', 'user-batch-50', '2nsQrloj1Sl16uh4z', 'qZHBzZiV6QmFCKDym'];
  for (const url of scriptUrls) {
    check('script is first-party', [publicOrigin, checkerOrigin].includes(new URL(url).origin));
    const value = await read(url);
    for (const match of value.text.matchAll(/\/assets\/processing\.worker-[A-Za-z0-9_-]+\.js/g)) scriptUrls.add(new URL(match[0], checkerOrigin).href);
    const matches = forbidden.filter(pattern => value.text.includes(pattern));
    if (/apify_api_[A-Za-z0-9_-]{12,}/.test(value.text)) matches.push('provider-token-shaped-string');
    assets.push({ url, bytes: Buffer.byteLength(value.text), sha256: sha256(value.text), forbiddenMatches: matches });
    check(`delivered asset exclusion:${new URL(url).pathname}`, value.response.status === 200 && matches.length === 0);
  }
  check('checker main and compiled worker both inspected', assets.some(asset => /\/assets\/index-/.test(asset.url)) && assets.some(asset => /processing\.worker-/.test(asset.url)));

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const browserRequests = [], browserErrors = [];
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    return [publicOrigin, checkerOrigin].includes(origin) ? route.continue() : route.abort('blockedbyclient');
  });
  context.on('request', request => { if (/^https?:/.test(request.url())) browserRequests.push({ url: request.url(), method: request.method() }); });
  context.on('page', page => page.on('pageerror', error => browserErrors.push(error.message)));
  const publicPage = await context.newPage();
  await publicPage.goto(`${publicOrigin}/`, { waitUntil: 'networkidle' });
  const key = 'mutuallens-independent-hosted-synthetic-origin-test';
  await publicPage.evaluate(key => { localStorage.setItem(key, 'public-synthetic'); sessionStorage.setItem(key, 'public-synthetic'); }, key);
  const popupPromise = context.waitForEvent('page');
  await publicPage.evaluate(checker => { window.__mutuallensReviewChild = window.open(checker, 'mutuallens-independent-review'); }, `${checkerOrigin}/`);
  const checkerPage = await popupPromise;
  await checkerPage.waitForLoadState('networkidle');
  const isolated = await checkerPage.evaluate(async key => {
    const before = { local: localStorage.getItem(key), session: sessionStorage.getItem(key) };
    localStorage.setItem(key, 'checker-synthetic'); sessionStorage.setItem(key, 'checker-synthetic');
    return { before, indexedDbNames: (await indexedDB.databases()).map(database => database.name) };
  }, key);
  check('checker cannot read public local/session storage', isolated.before.local === null && isolated.before.session === null);
  const parent = await publicPage.evaluate(key => {
    let domError = null;
    try { void window.__mutuallensReviewChild.document.body.textContent; } catch (error) { domError = error.name; }
    return { local: localStorage.getItem(key), session: sessionStorage.getItem(key), domError };
  }, key);
  check('checker writes do not modify public storage', parent.local === 'public-synthetic' && parent.session === 'public-synthetic');
  check('public cannot access checker DOM', parent.domError === 'SecurityError');
  check('no checker snapshots created during initial visit', isolated.indexedDbNames.length === 0);
  const sessionCookieNames = (await context.cookies()).map(cookie => cookie.name).filter(name => /mutuallens.*session/.test(name));
  check('disabled workflow creates no session cookies', sessionCookieNames.length === 0);
  const thirdParty = browserRequests.filter(request => ![publicOrigin, checkerOrigin].includes(new URL(request.url).origin));
  check('no third-party asset/tracker/provider requests attempted', thirdParty.length === 0);
  check('no browser runtime errors', browserErrors.length === 0);
  evidence.browser = { engine: 'Chromium', requests: browserRequests, thirdPartyRequests: thirdParty, runtimeErrors: browserErrors, isolatedStorageBefore: isolated.before, domError: parent.domError, indexedDbNames: isolated.indexedDbNames, sessionCookieNames, caveat: 'Fresh isolated context with synthetic storage sentinels only; no actual automatic session or graph was created. Enabled-session job authorization is not tested by this disabled-gate probe.' };
  await context.close();
  evidence.result = 'PASS';
} catch (error) {
  evidence.result = 'FAIL';
  evidence.failure = error instanceof Error ? error.message : 'Review did not complete.';
} finally {
  await browser?.close();
  evidence.finishedAt = new Date().toISOString();
  evidence.assertionsPassed = assertions.filter(assertion => assertion.passed).length;
  await writeFile(new URL('./hosted-security.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ result: evidence.result, passed: evidence.assertionsPassed, checks: assertions.length, assetCount: assets.length, failure: evidence.failure })}\n`);
}
if (evidence.result !== 'PASS') process.exitCode = 1;
