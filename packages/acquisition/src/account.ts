/** Provider account guard: documented account endpoints, never account mutation or chargeable Actor calls. */
export interface FreeCapacity {
  period: string;
  endsAt: string;
  recurringCreditsUsd: number;
  usedUsd: number;
  remainingUsd: number;
  retentionDays: number;
}
const ACCOUNT_TIMEOUT_MS = 10000;
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const number = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;
async function read(
  token: string,
  path: string,
  transport: typeof fetch,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  let rejectDeadline!: (reason: Error) => void;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    rejectDeadline(new Error('Provider account deadline reached.'));
  }, ACCOUNT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await Promise.race([
      transport(`https://api.apify.com/v2/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      }),
      deadline,
    ]);
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        'Provider account access timed out. No scan was started.',
        {
          cause: error,
        },
      );
    throw new Error(
      'Provider account access was unavailable. No scan was started.',
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      'Provider account access could not be verified. No scan was started.',
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Provider account response is unavailable.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  let rejectBodyDeadline!: (reason: Error) => void;
  const bodyDeadline = new Promise<never>((_, reject) => {
    rejectBodyDeadline = reject;
  });
  const bodyTimer = setTimeout(() => {
    controller.abort();
    rejectBodyDeadline(new Error('Provider account body deadline reached.'));
  }, ACCOUNT_TIMEOUT_MS);
  try {
    for (;;) {
      const chunk = await Promise.race([reader.read(), bodyDeadline]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new Error(
          'Provider account response exceeded its metadata budget.',
        );
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        'Provider account access timed out. No scan was started.',
        { cause: error },
      );
    if (error instanceof Error) throw error;
    throw new Error('Provider account response was unavailable.', {
      cause: error,
    });
  } finally {
    clearTimeout(bodyTimer);
    if (controller.signal.aborted) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Provider account response was invalid.');
  }
  if (!object(body) || !object(body.data))
    throw new Error('Provider account response was invalid.');
  return body.data;
}
export async function readFreeCapacity(
  token: string,
  transport: typeof fetch = fetch,
  now = Date.now(),
): Promise<FreeCapacity> {
  if (!token || /\s/.test(token))
    throw new Error('Private provider credentials are not configured.');
  const [user, usage] = await Promise.all([
    read(token, 'users/me', transport),
    read(token, 'users/me/limits', transport),
  ]);
  const plan = user.plan;
  const features = user.effectivePlatformFeatures;
  if (
    !object(plan) ||
    plan.tier !== 'FREE' ||
    plan.isEnabled !== true ||
    plan.monthlyBasePriceUsd !== 0 ||
    user.isPaying !== false ||
    !number(plan.monthlyUsageCreditsUsd) ||
    plan.monthlyUsageCreditsUsd <= 0 ||
    !object(features) ||
    !object(features.ACTORS) ||
    features.ACTORS.isEnabled !== true ||
    features.ACTORS.isTrial !== false ||
    !object(features.STORAGE) ||
    features.STORAGE.isEnabled !== true ||
    features.STORAGE.isTrial !== false
  )
    throw new Error(
      'This service requires a verified existing Apify Free account with recurring credits. No paid plan or fallback is permitted.',
    );
  const limits = usage.limits,
    current = usage.current,
    cycle = usage.monthlyUsageCycle;
  if (
    !object(limits) ||
    !object(current) ||
    !object(cycle) ||
    !number(limits.maxMonthlyUsageUsd) ||
    !number(limits.dataRetentionDays) ||
    !number(current.monthlyUsageUsd) ||
    !number(current.activeActorJobCount) ||
    !Number.isSafeInteger(current.activeActorJobCount) ||
    typeof cycle.startAt !== 'string' ||
    typeof cycle.endAt !== 'string' ||
    !number(plan.dataRetentionDays)
  )
    throw new Error(
      'The provider did not expose usable allowance and cycle information.',
    );
  if (current.activeActorJobCount !== 0)
    throw new Error(
      'The provider account has other active Actor work. Wait for it to finish before reserving a scan.',
    );
  const start = Date.parse(cycle.startAt),
    end = Date.parse(cycle.endAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    now < start ||
    now >= end
  )
    throw new Error('The provider allowance cycle is unavailable or expired.');
  const allowance = Math.min(
    plan.monthlyUsageCreditsUsd,
    limits.maxMonthlyUsageUsd,
  );
  return {
    period: cycle.startAt,
    endsAt: cycle.endAt,
    recurringCreditsUsd: allowance,
    usedUsd: current.monthlyUsageUsd,
    remainingUsd: Math.max(0, allowance - current.monthlyUsageUsd),
    retentionDays: Math.min(plan.dataRetentionDays, limits.dataRetentionDays),
  };
}
