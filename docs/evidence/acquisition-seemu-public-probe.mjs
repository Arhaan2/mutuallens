// Read-only public metadata probe. No token, account route, Actor start or
// Instagram request. Raw HTML/metadata is hashed in memory, never persisted.
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const actorUrl = 'https://api.apify.com/v2/acts/seemuapps~instagram-followers-scraper';
const buildUrl = `${actorUrl}/builds/default`;
const issueUrl = 'https://apify.com/seemuapps/instagram-followers-scraper/issues/question-pricing-x83vCvl0FjgjxiPyN';
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
async function read(url) {
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Public source returned HTTP ${response.status}`);
  const text = await response.text();
  return { url, status: response.status, retrievedAt: new Date().toISOString(), sha256: sha256(text), text };
}
const [actor, build, issue] = await Promise.all([read(actorUrl), read(buildUrl), read(issueUrl)]);
const a = JSON.parse(actor.text).data;
const b = JSON.parse(build.text).data;
const schema = typeof b.inputSchema === 'string' ? JSON.parse(b.inputSchema) : b.inputSchema;
const source = ({ url, status, retrievedAt, sha256 }) => ({ url, httpStatus: status, retrievedAt, sha256 });
const now = Date.now();
const activePricing = a.pricingInfos.filter((info) => Date.parse(info.startedAt) <= now && (!info.endedAt || Date.parse(info.endedAt) > now)).at(-1);
const prices = Object.fromEntries(Object.entries(activePricing.pricingPerEvent.actorChargeEvents).map(([name, value]) => [name, {
  eventPriceUsd: value.eventPriceUsd,
  isOneTimeEvent: value.isOneTimeEvent ?? false,
}]));
// Read hydration as inert JSON strings, never execute downloaded JavaScript.
const hydration = [...issue.text.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)]
  .flatMap((match) => { try { const value = JSON.parse(match[1]); return typeof value[1] === 'string' ? [value[1]] : []; } catch { return []; } })
  .join('\n');
const issueHasVendorBatchConfirmation = hydration.includes('1,000 batches') && hydration.includes('50,000 followers');
const issueHasPartialBatchRounding = hydration.includes('fewer than 50 users') && hydration.includes('still counts as one batch');
const evidence = {
  evidenceType: 'PUBLIC_DOCUMENTATION_AND_METADATA_ONLY',
  liveActorRuns: 0, credentialedAccountRequests: 0, instagramTargetRequests: 0,
  publicActor: {
    ...source(actor), actorId: a.id, name: a.name, username: a.username,
    modifiedAt: a.modifiedAt, isSourceCodeHidden: a.isSourceCodeHidden,
    actorPermissionLevel: a.actorPermissionLevel, defaultRunOptions: a.defaultRunOptions,
    pricing: { model: activePricing.pricingModel, startedAt: activePricing.startedAt, minimalMaxTotalChargeUsd: activePricing.minimalMaxTotalChargeUsd, events: prices },
  },
  publicBuild: {
    ...source(build), id: b.id, buildNumber: b.buildNumber, status: b.status,
    statusScope: 'ACTOR_BUILD_ONLY_NOT_SCRAPING_RUN', finishedAt: b.finishedAt,
    inputSchemaVersion: schema.schemaVersion, inputSchemaSha256: sha256(JSON.stringify(schema)),
    inputFields: Object.fromEntries(Object.entries(schema.properties).map(([name, field]) => [name, {
      type: field.type, default: field.default, minimum: field.minimum, enum: field.enum,
    }])),
  },
  pricingIssue: {
    ...source(issue), issueId: 'x83vCvl0FjgjxiPyN',
    vendorReplyDateObserved: '2026-07-21T02:49:45.673Z',
    issueHasVendorBatchConfirmation, issueHasPartialBatchRounding,
    paraphrase: 'The vendor confirms billing by batches of 50 identities, with a partially filled batch billed as a whole batch. This is a vendor explanation, not measured account-specific usage.',
  },
};
if (a.id !== '2nsQrloj1Sl16uh4z' || b.id !== 'qZHBzZiV6QmFCKDym' || b.buildNumber !== '1.0.35') throw new Error('Public Actor/build changed; review adapter pin before integration.');
if (!issueHasVendorBatchConfirmation || !issueHasPartialBatchRounding) throw new Error('Public pricing clarification could not be re-observed.');
await writeFile(new URL('./acquisition-seemu-public-metadata.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'PUBLIC_METADATA_READ_ONLY', actor: a.id, build: b.buildNumber, issueBatchConfirmation: issueHasVendorBatchConfirmation, liveRuns: 0 })}\n`);
