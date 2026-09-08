import { Buffer } from 'node:buffer';
import { webcrypto as crypto } from 'node:crypto';
// Independent synthetic regression probe. No server, provider, account or network.
// The lead's in-progress engine is bundled in memory; source files are read only.
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = '/Users/arhaan/Documents/ChatGPT/mutuallens';
const result = await build({ stdin: { contents: "export {ScanService} from './packages/acquisition/src/jobs.ts'; export {JobStore} from './packages/acquisition/src/store.ts'; export {APIFY_ACTOR_ID, APIFY_BUILD_ID} from './packages/acquisition/src/apify.ts';", resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false });
const { ScanService, JobStore, APIFY_ACTOR_ID, APIFY_BUILD_ID } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const migration = await readFile(`${root}/packages/acquisition/migrations/0001_jobs.sql`, 'utf8');
function setup({ failDelete = false, failRunRead = false, failAbort = false, charge = 0.04506, pageSize = 250 } = {}) {
  const db = new DatabaseSync(':memory:'); db.exec(migration);
  const driver = { async batch(queries) {
    db.exec('BEGIN IMMEDIATE');
    try { const rows = queries.map(query => ({ rows: db.prepare(query.sql).all(...query.values), changes: Number(db.prepare('SELECT changes() AS n').get().n) })); db.exec('COMMIT'); return rows; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } };
  let time = Date.parse('2026-09-08T00:00:00.000Z'), direction = 'followers', runs = 0;
  const run = (id, status) => ({ id, actorId: APIFY_ACTOR_ID, buildId: APIFY_BUILD_ID, status, statusMessage: 'Synthetic provider', defaultDatasetId: `${id}Dataset`, defaultKeyValueStoreId: null, defaultRequestQueueId: null, startedAt: '2026-09-08T00:00:00.000Z', finishedAt: status === 'RUNNING' ? null : '2026-09-08T00:00:01.000Z', usageTotalUsd: charge, chargedEventCounts: { 'apify-actor-start': 1, 'apify-default-dataset-item': 1, 'user-batch-50': 5 }, datasetItemCount: 1 });
  const provider = {
    async getReviewedPricing() { return { actorId: APIFY_ACTOR_ID, pricingModel: 'PAY_PER_EVENT', startedAt: '2026-04-12T12:56:41.164Z', checkedAt: new Date(time).toISOString(), eventPriceUsd: { 'apify-actor-start': 0.00005, 'apify-default-dataset-item': 0.00001, 'user-batch-50': 0.009 }, minimalMaxTotalChargeUsd: null, freeTierDiscountPercent: null, userPaysActorPlatformUsage: null }; },
    async start(input) { direction = input.direction; return run(`SyntheticRun${++runs}`, 'RUNNING'); },
    async getRun(id) { if (failRunRead) throw new Error('Synthetic run read unavailable'); return run(id, 'SUCCEEDED'); }, async abortRun(id) { if (failAbort) throw new Error('Synthetic abort unavailable'); return run(id, 'ABORTED'); },
    async readDatasetPage() { return { items: [{ results: Array.from({ length: pageSize }, (_, index) => ({ username: `synthetic_${index}`, userId: String(index), relation: direction === 'followers' ? 'follower' : 'following' })), cursor_next: null }], offset: 0, count: 1, total: 1, nextOffset: null, exhausted: true }; },
    async deleteDataset() { if (failDelete) throw new Error('Synthetic provider offline'); }, async deleteKeyValueStore() {}, async deleteRequestQueue() {}, async deleteRun() {},
  };
  const service = new ScanService(new JobStore(driver), provider, { windowUsd: 4.5, jobUsd: 3, runUsd: 0.05, reserveUsd: 0.5, terminalEvidenceId: 'synthetic-test-evidence-not-live-approval' }, async () => ({ period: '2026-09-01', endsAt: '2026-10-01T00:00:00.000Z', recurringCreditsUsd: 5, usedUsd: 0, remainingUsd: 5, retentionDays: 7 }), () => time);
  return { db, service, tick: () => { time += 3000; }, expire: () => { time += 3600001; }, runs: () => runs };
}
const evidence = { type: 'SYNTHETIC_INDEPENDENT_ENGINE_REGRESSION', retrievedAt: new Date().toISOString(), liveRuns: 0, sourceHashes: {}, findings: [] };
for (const name of ['jobs.ts', 'store.ts']) evidence.sourceHashes[name] = createHash('sha256').update(await readFile(`${root}/packages/acquisition/src/${name}`)).digest('hex');
{
  const test = setup(); let progress = await test.service.create('synthetic-session', crypto.randomUUID(), 'synthetic_target');
  for (let index = 0; index < 20 && !['complete', 'partial', 'failed', 'uncertain'].includes(progress.status); index++) { test.tick(); progress = await test.service.advance('synthetic-session', progress.id); }
  evidence.findings.push({ case: 'successful charge-limited 250-record null-cursor fixture; next .009 batch cannot fit .05 ceiling', status: progress.status, followersComplete: progress.followers.complete, followingComplete: progress.following.complete, syntheticRunStarts: test.runs(), passesConservativeGate: progress.status !== 'complete' });
  test.db.close();
}
{
  const test = setup({ failDelete: true, pageSize: 1 }); let progress = await test.service.create('synthetic-session', crypto.randomUUID(), 'synthetic_target');
  for (let index = 0; index < 3; index++) { test.tick(); progress = await test.service.advance('synthetic-session', progress.id); }
  const before = Number(test.db.prepare('SELECT COUNT(*) AS n FROM records').get().n);
  test.expire(); const cleanup = await test.service.cleanupExpired();
  const after = Number(test.db.prepare('SELECT COUNT(*) AS n FROM records').get().n);
  evidence.findings.push({ case: 'expired graph with provider deletion unavailable', recordsBeforeExpiry: before, cleanup, recordsAfterCleanup: after, passesLocalErasureGate: after === 0 });
  test.db.close();
}
{
  const test = setup({ failRunRead: true, failAbort: true }); let progress = await test.service.create('synthetic-session', crypto.randomUUID(), 'synthetic_target');
  for (let index = 0; index < 2; index++) { test.tick(); progress = await test.service.advance('synthetic-session', progress.id); }
  const ledger = test.db.prepare('SELECT spent,reserved FROM capacity').get();
  evidence.findings.push({ case: 'provider run read and abort both unavailable after successful start', status: progress.status, ledger, passesUncertainReservationGate: Number(ledger.spent) + Number(ledger.reserved) >= 3000000 });
  test.db.close();
}
await writeFile(new URL('./acquisition-seemu-engine-probe.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence.findings, null, 2)}\n`);
