import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SITE =
  process.env.MUTUALLENS_HOSTED_SITE_ORIGIN ??
  'https://mutuallens-ddm.pages.dev';
const CHECKER =
  process.env.MUTUALLENS_HOSTED_CHECKER_ORIGIN ??
  'https://mutuallens-app.pages.dev';
const PROJECT = 'https://arhaan2.github.io/mutuallens/';
const obsolete =
  /\b(?:demo|preview|prototype)\b|verification pending|release gates?|build stamp/i;

test('release: stable source stamps, accurate capability and separate noindexed origins', async ({
  request,
}) => {
  expect(new URL(SITE).origin).not.toBe(new URL(CHECKER).origin);
  const expected = process.env.MUTUALLENS_EXPECTED_SHA;
  expect(
    expected,
    'Hosted verification requires an exact deployed source SHA',
  ).toMatch(/^[a-f0-9]{40}$/);
  const expectedProject =
    process.env.MUTUALLENS_EXPECTED_PROJECT_SHA ?? expected;
  expect(expectedProject).toMatch(/^[a-f0-9]{40}$/);
  const sourceHashes = new Set<string>();
  for (const [origin, expectedCommit] of [
    [SITE, expected],
    [CHECKER, expected],
    [PROJECT.replace(/\/$/, ''), expectedProject],
  ]) {
    const stamp = await request.get(`${origin}/build-info.json`);
    expect(stamp.status()).toBe(200);
    const body = await stamp.json();
    expect(body).toMatchObject({ commit: expectedCommit });
    expect(body.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    sourceHashes.add(body.sourceHash);
  }
  expect(sourceHashes.size).toBe(1);
  for (const origin of [SITE, CHECKER]) {
    const response = await request.get(origin);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    const missing = await request.get(`${origin}/no-such-release-page`);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).not.toMatch(obsolete);
  }
  const capability = await request.get(`${CHECKER}/api/capabilities`);
  expect(await capability.json()).toMatchObject({
    automatic: { enabled: false, status: 'blocked' },
    ads: false,
  });
  expect(capability.headers()['cache-control']).toContain('no-store');
  expect(capability.headers()['x-robots-tag']).toContain('noindex');
  expect(capability.headers()['access-control-allow-origin']).toBeUndefined();
  expect(await (await request.get(`${SITE}/sitemap.xml`)).text()).not.toContain(
    '<loc>',
  );
});

test('release: public pages have product copy, working links, accessible mobile and desktop layouts', async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(SITE);
  const paths = await page
    .locator('a[href]')
    .evaluateAll((anchors) => [
      ...new Set(anchors.map((a) => (a as HTMLAnchorElement).href)),
    ]);
  // In-page links such as #main do not issue an HTTP navigation. Check each
  // distinct public document once, without treating a null anchor response as
  // a failed page load.
  const pages = [
    ...new Set(
      paths
        .filter((url) => new URL(url).origin === new URL(SITE).origin)
        .map((url) => {
          const document = new URL(url);
          document.hash = '';
          return document.href;
        }),
    ),
  ];
  expect(pages.length).toBeGreaterThan(5);
  for (const url of pages) {
    expect((await request.get(url)).status(), url).toBe(200);
    const response = await page.goto(url);
    // Firefox can report a successful cache revalidation as 304.
    expect([200, 304], url).toContain(response?.status());
    expect(await page.locator('body').innerText(), url).not.toMatch(obsolete);
    expect(await page.title()).not.toMatch(obsolete);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      new URL(url).origin + new URL(url).pathname,
    );
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of [SITE, CHECKER, PROJECT]) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      expect(await page.locator('body').innerText()).not.toMatch(obsolete);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
  const origins = new Set([
    new URL(SITE).origin,
    new URL(CHECKER).origin,
    new URL(PROJECT).origin,
  ]);
  expect(requests.filter((url) => !origins.has(new URL(url).origin))).toEqual(
    [],
  );
  // Playwright WebKit injects an inline stylesheet while taking screenshots.
  // Keep visual capture on a separate page so its CSP error cannot contaminate
  // the application console checks above; production CSP remains unchanged.
  const visualPage = await page.context().newPage();
  try {
    for (const width of [390, 1440]) {
      await visualPage.setViewportSize({ width, height: 900 });
      for (const [label, url] of [
        ['public', SITE],
        ['checker', CHECKER],
        ['project', PROJECT],
      ]) {
        await visualPage.goto(url!);
        await visualPage.screenshot({
          path: info.outputPath(`${label}-${width}.png`),
          fullPage: true,
        });
      }
    }
  } finally {
    await visualPage.close();
  }
});

test('release: GitHub project base, assets, refresh and 404 lead to the actual Cloudflare website', async ({
  page,
  request,
}) => {
  await page.goto(PROJECT);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    PROJECT,
  );
  await expect(page.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(page.locator('form, iframe, script')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /Visit MutualLens/ }),
  ).toHaveAttribute('href', `${SITE}/`);
  for (const path of ['project.css', 'favicon.svg'])
    expect((await request.get(`${PROJECT}${path}`)).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Instagram connections',
  );
  for (const path of ['missing-page', 'guides/']) {
    const response = await page.goto(`${PROJECT}${path}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('link', { name: 'Return to MutualLens' }),
    ).toHaveAttribute('href', '/mutuallens/');
  }
  await page.getByRole('link', { name: 'Return to MutualLens' }).click();
  await page.getByRole('link', { name: /Visit MutualLens/ }).click();
  await expect(page).toHaveURL(`${SITE}/`);
  await page
    .getByRole('link', { name: /Upload your Instagram files/ })
    .first()
    .click();
  await expect(page).toHaveURL(`${CHECKER}/#import`);
  await expect(page.locator('#import-files')).toBeVisible();
  await expect(page.locator('#results-title')).toHaveCount(0);
});
