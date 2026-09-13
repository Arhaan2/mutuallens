import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestSqlite } from '../../packages/acquisition/test/sqlite-driver';
import { JobStore, CapacityError } from '../../packages/acquisition/src/store';
import { ScanService } from '../../packages/acquisition/src/jobs';
import type {
  ScanJob,
  ScanProvider,
} from '../../packages/acquisition/src/jobs';
import {
  APIFY_ACTOR_ID,
  APIFY_BUILD_ID,
  APIFY_REVIEWED_EVENT_PRICE_USD,
  ApifyAdapterError,
} from '../../packages/acquisition/src/apify';
import type {
  ApifyRun,
  ApifyReviewedPricing,
} from '../../packages/acquisition/src/apify';

// Independent failure cases: real SQLite, synthetic provider, no live approval.
const databases: TestSqlite[] = [];
afterEach(() => {
  for (const sql of databases.splice(0)) sql.db.close();
});
function fixture(
  options: {
    charge?: number;
    terminalEvidenceId?: string;
    provider?: Partial<ScanProvider>;
  } = {},
) {
  const sql = new TestSqlite();
  databases.push(sql);
  let now = Date.parse('2026-09-08T00:00:00.000Z'),
    direction = 'followers',
    starts = 0;
  const record = (id: string, status: ApifyRun['status']): ApifyRun => ({
    id,
    actorId: APIFY_ACTOR_ID,
    buildId: APIFY_BUILD_ID,
    status,
    statusMessage: 'Synthetic provider',
    defaultDatasetId: `${id}Dataset`,
    defaultKeyValueStoreId: `${id}Store`,
    defaultRequestQueueId: `${id}Queue`,
    startedAt: new Date(now).toISOString(),
    finishedAt: status === 'RUNNING' ? null : new Date(now).toISOString(),
    usageTotalUsd: options.charge ?? 0.00906,
    chargedEventCounts: {
      'apify-actor-start': 1,
      'apify-default-dataset-item': 1,
      'user-batch-50': 1,
    },
    datasetItemCount: 1,
  });
  const provider: ScanProvider = {
    getReviewedPricing: vi.fn(async (): Promise<ApifyReviewedPricing> => ({
      actorId: APIFY_ACTOR_ID,
      pricingModel: 'PAY_PER_EVENT',
      startedAt: '2026-04-12T12:56:41.164Z',
      checkedAt: new Date(now).toISOString(),
      eventPriceUsd: APIFY_REVIEWED_EVENT_PRICE_USD,
      minimalMaxTotalChargeUsd: null,
      freeTierDiscountPercent: null,
      userPaysActorPlatformUsage: null,
    })),
    start: vi.fn(async (input) => {
      direction = input.direction;
      return record(`SyntheticRun${++starts}`, 'RUNNING');
    }),
    getRun: vi.fn(async (id) => record(id, 'SUCCEEDED')),
    abortRun: vi.fn(async (id) => record(id, 'ABORTED')),
    readDatasetPage: vi.fn(async () => ({
      items: [
        {
          results: [
            {
              username: 'synthetic_observed',
              userId: '1',
              relation: direction === 'followers' ? 'follower' : 'following',
            },
          ],
          cursor_next: null,
        },
      ],
      offset: 0,
      count: 1,
      total: 1,
      nextOffset: null,
      exhausted: true,
    })),
    deleteDataset: vi.fn(async () => {}),
    deleteKeyValueStore: vi.fn(async () => {}),
    deleteRequestQueue: vi.fn(async () => {}),
    deleteRun: vi.fn(async () => {}),
    ...options.provider,
  };
  const store = new JobStore<ScanJob>(sql);
  const service = new ScanService(
    store,
    provider,
    {
      windowUsd: 4.5,
      jobUsd: 3,
      runUsd: 0.05,
      reserveUsd: 0.5,
      terminalEvidenceId: options.terminalEvidenceId,
    },
    async () => ({
      period: '2026-09-01',
      endsAt: '2026-10-01T00:00:00.000Z',
      recurringCreditsUsd: 5,
      usedUsd: 0,
      remainingUsd: 5,
      retentionDays: 7,
    }),
    () => now,
  );
  const tick = () => {
    now += 3000;
  };
  return {
    sql,
    store,
    service,
    provider,
    tick,
    expire: () => {
      now += 3600001;
    },
  };
}
async function runUntilStopped(test: ReturnType<typeof fixture>) {
  let progress = await test.service.create(
    'synthetic-session',
    crypto.randomUUID(),
    'synthetic_target',
  );
  for (
    let step = 0;
    step < 20 &&
    !['partial', 'complete', 'uncertain', 'failed'].includes(progress.status);
    step++
  ) {
    test.tick();
    progress = await test.service.advance('synthetic-session', progress.id);
  }
  return progress;
}

describe('independent automatic safety regression', () => {
  it('does not accept nominal success/null cursor when the next billing batch cannot fit', async () => {
    const test = fixture({
      charge: 0.04506,
      terminalEvidenceId: 'synthetic-fixture-not-live-approval',
    });
    const progress = await runUntilStopped(test);
    expect(progress.status).toBe('partial');
    expect(progress.followers.complete).toBe(false);
    const result = await test.service.resultPage(
      'synthetic-session',
      progress.id,
      'followers',
      0,
    );
    expect(result.records).toHaveLength(1);
    expect(result.dataset.followers.metadata.terminal).toBe(false);
  });

  it('does not replace live terminal-behavior evidence with a well-funded synthetic null cursor', async () => {
    const test = fixture();
    const progress = await runUntilStopped(test);
    expect(progress.status).toBe('partial');
    expect(progress.followers.complete).toBe(false);
  });

  it('checks fresh reviewed pricing before every new provider start', async () => {
    const test = fixture({
      terminalEvidenceId: 'synthetic-fixture-not-live-approval',
    });
    expect((await runUntilStopped(test)).status).toBe('complete');
    expect(test.provider.start).toHaveBeenCalledTimes(2);
    expect(test.provider.getReviewedPricing).toHaveBeenCalledTimes(2);
    const starts = vi.mocked(test.provider.start).mock.invocationCallOrder;
    const checks = vi.mocked(test.provider.getReviewedPricing).mock
      .invocationCallOrder;
    expect(checks[0]).toBeLessThan(starts[0]);
    expect(checks[1]).toBeLessThan(starts[1]);
  });

  it('erases local graph and target data at expiry even when provider deletion is unavailable', async () => {
    const test = fixture({
      terminalEvidenceId: 'synthetic-fixture-not-live-approval',
      provider: {
        deleteDataset: vi.fn(async () => {
          throw new Error('Synthetic provider outage');
        }),
      },
    });
    const created = await test.service.create(
      'synthetic-session',
      crypto.randomUUID(),
      'synthetic_target',
    );
    for (let step = 0; step < 3; step++) {
      test.tick();
      await test.service.advance('synthetic-session', created.id);
    }
    expect(
      test.sql.db.prepare('SELECT COUNT(*) AS n FROM records').get()?.n,
    ).toBe(1);
    test.expire();
    expect(await test.service.cleanupExpired()).toEqual({
      removed: 1,
      pending: 1,
    });
    expect(
      test.sql.db.prepare('SELECT COUNT(*) AS n FROM records').get()?.n,
    ).toBe(0);
    expect(test.sql.db.prepare('SELECT COUNT(*) AS n FROM jobs').get()?.n).toBe(
      0,
    );
    const tombstone = test.sql.db
      .prepare('SELECT payload FROM remote_cleanup')
      .get();
    expect(tombstone).toBeDefined();
    expect(String(tombstone?.payload)).not.toMatch(
      /synthetic_target|synthetic_observed|session|cursor|fingerprint|results/,
    );
    await expect(
      test.service.status('synthetic-session', created.id),
    ).rejects.toThrow('SCAN_NOT_FOUND');
  });

  it('keeps the full reservation accounted when an active run can neither be read nor aborted', async () => {
    const test = fixture({
      provider: {
        getRun: vi.fn(async () => {
          throw new Error('Synthetic run read unavailable');
        }),
        abortRun: vi.fn(async () => {
          throw new Error('Synthetic abort unavailable');
        }),
      },
    });
    expect((await runUntilStopped(test)).status).toBe('partial');
    expect(
      test.sql.db.prepare('SELECT spent,reserved FROM capacity').get(),
    ).toMatchObject({ spent: 3000000, reserved: 0 });
    await expect(
      test.service.create(
        'second-session',
        crypto.randomUUID(),
        'synthetic_second',
      ),
    ).rejects.toBeInstanceOf(CapacityError);
    expect(test.provider.start).toHaveBeenCalledTimes(1);
  });

  it('replays expired resource deletion safely after a crash leaves a cleanup tombstone', async () => {
    const deletion = vi.fn(async () => {
      throw new ApifyAdapterError(
        'PROVIDER_HTTP',
        'Synthetic resource already deleted',
        404,
      );
    });
    const test = fixture({
      provider: {
        deleteDataset: deletion,
        deleteKeyValueStore: deletion,
        deleteRequestQueue: deletion,
        deleteRun: deletion,
      },
    });
    const created = await test.service.create(
      'synthetic-session',
      crypto.randomUUID(),
      'synthetic_target',
    );
    test.tick();
    await test.service.advance('synthetic-session', created.id);
    test.expire();
    expect(await test.service.cleanupExpired()).toEqual({
      removed: 1,
      pending: 0,
    });
    expect(
      test.sql.db.prepare('SELECT COUNT(*) AS n FROM remote_cleanup').get()?.n,
    ).toBe(0);
    expect(deletion).toHaveBeenCalledTimes(4);
  });
});
