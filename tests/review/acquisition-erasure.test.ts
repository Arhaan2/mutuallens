import { afterEach, expect, it, vi } from 'vitest';
import { eraseExpiredJobs } from '../../packages/acquisition/src/jobs';
import type { ScanJob } from '../../packages/acquisition/src/jobs';
import { JobStore } from '../../packages/acquisition/src/store';
import { TestSqlite } from '../../packages/acquisition/test/sqlite-driver';
import {
  APIFY_ACTOR_ID,
  APIFY_BUILD_ID,
} from '../../packages/acquisition/src/apify';

afterEach(() => vi.unstubAllGlobals());

it('erases expired graph using only D1, without provider token, configuration or network', async () => {
  const network = vi.fn(() => {
    throw new Error('Erasure must not contact a provider.');
  });
  vi.stubGlobal('fetch', network);
  const sql = new TestSqlite();
  try {
    const now = Date.parse('2026-09-08T00:00:00.000Z');
    const direction = () => ({
      cursor: 'synthetic-private-cursor',
      terminal: false,
      rawCount: 1,
      uniqueCount: 1,
      pages: 1,
      invalidCount: 0,
      warnings: [],
      cursors: [],
      fingerprints: [],
    });
    const run = {
      id: 'SyntheticUnfinishedRun',
      actorId: APIFY_ACTOR_ID,
      buildId: APIFY_BUILD_ID,
      status: 'RUNNING' as const,
      statusMessage: 'Synthetic run',
      defaultDatasetId: 'SyntheticPrivateDataset',
      defaultKeyValueStoreId: null,
      defaultRequestQueueId: null,
      startedAt: new Date(now).toISOString(),
      finishedAt: null,
      usageTotalUsd: null,
      chargedEventCounts: null,
      datasetItemCount: null,
    };
    const payload: ScanJob = {
      username: 'synthetic_private_target',
      status: 'running',
      message: 'Synthetic fixture',
      startedAt: new Date(now).toISOString(),
      finishedAt: null,
      spentMicros: 0,
      budgetMicros: 3000000,
      nextAt: 0,
      retries: 0,
      stage: 'polling',
      direction: 'followers',
      run,
      datasetOffset: 0,
      runRawCount: 0,
      runEnvelopes: 0,
      runCursor: null,
      runTerminal: null,
      runInvalid: 0,
      cleanup: [run],
      followers: direction(),
      following: direction(),
    };
    const store = new JobStore<ScanJob>(sql);
    const id = await store.create({
      id: crypto.randomUUID(),
      session: 'synthetic-session',
      key: crypto.randomUUID(),
      period: '2026-09-01',
      ceiling: 4500000,
      reservation: 3000000,
      payload,
      expiresAt: now + 1000,
      now,
    });
    const lease = await store.claim(id, 'synthetic-session', now);
    expect(lease).not.toBeNull();
    await store.addRecords(id, lease!, 'followers', [
      {
        username: 'synthetic_private_record',
        originalUsername: 'synthetic_private_record',
        id: '1',
        source: 'Synthetic privacy fixture',
      },
    ]);
    await store.save(id, lease!, payload);

    // Deliberately no ScanService, ApifyClient, token, Free-account read, or config.
    expect(await eraseExpiredJobs(store, now + 2000)).toBe(1);
    expect(sql.db.prepare('SELECT COUNT(*) AS n FROM records').get()?.n).toBe(
      0,
    );
    expect(sql.db.prepare('SELECT COUNT(*) AS n FROM jobs').get()?.n).toBe(0);
    expect(
      sql.db.prepare('SELECT spent,reserved FROM capacity').get(),
    ).toMatchObject({ spent: 3000000, reserved: 0 });
    const tombstone = sql.db
      .prepare('SELECT payload FROM remote_cleanup')
      .get();
    expect(String(tombstone?.payload)).toContain('SyntheticPrivateDataset');
    expect(String(tombstone?.payload)).not.toMatch(
      /synthetic_private_target|synthetic_private_record|synthetic-private-cursor|synthetic-session/,
    );
    expect(await eraseExpiredJobs(store, now + 2000)).toBe(0);
    expect(sql.db.prepare('SELECT COUNT(*) AS n FROM receipts').get()?.n).toBe(
      1,
    );
    // Receipt retention is enforced even when there are no remaining jobs.
    expect(await eraseExpiredJobs(store, now + 8 * 86400000)).toBe(0);
    expect(sql.db.prepare('SELECT COUNT(*) AS n FROM receipts').get()?.n).toBe(
      0,
    );
    expect(network).not.toHaveBeenCalled();
  } finally {
    sql.db.close();
  }
});
