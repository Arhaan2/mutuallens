import { afterEach, expect, it, vi } from 'vitest';
import { ScanService } from '../../packages/acquisition/src/jobs';
import type {
  ScanJob,
  ScanProvider,
} from '../../packages/acquisition/src/jobs';
import { JobStore } from '../../packages/acquisition/src/store';
import type {
  SqlDriver,
  SqlQuery,
  SqlResult,
} from '../../packages/acquisition/src/store';
import {
  APIFY_ACTOR_ID,
  APIFY_BUILD_ID,
  APIFY_REVIEWED_EVENT_PRICE_USD,
  ApifyAdapterError,
} from '../../packages/acquisition/src/apify';
import type {
  ApifyReviewedPricing,
  ApifyRun,
} from '../../packages/acquisition/src/apify';
import { TestSqlite } from '../../packages/acquisition/test/sqlite-driver';

const databases: TestSqlite[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.db.close();
});

class PausingDriver implements SqlDriver {
  saveEntered!: Promise<void>;
  private resolveSaveEntered: (() => void) | null = null;
  private releaseSavePromise: Promise<void> | null = null;
  private resolveReleaseSave: (() => void) | null = null;
  private pauseSave = false;

  constructor(private readonly inner: SqlDriver) {}

  armRetrySave(): void {
    this.pauseSave = true;
    this.saveEntered = new Promise((resolve) => {
      this.resolveSaveEntered = resolve;
    });
    this.releaseSavePromise = new Promise((resolve) => {
      this.resolveReleaseSave = resolve;
    });
  }

  releaseRetrySave(): void {
    this.resolveReleaseSave?.();
  }

  async batch(queries: SqlQuery[]): Promise<SqlResult[]> {
    if (
      this.pauseSave &&
      queries.some((query) => query.sql.startsWith('UPDATE jobs SET payload='))
    ) {
      this.pauseSave = false;
      this.resolveSaveEntered?.();
      await this.releaseSavePromise;
    }
    return this.inner.batch(queries);
  }
}

const running = (): ApifyRun => ({
  id: 'SyntheticCancelRaceRun',
  actorId: APIFY_ACTOR_ID,
  buildId: APIFY_BUILD_ID,
  status: 'RUNNING',
  statusMessage: 'Synthetic provider fixture',
  defaultDatasetId: 'SyntheticCancelRaceDataset',
  defaultKeyValueStoreId: null,
  defaultRequestQueueId: null,
  startedAt: '2026-09-08T00:00:00Z',
  finishedAt: null,
  usageTotalUsd: null,
  chargedEventCounts: null,
  datasetItemCount: null,
});

it('finishes a queued cancellation when the leased advance hits a retryable provider error', async () => {
  const sql = new TestSqlite();
  databases.push(sql);
  const store = new JobStore<ScanJob>(sql);
  let now = Date.parse('2026-09-08T00:00:00Z');
  let rejectRefresh!: (error: Error) => void;
  const refresh = new Promise<ApifyRun>((_resolve, reject) => {
    rejectRefresh = reject;
  });
  const getRun = vi.fn(() => refresh);
  const pricing: ApifyReviewedPricing = {
    actorId: APIFY_ACTOR_ID,
    pricingModel: 'PAY_PER_EVENT',
    startedAt: '2026-07-01T00:00:00Z',
    checkedAt: new Date(now).toISOString(),
    eventPriceUsd: APIFY_REVIEWED_EVENT_PRICE_USD,
    minimalMaxTotalChargeUsd: null,
    freeTierDiscountPercent: null,
    userPaysActorPlatformUsage: null,
  };
  const provider: ScanProvider = {
    getReviewedPricing: vi.fn(async () => pricing),
    start: vi.fn(async () => running()),
    getRun,
    abortRun: vi.fn(async () => ({ ...running(), status: 'ABORTED' as const })),
    readDatasetPage: vi.fn(),
    deleteDataset: vi.fn(async () => undefined),
    deleteKeyValueStore: vi.fn(async () => undefined),
    deleteRequestQueue: vi.fn(async () => undefined),
    deleteRun: vi.fn(async () => undefined),
  };
  const service = new ScanService(
    store,
    provider,
    {
      windowUsd: 4.5,
      jobUsd: 3,
      runUsd: 0.1,
      reserveUsd: 0.5,
      terminalEvidenceId: 'synthetic-review-only',
    },
    async () => ({
      period: '2026-09-01',
      endsAt: '2026-10-01T00:00:00Z',
      recurringCreditsUsd: 5,
      usedUsd: 0,
      remainingUsd: 5,
      retentionDays: 7,
    }),
    () => now,
  );

  const created = await service.create(
    'synthetic-session',
    crypto.randomUUID(),
    'synthetic_owner',
  );
  await service.advance('synthetic-session', created.id);
  now += 3_000;

  const advancing = service.advance('synthetic-session', created.id);
  await vi.waitFor(() => expect(getRun).toHaveBeenCalledOnce());
  const cancellation = await service.cancel('synthetic-session', created.id);
  expect(cancellation.status).toBe('running');

  rejectRefresh(
    new ApifyAdapterError(
      'PROVIDER_RATE_LIMIT',
      'Synthetic retryable provider failure',
      429,
      true,
      null,
      1,
    ),
  );
  await advancing;

  // A queued cancellation must become terminal after the lease holder releases;
  // otherwise the client cancellation loop only polls and the sole capacity slot
  // remains occupied until the one-hour expiry cleanup.
  const final = await service.status('synthetic-session', created.id);
  expect(final.status).toBe('cancelled');
  expect(provider.abortRun).toHaveBeenCalledOnce();
});

it('finishes cancellation requested between the retry cancellation check and checkpoint save', async () => {
  const sql = new TestSqlite();
  databases.push(sql);
  const pausingSql = new PausingDriver(sql);
  const store = new JobStore<ScanJob>(pausingSql);
  let now = Date.parse('2026-09-08T00:00:00Z');
  let rejectRefresh!: (error: Error) => void;
  const refresh = new Promise<ApifyRun>((_resolve, reject) => {
    rejectRefresh = reject;
  });
  const getRun = vi.fn(() => refresh);
  const pricing: ApifyReviewedPricing = {
    actorId: APIFY_ACTOR_ID,
    pricingModel: 'PAY_PER_EVENT',
    startedAt: '2026-07-01T00:00:00Z',
    checkedAt: new Date(now).toISOString(),
    eventPriceUsd: APIFY_REVIEWED_EVENT_PRICE_USD,
    minimalMaxTotalChargeUsd: null,
    freeTierDiscountPercent: null,
    userPaysActorPlatformUsage: null,
  };
  const provider: ScanProvider = {
    getReviewedPricing: vi.fn(async () => pricing),
    start: vi.fn(async () => running()),
    getRun,
    abortRun: vi.fn(async () => ({ ...running(), status: 'ABORTED' as const })),
    readDatasetPage: vi.fn(),
    deleteDataset: vi.fn(async () => undefined),
    deleteKeyValueStore: vi.fn(async () => undefined),
    deleteRequestQueue: vi.fn(async () => undefined),
    deleteRun: vi.fn(async () => undefined),
  };
  const service = new ScanService(
    store,
    provider,
    {
      windowUsd: 4.5,
      jobUsd: 3,
      runUsd: 0.1,
      reserveUsd: 0.5,
      terminalEvidenceId: 'synthetic-review-only',
    },
    async () => ({
      period: '2026-09-01',
      endsAt: '2026-10-01T00:00:00Z',
      recurringCreditsUsd: 5,
      usedUsd: 0,
      remainingUsd: 5,
      retentionDays: 7,
    }),
    () => now,
  );

  const created = await service.create(
    'synthetic-session',
    crypto.randomUUID(),
    'synthetic_owner',
  );
  await service.advance('synthetic-session', created.id);
  now += 3_000;

  pausingSql.armRetrySave();
  const advancing = service.advance('synthetic-session', created.id);
  await vi.waitFor(() => expect(getRun).toHaveBeenCalledOnce());
  rejectRefresh(
    new ApifyAdapterError(
      'PROVIDER_RATE_LIMIT',
      'Synthetic retryable provider failure',
      429,
      true,
      null,
      1,
    ),
  );
  await pausingSql.saveEntered;

  const cancellation = await service.cancel('synthetic-session', created.id);
  expect(cancellation.status).toBe('running');
  pausingSql.releaseRetrySave();
  await advancing;

  const final = await service.status('synthetic-session', created.id);
  expect(final.status).toBe('cancelled');
  expect(provider.abortRun).toHaveBeenCalledOnce();
});
