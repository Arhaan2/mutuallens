import { test, expect, type Download, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { zipSync, strToU8 } from 'fflate';

// All data is generated here and fictional. No provider routes are mocked.
const record = (value: string) => ({
  string_list_data: [{ value, href: `https://www.instagram.com/${value}/` }],
});
const file = (name: string, value: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(value)),
});
const files = (
  followers = ['review_fan', 'review_mutual'],
  following = ['review_other', 'review_mutual'],
) => [
  file('followers_1.json', followers.map(record)),
  file('following.json', { relationships_following: following.map(record) }),
];
async function openFiles(page: Page) {
  if (!(await page.locator('#import-files').isVisible()))
    await page.locator('#import > summary').click();
}
async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
async function exported(page: Page, label: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  return downloadText(await pending);
}
const obsolete =
  /\b(?:demo|preview|prototype)\b|verification pending|release gate|commit [a-f0-9]{7}/i;

test('independent: genuine disabled runtime and entry never fabricate a sample', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/capabilities');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    automatic: { enabled: false, status: 'blocked' },
    ads: false,
  });
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  expect(response.headers()['cache-control']).toContain('no-store');
  await page.goto('/#sample');
  await expect(page.locator('#automatic-status')).toContainText(
    'currently unavailable',
  );
  await expect(page.locator('#results-title')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(obsolete);
  await expect(page.locator('a[href*="#sample"]')).toHaveCount(0);
  await page.locator('#automatic > summary').click();
  await expect(page.locator('#automatic-username')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Check automatically', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('independent: immediate partial upload, failed replacement and explicit empty direction stay distinct', async ({
  page,
}) => {
  await page.goto('/#import');
  expect(
    await page
      .locator('#import input[required], #import input[type=checkbox]')
      .count(),
  ).toBe(0);
  await page
    .locator('#import-files')
    .setInputFiles([
      file('followers_1.json', [record('review_fan')]),
      file('followers_3.json', [record('review_mutual')]),
      files()[1]!,
    ]);
  await expect(page.locator('.account-list')).toContainText('@review_other');
  await expect(page.locator('.category.active')).toContainText(
    'Not found in supplied followers',
  );
  await expect(page.locator('.upload-limitation')).toBeVisible();
  expect(await exported(page, 'Export filtered CSV')).toMatch(
    /Missing|missing|numbered|part/,
  );
  await openFiles(page);
  await page.locator('#import-files').setInputFiles(files()[1]!);
  await expect(page.locator('#import [role=alert]')).toContainText(
    /Missing followers/i,
  );
  await expect(page.locator('.account-list')).toContainText('@review_other');
  await page
    .locator('#import-files')
    .setInputFiles(files([], ['review_explicit_empty']));
  await expect(page.locator('.account-list')).toContainText(
    '@review_explicit_empty',
  );
  await expect(page.locator('.category.active')).toContainText(
    'Not following you back',
  );
  await expect(page.locator('.upload-limitation')).toHaveCount(0);
  const json = JSON.parse(await exported(page, 'Export JSON'));
  expect(json.followers.records).toEqual([]);
  expect(json.sample).toBe(false);
});

test('independent: inert HTML and nested ZIP match JSON without uploads or external requests', async ({
  page,
}) => {
  const requests: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) =>
    requests.push(`${request.method()} ${request.url()}`),
  );
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const html = (direction: string, names: string[]) =>
    `<!doctype html><title>${direction}</title><h1>${direction}</h1>${names.map((name) => `<div class="_a6-g"><div class="_a6-p"><a href="https://www.instagram.com/${name}/">${name}</a></div></div>`).join('')}<script>window.reviewExecuted=true;fetch('https://example.invalid/graph')</script><img src="https://example.invalid/avatar"><iframe src="https://example.invalid/frame"></iframe>`;
  const followerHtml = html('Followers', ['review_fan', 'review_mutual']);
  const followingHtml = html('Following', ['review_other', 'review_mutual']);
  const htmlFiles = [
    {
      name: 'followers_1.html',
      mimeType: 'text/html',
      buffer: Buffer.from(followerHtml),
    },
    {
      name: 'following.html',
      mimeType: 'text/html',
      buffer: Buffer.from(followingHtml),
    },
  ];
  const archive = {
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(
      zipSync({
        'nested/connections/followers_and_following/followers_1.html':
          strToU8(followerHtml),
        'nested/connections/followers_and_following/following.html':
          strToU8(followingHtml),
        'photos/irrelevant.txt': strToU8('irrelevant synthetic data'),
      }),
    ),
  };
  for (const input of [files(), htmlFiles, archive]) {
    await page.goto('/#import');
    await openFiles(page);
    await page.locator('#import-files').setInputFiles(input);
    await expect(page.locator('#import')).not.toHaveAttribute('open', '');
    await expect(page.locator('.account-list')).toContainText('@review_other');
    const link = page.locator('.account-list a').first();
    await expect(link).toHaveAttribute(
      'href',
      'https://www.instagram.com/review_other/',
    );
    await expect(link).toHaveAttribute('rel', /noreferrer/);
  }
  expect(
    requests.filter((value) => {
      const [method, url] = value.split(' ');
      return (
        method !== 'GET' || new URL(url!).origin !== 'http://localhost:4424'
      );
    }),
  ).toEqual([]);
  expect(await page.evaluate(() => 'reviewExecuted' in window)).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('independent: 6000 per direction, 4500 mutual, full export and native reopen', async ({
  page,
}) => {
  const names = (start: number) =>
    Array.from(
      { length: 6000 },
      (_, i) => `review_${String(start + i).padStart(5, '0')}`,
    );
  await page.goto('/#import');
  await page
    .locator('#import-files')
    .setInputFiles(files(names(0), names(1500)));
  await expect(page.locator('.category.active')).toContainText('1,500');
  await expect(
    page.getByRole('button', { name: 'Mutuals 4,500', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.account-list li')).toHaveCount(50);
  await expect(page.locator('#results-title')).toBeFocused();
  await page
    .getByRole('navigation', { name: 'Result pages', exact: true })
    .getByRole('button', { name: 'Last', exact: true })
    .click();
  await expect(page.locator('.account-list')).toContainText('@review_07499');
  await page.getByRole('searchbox').fill('@REVIEW_07499');
  await expect(page.locator('.account-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  const csv = await exported(page, 'Export filtered CSV');
  expect(csv.trim().split('\r\n')).toHaveLength(1501);
  expect(csv).toContain('review_06000');
  expect(csv).toContain('review_07499');
  const native = JSON.parse(await exported(page, 'Export JSON'));
  expect(native.comparisonBasis).toBe('supplied_files');
  expect(native.followers.metadata.terminal).toBe(false);
  await page.reload();
  await page
    .locator('#import-files')
    .setInputFiles(file('mutuallens-dataset.json', native));
  await expect(page.locator('.category.active')).toContainText('1,500');
});

test('independent: actual worker cancellation preserves old report and supports retry', async ({
  page,
}) => {
  await page.goto('/#import');
  await page.locator('#import-files').setInputFiles(files());
  await expect(page.locator('.account-list')).toContainText('@review_other');
  await openFiles(page);
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const cancel = [...document.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Cancel processing',
      );
      if (cancel) {
        observer.disconnect();
        cancel.click();
      }
    });
    observer.observe(document.getElementById('main')!, {
      childList: true,
      subtree: true,
    });
  });
  const names = Array.from({ length: 30000 }, (_, i) => `review_cancel_${i}`);
  await page.locator('#import-files').setInputFiles(files(names, names));
  await expect(page.locator('#import [role=status]')).toContainText('canceled');
  await expect(page.locator('.account-list')).toContainText('@review_other');
  await expect(
    page.getByRole('button', { name: 'Cancel processing' }),
  ).toHaveCount(0);
  await page
    .locator('#import-files')
    .setInputFiles(files(['review_retry'], ['review_retry', 'review_success']));
  await expect(page.locator('.account-list')).toContainText('@review_success');
});

test('independent: public pages, checker keyboard/mobile accessibility and privacy separation', async ({
  page,
  browserName,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const routes = [
    '/',
    '/guides/',
    '/about/',
    '/contact/',
    '/privacy/',
    '/terms/',
    '/instagram-follow-back-checker/',
    '/guides/download-instagram-followers/',
    '/guides/followers-vs-following/',
  ];
  for (const route of routes) {
    const response = await page.goto(`http://localhost:4423${route}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).not.toContainText(obsolete);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      `http://localhost:4423${route}`,
    );
  }
  await page.goto('http://localhost:4423/');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press(
    process.platform === 'darwin' && browserName === 'webkit'
      ? 'Alt+Tab'
      : 'Tab',
  );
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await page.screenshot({
    path: info.outputPath('public-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('public-mobile.png'),
    fullPage: true,
  });
  await page.goto('/#import');
  await page.locator('#import-files').setInputFiles(files());
  await expect(page.locator('.account-list')).toContainText('@review_other');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('checker-mobile.png'),
    fullPage: true,
  });
  await page.locator('.snapshot-options > summary').click();
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
  await page.goto('http://localhost:4423/');
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).map((database) => database.name),
    ),
  ).not.toContain('mutuallens-local-snapshots');
  await page.goto('/');
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('independent: static GitHub project base assets, refresh and 404', async ({
  page,
  request,
}, info) => {
  const origin = 'http://localhost:4425';
  const failed: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto(`${origin}/mutuallens/`);
  await expect(page.locator('body')).not.toContainText(obsolete);
  await expect(page.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://arhaan2.github.io/mutuallens/',
  );
  await expect(
    page.getByRole('link', { name: /Visit MutualLens/ }),
  ).toHaveAttribute('href', 'https://mutuallens-ddm.pages.dev/');
  expect(await page.locator('script, iframe, form').count()).toBe(0);
  await page.reload();
  expect(failed).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('project-mobile.png'),
    fullPage: true,
  });
  const missing = await page.goto(`${origin}/mutuallens/missing-review-path/`);
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Return to MutualLens' }).click();
  await expect(page).toHaveURL(`${origin}/mutuallens/`);
  expect(
    await (await request.get(`${origin}/mutuallens/sitemap.xml`)).text(),
  ).not.toContain('<loc>');
});
