import { openImportDetails, openSnapshotOptions } from './product-ui';
import { test, expect, type Page, type Worker } from '@playwright/test';
import { expectedDevelopmentAbort } from './browser-events';
import { readFile } from 'node:fs/promises';

// Normal user workflows with actual unmodified module workers and synthetic files.
// No route interceptions, fake workers, held replies or timing sleeps.
// A DOM observer activates the real control when processing first renders, so
// cancellation does not assume a minimum duration for a fast browser worker.
const records = (names: string[]) =>
  names.map((value) => ({ string_list_data: [{ value }] }));
const file = (name: string, value: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(value)),
});
const small = () => [
  file('followers.json', records(['synthetic_mutual', 'synthetic_fan'])),
  file('following.json', {
    relationships_following: records([
      'synthetic_mutual',
      'synthetic_followed',
    ]),
  }),
];
async function form(
  page: Page,
  files: ReturnType<typeof small>,
  owner: string,
) {
  await openImportDetails(page);
  await page.locator('#import-account').fill(owner);
  await page.locator('#import-files').setInputFiles(files);
}
function observe(page: Page) {
  const workers = new Set<Worker>();
  const errors: string[] = [];
  page.on('worker', (worker) => {
    workers.add(worker);
    worker.on('close', () => workers.delete(worker));
  });
  page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    if (!expectedDevelopmentAbort(request))
      errors.push(`request: ${request.url()} ${request.failure()?.errorText}`);
  });
  return { workers, errors };
}

async function activateDuringProcessing(
  page: Page,
  action: 'cancel' | 'history',
) {
  await page.evaluate((target) => {
    const observer = new MutationObserver(() => {
      const cancel = [
        ...document.querySelectorAll<HTMLButtonElement>('button'),
      ].find((button) => button.textContent?.trim() === 'Cancel processing');
      if (!cancel || !cancel.getClientRects().length) return;
      const control =
        target === 'cancel'
          ? cancel
          : document.querySelector<HTMLAnchorElement>(
              '.workspace-bar a[href="#history"]',
            );
      if (!control) return;
      observer.disconnect();
      control.click();
    });
    observer.observe(document.getElementById('main')!, {
      childList: true,
      subtree: true,
    });
  }, action);
}

test('repair: repeated sample activation and pending saves leave one coherent report and one saved snapshot', async ({
  page,
}) => {
  const observed = observe(page);
  await page.goto('/');
  await expect(page.locator('#automatic-status')).toContainText(
    'awaiting provider account setup',
  );
  await page
    .getByRole('button', { name: 'Explore synthetic sample' })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
      button.click();
    });
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_example',
  );
  await expect(
    page.getByRole('button', { name: 'Explore synthetic sample' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Mutuals 4,500', exact: true }),
  ).toBeVisible();
  await expect.poll(() => observed.workers.size).toBe(0);
  await openSnapshotOptions(page);
  await page
    .getByRole('button', { name: 'Save snapshot locally' })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
      button.click();
    });
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Save snapshot locally' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.locator('#results-title')).toHaveCount(0);
  expect(
    await page
      .locator('#import-files')
      .evaluate((element: HTMLInputElement) => element.files?.length),
  ).toBe(0);
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
  expect(observed.errors).toEqual([]);
});

test('repair: real large import cancels, retries with exact data, and repeated history navigation cancels newer work', async ({
  page,
  browserName,
  browser,
}, testInfo) => {
  const observed = observe(page);
  await page.goto('/');
  await expect(page.locator('#automatic-status')).toContainText(
    'awaiting provider account setup',
  );
  // 49,000,030 bytes: inside the documented 64 MiB input safeguard. Padding is
  // ignored JSON metadata, and the 100,000 records per direction are synthetic.
  const largeRecords = Array.from({ length: 100000 }, (_, i) => ({
    string_list_data: [
      { value: `synthetic_queue${String(i).padStart(6, '0')}` },
    ],
    padding: 'x'.repeat(175),
  }));
  const large = [
    file('followers.json', largeRecords),
    file('following.json', { relationships_following: largeRecords }),
  ];
  const inputBytes = large.reduce(
    (total, input) => total + input.buffer.byteLength,
    0,
  );
  expect(inputBytes).toBe(49000030);
  expect(inputBytes).toBeLessThan(64 * 1024 * 1024);
  await form(page, large, 'synthetic_cancel');
  await activateDuringProcessing(page, 'cancel');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  const cancel = page.getByRole('button', {
    name: 'Cancel processing',
    exact: true,
  });
  await expect(page.locator('[role=status]:visible')).toContainText('canceled');
  await expect.poll(() => observed.workers.size).toBe(0);
  await expect(page.locator('#results-title')).toHaveCount(0);

  await form(page, small(), 'synthetic_retry');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#results-title')).toContainText('synthetic_retry');
  await expect(
    page.getByRole('button', { name: 'Mutuals 1', exact: true }),
  ).toBeVisible();
  await expect.poll(() => observed.workers.size).toBe(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const downloaded = await downloading;
  const path = await downloaded.path();
  expect(path).not.toBeNull();
  const dataset = JSON.parse(await readFile(path!, 'utf8'));
  expect(dataset.sample).toBe(false);
  expect(
    dataset.followers.records.map(
      (record: { username: string }) => record.username,
    ),
  ).toEqual(['synthetic_mutual', 'synthetic_fan']);
  expect(
    dataset.following.records.map(
      (record: { username: string }) => record.username,
    ),
  ).toEqual(['synthetic_mutual', 'synthetic_followed']);
  await openSnapshotOptions(page);
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(1);

  // The fragment is already #history when the next import starts. Activating
  // this same navigation again must still cancel; hashchange alone is insufficient.
  await page
    .getByRole('link', { name: 'Saved snapshots', exact: true })
    .click();
  await expect(page).toHaveURL(/#history$/);
  await form(page, large, 'synthetic_navigation');
  await expect(page).toHaveURL(/#history$/);
  await activateDuringProcessing(page, 'history');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('#import [role=status]')).toContainText('canceled');
  await expect(cancel).toHaveCount(0);
  await expect.poll(() => observed.workers.size).toBe(0);
  await expect(page.locator('#results-title')).toContainText('synthetic_retry');
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.locator('#results-title')).toHaveCount(0);
  expect(
    await page
      .locator('#import-files')
      .evaluate((element: HTMLInputElement) => element.files?.length),
  ).toBe(0);
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(1);
  expect(observed.errors).toEqual([]);
  await testInfo.attach('real-worker-cancellation-environment', {
    body: JSON.stringify(
      {
        synthetic: true,
        mocked: false,
        inputBytes,
        followers: 100000,
        following: 100000,
        browser: browserName,
        version: browser.version(),
        platform: process.platform,
        architecture: process.arch,
        caveat:
          'Resource-safe inputs exercise cancellation; this is not completed 100,000-record result or live acquisition evidence.',
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
});
