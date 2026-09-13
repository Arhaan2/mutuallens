import { openImportDetails, openSnapshotOptions } from '../browser/product-ui';
import { test, expect, type Page, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';

const SITE =
  process.env.MUTUALLENS_HOSTED_SITE_ORIGIN ??
  'https://codex-ui-functional-repair.mutuallens-ddm.pages.dev';
const CHECKER =
  process.env.MUTUALLENS_HOSTED_CHECKER_ORIGIN ??
  'https://codex-ui-functional-repair.mutuallens-app.pages.dev';
const allowed = new Set([new URL(SITE).origin, new URL(CHECKER).origin]);
const row = (value: string) => ({ string_list_data: [{ value }] });
const following = (names: string[]) => ({
  relationships_following: names.map(row),
});
const jsonFile = (name: string, value: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(value)),
});
const pair = (followers: string[], followed: string[]) => [
  jsonFile('followers.json', followers.map(row)),
  jsonFile('following.json', following(followed)),
];
async function openImport(page: Page) {
  await openImportDetails(page);
}
async function importPair(
  page: Page,
  followers: string[],
  followed: string[],
  date = '2025-01-01T12:00',
) {
  await openImport(page);
  await page.locator('#import-account').fill('synthetic_hosted');
  await page.locator('#import-files').setInputFiles(pair(followers, followed));
  await page.locator('#collected-at').fill(date);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.import-form button[type=submit]')).toBeEnabled();
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_hosted',
  );
}
async function textDownload(download: Download) {
  const p = await download.path();
  expect(p).not.toBeNull();
  return readFile(p!, 'utf8');
}
async function download(page: Page, name: string) {
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return wait;
}
function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
const observed = new WeakMap<
  Page,
  {
    errors: string[];
    requests: { method: string; url: string; type: string }[];
    httpFailures: { status: number; url: string }[];
  }
>();
test.beforeEach(async ({ page }) => {
  const state = {
    errors: [] as string[],
    requests: [] as { method: string; url: string; type: string }[],
    httpFailures: [] as { status: number; url: string }[],
  };
  observed.set(page, state);
  page.on('pageerror', (e) => state.errors.push(`uncaught: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') state.errors.push(`console: ${m.text()}`);
  });
  page.on('requestfailed', (r) =>
    state.errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`),
  );
  page.on('request', (r) =>
    state.requests.push({
      method: r.method(),
      url: r.url(),
      type: r.resourceType(),
    }),
  );
  page.on('response', (r) => {
    if (r.status() >= 400)
      state.httpFailures.push({ status: r.status(), url: r.url() });
  });
});
test.afterEach(async ({ page, browser, browserName }, info) => {
  const state = observed.get(page)!;
  await info.attach('hosted-browser-evidence', {
    body: JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        browser: browserName,
        version: browser.version(),
        viewport: page.viewportSize(),
        url: page.url(),
        synthetic: true,
        ...state,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(state.errors).toEqual([]);
  expect(state.httpFailures).toEqual([]);
  expect(
    state.requests.filter((r) => !allowed.has(new URL(r.url).origin)),
  ).toEqual([]);
  expect(
    state.requests.filter((r) => !['GET', 'HEAD'].includes(r.method)),
  ).toEqual([]);
});

test('hosted: homepage sample entry, metadata, exact synthetic counts and parsed full exports', async ({
  page,
  request,
}) => {
  const response = await page.goto(SITE);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    `${SITE}/`,
  );
  await expect(page.locator('.sample-link')).toHaveAttribute(
    'href',
    `${CHECKER}/#sample`,
  );
  await page.waitForLoadState('networkidle');
  await page.locator('.sample-link').click();
  await expect(page).toHaveURL(`${CHECKER}/#sample`);
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_example',
  );
  const capability = await request.get(`${CHECKER}/api/capabilities`);
  expect(capability.status()).toBe(200);
  expect(await capability.json()).toMatchObject({
    release: 'preview',
    automatic: { enabled: false, status: 'blocked' },
    ads: false,
  });
  for (const name of [
    'Not following you back 1,500',
    'Mutuals 4,500',
    'You don’t follow back 1,500',
    'All followers 6,000',
    'All following 6,000',
  ])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(page.locator('.account-list>li')).toHaveCount(50);
  expect(
    await page.locator('.account-list a[href*="instagram.com"]').count(),
  ).toBe(0);
  const csv = parseCsv(
    await textDownload(await download(page, 'Export filtered CSV')),
  );
  expect(csv).toHaveLength(1501);
  expect(csv.slice(1).every((r) => r[4] === 'synthetic fixture')).toBe(true);
  expect(csv.at(-1)?.[0]).toBe('user07500');
  const dataset = JSON.parse(
    await textDownload(await download(page, 'Export JSON')),
  );
  expect(dataset.sample).toBe(true);
  expect(dataset.followers.records).toHaveLength(6000);
  expect(dataset.following.records).toHaveLength(6000);
  const followers = new Set<string>(
    dataset.followers.records.map((r: { username: string }) => r.username),
  );
  expect(
    dataset.following.records.filter((r: { username: string }) =>
      followers.has(r.username),
    ),
  ).toHaveLength(4500);
  await page.reload();
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_example',
  );
});

test('hosted: ZIP split parts deduplicate, export exact records, and missing parts qualify negatives', async ({
  page,
}) => {
  await page.goto(`${CHECKER}/#import`);
  await openImportDetails(page);
  await page.locator('#import-account').fill('synthetic_hosted');
  const zip = zipSync({
    'connections/followers_1.json': strToU8(
      JSON.stringify(['synthetic_mutual', 'synthetic_fan'].map(row)),
    ),
    'connections/followers_2.json': strToU8(
      JSON.stringify(['synthetic_fan', 'synthetic_extra'].map(row)),
    ),
    'connections/following.json': strToU8(
      JSON.stringify(following(['synthetic_mutual', 'synthetic_followed'])),
    ),
  });
  await page.locator('#import-files').setInputFiles({
    name: 'synthetic-hosted-split.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zip),
  });
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_hosted',
  );
  await expect(
    page.getByRole('button', { name: 'All followers 3', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Not following you back 1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'You don’t follow back 2', exact: true }),
  ).toBeVisible();
  const dataset = JSON.parse(
    await textDownload(await download(page, 'Export JSON')),
  );
  expect(dataset.sample).toBe(false);
  expect(dataset.followers.metadata.rawCount).toBe(4);
  expect(
    dataset.followers.records
      .map((r: { username: string }) => r.username)
      .sort(),
  ).toEqual(['synthetic_extra', 'synthetic_fan', 'synthetic_mutual']);
  await openImport(page);
  await page
    .locator('#import-files')
    .setInputFiles([
      jsonFile('followers_1.json', ['synthetic_mutual'].map(row)),
      jsonFile('followers_3.json', ['synthetic_fan'].map(row)),
      jsonFile(
        'following.json',
        following(['synthetic_mutual', 'synthetic_followed']),
      ),
    ]);
  await expect(page.locator('#import input[type=checkbox]')).toHaveCount(0);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.import-form button[type=submit]')).toBeEnabled();
  await expect(page.locator('.category.active')).toHaveAccessibleName(
    'Not found in supplied followers 1',
  );
  await expect(page.locator('.account-list')).toContainText(
    '@synthetic_followed',
  );
  await expect(page.locator('.upload-limitation')).toBeVisible();
  const qualifiedCsv = await textDownload(
    await download(page, 'Export filtered CSV'),
  );
  expect(qualifiedCsv).toContain('Not found in supplied followers');
  expect(qualifiedCsv).toMatch(/missing|part/i);
});

test('hosted: explicit snapshots persist, all65 differences browse, export is complete, deletion is confirmed', async ({
  page,
  context,
}) => {
  await page.goto(CHECKER);
  await importPair(page, ['synthetic_mutual'], ['synthetic_mutual']);
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
  await openSnapshotOptions(page);
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
  const added = Array.from(
    { length: 65 },
    (_, i) => `synthetic_diff${String(i).padStart(3, '0')}`,
  );
  await importPair(
    page,
    ['synthetic_mutual', ...added],
    ['synthetic_mutual'],
    '2025-02-01T12:00',
  );
  await openSnapshotOptions(page);
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#results-title')).toHaveCount(0);
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(2);
  await page.getByLabel('Earlier snapshot').selectOption({ index: 2 });
  await page.getByLabel('Later snapshot').selectOption({ index: 1 });
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  const group = page.locator('.history-result details').first();
  await expect(group).toBeVisible();
  await group.locator('summary').click();
  await expect(group.locator('li')).toHaveCount(50);
  await group.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(group.locator('li')).toHaveCount(15);
  await expect(group).toContainText('@synthetic_diff064');
  const pending = page.waitForEvent('download');
  await group
    .getByRole('button', { name: 'Export full difference CSV' })
    .click();
  const rows = parseCsv(await textDownload(await pending));
  expect(rows.slice(1).map((r) => r[0])).toEqual(added);
  const publicPage = await context.newPage();
  await publicPage.goto(SITE);
  expect(
    await publicPage.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
  await publicPage.close();
  await page
    .getByRole('button', { name: 'Delete all local snapshots' })
    .click();
  await page.getByRole('button', { name: 'Keep snapshots' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Delete all local snapshots' })
    .click();
  await page
    .getByRole('button', { name: 'Confirm delete all snapshots' })
    .click();
  await expect(page.locator('.snapshot-row')).toHaveCount(0);
});

test('hosted: direct 6k by 6k upload needs no metadata and fully browses, exports, reopens and matches HTML', async ({
  page,
}) => {
  const name = (number: number) =>
    `hosted_fixture_${String(number).padStart(5, '0')}`;
  const followers = Array.from({ length: 6000 }, (_, index) => name(index + 1));
  const followingNames = Array.from({ length: 6000 }, (_, index) =>
    name(index + 1501),
  );
  await page.goto(`${CHECKER}/#import`);
  await expect(page.locator('#import input[required]')).toHaveCount(0);
  await expect(page.locator('#import input[type=checkbox]')).toHaveCount(0);
  await expect(page.locator('#import-account')).toHaveValue('');
  await expect(page.locator('#collected-at')).toHaveValue('');
  await page
    .locator('#import-files')
    .setInputFiles(pair(followers, followingNames));
  await page.getByRole('button', { name: /Compare local files/ }).click();
  const assertCounts = async () => {
    await expect(page.locator('#results-title')).toHaveText(
      'Your uploaded files',
    );
    await expect(page.locator('.category.active')).toHaveAccessibleName(
      'Not following you back 1,500',
    );
    await expect(
      page.getByRole('button', { name: 'Mutuals 4,500', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'All followers 6,000', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'All following 6,000', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.account-list > li')).toHaveCount(50);
    await expect(page.locator('.result-scope')).toContainText(
      'Based on your uploaded files',
    );
  };
  await assertCounts();
  const profile = page.locator('.account-list a').first();
  await expect(profile).toHaveAttribute(
    'href',
    `https://www.instagram.com/${name(6001)}/`,
  );
  await expect(profile).toHaveAttribute('target', '_blank');
  await expect(profile).toHaveAttribute('rel', 'noopener noreferrer');
  await page
    .getByRole('navigation', { name: 'Result pages', exact: true })
    .getByRole('button', { name: 'Last', exact: true })
    .click();
  await expect(page.locator('.account-list')).toContainText(`@${name(7500)}`);
  await page.getByRole('searchbox').fill(`@${name(7500).toUpperCase()}`);
  await expect(page.locator('.account-list > li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  const csv = parseCsv(
    await textDownload(await download(page, 'Export filtered CSV')),
  );
  expect(csv).toHaveLength(1501);
  expect(csv.slice(1).map((record) => record[0])).toEqual(
    followingNames.slice(4500),
  );
  expect(
    csv
      .slice(1)
      .every((record) => record[5]?.includes('Based on your uploaded files')),
  ).toBe(true);
  const nativeText = await textDownload(await download(page, 'Export JSON'));
  const native = JSON.parse(nativeText);
  expect(native.comparisonBasis).toBe('supplied_files');
  expect(native.account.username).toBe('');
  expect(native.followers.metadata.terminal).toBe(false);
  expect(native.exportScope).toContain('Based on your uploaded files');
  expect(native.followers.records).toHaveLength(6000);
  expect(native.following.records).toHaveLength(6000);
  const relationshipHtml = (names: string[], direction: string) =>
    `<!doctype html><html><head><title>${direction}</title></head><body><h1>${direction}</h1>${names.map((username) => `<div class="_a6-g"><div class="_a6-p"><a href="https://www.instagram.com/${username}/">${username}</a></div></div>`).join('')}</body></html>`;
  const html = (filename: string, names: string[], direction: string) => ({
    name: filename,
    mimeType: 'text/html',
    buffer: Buffer.from(relationshipHtml(names, direction)),
  });
  for (const inputs of [
    [
      {
        name: 'mutuallens-dataset.json',
        mimeType: 'application/json',
        buffer: Buffer.from(nativeText),
      },
    ],
    [
      html('followers_1.html', followers, 'Followers'),
      html('following.html', followingNames, 'Following'),
    ],
  ]) {
    await page.getByRole('button', { name: 'Start over', exact: true }).click();
    await expect(page.locator('#import-account')).toHaveValue('');
    await expect(page.locator('#collected-at')).toHaveValue('');
    await page.locator('#import-files').setInputFiles(inputs);
    await page.getByRole('button', { name: /Compare local files/ }).click();
    await assertCounts();
    const equivalent = parseCsv(
      await textDownload(await download(page, 'Export filtered CSV')),
    );
    expect(equivalent.slice(1).map((record) => record[0])).toEqual(
      followingNames.slice(4500),
    );
  }
});
