import { test, expect, type Page } from '@playwright/test';

// Fault injection only. Normal built-preview journeys belong to the other suite.
const validCapability = {
  release: 'preview',
  automatic: {
    enabled: false,
    status: 'blocked',
    reason: 'Automatic checks are not available in this preview.',
  },
  ads: false,
};
const sampleButton = (page: Page) =>
  page.getByRole('button', { name: /Explore synthetic sample/ });
const visibleAlert = (page: Page) => page.locator('[role="alert"]:visible');
const file = (name: string, value: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(value)),
});
const records = (names: string[]) =>
  names.map((value) => ({ string_list_data: [{ value }] }));

async function assertSampleWorks(page: Page) {
  await sampleButton(page).click();
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_example',
  );
  await expect(
    page.getByRole('button', { name: /Mutuals 4,500/ }),
  ).toBeVisible();
}

async function importAndSave(
  page: Page,
  marker: string,
  date: string,
  count: number,
) {
  if (!(await page.locator('#import-account').isVisible()))
    await page.locator('details#import > summary').click();
  await page.locator('#import-account').fill('synthetic_owner');
  await page.locator('input[type=file]').setInputFiles([
    file('followers.json', records([marker, 'mutual'])),
    file('following.json', {
      relationships_following: records(['following_only', 'mutual']),
    }),
  ]);
  await page.locator('#collected-at').fill(date);
  await page.getByLabel('I confirm these files').check();
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await expect(page.locator('.import-form button[type=submit]')).toBeEnabled();
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
  await page.getByRole('button', { name: /All followers/ }).click();
  await expect(page.locator('.account-list')).toContainText(`@${marker}`);
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(page.locator('.snapshot-row')).toHaveCount(count);
}

// Real module workers parse synthetic files. Only their completed reply delivery is held.
// release() deliberately invokes the registered callback after terminate(), modeling an
// already queued stale callback so task-id checks are verified independently of terminate().
async function installHeldWorkers(page: Page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const state = {
      holdKind: '' as string,
      held: [] as Array<{ kind: string; release: () => void }>,
    };
    Object.assign(window, { __mutuallensHeld: state });
    class HeldWorker {
      private native: Worker;
      private kind = '';
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      constructor(url: string | URL, options?: WorkerOptions) {
        this.native = new NativeWorker(url, options);
        this.native.onmessage = (event) => {
          const release = () => this.onmessage?.(event);
          if (state.holdKind === this.kind)
            state.held.push({ kind: this.kind, release });
          else release();
        };
        this.native.onerror = (event) => this.onerror?.(event);
        this.native.onmessageerror = (event) => this.onmessageerror?.(event);
      }
      postMessage(data: { kind: string }) {
        this.kind = data.kind;
        this.native.postMessage(data);
      }
      terminate() {
        this.native.terminate();
      }
    }
    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: HeldWorker,
    });
  });
}
async function setHeldKind(page: Page, kind: string) {
  await page.evaluate((value) => {
    (
      window as unknown as { __mutuallensHeld: { holdKind: string } }
    ).__mutuallensHeld.holdKind = value;
  }, kind);
}
async function waitHeld(page: Page, count: number) {
  await page.waitForFunction(
    (n) =>
      (window as unknown as { __mutuallensHeld: { held: unknown[] } })
        .__mutuallensHeld.held.length === n,
    count,
  );
}
async function releaseHeld(page: Page, index: number) {
  await page.evaluate((i) => {
    (
      window as unknown as {
        __mutuallensHeld: { held: Array<{ release: () => void }> };
      }
    ).__mutuallensHeld.held[i]!.release();
  }, index);
}

for (const [name, response] of [
  ['non-JSON response', '<!doctype html><title>Upstream failure</title>'],
  ['null JSON', 'null'],
  [
    'malformed capability',
    JSON.stringify({
      release: 'production',
      automatic: { enabled: true },
      ads: true,
    }),
  ],
] as const) {
  test(`fault: capability ${name} fails closed, can retry, and sample works`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let calls = 0;
    await page.route('**/api/capabilities', (route) => {
      calls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: calls === 1 ? response : JSON.stringify(validCapability),
      });
    });
    await page.goto('/');
    await expect(page.locator('#automatic-status')).toContainText(
      'Availability could not be verified',
    );
    await expect(
      page.getByRole('button', { name: /Check automatically/ }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Retry availability' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Retry availability' }).click();
    await expect(page.locator('#automatic-status')).toContainText(
      validCapability.automatic.reason,
    );
    expect(calls).toBe(2);
    await assertSampleWorks(page);
    expect(errors).toEqual([]);
  });
}

test('fault: capability network failure keeps local sample functional', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/capabilities', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('#automatic-status')).toContainText(
    'Availability could not be verified',
  );
  await expect(
    page.getByRole('button', { name: /Check automatically/ }),
  ).toBeDisabled();
  await assertSampleWorks(page);
  expect(errors).toEqual([]);
});

test('fault: hung capability times out at 8s without blocking local mode', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/api/capabilities', () => {
    requested();
  });
  await page.goto('/');
  await requestStarted;
  await expect(page.locator('#automatic-status')).toContainText(
    /Checking (?:service )?availability/,
  );
  await page.clock.fastForward(8001);
  await expect(page.locator('#automatic-status')).toContainText(
    'Availability could not be verified',
  );
  await expect(
    page.getByRole('button', { name: 'Retry availability' }),
  ).toBeVisible();
  await assertSampleWorks(page);
  expect(errors).toEqual([]);
});

test('fault: worker constructor failure gives an alert and retry works', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const state = { fail: true };
    Object.assign(window, { __mutuallensWorkerConstructor: state });
    Object.defineProperty(window, 'Worker', {
      value: class {
        constructor(url: string | URL, options?: WorkerOptions) {
          if (state.fail) throw new Error('Synthetic worker startup failure');
          return new NativeWorker(url, options);
        }
      },
    });
  });
  await page.goto('/');
  await sampleButton(page).click();
  await expect(visibleAlert(page)).toContainText(/processing|worker/i);
  await expect(page.locator('#results-title')).toHaveCount(0);
  await page.evaluate(() => {
    (
      window as unknown as { __mutuallensWorkerConstructor: { fail: boolean } }
    ).__mutuallensWorkerConstructor.fail = false;
  });
  await assertSampleWorks(page);
  expect(errors).toEqual([]);
});

for (const kind of ['error', 'messageerror', 'postMessage'] as const) {
  test(`fault: worker ${kind} failure exits processing and retry works`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((failureKind) => {
      const NativeWorker = window.Worker;
      const state = { fail: true };
      Object.assign(window, { __mutuallensWorkerEvent: state });
      Object.defineProperty(window, 'Worker', {
        value: class {
          constructor(url: string | URL, options?: WorkerOptions) {
            const worker = new NativeWorker(url, options);
            const post = worker.postMessage.bind(worker);
            worker.postMessage = (data: unknown) => {
              if (!state.fail) {
                post(data);
                return;
              }
              if (failureKind === 'postMessage')
                throw new DOMException(
                  'Synthetic clone failure',
                  'DataCloneError',
                );
              queueMicrotask(() =>
                worker.dispatchEvent(
                  failureKind === 'error'
                    ? new ErrorEvent('error', {
                        message: 'Synthetic worker failure',
                        cancelable: true,
                      })
                    : new MessageEvent('messageerror'),
                ),
              );
            };
            return worker;
          }
        },
      });
    }, kind);
    await page.goto('/');
    await sampleButton(page).click();
    await expect(visibleAlert(page)).toContainText(
      /processing|worker|read|message/i,
    );
    await expect(
      page.getByRole('button', { name: 'Cancel processing', exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() => {
      (
        window as unknown as { __mutuallensWorkerEvent: { fail: boolean } }
      ).__mutuallensWorkerEvent.fail = false;
    });
    await assertSampleWorks(page);
    expect(errors).toEqual([]);
  });
}

test('fault: cancel, retry and clear invalidate delayed completed worker replies', async ({
  page,
}) => {
  await installHeldWorkers(page);
  await page.goto('/');
  await setHeldKind(page, 'sample');
  await sampleButton(page).click();
  await waitHeld(page, 1);
  await page
    .getByRole('button', { name: 'Cancel processing', exact: true })
    .click();
  await expect(page.getByText(/Local processing canceled/)).toBeVisible();
  await releaseHeld(page, 0);
  await expect(page.locator('#results-title')).toHaveCount(0);
  await setHeldKind(page, '');
  await assertSampleWorks(page);
  await page.getByRole('button', { name: 'Clear report', exact: true }).click();
  await releaseHeld(page, 0);
  await expect(page.locator('#results-title')).toHaveCount(0);
});

test('fault: changing snapshot selection invalidates delayed comparison results', async ({
  page,
}) => {
  await installHeldWorkers(page);
  await page.goto('/');
  await importAndSave(page, 'earlier_only', '2025-01-01T12:00', 1);
  await importAndSave(page, 'later_only', '2025-02-01T12:00', 2);
  await page.getByLabel('Earlier snapshot').selectOption({ index: 2 });
  await page.getByLabel('Later snapshot').selectOption({ index: 1 });
  await setHeldKind(page, 'history');
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await waitHeld(page, 1);
  await page.getByLabel('Earlier snapshot').selectOption({ index: 1 });
  await releaseHeld(page, 0);
  await expect(page.locator('.history-result')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cancel processing', exact: true }),
  ).toHaveCount(0);
});

test('fault: deleting saved snapshots invalidates delayed comparison results', async ({
  page,
}) => {
  await installHeldWorkers(page);
  await page.goto('/');
  await importAndSave(page, 'earlier_only', '2025-01-01T12:00', 1);
  await importAndSave(page, 'later_only', '2025-02-01T12:00', 2);
  await page.getByLabel('Earlier snapshot').selectOption({ index: 2 });
  await page.getByLabel('Later snapshot').selectOption({ index: 1 });
  await setHeldKind(page, 'history');
  await page
    .getByRole('button', { name: 'Compare snapshots', exact: true })
    .click();
  await waitHeld(page, 1);
  await page
    .getByRole('button', { name: 'Delete all local snapshots' })
    .click();
  await page
    .getByRole('button', { name: 'Confirm delete all snapshots' })
    .click();
  await expect(page.locator('.snapshot-row')).toHaveCount(0);
  await releaseHeld(page, 0);
  await expect(page.locator('.history-result')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cancel processing', exact: true }),
  ).toHaveCount(0);
});

test('fault: export URL allocation failure is visible near report actions without an uncaught error', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await assertSampleWorks(page);
  await page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new Error('Synthetic download allocation failure');
    };
  });
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const alert = page.locator('.results [role="alert"]:visible');
  await expect(alert).toContainText(/export|download/i);
  const box = await alert.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    (page.viewportSize()?.height ?? 720) + 1,
  );
  expect(errors).toEqual([]);
});

test('fault: IndexedDB denied keeps report usable and reports saving failure locally', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Synthetic denied storage', 'SecurityError');
    };
  });
  await page.goto('/');
  await assertSampleWorks(page);
  await page.getByRole('button', { name: 'Save snapshot locally' }).click();
  await expect(visibleAlert(page)).toContainText(/storage|sav/i);
  await expect(page.locator('#results-title')).toContainText(
    'synthetic_example',
  );
  expect(errors).toEqual([]);
});

test('fault: corrupt synthetic stored record cannot blank the checker', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('mutuallens-local-snapshots', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('snapshots', { keyPath: 'id' });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('snapshots', 'readwrite');
          transaction
            .objectStore('snapshots')
            .put({ id: 'synthetic_corrupt', savedAt: '2025-01-01' });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
  );
  await page.getByRole('button', { name: 'View saved snapshots' }).click();
  await expect(page.locator('main')).toBeVisible();
  await expect(visibleAlert(page)).toContainText(
    /snapshot|storage|saved|invalid|read/i,
  );
  await assertSampleWorks(page);
  expect(errors).toEqual([]);
});

test('fault: import failure stays beside import after exporting the previous report', async ({
  page,
}) => {
  await installHeldWorkers(page);
  await page.goto('/');
  await importAndSave(page, 'earlier_only', '2025-01-01T12:00', 1);
  await page.locator('details#import > summary').click();
  await page.locator('#import-files').setInputFiles(
    file('following.json', {
      relationships_following: records(['synthetic_other']),
    }),
  );
  await setHeldKind(page, 'import');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await waitHeld(page, 1);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  await downloading;
  await expect(
    page.locator('#import').getByRole('button', { name: 'Cancel processing' }),
  ).toBeVisible();
  await releaseHeld(page, 0);
  await expect(page.locator('#import [role=alert]')).toContainText(
    'Missing followers',
  );
  await expect(page.locator('.results [role=alert]')).toHaveCount(0);
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
});

test('fault: repeated current history entry discards a delayed completed import', async ({
  page,
}) => {
  await installHeldWorkers(page);
  await page.goto('/');
  await importAndSave(page, 'earlier_only', '2025-01-01T12:00', 1);
  await page
    .getByRole('link', { name: 'Saved snapshots', exact: true })
    .click();
  await expect(page).toHaveURL(/#history$/);
  await page.locator('details#import > summary').click();
  await page.locator('#import-account').fill('synthetic_pending');
  await setHeldKind(page, 'import');
  await page.getByRole('button', { name: /Compare local files/ }).click();
  await waitHeld(page, 1);
  await page
    .getByRole('link', { name: 'Saved snapshots', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Cancel processing' }),
  ).toHaveCount(0);
  await releaseHeld(page, 0);
  await expect(page.locator('#results-title')).toContainText('synthetic_owner');
});
