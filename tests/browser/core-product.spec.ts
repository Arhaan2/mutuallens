import { test, expect, type Download } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';

const record = (name: string) => ({
  title: name,
  string_list_data: [
    {
      value: `@${name.toUpperCase()}`,
      href: `https://www.instagram.com/${name}/`,
      timestamp: 1700000000,
      harmless_extra: { text: 'ignored optional metadata' },
    },
  ],
  unknown_extra: true,
});
const followers = (names: string[]) => JSON.stringify(names.map(record));
const following = (names: string[]) =>
  JSON.stringify({
    relationships_following: names.map(record),
    harmless_metadata: {},
  });
const file = (name: string, text: string, mimeType = 'application/json') => ({
  name,
  mimeType,
  buffer: Buffer.from(text),
});
const standard = () => [
  file('followers_1.json', followers(['visual_alpha', 'visual_mutual'])),
  file('following.json', following(['visual_beta', 'visual_mutual'])),
];
const html = (names: string[], title: string) =>
  `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${names.map((name) => `<div class="_a6-g"><div class="_a6-p"><a target="_blank" href="https://www.instagram.com/${name}/">${name}</a><div>Nov 14, 2023 10:00 am</div></div></div>`).join('')}</body></html>`;
async function textDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('ordinary upload immediately shows non-followers without identity, date or confirmation; exports reopen', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#import');
  await expect(page.locator('#import input[required]')).toHaveCount(0);
  await expect(page.locator('#import input[type=checkbox]')).toHaveCount(0);
  await page.locator('#import-files').setInputFiles(standard());
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#results-title')).toHaveText(
    'Your uploaded files',
  );
  await expect(page.locator('.category.active')).toContainText(
    'Not following you back',
  );
  await expect(page.locator('.account-list')).toContainText('@visual_beta');
  await expect(page.locator('.result-scope')).toContainText(
    'Based on your uploaded files.',
  );
  await expect(page.locator('.import-summary')).toContainText(
    '2 relevant files',
  );
  const csvEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered CSV' }).click();
  const csv = await textDownload(await csvEvent);
  expect(csv).toContain('visual_beta');
  expect(csv).toContain('Based on your uploaded files');
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const json = await textDownload(await jsonEvent);
  expect(JSON.parse(json).comparisonBasis).toBe('supplied_files');
  expect(JSON.parse(json).followers.metadata.terminal).toBe(false);
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await page
    .locator('#import-files')
    .setInputFiles(file('mutuallens-dataset.json', json));
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.account-list')).toContainText('@visual_beta');
  expect(errors).toEqual([]);
});

test('known missing follower parts qualify usable negatives, export limitations, and preserve report on failed replacement', async ({
  page,
}) => {
  await page.goto('/#import');
  await page
    .locator('#import-files')
    .setInputFiles([
      file('followers_1.json', followers(['visual_alpha'])),
      file('followers_3.json', followers(['visual_mutual'])),
      file('following.json', following(['visual_beta', 'visual_mutual'])),
    ]);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.category.active')).toContainText(
    'Not found in supplied followers',
  );
  await expect(page.locator('.account-list')).toContainText('@visual_beta');
  await expect(page.locator('.upload-limitation')).toContainText(
    'Some supplied data could not be included',
  );
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered CSV' }).click();
  expect(await textDownload(await event)).toMatch(
    /Missing|missing|numbered|part/,
  );
  await page
    .getByRole('link', { name: 'Import local files', exact: true })
    .click();
  await page
    .locator('#import-files')
    .setInputFiles(file('following.json', following(['different_fixture'])));
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    /Missing followers|followers.*missing/i,
  );
  await expect(page.locator('.account-list')).toContainText('@visual_beta');
});

test('JSON, inert HTML and nested ZIP relationship data give equivalent results without external loads', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://localhost:5173')
      external.push(request.url());
  });
  const followerHtml = html(
    ['visual_alpha', 'visual_mutual'],
    'Followers',
  ).replace(
    '</body>',
    '<script>window.uploadExecuted=true;fetch("https://example.invalid/upload")</script><img src="https://example.invalid/avatar"></body>',
  );
  const followingHtml = html(['visual_beta', 'visual_mutual'], 'Following');
  const zipped = zipSync({
    'nested/connections/followers_and_following/followers_1.html':
      strToU8(followerHtml),
    'nested/connections/followers_and_following/following.html':
      strToU8(followingHtml),
    'photos/irrelevant.txt': strToU8('not relationship data'),
  });
  for (const input of [
    standard(),
    [
      file('followers_1.html', followerHtml, 'text/html'),
      file('following.html', followingHtml, 'text/html'),
    ],
    [
      {
        name: 'download.zip',
        mimeType: 'application/zip',
        buffer: Buffer.from(zipped),
      },
    ],
  ]) {
    await page.goto('/#import');
    if (!(await page.locator('#import-files').isVisible()))
      await page.locator('details#import > summary').click();
    await page.locator('#import-files').setInputFiles(input);
    await page.getByRole('button', { name: /Compare local files/ }).click();
    // A retained report can have identical counts: wait for this replacement to finish.
    await expect(
      page.locator('.import-form button[type=submit]'),
    ).toBeEnabled();
    await expect(page.locator('#import [role=alert]')).toHaveCount(0);
    await expect(page.locator('details#import')).not.toHaveAttribute(
      'open',
      '',
    );
    await expect(page.locator('.category.active')).toContainText(
      'Not following you back',
    );
    await expect(page.locator('.account-list')).toContainText('@visual_beta');
    await expect(page.locator('.category-controls')).toContainText('Mutuals');
  }
  expect(external).toEqual([]);
  expect(await page.evaluate(() => 'uploadExecuted' in window)).toBe(false);
});

test('ambiguous loose relationship files offer explicit direction assignment and retry', async ({
  page,
}) => {
  await page.goto('/#import');
  await page
    .locator('#import-files')
    .setInputFiles([
      file('first.json', followers(['visual_alpha', 'visual_mutual'])),
      file('second.json', followers(['visual_beta', 'visual_mutual'])),
    ]);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.file-assignments select')).toHaveCount(2);
  await page
    .locator('.file-assignments select')
    .nth(0)
    .selectOption('followers');
  await page
    .locator('.file-assignments select')
    .nth(1)
    .selectOption('following');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.account-list')).toContainText('@visual_beta');
});

test('unknown account labels remain optional for saving but do not imply matching historical identity', async ({
  page,
}) => {
  await page.goto('/#import');
  await page.locator('#import-files').setInputFiles(standard());
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await page.locator('.snapshot-options summary').click();
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.getByRole('status')).toContainText('Snapshot saved');
  await page.reload();
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('.snapshot-list')).toContainText(
    'Unlabeled uploaded files',
  );
});

test('uploaded target scale exposes all non-followers through search, pagination and full CSV', async ({
  page,
}) => {
  const names = (start: number) =>
    Array.from(
      { length: 6000 },
      (_, index) => `fixture_${String(start + index + 1).padStart(5, '0')}`,
    );
  await page.goto('/#import');
  await page
    .locator('#import-files')
    .setInputFiles([
      file('followers_1.json', followers(names(0))),
      file('following.json', following(names(1500))),
    ]);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.category.active')).toContainText('1,500');
  await expect(
    page.getByRole('button', { name: /Mutuals 4,500/ }),
  ).toBeVisible();
  await expect(page.locator('.account-list li')).toHaveCount(50);
  await page
    .getByRole('navigation', { name: 'Result pages', exact: true })
    .getByRole('button', { name: 'Last', exact: true })
    .click();
  await expect(page.locator('.account-list')).toContainText('@fixture_07500');
  await page.getByRole('searchbox').fill('@FIXTURE_07500');
  await expect(page.locator('.account-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered CSV' }).click();
  const csv = await textDownload(await event);
  expect(csv.trim().split('\r\n')).toHaveLength(1501);
  expect(csv).toContain('fixture_06001');
  expect(csv).toContain('fixture_07500');
  expect(csv).toContain('Based on your uploaded files');
});

// Explicitly mocked HTTP UI regressions. These do not establish real provider acquisition.
async function mockedAutomatic(
  page: import('@playwright/test').Page,
  failFirstStart = false,
) {
  const id = 'synthetic-job-0001';
  const creates: string[] = [];
  let done = false;
  const rows = (names: string[]) =>
    names.map((username) => ({
      username,
      originalUsername: username,
      source: 'mocked UI fixture',
    }));
  const sourceRows = {
    followers: rows(['visual_alpha', 'visual_mutual']),
    following: rows(['visual_beta', 'visual_mutual']),
  };
  const metadata = {
    source: 'mocked UI fixture',
    version: '1',
    startedAt: '2026-08-01T00:00:00.000Z',
    endedAt: '2026-08-01T00:00:01.000Z',
    rawCount: 2,
    uniqueCount: 2,
    completeness: 'complete_for_source',
    terminal: true,
    pages: 1,
    warnings: ['Mocked test only; not real acquisition evidence.'],
  };
  const dataset = {
    schemaVersion: 1,
    account: { username: 'synthetic_provider_target' },
    sample: false,
    comparisonBasis: 'source_evidence',
    importedAt: '2026-08-01T00:00:02.000Z',
    followers: { records: [], metadata },
    following: { records: [], metadata },
  };
  const progress = () => ({
    id,
    status: done ? 'complete' : 'queued',
    message: 'Mocked UI test state.',
    nextPollMs: 1,
    expiresAt: '2099-01-01T00:00:00.000Z',
    followers: { observed: done ? 2 : 0, pages: done ? 1 : 0, complete: done },
    following: { observed: done ? 2 : 0, pages: done ? 1 : 0, complete: done },
  });
  await page.route('**/api/capabilities', (route) =>
    route.fulfill({
      json: {
        release: 'preview',
        automatic: {
          enabled: true,
          status: 'available',
          reason: 'Mocked capability for UI regression only.',
        },
        ads: false,
      },
    }),
  );
  await page.route('**/api/session', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/scans', async (route) => {
    creates.push(route.request().postDataJSON().idempotencyKey);
    if (failFirstStart && creates.length === 1) return route.abort('failed');
    await route.fulfill({ status: 202, json: progress() });
  });
  await page.route(`**/api/scans/${id}/status`, (route) =>
    route.fulfill({ json: progress() }),
  );
  await page.route(`**/api/scans/${id}/advance`, (route) => {
    done = true;
    return route.fulfill({ json: progress() });
  });
  await page.route(`**/api/scans/${id}/result?**`, (route) => {
    const url = new URL(route.request().url());
    const direction = url.searchParams.get('direction') as
      'followers' | 'following';
    const offset = Number(url.searchParams.get('offset'));
    return route.fulfill({
      json: {
        dataset,
        records: sourceRows[direction].slice(offset, offset + 1),
        nextOffset: offset === 0 ? 1 : null,
      },
    });
  });
  return { id, creates };
}

test('mocked automatic UI assembles both paginated directions and preserves source-evidence labels', async ({
  page,
}) => {
  await mockedAutomatic(page);
  await page.goto('/#automatic');
  await page.locator('#automatic-username').fill('synthetic_provider_target');
  await page
    .getByRole('button', { name: 'Check automatically', exact: true })
    .click();
  await expect(page.locator('#results-title')).toHaveText(
    '@synthetic_provider_target',
  );
  await expect(page.locator('.results')).toContainText(
    'AUTOMATIC SOURCE REPORT',
  );
  await expect(page.locator('.account-list')).toContainText('@visual_beta');
  await expect(page.locator('.result-scope')).not.toContainText('uploaded');
});

test('mocked uncertain automatic creation retries the same idempotency key', async ({
  page,
}) => {
  const mock = await mockedAutomatic(page, true);
  await page.goto('/#automatic');
  await page.locator('#automatic-username').fill('synthetic_provider_target');
  await page
    .getByRole('button', { name: 'Check automatically', exact: true })
    .click();
  await expect(page.locator('.automatic-job [role=alert]')).toBeVisible();
  await page
    .getByRole('button', { name: 'Retry same start', exact: true })
    .click();
  await expect(page.locator('#results-title')).toHaveText(
    '@synthetic_provider_target',
  );
  expect(mock.creates).toHaveLength(2);
  expect(mock.creates[0]).toBe(mock.creates[1]);
});

test('mocked automatic reset cancels its job and cannot overwrite a later local upload', async ({
  page,
}) => {
  const mock = await mockedAutomatic(page);
  let advancing = false,
    release: (() => void) | undefined,
    cancellations = 0;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/scans/${mock.id}/advance`, async (route) => {
    advancing = true;
    await pending;
    await route.abort().catch(() => {});
  });
  await page.route(`**/api/scans/${mock.id}`, (route) => {
    if (route.request().method() === 'DELETE') cancellations++;
    return route.fulfill({
      json: {
        id: mock.id,
        status: 'cancelled',
        message: 'Mock cancellation.',
        nextPollMs: 0,
        expiresAt: '2099-01-01T00:00:00Z',
        followers: { observed: 0, pages: 0, complete: false },
        following: { observed: 0, pages: 0, complete: false },
      },
    });
  });
  await page.goto('/#automatic');
  await page.locator('#automatic-username').fill('synthetic_provider_target');
  await page
    .getByRole('button', { name: 'Check automatically', exact: true })
    .click();
  await expect.poll(() => advancing).toBe(true);
  await page
    .getByRole('link', { name: 'Import your Instagram export', exact: true })
    .click();
  await expect.poll(() => cancellations).toBeGreaterThan(0);
  release!();
  await page.locator('#import-files').setInputFiles(standard());
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#results-title')).toHaveText(
    'Your uploaded files',
  );
  await expect(page.locator('.account-list')).toContainText('@visual_beta');
  await expect(page.locator('.results')).toContainText('UPLOADED FILES REPORT');
});
