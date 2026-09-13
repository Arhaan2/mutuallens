import { openImportDetails, openSnapshotOptions } from './product-ui';
import { test, expect, type Page, type Download } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { expectedDevelopmentAbort } from './browser-events';
import { readFile } from 'node:fs/promises';

const SITE = 'http://localhost:4321';
const CHECKER = 'http://localhost:5173';
const follower = (username: string) => ({
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
const followerText = (names: string[]) => JSON.stringify(names.map(follower));
const followingText = (names: string[]) =>
  JSON.stringify({ relationships_following: names.map(follower) });
const jsonFile = (name: string, text: string) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(text),
});
const pair = (followers: string[], following: string[]) => [
  jsonFile('followers.json', followerText(followers)),
  jsonFile('following.json', followingText(following)),
];

async function openImport(page: Page) {
  await openImportDetails(page);
}
async function importLists(
  page: Page,
  followers: string[],
  following: string[],
  options: { owner?: string; sourceDate?: string } = {},
) {
  await openImport(page);
  await page
    .locator('#import-account')
    .fill(options.owner ?? 'synthetic_owner');
  await page.locator('#import-files').setInputFiles(pair(followers, following));
  await page
    .locator('#collected-at')
    .fill(options.sourceDate ?? '2025-01-01T12:00');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#results-title')).toContainText(
    options.owner ?? 'synthetic_owner',
  );
  await expect(page.locator('.import-form button[type=submit]')).toBeEnabled();
}
async function save(page: Page) {
  const before = await page.locator('.snapshot-row').count();
  await openSnapshotOptions(page);
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(before + 1);
}
async function downloadedText(download: Download) {
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!, 'utf8');
}
async function downloadButton(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return pending;
}
// Parse actual CSV cells, including doubled quotes and quoted newlines.
function parseCsv(input: string): string[][] {
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

// Normal journeys only: no intercepted routes, fake workers or storage mocks.
// Fault injection belongs in a separate suite and is explicitly labeled there.
test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`exception: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    if (expectedDevelopmentAbort(request)) return;
    if (request.url().startsWith(CHECKER) || request.url().startsWith(SITE))
      failures.push(
        `failed request: ${request.method()} ${request.url()} ${request.failure()?.errorText}`,
      );
  });
  Object.assign(page, { __normalJourneyFailures: failures });
});
test.afterEach(async ({ page }, testInfo) => {
  const failures = (page as Page & { __normalJourneyFailures: string[] })
    .__normalJourneyFailures;
  if (failures.length)
    await testInfo.attach('normal-journey-browser-errors', {
      body: JSON.stringify(failures, null, 2),
      contentType: 'application/json',
    });
  expect(failures).toEqual([]);
});

test('repair: homepage sample entry is direct and survives reload and browser history', async ({
  page,
}) => {
  await page.goto(SITE);
  await page.locator('.sample-link').click();
  await expect(page).toHaveURL(`${CHECKER}/#sample`);
  await expect(page.locator('#results-title')).toBeVisible();
  await expect(page.locator('.results')).toContainText('SYNTHETIC SAMPLE');
  await page.reload();
  await expect(page.locator('#results-title')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(`${SITE}/`);
  await page.goForward();
  await expect(page).toHaveURL(`${CHECKER}/#sample`);
  await expect(page.locator('#results-title')).toBeVisible();
  await page.getByRole('button', { name: 'Explore synthetic sample' }).click();
  await expect(page.locator('#results-title')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Not following you back 1,500/ }),
  ).toBeVisible();
});

test('repair: missing import input has visible nearby feedback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${CHECKER}/#import`);
  await openImport(page);
  await page.locator('#import-account').fill('synthetic_owner');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  const alert = page
    .getByRole('alert')
    .filter({ hasText: 'Select your followers and following' });
  await expect(alert).toBeVisible();
  const box = await alert.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});

test('repair: all snapshot differences are browsable and full exports contain every record', async ({
  page,
}) => {
  await page.goto(CHECKER);
  const names = (prefix: string) =>
    Array.from(
      { length: 65 },
      (_, i) => `${prefix}${String(i).padStart(3, '0')}`,
    );
  await importLists(page, names('synthetic_oldf'), names('synthetic_oldg'));
  await save(page);
  await importLists(page, names('synthetic_newf'), names('synthetic_newg'), {
    sourceDate: '2025-02-01T12:00',
  });
  await save(page);
  await page.getByLabel('Earlier snapshot').selectOption({ index: 2 });
  await page.getByLabel('Later snapshot').selectOption({ index: 1 });
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await expect(page.locator('.history-result')).toBeVisible();
  for (const [index, prefix] of [
    'synthetic_newf',
    'synthetic_oldf',
    'synthetic_newg',
    'synthetic_oldg',
  ].entries()) {
    const group = page.locator('.history-result details').nth(index);
    await group.locator('summary').click();
    await expect(group.locator('summary')).toContainText('65');
    await expect(group).toContainText(`@${prefix}000`);
    await expect(group).not.toContainText(`@${prefix}064`);
    await group.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(group).toContainText(`@${prefix}064`);
    await expect(
      group.getByRole('button', { name: 'Next', exact: true }),
    ).toBeDisabled();
    const pending = page.waitForEvent('download');
    await group
      .getByRole('button', { name: 'Export full difference CSV' })
      .click();
    const rows = parseCsv(await downloadedText(await pending));
    expect(rows[0]).toEqual([
      'username',
      'original_username',
      'id',
      'display_name',
      'source',
      'comparison_scope',
      'limitations',
    ]);
    expect(rows.slice(1).map((row) => row[0])).toEqual(names(prefix));
    await group.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(group).toContainText(`@${prefix}000`);
    await expect(
      group.getByRole('button', { name: 'Previous', exact: true }),
    ).toBeDisabled();
    await group.locator('summary').click();
  }
});

test('repair: synthetic result categories search sorting paging and downloads contain complete data', async ({
  page,
}) => {
  await page.goto(`${CHECKER}/#sample`);
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_example',
  );
  const categories = [
    ['Not following you back', '1,500', 1500],
    ['Mutuals', '4,500', 4500],
    ['You don’t follow back', '1,500', 1500],
    ['All followers', '6,000', 6000],
    ['All following', '6,000', 6000],
  ] as const;
  for (const [label, formatted, count] of categories) {
    const category = page.getByRole('button', {
      name: `${label} ${formatted}`,
      exact: true,
    });
    await category.click();
    await expect(category).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.account-list > li')).toHaveCount(50);
    const rows = parseCsv(
      await downloadedText(await downloadButton(page, 'Export filtered CSV')),
    );
    expect(rows).toHaveLength(count + 1);
    expect(new Set(rows.slice(1).map((row) => row[0])).size).toBe(count);
    expect(rows.slice(1).every((row) => row[4] === 'synthetic fixture')).toBe(
      true,
    );
  }
  await page
    .getByRole('button', { name: 'Not following you back 1,500', exact: true })
    .click();
  const pages = page.getByRole('navigation', { name: 'Result pages' });
  await expect(
    pages.getByRole('button', { name: 'First', exact: true }),
  ).toBeDisabled();
  await pages.getByRole('button', { name: 'Last', exact: true }).click();
  await expect(pages).toContainText('Page 30 of 30');
  await expect(page.locator('#list-title')).toBeFocused();
  const firstVisible = await page
    .locator('.account-list > li')
    .first()
    .boundingBox();
  expect(firstVisible!.y).toBeGreaterThanOrEqual(0);
  expect(firstVisible!.y + firstVisible!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await expect(page.locator('.account-list')).toContainText('@user07500');
  await expect(
    pages.getByRole('button', { name: 'Next', exact: true }),
  ).toBeDisabled();
  const whole = parseCsv(
    await downloadedText(await downloadButton(page, 'Export filtered CSV')),
  );
  expect(whole).toHaveLength(1501);
  expect(whole[1]?.[0]).toBe('user06001');
  expect(whole.at(-1)?.[0]).toBe('user07500');
  await page.getByRole('searchbox').fill('  @USER07500  ');
  await expect(page.locator('.account-list > li')).toHaveCount(1);
  await expect(pages).toContainText('Page 1 of 1');
  const filtered = parseCsv(
    await downloadedText(await downloadButton(page, 'Export filtered CSV')),
  );
  expect(filtered).toHaveLength(2);
  expect(filtered[1]?.[0]).toBe('user07500');
  await page.getByRole('searchbox').fill('missing_synthetic_record');
  await expect(
    page.getByRole('heading', { name: 'No matching accounts' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page
    .getByRole('combobox', { name: 'Sort accounts' })
    .selectOption('descending');
  await expect(page.locator('.account-list > li').first()).toContainText(
    '@user07500',
  );
  await pages.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByRole('button', { name: 'Mutuals 4,500', exact: true })
    .click();
  await expect(pages).toContainText('Page 1 of 90');
  await page
    .getByRole('combobox', { name: 'Sort accounts' })
    .selectOption('ascending');
  await expect(page.locator('.account-list > li').first()).toContainText(
    '@user01501',
  );
  const download = await downloadButton(page, 'Export JSON');
  expect(download.suggestedFilename()).toContain('synthetic');
  const dataset = JSON.parse(await downloadedText(download));
  expect(dataset.sample).toBe(true);
  expect(dataset.followers.records).toHaveLength(6000);
  expect(dataset.following.records).toHaveLength(6000);
  expect(
    new Set(
      dataset.followers.records.map(
        (record: { username: string }) => record.username,
      ),
    ).size,
  ).toBe(6000);
  expect(dataset.followers.metadata.completeness).toBe('complete_for_source');
  expect(
    await page.locator('.account-list a[href*="instagram.com"]').count(),
  ).toBe(0);
});

test('repair: sample replacement requires explicit choice and clearing differs from starting over', async ({
  page,
}) => {
  await page.goto(`${CHECKER}/#import`);
  await importLists(
    page,
    ['synthetic_a', 'synthetic_mutual'],
    ['synthetic_b', 'synthetic_mutual'],
  );
  await save(page);
  await page.getByRole('button', { name: 'Explore synthetic sample' }).click();
  await expect(
    page.getByRole('button', {
      name: 'Replace report with sample',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
  await page
    .getByRole('button', { name: 'Keep current report', exact: true })
    .click();
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
  await expect(
    page.getByRole('button', {
      name: 'Replace report with sample',
      exact: true,
    }),
  ).toHaveCount(0);
  // A fragment navigation is a supported user entry, not a business-logic mock.
  await page.evaluate(() => {
    location.hash = 'sample';
  });
  await expect(
    page.getByRole('button', {
      name: 'Replace report with sample',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
  await page
    .getByRole('button', { name: 'Replace report with sample', exact: true })
    .click();
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_example',
  );
  await page.getByRole('button', { name: 'Clear report', exact: true }).click();
  await expect(page.locator('#results-title')).toHaveCount(0);
  await openImport(page);
  await expect(page.locator('#import-account')).toHaveValue('synthetic_owner');
  expect(
    await page
      .locator('#import-files')
      .evaluate((element: HTMLInputElement) => element.files?.length),
  ).toBe(2);
  await expect(page.locator('#import input[type=checkbox]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.locator('#results-title')).toHaveCount(0);
  await openImport(page);
  await expect(page.locator('#import-account')).toHaveValue('');
  await expect(page.locator('#collected-at')).toHaveValue('');
  await expect(page.locator('#import input[type=checkbox]')).toHaveCount(0);
  expect(
    await page
      .locator('#import-files')
      .evaluate((element: HTMLInputElement) => element.files?.length),
  ).toBe(0);
  const show = page.getByRole('button', { name: 'View saved snapshots' });
  if (await show.count()) await show.click();
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
});

test('repair: ZIP split parts deduplicate correctly and selecting same files again is supported', async ({
  page,
}) => {
  await page.goto(`${CHECKER}/#import`);
  await openImport(page);
  await page.locator('#import-account').fill('@SYNTHETIC_OWNER');
  const zip = zipSync({
    'connections/followers_1.json': strToU8(
      followerText(['synthetic_a', 'synthetic_mutual']),
    ),
    'connections/followers_2.json': strToU8(
      followerText(['synthetic_a', 'synthetic_c']),
    ),
    'connections/following.json': strToU8(
      followingText(['synthetic_b', 'synthetic_mutual']),
    ),
  });
  const input = {
    name: 'synthetic-split.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zip),
  };
  await page.locator('#import-files').setInputFiles(input);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
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
    await downloadedText(await downloadButton(page, 'Export JSON')),
  );
  expect(dataset.sample).toBe(false);
  expect(
    dataset.followers.records
      .map((record: { username: string }) => record.username)
      .sort(),
  ).toEqual(['synthetic_a', 'synthetic_c', 'synthetic_mutual']);
  expect(dataset.followers.metadata.rawCount).toBe(4);
  expect(dataset.followers.metadata.uniqueCount).toBe(3);
  await openImport(page);
  await page.locator('#import-files').setInputFiles([]);
  expect(
    await page
      .locator('#import-files')
      .evaluate((element: HTMLInputElement) => element.files?.length),
  ).toBe(0);
  await page.locator('#import-files').setInputFiles(input);
  await expect(page.locator('#import input[type=checkbox]')).toHaveCount(0);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.import-form button[type=submit]')).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'All followers 3', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Not following you back 1', exact: true })
    .click();
  await expect(page.locator('.account-list a')).toHaveAttribute(
    'href',
    'https://www.instagram.com/synthetic_b/',
  );
  await expect(page.locator('.account-list a')).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
});

test('repair: known missing parts qualify useful negatives; missing malformed and unsupported data fail clearly', async ({
  page,
}) => {
  await page.goto(`${CHECKER}/#import`);
  await openImport(page);
  await page.locator('#import-account').fill('synthetic_owner');
  await page
    .locator('#import-files')
    .setInputFiles([
      jsonFile('followers_1.json', followerText(['synthetic_a'])),
      jsonFile('followers_3.json', followerText(['synthetic_mutual'])),
      jsonFile(
        'following.json',
        followingText(['synthetic_b', 'synthetic_mutual']),
      ),
    ]);
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.category.active')).toHaveAccessibleName(
    'Not found in supplied followers 1',
  );
  await expect(page.locator('.account-list')).toContainText('@synthetic_b');
  await expect(page.locator('.upload-limitation')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Export filtered CSV' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mutuals 1', exact: true }).click();
  await expect(page.locator('.account-list')).toContainText(
    '@synthetic_mutual',
  );
  for (const scenario of [
    {
      files: [jsonFile('following.json', followingText(['synthetic_b']))],
      expected: 'Missing followers',
    },
    {
      files: [
        jsonFile('followers.json', '{bad'),
        jsonFile('following.json', '{}'),
      ],
      expected: 'not valid JSON',
    },
    {
      files: [jsonFile('followers.html', '<html>unsupported</html>')],
      expected:
        /recognized relationship|unsupported|relationship.*HTML|HTML.*relationship/i,
    },
  ]) {
    await openImport(page);
    await page.locator('#import-files').setInputFiles(scenario.files);
    await page.getByRole('button', { name: /Compare local files/ }).click();
    await expect(page.getByRole('alert')).toContainText(scenario.expected);
    await expect(page.locator('#results-title')).toContainText(
      'synthetic_owner',
    );
  }
  await openImport(page);
  await page.locator('#import-files').setInputFiles(pair([], []));
  await page.locator('#import-account').fill('invalid account !');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.getByRole('alert')).toContainText('Usernames must contain');
  await page.locator('#import-account').fill('synthetic_owner');
  await page.locator('#collected-at').fill('2099-01-01T12:00');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'cannot be in the future',
  );
  await importLists(page, [], []);
  await expect(
    page.getByRole('heading', { name: 'No accounts in this category' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'All followers 0', exact: true }),
  ).toBeVisible();
});

for (const scenario of [
  {
    name: 'all mutual',
    followers: ['synthetic_a', 'synthetic_b'],
    following: ['synthetic_a', 'synthetic_b'],
    mutuals: 2,
    notBack: 0,
    notByYou: 0,
  },
  {
    name: 'no mutual',
    followers: ['synthetic_a'],
    following: ['synthetic_b'],
    mutuals: 0,
    notBack: 1,
    notByYou: 1,
  },
  {
    name: 'asymmetric empty following',
    followers: ['synthetic_a', 'synthetic_b', 'synthetic_c'],
    following: [],
    mutuals: 0,
    notBack: 0,
    notByYou: 3,
  },
]) {
  test(`repair: exact category counts for ${scenario.name}`, async ({
    page,
  }) => {
    await page.goto(`${CHECKER}/#import`);
    await importLists(page, scenario.followers, scenario.following);
    for (const [label, count] of [
      ['Mutuals', scenario.mutuals],
      ['Not following you back', scenario.notBack],
      ['You don’t follow back', scenario.notByYou],
      ['All followers', scenario.followers.length],
      ['All following', scenario.following.length],
    ] as const) {
      await expect(
        page.getByRole('button', { name: `${label} ${count}`, exact: true }),
      ).toBeVisible();
    }
  });
}

test('repair: snapshots persist only after saving; invalid comparisons are rejected and deletion is confirmed', async ({
  page,
}) => {
  await page.goto(CHECKER);
  await importLists(page, ['synthetic_old'], ['synthetic_mutual']);
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
  await save(page);
  await importLists(page, ['synthetic_new'], ['synthetic_mutual'], {
    sourceDate: '2025-02-01T12:00',
  });
  await save(page);
  const before = page.getByLabel('Earlier snapshot');
  const after = page.getByLabel('Later snapshot');
  const earlyId = await before.locator('option').nth(2).getAttribute('value');
  const lateId = await before.locator('option').nth(1).getAttribute('value');
  await before.selectOption(earlyId!);
  await after.selectOption(earlyId!);
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'two different snapshots',
  );
  await before.selectOption(lateId!);
  await after.selectOption(earlyId!);
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('strictly ordered');
  await importLists(page, ['synthetic_unknown'], ['synthetic_mutual'], {
    sourceDate: '',
  });
  await save(page);
  const unknownId = await before.locator('option').nth(1).getAttribute('value');
  await before.selectOption(earlyId!);
  await after.selectOption(unknownId!);
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('dates are unknown');
  await expect(page.locator('.history-result')).toHaveCount(0);
  await importLists(page, ['synthetic_other'], ['synthetic_mutual'], {
    owner: 'synthetic_other_owner',
    sourceDate: '2025-03-01T12:00',
  });
  await save(page);
  const otherId = await before.locator('option').nth(1).getAttribute('value');
  await before.selectOption(earlyId!);
  await after.selectOption(otherId!);
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('same account');
  await page.reload();
  await expect(page.locator('#results-title')).toHaveCount(0);
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(4);
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export snapshot', exact: true })
    .first()
    .click();
  const snapshot = JSON.parse(await downloadedText(await pending));
  expect(snapshot.schemaVersion).toBe(1);
  expect(snapshot.dataset.account.username).toBe('synthetic_other_owner');
  expect(snapshot.dataset.followers.records[0].username).toBe(
    'synthetic_other',
  );
  await page
    .getByRole('button', { name: 'Delete all local snapshots' })
    .click();
  await page.getByRole('button', { name: 'Keep snapshots' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(4);
  await page
    .getByRole('button', { name: 'Delete all local snapshots' })
    .click();
  await page
    .getByRole('button', { name: 'Confirm delete all snapshots' })
    .click();
  await expect(page.locator('.snapshot-row')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('.snapshot-list')).toContainText(
    'No snapshots saved',
  );
});

test('repair: 50,000 per-direction local import preserves full searchable and exported data', async ({
  page,
  browser,
  browserName,
}, testInfo) => {
  await page.goto(`${CHECKER}/#import`);
  const name = (i: number) => `synthetic_large${String(i).padStart(5, '0')}`;
  const followers = Array.from({ length: 50000 }, (_, i) => name(i));
  const following = Array.from({ length: 50000 }, (_, i) => name(i + 1500));
  const started = performance.now();
  await importLists(page, followers, following);
  const importRoundTripMs = performance.now() - started;
  await expect(
    page.getByRole('button', { name: 'All followers 50,000', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'All following 50,000', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Mutuals 48,500', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Not following you back 1,500',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'You don’t follow back 1,500',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.account-list > li')).toHaveCount(50);
  await page.getByRole('searchbox').fill('@SYNTHETIC_LARGE51499');
  await expect(page.locator('.account-list > li')).toHaveCount(1);
  const filtered = parseCsv(
    await downloadedText(await downloadButton(page, 'Export filtered CSV')),
  );
  expect(filtered).toHaveLength(2);
  expect(filtered[1]?.[0]).toBe(name(51499));
  const dataset = JSON.parse(
    await downloadedText(await downloadButton(page, 'Export JSON')),
  );
  expect(
    dataset.followers.records.map(
      (record: { username: string }) => record.username,
    ),
  ).toEqual(followers);
  expect(
    dataset.following.records.map(
      (record: { username: string }) => record.username,
    ),
  ).toEqual(following);
  await testInfo.attach('synthetic-large-import-performance', {
    body: JSON.stringify(
      {
        synthetic: true,
        liveAcquisition: false,
        followers: 50000,
        following: 50000,
        importRoundTripMs,
        browser: browserName,
        version: browser.version(),
        platform: process.platform,
        architecture: process.arch,
        caveat:
          'One local automation round trip including file generation transfer and DOM assertions; not a benchmark or live acquisition evidence.',
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
});
