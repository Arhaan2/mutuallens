// Public metadata only. Fixed unauthenticated GETs; no target, token or run.
// Raw provider content is hashed in memory and never saved or printed.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const actorUrl =
  'https://api.apify.com/v2/acts/seemuapps~instagram-followers-scraper';
const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');
async function read(url) {
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Public metadata body unavailable');
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('Public metadata exceeded fixed response bound');
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  const source = {
    url,
    httpStatus: response.status,
    retrievedAt: new Date().toISOString(),
    sha256: sha256(raw),
  };
  if (!response.ok) return { source, data: null };
  return { source, data: JSON.parse(raw.toString('utf8')).data };
}
const [actor, build] = await Promise.all([
  read(actorUrl),
  read(`${actorUrl}/builds/default`),
]);
const a = actor.data;
const b = build.data;
const activePricing = a?.pricingInfos?.filter(
  (price) =>
    Date.parse(price.startedAt) <= Date.now() &&
    (!price.endedAt || Date.parse(price.endedAt) > Date.now()),
);
const schema =
  typeof b?.inputSchema === 'string'
    ? JSON.parse(b.inputSchema)
    : b?.inputSchema;
const evidence = {
  evidenceType: 'PUBLIC_METADATA_ONLY',
  liveActorRuns: 0,
  credentialedAccountRequests: 0,
  instagramTargetRequests: 0,
  publicActor: {
    ...actor.source,
    actorId: a?.id ?? null,
    modifiedAt: a?.modifiedAt ?? null,
    actorPermissionLevel: a?.actorPermissionLevel ?? null,
    isSourceCodeHidden: a?.isSourceCodeHidden ?? null,
    pricing: activePricing?.map((price) => ({
      model: price.pricingModel,
      startedAt: price.startedAt,
      minimalMaxTotalChargeUsd: price.minimalMaxTotalChargeUsd ?? null,
      events: Object.fromEntries(
        Object.entries(price.pricingPerEvent?.actorChargeEvents ?? {}).map(
          ([name, event]) => [
            name,
            {
              eventPriceUsd: event.eventPriceUsd,
              isOneTimeEvent: event.isOneTimeEvent ?? false,
            },
          ],
        ),
      ),
    })) ?? null,
  },
  publicBuild: {
    ...build.source,
    id: b?.id ?? null,
    buildNumber: b?.buildNumber ?? null,
    status: b?.status ?? null,
    statusScope: 'ACTOR_BUILD_ONLY_NOT_SCRAPING_RUN',
    finishedAt: b?.finishedAt ?? null,
    inputSchemaVersion: schema?.schemaVersion ?? null,
    inputSchemaSha256: schema ? sha256(JSON.stringify(schema)) : null,
    inputFields: schema
      ? Object.fromEntries(
          Object.entries(schema.properties).map(([name, field]) => [
            name,
            {
              type: field.type,
              default: field.default,
              minimum: field.minimum,
              enum: field.enum,
            },
          ]),
        )
      : null,
  },
};
await writeFile(
  new URL('./acquisition-ship-public-metadata.json', import.meta.url),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
process.stdout.write(
  `${JSON.stringify({
    status: 'PUBLIC_METADATA_READ_ONLY',
    actorHttpStatus: actor.source.httpStatus,
    buildHttpStatus: build.source.httpStatus,
    build: b?.buildNumber ?? null,
    liveRuns: 0,
  })}\n`,
);
