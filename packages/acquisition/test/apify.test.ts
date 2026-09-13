import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APIFY_ACTOR_ID,
  APIFY_BUILD_ID,
  APIFY_REVIEWED_ACTOR_MODIFIED_AT,
  APIFY_REVIEWED_EVENT_PRICE_USD,
  APIFY_STARTS_REVIEWED,
  ApifyAdapterError,
  ApifyClient,
  normalizeAcquisitionEnvelopes,
  normalizeApifyRun,
  normalizeReviewedPricing,
  type ApifyStartInput,
} from '../src/apify';

// Synthetic HTTP/schema fixtures only. No provider credential, Actor run,
// Instagram account or live acquisition acceptance is represented here.
const syntheticToken = 'synthetic-test-token';
const pricingNow = Date.parse('2026-09-08T00:00:00.000Z');
const pricingPayload = () => ({
  data: {
    id: APIFY_ACTOR_ID,
    modifiedAt: APIFY_REVIEWED_ACTOR_MODIFIED_AT,
    actorPermissionLevel: 'LIMITED_PERMISSIONS',
    pricingInfos: [
      {
        startedAt: '2026-04-12T12:56:41.164Z',
        pricingModel: 'PAY_PER_EVENT',
        minimalMaxTotalChargeUsd: null,
        pricingPerEvent: {
          actorChargeEvents: Object.fromEntries(
            Object.entries(APIFY_REVIEWED_EVENT_PRICE_USD).map(
              ([name, price]) => [
                name,
                {
                  eventPriceUsd: Number(price),
                  isOneTimeEvent: name === 'apify-actor-start',
                },
              ],
            ),
          ),
        },
      },
    ],
  },
});
const runId = 'SyntheticRun123';
const datasetId = 'SyntheticDataset123';
const startInput: ApifyStartInput = {
  username: '@Synthetic_Target',
  direction: 'followers',
  maxItems: 200,
  maxTotalChargeUsd: 0.05,
};
const runPayload = (overrides: Record<string, unknown> = {}) => ({
  data: {
    id: runId,
    actId: APIFY_ACTOR_ID,
    buildId: APIFY_BUILD_ID,
    status: 'RUNNING',
    defaultDatasetId: datasetId,
    defaultKeyValueStoreId: 'SyntheticStore123',
    defaultRequestQueueId: 'SyntheticQueue123',
    startedAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  },
});
const json = (value: unknown, options: ResponseInit = {}) =>
  new Response(JSON.stringify(value), {
    ...options,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...options.headers,
    },
  });
const mockClient = (
  response: () => Response | Promise<Response>,
  options: { requestTimeoutMs?: number; maxResponseBytes?: number } = {},
) => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async () => response());
  return {
    fetch,
    client: new ApifyClient({ token: syntheticToken, fetch, ...options }),
  };
};
const syntheticRow = (
  id: number,
  relation: 'follower' | 'following' = 'follower',
) => ({
  userId: String(id),
  username: `synthetic_${id}`,
  relation,
  displayName: `Synthetic ${id}`,
  isPrivate: false,
  isVerified: false,
  profilePicUrl: 'https://external.invalid/do-not-fetch.jpg',
});
const datasetResponse = (
  items: unknown[],
  offset = 0,
  total = items.length,
  headerOverrides: Record<string, string> = {},
) =>
  json(items, {
    headers: {
      'x-apify-pagination-offset': String(offset),
      'x-apify-pagination-count': String(items.length),
      'x-apify-pagination-limit': '100',
      'x-apify-pagination-total': String(total),
      ...headerOverrides,
    },
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('server-only pinned Apify HTTP transport (synthetic)', () => {
  it('disables every chargeable start after the documented provider capability and cursor change', async () => {
    const { client, fetch } = mockClient(() => json(runPayload()));
    expect(APIFY_STARTS_REVIEWED).toBe(false);
    await expect(client.start(startInput)).rejects.toMatchObject({
      code: 'CONFIGURATION',
      startOutcome: 'not-started',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { maxItems: 0 },
    { maxItems: 501 },
    { maxItems: Infinity },
    { maxItems: 1.5 },
    { maxTotalChargeUsd: 0 },
    { maxTotalChargeUsd: -1 },
    { maxTotalChargeUsd: NaN },
    { timeoutSecs: 0 },
    { timeoutSecs: 301 },
    { build: 'latest' },
    { direction: 'both' },
    { username: 'https://instagram.com/synthetic_target/' },
    { upstreamCursor: '' },
    { upstreamCursor: '\n' },
    { upstreamCursor: 'x'.repeat(8193) },
  ])(
    'rejects an unbounded or ambiguous run input before HTTP: %j',
    async (override) => {
      const { client, fetch } = mockClient(() => json(runPayload()));
      await expect(
        client.start({ ...startInput, ...override } as ApifyStartInput),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('rejects browser instantiation and invalid private configuration', () => {
    vi.stubGlobal('window', {});
    expect(() => new ApifyClient({ token: syntheticToken })).toThrow(
      /server-only/,
    );
    vi.unstubAllGlobals();
    for (const token of ['', ' ', 'has whitespace'])
      expect(() => new ApifyClient({ token })).toThrow(ApifyAdapterError);
    expect(
      () => new ApifyClient({ token: syntheticToken, requestTimeoutMs: 30001 }),
    ).toThrow(ApifyAdapterError);
    expect(
      () =>
        new ApifyClient({
          token: syntheticToken,
          maxResponseBytes: 17 * 1024 * 1024,
        }),
    ).toThrow(ApifyAdapterError);
  });

  it('reports retryability for safe read failures without implementing a retry loop', async () => {
    const { client, fetch } = mockClient(() =>
      json({}, { status: 429, headers: { 'retry-after': '3' } }),
    );
    await expect(client.getRun(runId)).rejects.toMatchObject({
      code: 'PROVIDER_RATE_LIMIT',
      retryable: true,
      startOutcome: null,
      retryAfterSeconds: 3,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sanitizes thrown transport failures', async () => {
    const { client, fetch } = mockClient(() =>
      Promise.reject(new Error(`Connection lost ${syntheticToken}`)),
    );
    const error = await client.getRun(runId).catch((error) => error);
    expect(error).toMatchObject({
      code: 'PROVIDER_TRANSPORT',
      startOutcome: null,
      retryable: true,
    });
    expect(String(error)).not.toContain(syntheticToken);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('bounds fetch duration even when an injected transport ignores AbortSignal', async () => {
    vi.useFakeTimers();
    const { client, fetch } = mockClient(() => new Promise(() => {}), {
      requestTimeoutMs: 100,
    });
    const check = expect(client.getRun(runId)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
      startOutcome: null,
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(100);
    await check;
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds stalled response streams and cancels them', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{'));
      },
      cancel,
    });
    const { client } = mockClient(
      () =>
        new Response(body, { headers: { 'content-type': 'application/json' } }),
      { requestTimeoutMs: 100 },
    );
    const check = expect(client.getRun(runId)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(100);
    await check;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([true, false])(
    'bounds response bytes with declared length present=%s',
    async (declared) => {
      const body = JSON.stringify(runPayload());
      const { client } = mockClient(
        () =>
          new Response(body, {
            headers: {
              'content-type': 'application/json',
              ...(declared ? { 'content-length': String(body.length) } : {}),
            },
          }),
        { maxResponseBytes: 20 },
      );
      await expect(client.getRun(runId)).rejects.toMatchObject({
        code: 'PROVIDER_RESPONSE_TOO_LARGE',
        startOutcome: null,
      });
    },
  );

  it('rejects invalid UTF-8 before parsing JSON', async () => {
    const { client } = mockClient(
      () =>
        new Response(new Uint8Array([0xff, 0xfe]), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(client.getRun(runId)).rejects.toMatchObject({
      code: 'PROVIDER_RESPONSE_INVALID',
    });
  });

  it('matches requested run IDs and aborts immediately without resurrection', async () => {
    const { client, fetch } = mockClient(() =>
      json(runPayload({ status: 'ABORTING' })),
    );
    expect((await client.abortRun(runId)).status).toBe('ABORTING');
    expect(fetch.mock.calls[0][0]).toBe(
      `https://api.apify.com/v2/actor-runs/${runId}/abort?gracefully=false`,
    );
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
    await expect(client.getRun('OtherRun')).rejects.toMatchObject({
      code: 'PROVIDER_RESPONSE_INVALID',
    });
    await expect(client.abortRun('OtherRun')).rejects.toMatchObject({
      code: 'PROVIDER_RESPONSE_INVALID',
    });
  });

  it('deletes only explicit stored resource IDs and requires the documented 204 acknowledgement', async () => {
    const { client, fetch } = mockClient(
      () => new Response(null, { status: 204 }),
    );
    await client.deleteDataset(datasetId);
    await client.deleteKeyValueStore('SyntheticStore123');
    await client.deleteRequestQueue('SyntheticQueue123');
    await client.deleteRun(runId);
    expect(
      fetch.mock.calls.map(([url, init]) => [
        new URL(String(url)).pathname,
        init?.method,
      ]),
    ).toEqual([
      [`/v2/datasets/${datasetId}`, 'DELETE'],
      ['/v2/key-value-stores/SyntheticStore123', 'DELETE'],
      ['/v2/request-queues/SyntheticQueue123', 'DELETE'],
      [`/v2/actor-runs/${runId}`, 'DELETE'],
    ]);
    const unexpected = mockClient(() => json({ deleted: false }));
    await expect(unexpected.client.deleteRun(runId)).rejects.toMatchObject({
      code: 'PROVIDER_RESPONSE_INVALID',
    });
  });

  it('prevents untrusted resource identifiers from selecting other paths or hosts', async () => {
    const { client, fetch } = mockClient(
      () => new Response(null, { status: 204 }),
    );
    for (const value of [
      '',
      '../users/me',
      'x?token=leak',
      'https://external.invalid',
      'x'.repeat(65),
    ]) {
      await expect(client.getRun(value)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      await expect(client.deleteDataset(value)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      await expect(client.deleteKeyValueStore(value)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      await expect(client.deleteRequestQueue(value)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      await expect(client.deleteRun(value)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('run metadata and two independent pagination domains (synthetic)', () => {
  it('checks fresh exact charge events without pretending the account or platform allowance is known', async () => {
    const { client, fetch } = mockClient(() => json(pricingPayload()));
    expect(await client.getReviewedPricing(pricingNow)).toEqual({
      actorId: APIFY_ACTOR_ID,
      pricingModel: 'PAY_PER_EVENT',
      startedAt: '2026-04-12T12:56:41.164Z',
      checkedAt: '2026-09-08T00:00:00.000Z',
      eventPriceUsd: APIFY_REVIEWED_EVENT_PRICE_USD,
      minimalMaxTotalChargeUsd: null,
      freeTierDiscountPercent: null,
      userPaysActorPlatformUsage: null,
    });
    expect(fetch.mock.calls[0][0]).toBe(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}`,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    'priceIncrease',
    'extraEvent',
    'missingEvent',
    'wrongModel',
    'futurePrice',
    'multipleActive',
    'fullPermissions',
    'changedActorMetadata',
    'changedEventSemantics',
    'unknownMinimum',
  ])('rejects unreviewed pricing condition %s', (condition) => {
    const payload = pricingPayload();
    const p = payload.data.pricingInfos[0];
    const events = p.pricingPerEvent.actorChargeEvents;
    if (condition === 'priceIncrease')
      events['user-batch-50'].eventPriceUsd = 0.01;
    if (condition === 'extraEvent')
      events['new-charge'] = { eventPriceUsd: 0.001, isOneTimeEvent: false };
    if (condition === 'missingEvent') delete events['user-batch-50'];
    if (condition === 'wrongModel') p.pricingModel = 'PAY_PER_RESULT';
    if (condition === 'futurePrice') p.startedAt = '2099-01-01T00:00:00.000Z';
    if (condition === 'multipleActive')
      payload.data.pricingInfos.push(structuredClone(p));
    if (condition === 'fullPermissions')
      payload.data.actorPermissionLevel = 'FULL_PERMISSIONS';
    if (condition === 'changedActorMetadata')
      payload.data.modifiedAt = '2026-09-12T00:00:00.000Z';
    if (condition === 'changedEventSemantics')
      events['user-batch-50'].isOneTimeEvent = true;
    if (condition === 'unknownMinimum')
      Reflect.deleteProperty(p, 'minimalMaxTotalChargeUsd');
    expect(() => normalizeReviewedPricing(payload, pricingNow)).toThrow(
      ApifyAdapterError,
    );
  });

  it('keeps unknown charge/count fields null and drops raw logs, input, URLs and status text', () => {
    const run = normalizeApifyRun(
      runPayload({
        statusMessage: 'Private target details',
        input: { username: 'private' },
        containerUrl: 'https://external.invalid',
      }),
    );
    expect(run.usageTotalUsd).toBeNull();
    expect(run.datasetItemCount).toBeNull();
    expect(run.chargedEventCounts).toBeNull();
    expect(JSON.stringify(run)).not.toMatch(
      /Private target|external.invalid|username/,
    );
    const measured = normalizeApifyRun(
      runPayload({
        usageTotalUsd: 0.00906,
        chargedEventCounts: { 'user-batch-50': 1 },
        stats: { datasetItemCount: 1 },
      }),
    );
    expect(measured).toMatchObject({
      usageTotalUsd: 0.00906,
      chargedEventCounts: { 'user-batch-50': 1 },
      datasetItemCount: 1,
    });
  });

  it.each([
    { usageTotalUsd: -1 },
    { usageTotalUsd: '0.1' },
    { usageTotalUsd: NaN },
    { chargedEventCounts: { 'user-batch-50': -1 } },
    { chargedEventCounts: [] },
    { stats: { datasetItemCount: 1.5 } },
    { startedAt: 'invalid' },
    { status: 'UNKNOWN' },
  ])('rejects malformed accounting/run metadata %j', (override) => {
    expect(() => normalizeApifyRun(runPayload(override))).toThrow(
      ApifyAdapterError,
    );
  });

  it('uses dataset envelope offsets without passing them as upstream cursors', async () => {
    const envelope = {
      results: [syntheticRow(1), syntheticRow(2)],
      cursor_next: 'upstream-next',
    };
    const { client, fetch } = mockClient(() =>
      datasetResponse([envelope], 100, 101),
    );
    const page = await client.readDatasetPage(datasetId, {
      offset: 100,
      limit: 100,
    });
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'json',
      clean: 'false',
      skipEmpty: 'false',
      skipHidden: 'false',
      desc: 'false',
      offset: '100',
      limit: '100',
    });
    expect(page).toMatchObject({
      count: 1,
      total: 101,
      nextOffset: null,
      exhausted: true,
    });
    const normalized = normalizeAcquisitionEnvelopes(page.items, 'followers', {
      requestedMaxItems: 200,
    });
    expect(normalized).toMatchObject({
      rawRecordCount: 2,
      envelopeCount: 1,
      upstreamCursor: 'upstream-next',
      upstreamTerminal: false,
    });
  });

  it('advances a bounded dataset page until its documented total is reached', async () => {
    const { client } = mockClient(() => datasetResponse([{}], 0, 2));
    expect(await client.readDatasetPage(datasetId)).toMatchObject({
      nextOffset: 1,
      exhausted: false,
    });
  });

  it.each<Record<string, string>>([
    { 'x-apify-pagination-offset': '1' },
    { 'x-apify-pagination-count': '2' },
    { 'x-apify-pagination-total': '0' },
    { 'x-apify-pagination-total': '-1' },
    { 'x-apify-pagination-total': '1.5' },
    { 'x-apify-pagination-total': '9007199254740992' },
  ])(
    'does not classify inconsistent dataset pagination as exhaustion %j',
    (headers) => {
      const { client } = mockClient(() => datasetResponse([{}], 0, 1, headers));
      return expect(client.readDatasetPage(datasetId)).rejects.toMatchObject({
        code: 'DATASET_PAGINATION_INVALID',
      });
    },
  );

  it('requires paging metadata and refuses an empty page before total exhaustion', async () => {
    await expect(
      mockClient(() => json([])).client.readDatasetPage(datasetId),
    ).rejects.toMatchObject({ code: 'DATASET_PAGINATION_INVALID' });
    await expect(
      mockClient(() => datasetResponse([], 0, 1)).client.readDatasetPage(
        datasetId,
      ),
    ).rejects.toMatchObject({ code: 'DATASET_PAGINATION_INVALID' });
    expect(
      await mockClient(() => datasetResponse([])).client.readDatasetPage(
        datasetId,
      ),
    ).toMatchObject({ exhausted: true, count: 0 });
  });

  it.each([
    { offset: -1 },
    { offset: Infinity },
    { limit: 0 },
    { limit: 1001 },
  ])('bounds each dataset request %j', (options) => {
    const { client, fetch } = mockClient(() => datasetResponse([]));
    const promise = expect(
      client.readDatasetPage(datasetId, options),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(fetch).not.toHaveBeenCalled();
    return promise;
  });
});

describe('nested envelope normalization and conservative upstream completion (synthetic)', () => {
  it('normalizes nested identities and never retains remote image URLs or private flags', () => {
    const normalized = normalizeAcquisitionEnvelopes(
      [
        {
          results: [{ ...syntheticRow(1), username: ' @Synthetic_1 ' }],
          cursor_next: null,
        },
      ],
      'followers',
      { requestedMaxItems: 200 },
    );
    expect(normalized).toMatchObject({
      envelopeCount: 1,
      rawRecordCount: 1,
      upstreamTerminal: true,
      explicitTerminalMarker: true,
      capReached: false,
    });
    expect(normalized.records[0]).toMatchObject({
      username: 'synthetic_1',
      id: '1',
    });
    expect(JSON.stringify(normalized)).not.toMatch(
      /profilePicUrl|isPrivate|external.invalid/,
    );
  });

  it('requires an explicit terminal marker; an empty array by itself is unknown', () => {
    expect(
      normalizeAcquisitionEnvelopes([{ results: [] }], 'followers')
        .upstreamTerminal,
    ).toBeNull();
    expect(
      normalizeAcquisitionEnvelopes([], 'followers').upstreamTerminal,
    ).toBeNull();
    expect(
      normalizeAcquisitionEnvelopes(
        [{ results: [], cursor_next: null }],
        'followers',
      ).upstreamTerminal,
    ).toBe(true);
  });

  it('withholds terminal evidence when maxItems was reached, even for a null cursor', () => {
    const result = normalizeAcquisitionEnvelopes(
      [{ results: [syntheticRow(1)], cursor_next: null }],
      'followers',
      { requestedMaxItems: 1 },
    );
    expect(result).toMatchObject({
      capReached: true,
      explicitTerminalMarker: true,
      upstreamTerminal: null,
    });
    expect(result.warnings.join(' ')).toContain('item budget');
  });

  it('reports a repeated input cursor and retains usable observations', () => {
    const result = normalizeAcquisitionEnvelopes(
      [{ results: [syntheticRow(1)], cursor_next: 'same' }],
      'followers',
      { inputCursor: 'same' },
    );
    expect(result).toMatchObject({
      repeatedCursor: true,
      upstreamTerminal: null,
    });
    expect(result.records).toHaveLength(1);
  });

  it('marks unexpected multiple envelopes ambiguous instead of trusting the last marker', () => {
    const result = normalizeAcquisitionEnvelopes(
      [
        { results: [syntheticRow(1)], cursor_next: 'next' },
        { results: [syntheticRow(2)], cursor_next: null },
      ],
      'followers',
    );
    expect(result).toMatchObject({
      envelopeCount: 2,
      rawRecordCount: 2,
      upstreamTerminal: null,
    });
  });

  it('omits malformed and wrong-direction rows while preventing absence classifications', () => {
    const rows = [
      syntheticRow(1),
      syntheticRow(2, 'following'),
      { ...syntheticRow(3), userId: 3 },
      { ...syntheticRow(4), username: '<script>' },
      null,
    ];
    const result = normalizeAcquisitionEnvelopes(
      [{ results: rows, cursor_next: null }],
      'followers',
    );
    expect(result).toMatchObject({
      rawRecordCount: 5,
      invalidRecordCount: 4,
      upstreamTerminal: null,
    });
    expect(result.records.map((row) => row.id)).toEqual(['1']);
  });

  it('keeps following records separate from followers and collapses exact duplicate identities', () => {
    const result = normalizeAcquisitionEnvelopes(
      [
        {
          results: [syntheticRow(1, 'following'), syntheticRow(1, 'following')],
          cursor_next: null,
        },
      ],
      'following',
    );
    expect(result).toMatchObject({
      rawRecordCount: 2,
      duplicateCount: 1,
      invalidRecordCount: 0,
    });
    expect(result.records).toHaveLength(1);
  });

  it('collapses ID-less and ID-bearing variants of one normalized username', () => {
    const result = normalizeAcquisitionEnvelopes(
      [
        {
          results: [
            { relation: 'follower', username: 'Synthetic_1' },
            syntheticRow(1),
          ],
          cursor_next: null,
        },
      ],
      'followers',
    );
    expect(result).toMatchObject({
      duplicateCount: 1,
      invalidRecordCount: 0,
    });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      username: 'synthetic_1',
      id: '1',
    });
  });

  it('quarantines both sides of conflicting usernames/IDs and leaves other records usable', () => {
    const rows = [
      syntheticRow(1),
      { ...syntheticRow(2), username: 'synthetic_1' },
      syntheticRow(3),
      { ...syntheticRow(3), username: 'changed_handle' },
      syntheticRow(4),
    ];
    const result = normalizeAcquisitionEnvelopes(
      [{ results: rows, cursor_next: null }],
      'followers',
    );
    expect(result).toMatchObject({
      invalidRecordCount: 4,
      upstreamTerminal: null,
    });
    expect(result.records.map((row) => row.id)).toEqual(['4']);
  });

  it('labels missing stable IDs and tolerates unfamiliar optional fields', () => {
    const row = {
      relation: 'follower',
      username: 'synthetic_1',
      unrelated: { metadata: true },
      displayName: 'x'.repeat(513),
    };
    const result = normalizeAcquisitionEnvelopes(
      [{ results: [row], cursor_next: null }],
      'followers',
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).not.toHaveProperty('displayName');
    expect(result.warnings.join(' ')).toContain('no stable identity ID');
  });

  it.each([
    null,
    {},
    { results: null },
    { results: [], cursor_next: '' },
    { results: [], cursor_next: false },
    { results: [], cursor_next: 'x'.repeat(8193) },
  ])('rejects an incompatible envelope %j', (envelope) => {
    expect(() =>
      normalizeAcquisitionEnvelopes([envelope], 'followers'),
    ).toThrow(ApifyAdapterError);
  });

  it('normalizes more than 6,000 identities through bounded pages without a total cutoff', () => {
    const collected: string[] = [];
    for (let offset = 0; offset < 6201; offset += 200) {
      const size = Math.min(200, 6201 - offset);
      const records = Array.from({ length: size }, (_, index) =>
        syntheticRow(offset + index),
      );
      const result = normalizeAcquisitionEnvelopes(
        [
          {
            results: records,
            cursor_next:
              offset + size < 6201 ? `synthetic-cursor-${offset + size}` : null,
          },
        ],
        'followers',
        {
          requestedMaxItems: 200,
          inputCursor: offset ? `synthetic-cursor-${offset}` : null,
        },
      );
      expect(result.rawRecordCount).toBe(size);
      expect(result.upstreamTerminal).toBe(size < 200 ? true : null);
      collected.push(...result.records.map((row) => row.username));
    }
    expect(collected).toHaveLength(6201);
    expect(new Set(collected).size).toBe(6201);
  });
});
