/* global Worker, File, setTimeout, clearTimeout -- executed inside the isolated browser evaluation callback. */
// Read-only current-build review. Launches one isolated Chromium context; no
// server, credentials, live account, provider call or existing browser context.
import { chromium } from 'playwright';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dist = '/Users/arhaan/Documents/ChatGPT/mutuallens/apps/checker/dist';
const hash = value => createHash('sha256').update(value).digest('hex');
const stamp = JSON.parse(await readFile(`${dist}/build-info.json`, 'utf8'));
const assets = (await readdir(`${dist}/assets`)).filter(name => name.endsWith('.js'));
const forbidden = ['api.apify.com', 'APIFY_TOKEN', 'HIKER_API_KEY', 'apify-actor-start', 'user-batch-50', '2nsQrloj1Sl16uh4z', 'qZHBzZiV6QmFCKDym'];
const checks = [];
let workerCode = '';
for (const asset of assets) {
  const bytes = await readFile(`${dist}/assets/${asset}`), text = bytes.toString('utf8');
  const matches = forbidden.filter(value => text.includes(value));
  checks.push({ asset, bytes: bytes.length, sha256: hash(bytes), forbiddenMatches: matches });
  if (asset.startsWith('processing.worker-')) workerCode = text;
}
if (!workerCode || checks.some(check => check.forbiddenMatches.length)) throw new Error('Browser bundle provider-boundary check failed.');
const browser = await chromium.launch({ headless: true });
const requests = [], errors = [];
const harnessOrigin = 'https://synthetic-mutuallens.invalid';
let workerResult;
try {
  const context = await browser.newContext();
  // Even a regression attempting a network request cannot contact a target.
  await context.route('**/*', route => {
    if (route.request().url() === `${harnessOrigin}/review`) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>Isolated synthetic import review</body></html>' });
    if (route.request().url() === `${harnessOrigin}/processing.worker.js`) return route.fulfill({ status: 200, contentType: 'application/javascript', body: workerCode });
    return route.abort('blockedbyclient');
  });
  context.on('request', request => { if (/^https?:/.test(request.url())) requests.push({ url: request.url(), method: request.method() }); });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${harnessOrigin}/review`);
  workerResult = await page.evaluate(async () => {
    const address = '/processing.worker.js';
    const worker = new Worker(address, { type: 'module' });
    const followers = '<!doctype html><html><head><title>Followers</title><link rel="stylesheet" href="https://external.invalid/import.css"><script>fetch("https://external.invalid/script-ran")</script></head><body><h1>Followers</h1><img src="https://external.invalid/import.png"><div class="_a6-p"><a href="https://www.instagram.com/synthetic_mutual/">synthetic_mutual</a></div></body></html>';
    const following = JSON.stringify({ relationships_following: ['synthetic_mutual', 'synthetic_not_back'].map(value => ({ string_list_data: [{ value, href: `https://www.instagram.com/${value}/`, timestamp: 1700000000 }] })) });
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Built worker did not finish within its test deadline.')), 15000);
        worker.addEventListener('error', event => { clearTimeout(timeout); reject(new Error(`Built worker failed: ${event.message || 'unavailable error message'}`)); }, { once: true });
        worker.addEventListener('message', event => {
          clearTimeout(timeout);
          if (event.data.error) { reject(new Error(event.data.error)); return; }
          const { dataset, comparison } = event.data.result;
          resolve({ kind: 'BUILT_WORKER_SYNTHETIC_HTML_JSON_IMPORT', requestId: event.data.id, comparisonBasis: dataset.comparisonBasis, followers: dataset.followers.records.length, following: dataset.following.records.length, mutuals: comparison.mutuals.length, notFollowingBack: comparison.notFollowingBack.map(row => row.username), negativesWithheld: comparison.negativesWithheld });
        }, { once: true });
        worker.postMessage({ id: 902, kind: 'import', files: [new File([followers], 'followers.html', { type: 'text/html' }), new File([following], 'following.json', { type: 'application/json' })], options: {} });
      });
    } finally { worker.terminate(); }
  });
  await context.close();
} finally { await browser.close(); }
const unexpectedRequests = requests.filter(request => ![`${harnessOrigin}/review`, `${harnessOrigin}/processing.worker.js`].includes(request.url));
if (unexpectedRequests.length || errors.length || workerResult.comparisonBasis !== 'supplied_files' || workerResult.followers !== 1 || workerResult.following !== 2 || workerResult.mutuals !== 1 || workerResult.negativesWithheld || JSON.stringify(workerResult.notFollowingBack) !== '["synthetic_not_back"]') throw new Error('Built worker import/privacy assertion failed.');
const evidence = { kind: 'WIP_BROWSER_BUILD_BOUNDARY_AND_SYNTHETIC_WORKER_TEST', recordedAt: new Date().toISOString(), build: stamp, caveat: 'WIP stamped source artifact, not deployed acceptance or a clean committed build; actual UI journey is covered separately. A synthetic HTML harness and the exact built worker bytes were fulfilled in memory by Playwright routing. No real server or network endpoint was contacted.', assets: checks, workerResult, harnessServedRequests: requests, unexpectedImportRequests: unexpectedRequests, pageErrors: errors, noServerStarted: true, liveProviderRuns: 0, result: 'PASS' };
const finalStamp = JSON.parse(await readFile(`${dist}/build-info.json`, 'utf8'));
if (finalStamp.sourceHash !== stamp.sourceHash) throw new Error('Build changed during inspection; no result was recorded.');
await writeFile(new URL(`./acquisition-seemu-browser-boundary-${stamp.sourceHash.slice(0, 12)}.json`, import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ sourceHash: stamp.sourceHash, assets: checks.length, workerResult, unexpectedImportRequests: unexpectedRequests.length, result: evidence.result })}\n`);
