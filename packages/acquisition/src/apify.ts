/** Server-only transport. No calls happen until a credentialed integrator invokes a method.
 * No blind retries: a lost start response may already have created a chargeable run. */
export const APIFY_ACTOR_ID = '2nsQrloj1Sl16uh4z';
export const APIFY_ACTOR_NAME = 'seemuapps/instagram-followers-scraper';
export const APIFY_BUILD_ID = 'qZHBzZiV6QmFCKDym';
export const APIFY_BUILD_NUMBER = '1.0.35';
export const APIFY_INPUT_SCHEMA_VERSION = 1;
export const APIFY_REVIEWED_EVENT_PRICE_USD = {
  'apify-actor-start': 0.00005,
  'apify-default-dataset-item': 0.00001,
  'user-batch-50': 0.009,
} as const;
export interface ApifyReviewedPricing {
  actorId: typeof APIFY_ACTOR_ID;
  pricingModel: 'PAY_PER_EVENT';
  startedAt: string;
  checkedAt: string;
  eventPriceUsd: Record<keyof typeof APIFY_REVIEWED_EVENT_PRICE_USD, number>;
  minimalMaxTotalChargeUsd: number | null;
  /** Public Actor API omits these account/platform facts. Never substitute zero. */
  freeTierDiscountPercent: null;
  userPaysActorPlatformUsage: null;
}
export type AcquisitionDirection = 'followers' | 'following';
export type ApifyRunStatus =
  | 'READY'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMING-OUT'
  | 'TIMED-OUT'
  | 'ABORTING'
  | 'ABORTED';
export interface ApifyRun {
  id: string;
  actorId: string;
  buildId: string | null;
  status: ApifyRunStatus;
  /** Safe local description; raw provider status text can contain target data. */
  statusMessage: string;
  defaultDatasetId: string | null;
  defaultKeyValueStoreId: string | null;
  defaultRequestQueueId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  usageTotalUsd: number | null;
  chargedEventCounts: Record<string, number> | null;
  datasetItemCount: number | null;
}
export interface ApifyStartInput {
  username: string;
  direction: AcquisitionDirection;
  upstreamCursor?: string | null;
  /** Per-run resource budget, never a whole-account cutoff. A cap is not completeness. */
  maxItems: number;
  maxTotalChargeUsd: number;
  timeoutSecs?: number;
  build?: string;
}
export interface ApifyDatasetPage {
  items: unknown[];
  offset: number;
  count: number;
  total: number;
  nextOffset: number | null;
  /** Exhaustion of the Apify dataset only; never upstream Instagram completion. */
  exhausted: boolean;
}
export interface AcquiredAccount {
  username: string;
  originalUsername: string;
  id?: string;
  displayName?: string;
  source: string;
}
export interface NormalizedAcquisitionPage {
  records: AcquiredAccount[];
  rawRecordCount: number;
  envelopeCount: number;
  duplicateCount: number;
  invalidRecordCount: number;
  upstreamCursor: string | null;
  /** null means absent/ambiguous evidence; true requires explicit null cursor and no cap/row ambiguity. */
  upstreamTerminal: boolean | null;
  explicitTerminalMarker: boolean;
  capReached: boolean;
  repeatedCursor: boolean;
  warnings: string[];
}
export type ApifyErrorCode =
  | 'CONFIGURATION'
  | 'INVALID_INPUT'
  | 'PROVIDER_UNAUTHORIZED'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_HTTP'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_TRANSPORT'
  | 'PROVIDER_RESPONSE_INVALID'
  | 'PROVIDER_RESPONSE_TOO_LARGE'
  | 'DATASET_PAGINATION_INVALID';
export class ApifyAdapterError extends Error {
  readonly name = 'ApifyAdapterError';
  constructor(
    public readonly code: ApifyErrorCode,
    message: string,
    public readonly status: number | null = null,
    public readonly retryable = false,
    /** The caller MUST retain the reservation and reconcile, never repeat POST blindly. */
    public readonly startOutcome: 'not-started' | 'unknown' | null = null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}
export interface ApifyClientOptions {
  token: string;
  fetch?: typeof globalThis.fetch;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const bad = (
  message = 'The provider response did not match the pinned adapter schema.',
): never => {
  throw new ApifyAdapterError('PROVIDER_RESPONSE_INVALID', message);
};
const identifier = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(value))
    throw new ApifyAdapterError(
      'INVALID_INPUT',
      'A valid provider resource identifier is required.',
    );
  return value;
};
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const money = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const cursor = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 8192 ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new ApifyAdapterError(
      'INVALID_INPUT',
      'The provider continuation cursor is invalid.',
    );
  return value;
};
const username = (value: unknown): string => {
  if (typeof value !== 'string')
    throw new ApifyAdapterError(
      'INVALID_INPUT',
      'Enter an Instagram username.',
    );
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(normalized) || !/[a-z0-9_]/.test(normalized))
    throw new ApifyAdapterError(
      'INVALID_INPUT',
      'Enter a valid Instagram username.',
    );
  return normalized;
};
const optionalId = (value: unknown): string | null =>
  value === undefined || value === null ? null : identifier(value);
const date = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    return bad();
  return value;
};
const statuses: ApifyRunStatus[] = [
  'READY',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'TIMING-OUT',
  'TIMED-OUT',
  'ABORTING',
  'ABORTED',
];
/** Fresh metadata guard only. It does not verify the credential's account plan,
 * free allowance, platform extras, event quantities, or acquisition semantics. */
export function normalizeReviewedPricing(
  payload: unknown,
  nowMs = Date.now(),
): ApifyReviewedPricing {
  if (!object(payload) || !object(payload.data) || !Number.isFinite(nowMs))
    return bad();
  const actor = payload.data;
  if (
    actor.id !== APIFY_ACTOR_ID ||
    actor.actorPermissionLevel !== 'LIMITED_PERMISSIONS' ||
    !Array.isArray(actor.pricingInfos)
  )
    return bad();
  const active = actor.pricingInfos.filter(
    (info: unknown) =>
      object(info) &&
      typeof info.startedAt === 'string' &&
      Number.isFinite(Date.parse(info.startedAt)) &&
      Date.parse(info.startedAt) <= nowMs &&
      (info.endedAt === undefined ||
        info.endedAt === null ||
        (typeof info.endedAt === 'string' && Date.parse(info.endedAt) > nowMs)),
  );
  if (active.length !== 1)
    return bad(
      'The provider does not have one unambiguous active pricing contract.',
    );
  const p = active[0] as Record<string, unknown>;
  if (
    p.pricingModel !== 'PAY_PER_EVENT' ||
    !object(p.pricingPerEvent) ||
    !object(p.pricingPerEvent.actorChargeEvents)
  )
    return bad();
  const events = p.pricingPerEvent.actorChargeEvents;
  const keys = Object.keys(
    APIFY_REVIEWED_EVENT_PRICE_USD,
  ) as (keyof typeof APIFY_REVIEWED_EVENT_PRICE_USD)[];
  if (Object.keys(events).length !== keys.length)
    return bad(
      'The provider charge events changed; operator review is required.',
    );
  const eventPriceUsd = {} as ApifyReviewedPricing['eventPriceUsd'];
  for (const key of keys) {
    const event = events[key];
    if (
      !object(event) ||
      !money(event.eventPriceUsd) ||
      event.eventPriceUsd > APIFY_REVIEWED_EVENT_PRICE_USD[key]
    )
      return bad(
        'The provider charge events exceed the reviewed price ceiling.',
      );
    if (
      key === 'apify-actor-start'
        ? event.isOneTimeEvent !== true
        : event.isOneTimeEvent === true
    )
      return bad('The provider charge event semantics changed.');
    eventPriceUsd[key] = event.eventPriceUsd;
  }
  if (p.minimalMaxTotalChargeUsd !== null && !money(p.minimalMaxTotalChargeUsd))
    return bad();
  return {
    actorId: APIFY_ACTOR_ID,
    pricingModel: 'PAY_PER_EVENT',
    startedAt: p.startedAt as string,
    checkedAt: new Date(nowMs).toISOString(),
    eventPriceUsd,
    minimalMaxTotalChargeUsd: p.minimalMaxTotalChargeUsd,
    freeTierDiscountPercent: null,
    userPaysActorPlatformUsage: null,
  };
}
export function normalizeApifyRun(payload: unknown): ApifyRun {
  if (!object(payload) || !object(payload.data)) return bad();
  const d = payload.data;
  if (
    !statuses.includes(d.status as ApifyRunStatus) ||
    d.actId !== APIFY_ACTOR_ID
  )
    return bad();
  if (
    d.buildId !== undefined &&
    d.buildId !== null &&
    d.buildId !== APIFY_BUILD_ID
  )
    return bad('The provider run used an unreviewed build.');
  if (d.usageTotalUsd !== undefined && !money(d.usageTotalUsd)) return bad();
  let events: Record<string, number> | null = null;
  if (d.chargedEventCounts !== undefined) {
    if (
      !object(d.chargedEventCounts) ||
      Object.keys(d.chargedEventCounts).length > 100
    )
      return bad();
    events = {};
    for (const [key, value] of Object.entries(d.chargedEventCounts)) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key) || !count(value)) return bad();
      Object.defineProperty(events, key, { value, enumerable: true });
    }
  }
  const itemCount = object(d.stats) ? d.stats.datasetItemCount : undefined;
  if (itemCount !== undefined && !count(itemCount)) return bad();
  return {
    id: identifier(d.id),
    actorId: APIFY_ACTOR_ID,
    buildId: optionalId(d.buildId),
    status: d.status as ApifyRunStatus,
    statusMessage: `Provider run status: ${d.status}.`,
    defaultDatasetId: optionalId(d.defaultDatasetId),
    defaultKeyValueStoreId: optionalId(d.defaultKeyValueStoreId),
    defaultRequestQueueId: optionalId(d.defaultRequestQueueId),
    startedAt: date(d.startedAt),
    finishedAt: date(d.finishedAt),
    usageTotalUsd: money(d.usageTotalUsd) ? d.usageTotalUsd : null,
    chargedEventCounts: events,
    datasetItemCount: count(itemCount) ? itemCount : null,
  };
}

/** Normalize nested records; dataset envelopes are not Instagram identities. */
export function normalizeAcquisitionEnvelopes(
  items: unknown[],
  direction: AcquisitionDirection,
  options: { requestedMaxItems?: number; inputCursor?: string | null } = {},
): NormalizedAcquisitionPage {
  if (!Array.isArray(items) || !['followers', 'following'].includes(direction))
    return bad();
  if (
    options.requestedMaxItems !== undefined &&
    (!count(options.requestedMaxItems) || options.requestedMaxItems === 0)
  )
    throw new ApifyAdapterError(
      'INVALID_INPUT',
      'A positive bounded per-run maxItems is required.',
    );
  const expectedRelation = direction === 'followers' ? 'follower' : 'following';
  const records: AcquiredAccount[] = [];
  const seen = new Set<string>();
  let rawRecordCount = 0,
    duplicateCount = 0,
    invalidRecordCount = 0;
  let upstreamCursor: string | null = null;
  let explicitTerminalMarker = false,
    cursorKnown = false;
  const warnings: string[] = [];
  for (const envelope of items) {
    if (!object(envelope) || !Array.isArray(envelope.results))
      return bad(
        'The provider dataset must contain envelopes with nested results arrays.',
      );
    if (Object.hasOwn(envelope, 'cursor_next')) {
      if (envelope.cursor_next === null) {
        upstreamCursor = null;
        explicitTerminalMarker = true;
        cursorKnown = true;
      } else {
        try {
          upstreamCursor = cursor(envelope.cursor_next);
        } catch {
          return bad('The provider returned an invalid upstream cursor.');
        }
        explicitTerminalMarker = false;
        cursorKnown = true;
      }
    } else {
      cursorKnown = false;
      upstreamCursor = null;
      explicitTerminalMarker = false;
    }
    rawRecordCount += envelope.results.length;
    if (!Number.isSafeInteger(rawRecordCount)) return bad();
    for (const raw of envelope.results) {
      if (!object(raw) || raw.relation !== expectedRelation) {
        invalidRecordCount++;
        continue;
      }
      let handle: string;
      try {
        handle = username(raw.username);
      } catch {
        invalidRecordCount++;
        continue;
      }
      let id: string | undefined;
      if (raw.userId !== undefined) {
        if (
          typeof raw.userId !== 'string' ||
          !/^[0-9]{1,100}$/.test(raw.userId)
        ) {
          invalidRecordCount++;
          continue;
        }
        id = raw.userId;
      } else warnings.push('Some provider records have no stable identity ID.');
      const key = `${id ?? ''}:${handle}`;
      if (seen.has(key)) {
        duplicateCount++;
        continue;
      }
      seen.add(key);
      records.push({
        username: handle,
        originalUsername: String(raw.username),
        ...(id ? { id } : {}),
        ...(typeof raw.displayName === 'string' && raw.displayName.length <= 512
          ? { displayName: raw.displayName }
          : {}),
        source: `${APIFY_ACTOR_NAME}@${APIFY_BUILD_NUMBER}`,
      });
    }
  }
  // A username mapped to different IDs, or one ID mapped to different usernames,
  // is not a reliable identity observation. Keep other rows, quarantine all sides.
  const idsByHandle = new Map<string, Set<string>>();
  const handlesById = new Map<string, Set<string>>();
  for (const row of records) {
    if (!row.id) continue;
    const ids = idsByHandle.get(row.username) ?? new Set<string>();
    ids.add(row.id);
    idsByHandle.set(row.username, ids);
    const handles = handlesById.get(row.id) ?? new Set<string>();
    handles.add(row.username);
    handlesById.set(row.id, handles);
  }
  const usable = records.filter((row) => {
    const ambiguous =
      (idsByHandle.get(row.username)?.size ?? 0) > 1 ||
      (!!row.id && (handlesById.get(row.id)?.size ?? 0) > 1);
    if (ambiguous) invalidRecordCount++;
    return !ambiguous;
  });
  const capReached =
    options.requestedMaxItems !== undefined &&
    rawRecordCount >= options.requestedMaxItems;
  const repeatedCursor =
    !!upstreamCursor && upstreamCursor === options.inputCursor;
  if (items.length !== 1)
    warnings.push(
      'Expected one dataset envelope for one direction per run; upstream completion needs review.',
    );
  if (!cursorKnown)
    warnings.push(
      'The provider did not supply an explicit upstream continuation marker.',
    );
  if (capReached)
    warnings.push(
      'The per-run item budget was reached. A null cursor at this boundary cannot establish a complete upstream list.',
    );
  if (invalidRecordCount)
    warnings.push(
      'Invalid or wrong-direction provider records were omitted; automatic absence classifications must remain withheld.',
    );
  if (repeatedCursor)
    warnings.push(
      'The provider repeated the input cursor. Stop continuation and preserve observed records as incomplete.',
    );
  return {
    records: usable,
    rawRecordCount,
    envelopeCount: items.length,
    duplicateCount,
    invalidRecordCount,
    upstreamCursor,
    explicitTerminalMarker,
    capReached,
    repeatedCursor,
    upstreamTerminal:
      cursorKnown &&
      items.length === 1 &&
      !capReached &&
      !invalidRecordCount &&
      !repeatedCursor
        ? explicitTerminalMarker
        : null,
    warnings: [...new Set(warnings)],
  };
}

export class ApifyClient {
  #token: string;
  #fetch: typeof globalThis.fetch;
  #timeout: number;
  #maxBytes: number;
  constructor(options: ApifyClientOptions) {
    if (typeof window !== 'undefined')
      throw new ApifyAdapterError(
        'CONFIGURATION',
        'Provider transport is server-only.',
      );
    if (
      typeof options.token !== 'string' ||
      !options.token.trim() ||
      /\s/.test(options.token)
    )
      throw new ApifyAdapterError(
        'CONFIGURATION',
        'Configure the provider credential privately on the server.',
      );
    this.#token = options.token;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeout = options.requestTimeoutMs ?? 10000;
    this.#maxBytes = options.maxResponseBytes ?? 8 * 1024 * 1024;
    if (
      !count(this.#timeout) ||
      this.#timeout < 1 ||
      this.#timeout > 30000 ||
      !count(this.#maxBytes) ||
      this.#maxBytes < 1 ||
      this.#maxBytes > 16 * 1024 * 1024
    )
      throw new ApifyAdapterError(
        'CONFIGURATION',
        'Provider transport resource bounds are invalid.',
      );
  }
  async #request(
    path: string,
    init: RequestInit = {},
    start = false,
  ): Promise<{ payload: unknown; headers: Headers }> {
    const controller = new AbortController();
    let rejectDeadline!: (reason: Error) => void;
    const deadline = new Promise<never>((_, reject) => {
      rejectDeadline = reject;
    });
    const timer = setTimeout(() => {
      controller.abort();
      rejectDeadline(new Error('Provider deadline reached.'));
    }, this.#timeout);
    let status: number | null = null;
    try {
      const response = await Promise.race([
        this.#fetch(`https://api.apify.com/v2/${path}`, {
          ...init,
          credentials: 'omit',
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.#token}`,
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          },
        }),
        deadline,
      ]);
      status = response.status;
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        const rawRetry = response.headers.get('retry-after');
        const retrySeconds =
          rawRetry && /^\d+$/.test(rawRetry)
            ? Math.min(300, Number(rawRetry))
            : null;
        const code: ApifyErrorCode =
          status === 401 || status === 403
            ? 'PROVIDER_UNAUTHORIZED'
            : status === 429
              ? 'PROVIDER_RATE_LIMIT'
              : 'PROVIDER_HTTP';
        const notStarted = [400, 401, 403, 404, 422].includes(status);
        throw new ApifyAdapterError(
          code,
          status === 401 || status === 403
            ? 'Provider authorization is unavailable. Ask the service operator to review private setup.'
            : 'The provider request failed. No complete automatic result is established.',
          status,
          !start && (status === 429 || status >= 500),
          start ? (notStarted ? 'not-started' : 'unknown') : null,
          retrySeconds,
        );
      }
      if (status === 204) return { payload: null, headers: response.headers };
      if (init.method === 'DELETE')
        return bad('The provider did not acknowledge resource deletion.');
      const declared = response.headers.get('content-length');
      if (
        declared &&
        (!/^\d+$/.test(declared) || Number(declared) > this.#maxBytes)
      ) {
        void response.body?.cancel().catch(() => undefined);
        throw new ApifyAdapterError(
          'PROVIDER_RESPONSE_TOO_LARGE',
          'The provider response exceeds the bounded page memory budget.',
        );
      }
      if (
        response.headers
          .get('content-type')
          ?.split(';')[0]
          .trim()
          .toLowerCase() !== 'application/json'
      ) {
        void response.body?.cancel().catch(() => undefined);
        return bad('The provider returned a non-JSON response.');
      }
      const reader = response.body?.getReader();
      if (!reader) return bad();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const next = await Promise.race([reader.read(), deadline]);
          if (next.done) break;
          size += next.value.byteLength;
          if (size > this.#maxBytes) {
            void reader.cancel().catch(() => undefined);
            throw new ApifyAdapterError(
              'PROVIDER_RESPONSE_TOO_LARGE',
              'The provider response exceeds the bounded page memory budget.',
            );
          }
          chunks.push(next.value);
        }
      } finally {
        if (controller.signal.aborted)
          void reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        );
      } catch {
        return bad('The provider returned malformed JSON.');
      }
      return { payload, headers: response.headers };
    } catch (error) {
      if (error instanceof ApifyAdapterError) {
        if (start && error.startOutcome === null)
          throw new ApifyAdapterError(
            error.code,
            error.message,
            status,
            false,
            'unknown',
            error.retryAfterSeconds,
          );
        throw error;
      }
      throw new ApifyAdapterError(
        controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_TRANSPORT',
        'The provider request did not complete. The operator must reconcile an uncertain start before retrying.',
        status,
        !start,
        start ? 'unknown' : null,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async start(input: ApifyStartInput): Promise<ApifyRun> {
    const normalized = username(input.username);
    if (
      !['followers', 'following'].includes(input.direction) ||
      !count(input.maxItems) ||
      input.maxItems < 1 ||
      input.maxItems > 500 ||
      !money(input.maxTotalChargeUsd) ||
      input.maxTotalChargeUsd <= 0
    )
      throw new ApifyAdapterError(
        'INVALID_INPUT',
        'Use one direction, a positive per-run item budget up to 500, and an explicitly reserved charge ceiling.',
      );
    const timeout = input.timeoutSecs ?? 120;
    if (!count(timeout) || timeout < 1 || timeout > 300)
      throw new ApifyAdapterError(
        'INVALID_INPUT',
        'Use a provider run timeout between 1 and 300 seconds.',
      );
    const build = input.build ?? APIFY_BUILD_NUMBER;
    if (build !== APIFY_BUILD_NUMBER)
      throw new ApifyAdapterError(
        'INVALID_INPUT',
        'Only the reviewed provider build is allowed.',
      );
    const body = {
      username: normalized,
      mode: input.direction,
      maxItems: input.maxItems,
      ...(input.upstreamCursor !== undefined && input.upstreamCursor !== null
        ? { pageId: cursor(input.upstreamCursor) }
        : {}),
    };
    const query = new URLSearchParams({
      build,
      timeout: String(timeout),
      memory: '256',
      maxTotalChargeUsd: String(input.maxTotalChargeUsd),
      restartOnError: 'false',
      waitForFinish: '0',
      forcePermissionLevel: 'LIMITED_PERMISSIONS',
    });
    const { payload } = await this.#request(
      `acts/${APIFY_ACTOR_ID}/runs?${query}`,
      { method: 'POST', body: JSON.stringify(body) },
      true,
    );
    try {
      return normalizeApifyRun(payload);
    } catch {
      throw new ApifyAdapterError(
        'PROVIDER_RESPONSE_INVALID',
        'Provider start returned an unusable acknowledgement. Preserve its reservation and reconcile before retrying.',
        null,
        false,
        'unknown',
      );
    }
  }
  async getReviewedPricing(nowMs = Date.now()): Promise<ApifyReviewedPricing> {
    const { payload } = await this.#request(`acts/${APIFY_ACTOR_ID}`);
    return normalizeReviewedPricing(payload, nowMs);
  }
  async getRun(runId: string): Promise<ApifyRun> {
    const { payload } = await this.#request(`actor-runs/${identifier(runId)}`);
    const run = normalizeApifyRun(payload);
    if (run.id !== runId) return bad();
    return run;
  }
  async abortRun(runId: string): Promise<ApifyRun> {
    const { payload } = await this.#request(
      `actor-runs/${identifier(runId)}/abort?gracefully=false`,
      { method: 'POST' },
    );
    const run = normalizeApifyRun(payload);
    if (run.id !== runId) return bad();
    return run;
  }
  async readDatasetPage(
    datasetId: string,
    options: { offset?: number; limit?: number } = {},
  ): Promise<ApifyDatasetPage> {
    const offset = options.offset ?? 0,
      limit = options.limit ?? 100;
    if (!count(offset) || !count(limit) || limit < 1 || limit > 1000)
      throw new ApifyAdapterError(
        'INVALID_INPUT',
        'Use a nonnegative dataset offset and page size from 1 to 1,000.',
      );
    const query = new URLSearchParams({
      format: 'json',
      clean: 'false',
      skipEmpty: 'false',
      skipHidden: 'false',
      desc: 'false',
      offset: String(offset),
      limit: String(limit),
    });
    const { payload, headers } = await this.#request(
      `datasets/${identifier(datasetId)}/items?${query}`,
    );
    const numberHeader = (key: string) => {
      const value = headers.get(key);
      return value !== null &&
        /^\d+$/.test(value) &&
        Number.isSafeInteger(Number(value))
        ? Number(value)
        : null;
    };
    const total = numberHeader('x-apify-pagination-total');
    const actualOffset = numberHeader('x-apify-pagination-offset');
    const actualCount = numberHeader('x-apify-pagination-count');
    if (
      !Array.isArray(payload) ||
      total === null ||
      actualOffset !== offset ||
      actualCount !== payload.length ||
      payload.length > limit ||
      offset + payload.length > total ||
      (payload.length === 0 && offset < total)
    )
      throw new ApifyAdapterError(
        'DATASET_PAGINATION_INVALID',
        'Provider dataset paging metadata is inconsistent. Do not treat this page as an exhausted upstream list.',
      );
    const next = offset + payload.length;
    return {
      items: payload,
      offset,
      count: payload.length,
      total,
      nextOffset: next < total ? next : null,
      exhausted: next >= total,
    };
  }
  async deleteRun(runId: string): Promise<void> {
    await this.#request(`actor-runs/${identifier(runId)}`, {
      method: 'DELETE',
    });
  }
  async deleteDataset(datasetId: string): Promise<void> {
    await this.#request(`datasets/${identifier(datasetId)}`, {
      method: 'DELETE',
    });
  }
  async deleteKeyValueStore(storeId: string): Promise<void> {
    await this.#request(`key-value-stores/${identifier(storeId)}`, {
      method: 'DELETE',
    });
  }
  async deleteRequestQueue(queueId: string): Promise<void> {
    await this.#request(`request-queues/${identifier(queueId)}`, {
      method: 'DELETE',
    });
  }
}
