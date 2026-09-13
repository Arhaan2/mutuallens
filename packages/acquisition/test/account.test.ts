import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFreeCapacity } from '../src/account';
const now = Date.parse('2026-09-08T00:00:00Z');
const user = {
  isPaying: false,
  effectivePlatformFeatures: {
    ACTORS: { isEnabled: true, isTrial: false },
    STORAGE: { isEnabled: true, isTrial: false },
  },
  plan: {
    tier: 'FREE',
    isEnabled: true,
    monthlyBasePriceUsd: 0,
    monthlyUsageCreditsUsd: 5,
    dataRetentionDays: 7,
  },
};
const limits = {
  limits: { maxMonthlyUsageUsd: 5, dataRetentionDays: 14 },
  current: { monthlyUsageUsd: 1.25, activeActorJobCount: 0 },
  monthlyUsageCycle: {
    startAt: '2026-09-01T00:00:00Z',
    endAt: '2026-10-01T00:00:00Z',
  },
};
afterEach(() => vi.useRealTimers());
function fixture(u: unknown = user, l: unknown = limits) {
  return vi.fn<typeof fetch>(async (input, init) => {
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toEqual({ Authorization: 'Bearer synthetic-token' });
    expect(String(input)).not.toContain('synthetic-token');
    return Response.json({ data: String(input).endsWith('/limits') ? l : u });
  });
}
describe('Free account allowance guard; synthetic metadata, no real account calls', () => {
  it('reports the recurring allowance and measured remaining credit separately', async () => {
    expect(await readFreeCapacity('synthetic-token', fixture(), now)).toEqual({
      period: limits.monthlyUsageCycle.startAt,
      endsAt: limits.monthlyUsageCycle.endAt,
      recurringCreditsUsd: 5,
      usedUsd: 1.25,
      remainingUsd: 3.75,
      retentionDays: 7,
    });
  });
  it.each([
    { ...user, isPaying: true },
    { ...user, plan: { ...user.plan, tier: 'STARTER' } },
    { ...user, plan: { ...user.plan, isEnabled: false } },
    { ...user, plan: { ...user.plan, monthlyBasePriceUsd: 1 } },
    { ...user, plan: { ...user.plan, monthlyUsageCreditsUsd: 0 } },
  ])(
    'refuses paying/disabled/nonrecurring plans before acquisition',
    async (u) => {
      await expect(
        readFreeCapacity('synthetic-token', fixture(u), now),
      ).rejects.toThrow('Free account');
    },
  );
  it('honors the lower enforced account allowance and clamps exhausted credit', async () => {
    expect(
      await readFreeCapacity(
        'synthetic-token',
        fixture(user, {
          ...limits,
          limits: { ...limits.limits, maxMonthlyUsageUsd: 1 },
        }),
        now,
      ),
    ).toMatchObject({ recurringCreditsUsd: 1, remainingUsd: 0 });
  });
  it('refuses unknown, stale and future cycles', async () => {
    for (const l of [
      {},
      {
        ...limits,
        monthlyUsageCycle: {
          ...limits.monthlyUsageCycle,
          endAt: '2026-09-01T00:00:00Z',
        },
      },
      {
        ...limits,
        monthlyUsageCycle: {
          ...limits.monthlyUsageCycle,
          startAt: '2026-10-01T00:00:00Z',
        },
      },
    ])
      await expect(
        readFreeCapacity('synthetic-token', fixture(user, l), now),
      ).rejects.toThrow();
  });
  it('rejects unauthenticated and oversized metadata without exposing response contents', async () => {
    await expect(
      readFreeCapacity(
        'synthetic-token',
        vi.fn(
          async () => new Response('private-provider-detail', { status: 401 }),
        ),
        now,
      ),
    ).rejects.toThrow('could not be verified');
    await expect(
      readFreeCapacity(
        'synthetic-token',
        vi.fn(async () => new Response('x'.repeat(1024 * 1024 + 1))),
        now,
      ),
    ).rejects.toThrow('metadata budget');
  });
  it('fails closed when required recurring platform features are unavailable or trial-only', async () => {
    for (const feature of [
      { isEnabled: false, isTrial: false },
      { isEnabled: true, isTrial: true },
    ])
      await expect(
        readFreeCapacity(
          'synthetic-token',
          fixture({
            ...user,
            effectivePlatformFeatures: {
              ...user.effectivePlatformFeatures,
              ACTORS: feature,
            },
          }),
          now,
        ),
      ).rejects.toThrow('Free account');
  });
  it('refuses to reserve capacity while other account-wide Actor work is active', async () => {
    await expect(
      readFreeCapacity(
        'synthetic-token',
        fixture(user, {
          ...limits,
          current: { ...limits.current, activeActorJobCount: 1 },
        }),
        now,
      ),
    ).rejects.toThrow('other active Actor work');
  });
  it('bounds account metadata fetches even when an injected transport ignores cancellation', async () => {
    vi.useFakeTimers();
    const pending = readFreeCapacity(
      'synthetic-token',
      vi.fn(() => new Promise<Response>(() => {})),
      now,
    );
    const check = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(10001);
    await check;
  });
});
