import type {
  AccountList,
  AccountRecord,
  Dataset,
  Direction,
} from '../../core/src/types';
import { normalizeUsername } from '../../core/src/identity';
import {
  ApifyAdapterError,
  APIFY_BUILD_ID,
  APIFY_BUILD_NUMBER,
  APIFY_ACTOR_NAME,
  normalizeAcquisitionEnvelopes,
} from './apify';
import type { ApifyClient, ApifyRun } from './apify';
import { readFreeCapacity } from './account';
import type { FreeCapacity } from './account';
import { JobStore, CapacityError } from './store';

export type ScanStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'partial'
  | 'cancelled'
  | 'failed'
  | 'uncertain';
interface DirectionState {
  cursor: string | null;
  terminal: boolean;
  rawCount: number;
  uniqueCount: number;
  pages: number;
  invalidCount: number;
  warnings: string[];
  cursors: string[];
  fingerprints: string[];
}
export interface ScanJob {
  username: string;
  status: ScanStatus;
  message: string;
  startedAt: string;
  finishedAt: string | null;
  spentMicros: number;
  budgetMicros: number;
  nextAt: number;
  retries: number;
  stage: 'ready' | 'starting' | 'polling' | 'dataset' | 'cleanup';
  direction: Direction;
  run: ApifyRun | null;
  datasetOffset: number;
  runRawCount: number;
  runEnvelopes: number;
  runCursor: string | null;
  runTerminal: boolean | null;
  runInvalid: number;
  cleanup: ApifyRun[];
  terminalHeadroomMicros?: number;
  followers: DirectionState;
  following: DirectionState;
}
export interface JobConfig {
  windowUsd: number;
  jobUsd: number;
  runUsd: number;
  reserveUsd: number;
  terminalEvidenceId?: string;
}
export interface ScanProgress {
  id: string;
  status: ScanStatus;
  message: string;
  nextPollMs: number;
  expiresAt: string;
  followers: { observed: number; pages: number; complete: boolean };
  following: { observed: number; pages: number; complete: boolean };
}
const terminal = (s: ScanStatus) =>
  ['complete', 'partial', 'cancelled', 'failed', 'uncertain'].includes(s);
const micros = (usd: number) => Math.ceil(usd * 1_000_000);
const directionState = (): DirectionState => ({
  cursor: null,
  terminal: false,
  rawCount: 0,
  uniqueCount: 0,
  pages: 0,
  invalidCount: 0,
  warnings: [],
  cursors: [],
  fingerprints: [],
});
async function digest(text: string): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export { digest as sessionDigest };
export type ScanProvider = Pick<
  ApifyClient,
  | 'getReviewedPricing'
  | 'start'
  | 'getRun'
  | 'abortRun'
  | 'readDatasetPage'
  | 'deleteDataset'
  | 'deleteKeyValueStore'
  | 'deleteRequestQueue'
  | 'deleteRun'
>;
/** Local erasure needs only D1, even if provider credentials/configuration fail. */
export async function eraseExpiredJobs(
  store: JobStore<ScanJob>,
  now: number,
): Promise<number> {
  let removed = 0;
  await store.pruneReceipts(now);
  for (const row of await store.expired(now)) {
    const minimal = row.payload.cleanup.map((run) => ({
      id: run.id,
      payload: JSON.stringify({
        id: run.id,
        status: run.status,
        defaultDatasetId: run.defaultDatasetId,
        defaultKeyValueStoreId: run.defaultKeyValueStoreId,
        defaultRequestQueueId: run.defaultRequestQueueId,
      }),
    }));
    await store.removeExpired(row.id, now, minimal);
    removed++;
  }
  return removed;
}
export class ScanService {
  constructor(
    private readonly store: JobStore<ScanJob>,
    private readonly provider: ScanProvider,
    private readonly config: JobConfig,
    private readonly capacity: () => Promise<FreeCapacity>,
    private readonly now: () => number = Date.now,
  ) {
    if (
      ![
        config.windowUsd,
        config.jobUsd,
        config.runUsd,
        config.reserveUsd,
      ].every((n) => Number.isFinite(n) && n > 0) ||
      config.runUsd > config.jobUsd ||
      config.jobUsd > config.windowUsd
    )
      throw new Error('Automatic capacity settings are invalid.');
  }
  async create(
    session: string,
    key: string,
    username: string,
  ): Promise<ScanProgress> {
    if (!/^[0-9a-f-]{36}$/i.test(key))
      throw new Error('A unique scan request key is required.');
    const account = normalizeUsername(username);
    const existing = await this.store.find(session, key, this.now());
    if (existing) {
      if (existing.payload.username !== account)
        throw new Error('This request key belongs to another account.');
      return this.status(session, existing.id);
    }
    const free = await this.capacity();
    if (free.remainingUsd < this.config.jobUsd + this.config.reserveUsd)
      throw new CapacityError();
    const now = this.now(),
      id = crypto.randomUUID();
    const payload: ScanJob = {
      username: account,
      status: 'queued',
      message: 'Ready to retrieve public relationship lists.',
      startedAt: new Date(now).toISOString(),
      finishedAt: null,
      spentMicros: 0,
      budgetMicros: micros(this.config.jobUsd),
      nextAt: 0,
      retries: 0,
      stage: 'ready',
      direction: 'followers',
      run: null,
      datasetOffset: 0,
      runRawCount: 0,
      runEnvelopes: 0,
      runCursor: null,
      runTerminal: null,
      runInvalid: 0,
      cleanup: [],
      followers: directionState(),
      following: directionState(),
    };
    const jobId = await this.store.create({
      id,
      session,
      key,
      period: free.period,
      ceiling: micros(
        Math.min(
          this.config.windowUsd,
          free.recurringCreditsUsd - this.config.reserveUsd,
        ),
      ),
      reservation: payload.budgetMicros,
      payload,
      expiresAt: Math.min(now + 3600000, Date.parse(free.endsAt)),
      now,
    });
    if ((await this.owned(session, jobId)).payload.username !== account)
      throw new Error(
        'This request key belongs to another scan. Start a new request explicitly.',
      );
    return this.status(session, jobId);
  }
  private async owned(session: string, id: string) {
    const job = await this.store.get(id, session, this.now());
    if (!job) throw new Error('SCAN_NOT_FOUND');
    return job;
  }
  async status(session: string, id: string): Promise<ScanProgress> {
    const row = await this.owned(session, id),
      job = row.payload;
    return {
      id,
      status: job.status,
      message:
        row.cancelRequested && !terminal(job.status)
          ? 'Cancellation requested. The current bounded step is finishing.'
          : job.message,
      nextPollMs: Math.max(1500, job.nextAt - this.now()),
      expiresAt: new Date(row.expiresAt).toISOString(),
      followers: {
        observed: job.followers.uniqueCount,
        pages: job.followers.pages,
        complete: job.followers.terminal,
      },
      following: {
        observed: job.following.uniqueCount,
        pages: job.following.pages,
        complete: job.following.terminal,
      },
    };
  }
  async advance(session: string, id: string): Promise<ScanProgress> {
    let row = await this.owned(session, id);
    if (terminal(row.payload.status) || row.payload.nextAt > this.now())
      return this.status(session, id);
    const lease = await this.store.claim(id, session, this.now());
    if (!lease) return this.status(session, id);
    row = await this.owned(session, id);
    const job = row.payload;
    try {
      if (row.cancelRequested)
        return await this.stop(
          id,
          lease,
          job,
          'cancelled',
          'Scan cancelled; observed records remain incomplete.',
          true,
          session,
        );
      if (job.stage === 'starting') {
        // A checkpoint before a lost start response MUST NOT cause another charged run.
        return await this.stop(
          id,
          lease,
          job,
          'uncertain',
          'A provider start could not be reconciled. The service operator must review it; no duplicate run will be started.',
          true,
          session,
        );
      }
      if (this.now() - Date.parse(job.startedAt) > 20 * 60000)
        return await this.stop(
          id,
          lease,
          job,
          'partial',
          'The scan time budget ended. Observed records remain available without confirmed absence classifications.',
          true,
          session,
        );
      if (job.stage === 'ready') {
        const free = await this.capacity();
        if (
          free.remainingUsd < this.config.runUsd + this.config.reserveUsd ||
          job.spentMicros + micros(this.config.runUsd) > job.budgetMicros
        )
          return await this.stop(
            id,
            lease,
            job,
            'partial',
            'The free service capacity was reached before collection finished. No incomplete list is treated as complete.',
            false,
            session,
          );
        const pricing = await this.provider.getReviewedPricing(this.now());
        if ((pricing.minimalMaxTotalChargeUsd ?? 0) > this.config.runUsd)
          throw new Error('Provider minimum exceeds the approved run budget.');
        job.terminalHeadroomMicros = micros(
          pricing.eventPriceUsd['user-batch-50'] +
            pricing.eventPriceUsd['apify-default-dataset-item'],
        );
        job.stage = 'starting';
        job.status = 'running';
        job.message = `Retrieving ${job.direction}.`;
        await this.store.save(id, lease, job, false);
        job.run = await this.provider.start({
          username: job.username,
          direction: job.direction,
          upstreamCursor: job[job.direction].cursor,
          maxItems: 500,
          maxTotalChargeUsd: this.config.runUsd,
          timeoutSecs: 120,
          build: APIFY_BUILD_NUMBER,
        });
        job.cleanup.push(job.run);
        if (job.run.buildId !== APIFY_BUILD_ID)
          return await this.stop(
            id,
            lease,
            job,
            'partial',
            'The provider build changed. Observed data is retained for review without assuming completeness.',
            true,
            session,
          );
        job.stage = 'polling';
        job.nextAt = this.now() + 2000;
        job.retries = 0;
      } else if (job.stage === 'polling') {
        if (!job.run) throw new Error('Missing durable provider run.');
        const run = await this.provider.getRun(job.run.id);
        job.run = run;
        job.cleanup = job.cleanup.map((item) =>
          item.id === run.id ? run : item,
        );
        if (
          ['READY', 'RUNNING', 'TIMING-OUT', 'ABORTING'].includes(run.status)
        ) {
          job.nextAt = this.now() + 2000;
        } else {
          if (run.usageTotalUsd === null)
            return await this.stop(
              id,
              lease,
              job,
              'partial',
              'Provider credit usage is unavailable. Collection stopped safely for operator review.',
              true,
              session,
            );
          job.spentMicros += micros(run.usageTotalUsd);
          if (run.status !== 'SUCCEEDED' || !run.defaultDatasetId)
            return await this.stop(
              id,
              lease,
              job,
              'partial',
              'The provider could not finish this page. Any observed records remain provisional.',
              false,
              session,
            );
          job.stage = 'dataset';
          job.datasetOffset = 0;
          job.runRawCount = 0;
          job.runEnvelopes = 0;
          job.runCursor = null;
          job.runTerminal = null;
          job.runInvalid = 0;
          job.nextAt = 0;
        }
      } else if (job.stage === 'dataset') {
        if (!job.run?.defaultDatasetId)
          throw new Error('Missing durable provider dataset.');
        const page = await this.provider.readDatasetPage(
          job.run.defaultDatasetId,
          { offset: job.datasetOffset, limit: 10 },
        );
        const normalized = normalizeAcquisitionEnvelopes(
          page.items,
          job.direction,
          { requestedMaxItems: 500, inputCursor: job[job.direction].cursor },
        );
        const state = job[job.direction];
        const fingerprint = await digest(
          JSON.stringify(
            normalized.records.map((record) => [
              record.id ?? '',
              record.username,
            ]),
          ),
        );
        if (
          normalized.records.length &&
          state.fingerprints.includes(fingerprint)
        )
          return await this.stop(
            id,
            lease,
            job,
            'partial',
            'The provider repeated a relationship page. Collection stopped without confirming missing accounts.',
            false,
            session,
          );
        if (normalized.records.length) state.fingerprints.push(fingerprint);
        state.uniqueCount = await this.store.addRecords(
          id,
          lease,
          job.direction,
          normalized.records,
        );
        state.rawCount += normalized.rawRecordCount;
        state.invalidCount += normalized.invalidRecordCount;
        state.warnings = [
          ...new Set([...state.warnings, ...normalized.warnings]),
        ];
        job.runRawCount += normalized.rawRecordCount;
        job.runEnvelopes += normalized.envelopeCount;
        job.runCursor = normalized.upstreamCursor;
        job.runTerminal = normalized.upstreamTerminal;
        job.runInvalid += normalized.invalidRecordCount;
        if (!page.exhausted) {
          if (page.nextOffset === null || page.nextOffset <= job.datasetOffset)
            throw new Error('Invalid dataset continuation.');
          job.datasetOffset = page.nextOffset;
        } else {
          state.pages++;
          if (job.runCursor) {
            const cursorHash = await digest(job.runCursor);
            if (
              state.cursors.includes(cursorHash) ||
              job.runCursor === state.cursor
            )
              return await this.stop(
                id,
                lease,
                job,
                'partial',
                'The provider repeated a continuation cursor. Observed lists remain incomplete.',
                false,
                session,
              );
            state.cursors.push(cursorHash);
            state.cursor = job.runCursor;
          } else if (
            job.runTerminal === true &&
            job.runEnvelopes === 1 &&
            job.runRawCount < 500 &&
            state.invalidCount === 0 &&
            !!this.config.terminalEvidenceId?.trim() &&
            job.run.usageTotalUsd !== null &&
            micros(job.run.usageTotalUsd) +
              (job.terminalHeadroomMicros ?? Infinity) <=
              micros(this.config.runUsd)
          ) {
            state.terminal = true;
          } else
            return await this.stop(
              id,
              lease,
              job,
              'partial',
              'The provider did not establish a complete upstream list. Observed records are available with uncertainty.',
              false,
              session,
            );
          job.stage = 'cleanup';
          job.nextAt = 0;
        }
      } else if (job.stage === 'cleanup') {
        await this.cleanRuns(job);
        job.run = null;
        job.stage = 'ready';
        job.nextAt = 0;
        if (job.followers.terminal) job.direction = 'following';
        if (job.followers.terminal && job.following.terminal)
          return await this.stop(
            id,
            lease,
            job,
            'complete',
            'Both source lists reached explicit completion. Results describe the observed collection window.',
            false,
            session,
          );
      }
      if ((await this.owned(session, id)).cancelRequested)
        return await this.stop(
          id,
          lease,
          job,
          'cancelled',
          'Scan cancelled; observed records remain incomplete.',
          true,
          session,
        );
      job.retries = 0;
      await this.store.save(id, lease, job);
      return this.status(session, id);
    } catch (error) {
      if (
        error instanceof ApifyAdapterError &&
        error.startOutcome === 'unknown'
      )
        return this.stop(
          id,
          lease,
          job,
          'uncertain',
          'The provider start response was lost. No automatic retry will create a duplicate run; operator reconciliation is required.',
          true,
          session,
        );
      if (
        error instanceof ApifyAdapterError &&
        error.startOutcome === 'not-started'
      )
        job.stage = 'ready';
      if (
        error instanceof ApifyAdapterError &&
        error.retryable &&
        job.retries < 3 &&
        job.stage !== 'starting'
      ) {
        job.retries++;
        job.nextAt =
          this.now() +
          Math.max(
            2000 * 2 ** job.retries,
            (error.retryAfterSeconds ?? 0) * 1000,
          );
        job.message =
          'The provider is temporarily unavailable. Retrying the existing page after a bounded delay.';
        await this.store.save(id, lease, job);
        return this.status(session, id);
      }
      return this.stop(
        id,
        lease,
        job,
        'partial',
        'The source request could not be completed safely. Observed records remain available without confirmed absence classifications.',
        job.stage === 'starting',
        session,
      );
    }
  }
  private async stop(
    id: string,
    lease: string,
    job: ScanJob,
    status: ScanStatus,
    message: string,
    uncertain: boolean,
    session: string,
  ): Promise<ScanProgress> {
    job.status = status;
    job.message = message;
    job.finishedAt = new Date(this.now()).toISOString();
    job.nextAt = 0;
    // A failed/unfinished abort can still consume credits. Do not release its
    // reservation as known zero usage simply because collection has stopped.
    if (
      job.cleanup.some(
        (run) =>
          ['READY', 'RUNNING', 'TIMING-OUT', 'ABORTING'].includes(run.status) ||
          run.usageTotalUsd === null,
      )
    )
      uncertain = true;
    try {
      await this.cleanRuns(job);
    } catch {
      uncertain = true;
      job.message +=
        ' Provider cleanup is pending; expired local records are erased independently.';
    }
    await this.store.finish(id, lease, job, uncertain);
    return this.status(session, id);
  }
  private async cleanRuns(job: { cleanup: ApifyRun[] }): Promise<void> {
    for (const old of [...job.cleanup]) {
      let run = old;
      if (['READY', 'RUNNING', 'TIMING-OUT', 'ABORTING'].includes(run.status)) {
        run = await this.provider.abortRun(run.id);
        job.cleanup = job.cleanup.map((item) =>
          item.id === run.id ? run : item,
        );
        if (
          !['ABORTED', 'TIMED-OUT', 'FAILED', 'SUCCEEDED'].includes(run.status)
        )
          throw new Error('Provider abort is pending.');
      }
      const remove = async (action: () => Promise<void>) => {
        try {
          await action();
        } catch (error) {
          if (!(error instanceof ApifyAdapterError && error.status === 404))
            throw error;
        }
      };
      if (run.defaultDatasetId)
        await remove(() => this.provider.deleteDataset(run.defaultDatasetId!));
      if (run.defaultKeyValueStoreId)
        await remove(() =>
          this.provider.deleteKeyValueStore(run.defaultKeyValueStoreId!),
        );
      if (run.defaultRequestQueueId)
        await remove(() =>
          this.provider.deleteRequestQueue(run.defaultRequestQueueId!),
        );
      await remove(() => this.provider.deleteRun(run.id));
      job.cleanup = job.cleanup.filter((item) => item.id !== run.id);
    }
  }
  async cancel(session: string, id: string): Promise<ScanProgress> {
    const row = await this.owned(session, id);
    if (terminal(row.payload.status)) return this.status(session, id);
    await this.store.requestCancel(id, session, this.now());
    const lease = await this.store.claim(id, session, this.now());
    if (!lease) return this.status(session, id);
    const job = (await this.owned(session, id)).payload;
    return this.stop(
      id,
      lease,
      job,
      'cancelled',
      'Scan cancelled. Observed records are incomplete; confirmed absence classifications are withheld.',
      true,
      session,
    );
  }
  async resultPage(
    session: string,
    id: string,
    direction: Direction,
    offset: number,
  ): Promise<{
    records: AccountRecord[];
    nextOffset: number | null;
    dataset: Dataset;
  }> {
    const row = await this.owned(session, id),
      job = row.payload;
    if (!terminal(job.status)) throw new Error('SCAN_NOT_READY');
    const records = await this.store.records(id, direction, offset);
    const list = (d: Direction): AccountList => ({
      records: [],
      metadata: {
        source: APIFY_ACTOR_NAME,
        version: APIFY_BUILD_NUMBER,
        startedAt: job.startedAt,
        endedAt: job.finishedAt,
        rawCount: job[d].rawCount,
        uniqueCount: job[d].uniqueCount,
        completeness:
          job.status === 'complete' && job[d].terminal
            ? 'complete_for_source'
            : 'partial',
        terminal: job.status === 'complete' && job[d].terminal,
        pages: job[d].pages,
        warnings: job[d].warnings,
        skippedCount: job[d].invalidCount,
      },
    });
    return {
      records,
      nextOffset: records.length === 200 ? offset + 200 : null,
      dataset: {
        schemaVersion: 1,
        comparisonBasis: 'source_evidence',
        account: { username: job.username },
        sample: false,
        importedAt: job.finishedAt ?? job.startedAt,
        followers: list('followers'),
        following: list('following'),
      },
    };
  }
  async cleanupExpired(): Promise<{ removed: number; pending: number }> {
    const removed = await eraseExpiredJobs(this.store, this.now());
    let pending = 0;
    for (const item of await this.store.pendingCleanup(this.now())) {
      try {
        await this.cleanRuns({
          cleanup: [JSON.parse(item.payload) as ApifyRun],
        });
        await this.store.finishCleanup(item.id);
      } catch {
        await this.store.retryCleanup(item.id, this.now());
        pending++;
      }
    }
    return { removed, pending };
  }
}
export const capacityReader = (token: string) => () => readFreeCapacity(token);
