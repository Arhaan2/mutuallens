import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestSqlite } from './sqlite-driver';
import { JobStore, CapacityError } from '../src/store';
import { ScanService } from '../src/jobs';
import type { ScanJob, ScanProvider } from '../src/jobs';
import {
  APIFY_ACTOR_ID,
  APIFY_BUILD_ID,
  APIFY_REVIEWED_EVENT_PRICE_USD,
  ApifyAdapterError,
} from '../src/apify';
import type { ApifyRun, ApifyReviewedPricing } from '../src/apify';
import { compareDataset } from '../../core/src/identity';
const databases: TestSqlite[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.db.close();
});
const run = (
  id = 'runSynthetic',
  status: ApifyRun['status'] = 'SUCCEEDED',
): ApifyRun => ({
  id,
  actorId: APIFY_ACTOR_ID,
  buildId: APIFY_BUILD_ID,
  status,
  statusMessage: 'Synthetic provider fixture',
  defaultDatasetId: id + 'Dataset',
  defaultKeyValueStoreId: null,
  defaultRequestQueueId: null,
  startedAt: '2026-09-08T00:00:00Z',
  finishedAt: '2026-09-08T00:00:01Z',
  usageTotalUsd: 0.01,
  chargedEventCounts: null,
  datasetItemCount: 1,
});
function setup(override: Partial<ScanProvider> = {}) {
  const sql = new TestSqlite();
  databases.push(sql);
  const store = new JobStore<ScanJob>(sql);
  let time = Date.parse('2026-09-08T00:00:00Z');
  let direction = 'followers',
    cursor: string | null = null;
  const provider: ScanProvider = {
    getReviewedPricing: vi.fn(async (): Promise<ApifyReviewedPricing> => ({
      actorId: APIFY_ACTOR_ID,
      pricingModel: 'PAY_PER_EVENT',
      startedAt: '2026-07-01T00:00:00Z',
      checkedAt: new Date(time).toISOString(),
      eventPriceUsd: APIFY_REVIEWED_EVENT_PRICE_USD,
      minimalMaxTotalChargeUsd: null,
      freeTierDiscountPercent: null,
      userPaysActorPlatformUsage: null,
    })),
    start: vi.fn(async (input) => {
      direction = input.direction;
      cursor = input.upstreamCursor ?? null;
      return run(direction + (cursor ? 'Second' : 'First'), 'RUNNING');
    }),
    getRun: vi.fn(async (id) => run(id)),
    abortRun: vi.fn(async (id) => run(id, 'ABORTED')),
    readDatasetPage: vi.fn(async () => ({
      items: [
        {
          results: [
            {
              username:
                direction === 'followers'
                  ? 'synthetic_mutual'
                  : cursor
                    ? 'synthetic_not_back'
                    : 'synthetic_mutual',
              userId: direction === 'following' && cursor ? '2' : '1',
              relation: direction === 'followers' ? 'follower' : 'following',
            },
          ],
          cursor_next:
            direction === 'following' && !cursor ? 'second-page' : null,
        },
      ],
      offset: 0,
      count: 1,
      total: 1,
      nextOffset: null,
      exhausted: true,
    })),
    deleteDataset: vi.fn(async () => {}),
    deleteRun: vi.fn(async () => {}),
    deleteKeyValueStore: vi.fn(async () => {}),
    deleteRequestQueue: vi.fn(async () => {}),
    ...override,
  };
  const capacity = vi.fn(async () => ({
    period: '2026-09-01',
    endsAt: '2026-10-01T00:00:00Z',
    recurringCreditsUsd: 5,
    usedUsd: 0,
    remainingUsd: 5,
    retentionDays: 7,
  }));
  const service = new ScanService(
    store,
    provider,
    {
      windowUsd: 4.5,
      jobUsd: 3,
      runUsd: 0.1,
      reserveUsd: 0.5,
      terminalEvidenceId: 'synthetic-unit-evidence-only',
    },
    capacity,
    () => time,
  );
  return {
    sql,
    store,
    provider,
    capacity,
    service,
    tick: () => {
      time += 3000;
    },
    expire: () => {
      time += 3600001;
    },
  };
}
describe('resumable automatic engine using synthetic provider fixtures and real SQLite', () => {
  it('retrieves both upstream directions across runs, deduplicates and produces source-qualified math', async () => {
    const { service, provider, tick } = setup();
    const job = await service.create(
      'session-one',
      crypto.randomUUID(),
      'synthetic_owner',
    );
    let status = job;
    for (let i = 0; i < 30 && status.status !== 'complete'; i++) {
      tick();
      status = await service.advance('session-one', job.id);
    }
    expect(status.status).toBe('complete');
    expect(status.followers.observed).toBe(1);
    expect(status.following.observed).toBe(2);
    expect(provider.start).toHaveBeenCalledTimes(3);
    const followers = await service.resultPage(
        'session-one',
        job.id,
        'followers',
        0,
      ),
      following = await service.resultPage(
        'session-one',
        job.id,
        'following',
        0,
      );
    const dataset = followers.dataset;
    dataset.followers.records = followers.records;
    dataset.following.records = following.records;
    expect(dataset.comparisonBasis).toBe('source_evidence');
    expect(
      compareDataset(dataset).notFollowingBack.map((r) => r.username),
    ).toEqual(['synthetic_not_back']);
    expect(provider.deleteDataset).toHaveBeenCalledTimes(3);
  });
  it('idempotent create and concurrent starts preserve one atomic reservation', async () => {
    const { service, sql } = setup(),
      key = crypto.randomUUID();
    const results = await Promise.allSettled([
      service.create('same', key, 'synthetic_owner'),
      service.create('same', key, 'synthetic_owner'),
      service.create('other', crypto.randomUUID(), 'synthetic_other'),
    ]);
    const accepted = results.filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Awaited<ReturnType<typeof service.create>>
      > => r.status === 'fulfilled',
    );
    expect(accepted.length).toBeGreaterThan(0);
    expect(new Set(accepted.map((r) => r.value.id)).size).toBe(1);
    expect(
      sql.db.prepare('SELECT reserved FROM capacity').get()?.reserved,
    ).toBe(3000000);
    expect(sql.db.prepare('SELECT COUNT(*) AS n FROM jobs').get()?.n).toBe(1);
  });
  it('an uncertain provider start is never repeated and keeps its full reservation accounted', async () => {
    const { service, provider, sql, tick } = setup({
      start: vi.fn(async () => {
        throw new ApifyAdapterError(
          'PROVIDER_TRANSPORT',
          'synthetic lost acknowledgement',
          null,
          false,
          'unknown',
        );
      }),
    });
    const job = await service.create(
      's',
      crypto.randomUUID(),
      'synthetic_owner',
    );
    tick();
    const status = await service.advance('s', job.id);
    expect(status.status).toBe('uncertain');
    tick();
    await service.advance('s', job.id);
    expect(provider.start).toHaveBeenCalledTimes(1);
    expect(
      sql.db.prepare('SELECT spent,reserved FROM capacity').get(),
    ).toMatchObject({ spent: 3000000, reserved: 0 });
  });
  it('a durable STARTING checkpoint surviving a crash is not retried', async () => {
    const { service, store, provider, tick } = setup();
    const job = await service.create(
      's',
      crypto.randomUUID(),
      'synthetic_owner',
    );
    const lease = await store.claim(
      job.id,
      's',
      Date.parse('2026-09-08T00:00:00Z'),
    );
    const row = (await store.get(
      job.id,
      's',
      Date.parse('2026-09-08T00:00:00Z'),
    ))!;
    row.payload.stage = 'starting';
    await store.save(job.id, lease!, row.payload);
    tick();
    expect((await service.advance('s', job.id)).status).toBe('uncertain');
    expect(provider.start).not.toHaveBeenCalled();
  });
  it('same-session authorization and expiry prevent status and graph disclosure', async () => {
    const { service, expire } = setup();
    const job = await service.create(
      'owner',
      crypto.randomUUID(),
      'synthetic_owner',
    );
    await expect(service.status('stranger', job.id)).rejects.toThrow(
      'SCAN_NOT_FOUND',
    );
    await expect(
      service.resultPage('stranger', job.id, 'followers', 0),
    ).rejects.toThrow('SCAN_NOT_FOUND');
    expire();
    await expect(service.status('owner', job.id)).rejects.toThrow(
      'SCAN_NOT_FOUND',
    );
    expect(await service.cleanupExpired()).toEqual({ removed: 1, pending: 0 });
  });
  it('missing free capacity refuses new scans before any provider run', async () => {
    const { service, capacity, provider } = setup();
    capacity.mockResolvedValue({
      period: '2026-09-01',
      endsAt: '2026-10-01T00:00:00Z',
      recurringCreditsUsd: 5,
      usedUsd: 4.9,
      remainingUsd: 0.1,
      retentionDays: 7,
    });
    await expect(
      service.create('s', crypto.randomUUID(), 'synthetic_owner'),
    ).rejects.toBeInstanceOf(CapacityError);
    expect(provider.start).not.toHaveBeenCalled();
  });
  it('missing terminal marker gives observed records but withholds automatic negatives', async () => {
    const { service, tick } = setup({
      readDatasetPage: vi.fn(async () => ({
        items: [
          {
            results: [
              {
                username: 'synthetic_observed',
                userId: '1',
                relation: 'follower',
              },
            ],
          },
        ],
        offset: 0,
        count: 1,
        total: 1,
        nextOffset: null,
        exhausted: true,
      })),
    });
    const job = await service.create(
      's',
      crypto.randomUUID(),
      'synthetic_owner',
    );
    let status = job;
    for (
      let i = 0;
      i < 8 && !['partial', 'complete'].includes(status.status);
      i++
    ) {
      tick();
      status = await service.advance('s', job.id);
    }
    expect(status.status).toBe('partial');
    const page = await service.resultPage('s', job.id, 'followers', 0);
    expect(page.records).toHaveLength(1);
    expect(page.dataset.followers.metadata.terminal).toBe(false);
  });
  it('explicit cancellation aborts an active provider run and cannot restart it', async () => {
    const { service, provider, tick } = setup();
    const job = await service.create(
      's',
      crypto.randomUUID(),
      'synthetic_owner',
    );
    tick();
    await service.advance('s', job.id);
    expect((await service.cancel('s', job.id)).status).toBe('cancelled');
    tick();
    await service.advance('s', job.id);
    expect(provider.start).toHaveBeenCalledTimes(1);
    expect(provider.abortRun).toHaveBeenCalledTimes(1);
  });
});
