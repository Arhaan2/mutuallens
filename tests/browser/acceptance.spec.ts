import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { zipSync, strToU8 } from 'fflate';
import { mkdir, writeFile } from 'node:fs/promises';

const keyboardTab = (browserName: string) =>
  browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
const evidence = () => `test-results/acceptance-${test.info().project.name}`;
test.beforeEach(async () => {
  await mkdir(evidence(), { recursive: true });
});
const row = (username: string) => ({
  title: '',
  media_list_data: [],
  string_list_data: [
    {
      value: username,
      href: `https://www.instagram.com/${username}/`,
      timestamp: 1700000000,
    },
  ],
});
const followerFile = (names: string[]) => JSON.stringify(names.map(row));
const followingFile = (names: string[]) =>
  JSON.stringify({ relationships_following: names.map(row) });
const file = (name: string, text: string) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(text),
});

test('capability, scan boundary, headers and unknown paths on local Workers runtime', async ({
  request,
}) => {
  const capability = await request.get('/api/capabilities');
  expect(await capability.json()).toMatchObject({
    release: 'preview',
    automatic: { enabled: false },
    ads: false,
  });
  expect(capability.headers()['cache-control']).toContain('no-store');
  const scan = await request.post('/api/scans', {
    headers: { Origin: 'http://localhost:5173' },
    data: { username: 'synthetic' },
  });
  expect(scan.status()).toBe(503);
  expect(await scan.json()).toMatchObject({ results: null, complete: false });
  expect(
    (
      await request.post('/api/scans', {
        headers: { Origin: 'http://localhost:4321' },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get('/api/unknown')).status()).toBe(404);
  expect((await request.get('/nonexistent-account')).status()).toBe(404);
  for (const origin of ['http://localhost:5173', 'http://localhost:4321']) {
    const response = await request.get(origin);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
  }
});

test('synthetic target, search, pagination, keyboard, exports, no external requests', async ({
  page,
  browserName,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Check automatically' }),
  ).toBeDisabled();
  await page.keyboard.press(keyboardTab(browserName));
  await expect(
    page.getByRole('link', { name: 'Skip to checker' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Explore synthetic sample' }).click();
  await expect(page.locator('#results-title')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Not following you back 1,500/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Mutuals 4,500/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /You don’t follow back 1,500/ }),
  ).toBeVisible();
  await expect(page.locator('.account-list > li')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.pagination')).toContainText('Page 2 of 30');
  const start = performance.now();
  await page.getByRole('searchbox').fill('user07500');
  await expect(page.locator('.account-list > li')).toHaveCount(1);
  const searchMs = performance.now() - start;
  await page.getByRole('searchbox').fill('not_a_synthetic_account');
  await expect(
    page.getByRole('heading', { name: 'No matching accounts' }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered CSV' }).click();
  expect((await download).suggestedFilename()).toContain('synthetic');
  expect(errors).toEqual([]);
  expect(
    requests.filter(
      (url) =>
        !url.startsWith('http://localhost:5173/') &&
        !url.startsWith('blob:http://localhost:5173/'),
    ),
  ).toEqual([]);
  await mkdir(evidence(), { recursive: true });
  const memory = await page.evaluate(() => {
    const p = performance as Performance & {
      memory?: { usedJSHeapSize: number };
    };
    return p.memory?.usedJSHeapSize ?? null;
  });
  await writeFile(
    `${evidence()}/browser-performance.json`,
    JSON.stringify(
      {
        synthetic: true,
        browser: `Playwright ${browserName}`,
        searchRoundTripMs: searchMs,
        usedJSHeapBytes: memory,
        caveat:
          'Automation round-trip includes input and assertion overhead; memory is Chromium estimate, not device limit or live scan evidence.',
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: `${evidence()}/checker-desktop.png`,
    fullPage: true,
  });
});

test('local loose imports withhold absences by default and do not transmit files', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#automatic-status')).toContainText(
    'not available',
  );
  const requests: string[] = [];
  page.on('request', (r) => requests.push(`${r.method()} ${r.url()}`));
  await page.locator('#import-account').fill('synthetic_owner');
  if (!(await page.locator('#import-account').isVisible()))
    await page.locator('details#import > summary').click();
  await page
    .locator('input[type=file]')
    .setInputFiles([
      file('followers_1.json', followerFile(['alpha', 'mutual'])),
      file('following.json', followingFile(['beta', 'mutual'])),
    ]);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
  await expect(
    page.getByRole('button', { name: /Not following you back Withheld/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Not following you back Withheld/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Missing doesn’t mean not following.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Export filtered CSV' }),
  ).toBeDisabled();
  expect(
    requests.filter(
      (r) =>
        !r.startsWith('GET http://localhost:5173/assets/') &&
        !r.startsWith('GET blob:http://localhost:5173/'),
    ),
  ).toEqual([]);
});

test('ZIP split import complete supplied sets, empty input distinct from missing and malformed', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#import-account').fill('synthetic_owner');
  const zip = zipSync({
    'connections/followers_1.json': strToU8(followerFile(['alpha'])),
    'connections/followers_2.json': strToU8(followerFile(['mutual'])),
    'connections/following.json': strToU8(followingFile(['beta', 'mutual'])),
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zip),
  });
  await page.getByLabel('I confirm these files').check();
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(
    page.getByRole('button', { name: /Not following you back 1$/ }),
  ).toBeVisible();
  await expect(page.locator('.account-list')).toContainText('@beta');
  if (!(await page.locator('#import-account').isVisible()))
    await page.locator('details#import > summary').click();
  await page
    .locator('input[type=file]')
    .setInputFiles([
      file('followers.json', '[]'),
      file('following.json', '{"relationships_following":[]}'),
    ]);
  await page.getByLabel('I confirm these files').check();
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(
    page.getByRole('heading', { name: 'No accounts in this category' }),
  ).toBeVisible();
  if (!(await page.locator('#import-account').isVisible()))
    await page.locator('details#import > summary').click();
  await page
    .locator('input[type=file]')
    .setInputFiles(file('following.json', followingFile(['beta'])));
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.getByRole('alert')).toContainText('Missing followers');
  if (!(await page.locator('#import-account').isVisible()))
    await page.locator('details#import > summary').click();
  await page
    .locator('input[type=file]')
    .setInputFiles([
      file('followers.json', '{bad'),
      file('following.json', '{}'),
    ]);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
});

test('explicit snapshots, reload persistence, delete-all and public origin storage/DOM isolation', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore synthetic sample' }).click();
  await expect(page.locator('#results-title')).toBeVisible();
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.getByRole('status')).toContainText('Snapshot saved');
  const publicPage = await context.newPage();
  await publicPage.goto('http://localhost:4321/');
  expect(
    await publicPage.evaluate(async () =>
      (await indexedDB.databases()).map((db) => db.name),
    ),
  ).toEqual([]);
  // Executed security probe in the actual public document: an opened checker window stays cross-origin.
  const popupPromise = publicPage.waitForEvent('popup');
  await publicPage.evaluate(() => {
    window.open('http://localhost:5173/', 'isolation-probe');
  });
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  const access = await publicPage.evaluate(() => {
    const child = window.open('', 'isolation-probe');
    try {
      return { blocked: false, text: child?.document.body.textContent };
    } catch (error) {
      return {
        blocked:
          error instanceof DOMException && error.name === 'SecurityError',
      };
    }
  });
  expect(access.blocked).toBe(true);
  await popup.close();
  // Generic entry restores no report; #sample intentionally regenerates on reload.
  await page.goto('/');
  await page.reload();
  await expect(page.locator('#results-title')).toHaveCount(0);
  await page.getByRole('button', { name: /View saved snapshots/ }).click();
  await expect(page.locator('.snapshot-list')).toContainText('Synthetic');
  await page
    .getByRole('button', { name: 'Delete all local snapshots' })
    .click();
  await page
    .getByRole('button', { name: 'Confirm delete all snapshots' })
    .click();
  await expect(page.getByRole('status')).toContainText('were deleted');
  const count = await page.evaluate(
    async () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('mutuallens-local-snapshots', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('snapshots');
          const query = tx.objectStore('snapshots').count();
          query.onsuccess = () => {
            resolve(query.result);
            db.close();
          };
        };
      }),
  );
  expect(count).toBe(0);
});

test('desktop and mobile accessibility, 200% layout zoom and reduced motion', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore synthetic sample' }).click();
  await expect(page.locator('#results-title')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `${evidence()}/checker-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole('searchbox')).toBeVisible();
  await page.screenshot({
    path: `${evidence()}/checker-zoom200.png`,
    fullPage: true,
  });
});

test('public pages, noindex canonicals, honest copy, ad-free network and useful navigation', async ({
  page,
  request,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('http://localhost:4321/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'http://localhost:4321/',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `${evidence()}/site-desktop.png`,
    fullPage: true,
  });
  const links = await page
    .locator('a[href]')
    .evaluateAll((items) => [
      ...new Set(items.map((item) => (item as HTMLAnchorElement).href)),
    ]);
  for (const url of links.filter((url) =>
    url.startsWith('http://localhost:4321/'),
  )) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(await response.text()).toMatch(/noindex/);
  }
  for (const path of [
    '/guides/download-instagram-followers/',
    '/guides/followers-vs-following/',
    '/guides/not-following-back-vs-unfollowed/',
    '/guides/instagram-export-troubleshooting/',
    '/privacy/',
    '/terms/',
    '/contact/',
    '/about/',
    '/instagram-follow-back-checker/',
  ]) {
    expect(
      (await request.get(`http://localhost:4321${path}`)).status(),
      path,
    ).toBe(200);
  }
  expect(
    requests.filter((url) => !url.startsWith('http://localhost:4321/')),
  ).toEqual([]);
  expect((await request.get('http://localhost:4321/ads.txt')).status()).toBe(
    404,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${evidence()}/site-mobile.png`,
    fullPage: true,
  });
});

test('keyboard-only sample flow and capability failure remain usable', async ({
  page,
  browserName,
}) => {
  await page.route('**/api/capabilities', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.goto('/');
  await expect(page.locator('#automatic-status')).toContainText(
    'could not be verified',
  );
  let sampleFocused = false;
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press(keyboardTab(browserName));
    sampleFocused = await page
      .getByRole('button', { name: 'Explore synthetic sample' })
      .evaluate((element) => element === document.activeElement);
    if (sampleFocused) break;
  }
  expect(sampleFocused).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#results-title')).toBeFocused();
  await page.keyboard.press(keyboardTab(browserName));
  await expect(page.getByRole('button', { name: 'Export JSON' })).toBeFocused();
  await page.setViewportSize({ width: 640, height: 450 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('snapshot comparison visible semantics and incompatible identity rejection', async ({
  page,
}) => {
  await page.goto('/');
  async function importAndSave(
    owner: string,
    followers: string[],
    date: string,
  ) {
    if (!(await page.locator('#import-account').isVisible()))
      await page.locator('details#import > summary').click();
    await page.locator('#import-account').fill(owner);
    await page
      .locator('input[type=file]')
      .setInputFiles([
        file('followers.json', followerFile(followers)),
        file('following.json', followingFile(['mutual'])),
      ]);
    await page.locator('#collected-at').fill(date);
    await page.getByLabel('I confirm these files').check();
    await page.getByRole('button', { name: /Compare local files/ }).click();
    await expect(page.locator('#results-title')).toContainText(owner);
    await expect(page.getByRole('status')).toContainText(
      'selected files were processed',
    );
    await page.getByRole('button', { name: 'Save snapshot locally' }).click();
    await expect(page.getByRole('status')).toContainText('Snapshot saved');
  }
  await importAndSave(
    'synthetic_owner',
    ['alpha', 'mutual'],
    '2025-01-01T12:00',
  );
  await importAndSave(
    'synthetic_owner',
    ['beta', 'mutual'],
    '2025-02-01T12:00',
  );
  const before = page.getByLabel('Earlier snapshot');
  const after = page.getByLabel('Later snapshot');
  await before.selectOption({ index: 2 });
  await after.selectOption({ index: 1 });
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await expect(page.locator('.history-result')).toContainText(
    'do not establish an exact unfollow time',
  );
  await expect(page.locator('.history-result')).toContainText('username-only');
  await expect(page.locator('.history-result summary').first()).toContainText(
    '1',
  );
  await importAndSave('different_owner', ['gamma'], '2025-03-01T12:00');
  await before.selectOption({ index: 3 });
  await after.selectOption({ index: 1 });
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('same account');
  await expect(page.locator('.history-result')).toHaveCount(0);
});

test('public content accessibility and recorded local paint measurements', async ({
  page,
  browser,
  browserName,
}) => {
  await page.addInitScript(() => {
    const metrics: { lcpMs: number | null; cls: number | null } = {
      lcpMs: PerformanceObserver.supportedEntryTypes.includes(
        'largest-contentful-paint',
      )
        ? 0
        : null,
      cls: PerformanceObserver.supportedEntryTypes.includes('layout-shift')
        ? 0
        : null,
    };
    Object.assign(window, { __mutuallensLab: metrics });
    if (
      PerformanceObserver.supportedEntryTypes.includes(
        'largest-contentful-paint',
      )
    )
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) metrics.lcpMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift'))
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          };
          if (!shift.hadRecentInput)
            metrics.cls = (metrics.cls ?? 0) + shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('http://localhost:4321/');
  if (
    await page.evaluate(() =>
      PerformanceObserver.supportedEntryTypes.includes('paint'),
    )
  )
    await page.waitForFunction(
      () => performance.getEntriesByName('first-contentful-paint').length > 0,
    );
  const lab = await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const metrics = (
      window as Window & { __mutuallensLab?: { lcpMs: number; cls: number } }
    ).__mutuallensLab;
    const navigation = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming;
    return {
      ...metrics,
      fcpMs: performance.getEntriesByName('first-contentful-paint')[0]
        ?.startTime,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      transferBytes: navigation.transferSize,
    };
  });
  await writeFile(
    `${evidence()}/public-lab-performance.json`,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        environment: `${process.platform}/${process.arch} local preview; ${browserName} ${browser.version()}; no network/CPU throttling`,
        ...lab,
        fieldCoreWebVitals: 'NOT MEASURED',
        caveat:
          'Single local initial-load lab observation; not field percentiles, production latency, or automatic acquisition timing.',
      },
      null,
      2,
    ),
  );
  for (const path of [
    '/instagram-follow-back-checker/',
    '/guides/download-instagram-followers/',
    '/guides/followers-vs-following/',
    '/guides/not-following-back-vs-unfollowed/',
    '/guides/instagram-export-troubleshooting/',
    '/privacy/',
    '/terms/',
    '/contact/',
    '/about/',
  ]) {
    await page.goto(`http://localhost:4321${path}`);
    expect((await new AxeBuilder({ page }).analyze()).violations, path).toEqual(
      [],
    );
  }
});
