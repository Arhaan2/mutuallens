import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  compareDataset,
  compareSnapshots,
  createSampleDataset,
  createSnapshot,
  exportCsv,
  importInstagram,
} from '../../packages/core/src/index';
import { handleApi } from '../../apps/checker/functions/api/[[path]]';

const opts = {
  account: { username: 'synthetic_review_owner' },
  confirmedComplete: true,
  collectedAt: '2026-01-01T00:00:00Z',
};
const encode = (value: unknown) => strToU8(JSON.stringify(value));
const row = (name: string) => ({ string_list_data: [{ value: name }] });
const inputs = () => [
  { name: 'followers_1.json', bytes: encode([row('synthetic_a')]) },
  {
    name: 'following.json',
    bytes: encode({ relationships_following: [row('synthetic_b')] }),
  },
];

describe('independent adversarial correctness review; synthetic data only', () => {
  it.each(['followers_0.json', 'followers_01.json', 'following_0.json'])(
    'does not silently drop malformed relationship part %s from an otherwise complete ZIP',
    async (name) => {
      const files = Object.fromEntries(
        inputs().map((file) => [file.name, file.bytes]),
      );
      files[name] = encode([row('synthetic_omitted')]);
      await expect(
        importInstagram(
          [{ name: 'synthetic.zip', bytes: zipSync(files) }],
          opts,
        ),
      ).rejects.toThrow();
    },
  );

  it.each([
    '2025-02-30T00:00:00Z',
    '2026-01-01T24:00:00Z',
    '2026-01-01T12:00:00',
    '2099-01-01T00:00:00Z',
  ])(
    'rejects an invalid, timezone-ambiguous or future collection date %s',
    async (collectedAt) => {
      await expect(
        importInstagram(inputs(), { ...opts, collectedAt }),
      ).rejects.toThrow();
    },
  );

  it('retains an explicit incomplete state when expected total contradicts actual records', () => {
    const dataset = createSampleDataset(2, 1);
    dataset.followers.metadata.expectedCount = 3;
    const result = compareDataset(dataset);
    expect(result.negativesWithheld).toBe(true);
    expect(result.notFollowingBack).toEqual([]);
    expect(result.notFollowedBackByYou).toEqual([]);
  });

  it('does not trust a stale unique-count metadata label', () => {
    const dataset = createSampleDataset(2, 1);
    dataset.followers.records.pop();
    const result = compareDataset(dataset);
    expect(result.negativesWithheld).toBe(true);
    expect(result.notFollowingBack).toEqual([]);
  });

  it('keeps ID collisions distinct under record and list permutations', () => {
    const seed = createSampleDataset(0);
    const a = {
      username: 'same_name',
      originalUsername: 'same_name',
      id: '111',
      source: 'synthetic',
    };
    const b = { ...a, id: '222' };
    for (const [followers, following] of [
      [[a], [b]],
      [[b], [a]],
    ]) {
      const dataset = structuredClone(seed);
      dataset.followers.records = followers!;
      dataset.following.records = following!;
      dataset.followers.metadata.rawCount =
        dataset.followers.metadata.uniqueCount = 1;
      dataset.following.metadata.rawCount =
        dataset.following.metadata.uniqueCount = 1;
      expect(compareDataset(dataset)).toMatchObject({
        negativesWithheld: true,
        mutuals: [],
        notFollowingBack: [],
        notFollowedBackByYou: [],
        unionCount: 2,
      });
    }
  });

  it('rejects historical comparison when known totals contradict terminal metadata', () => {
    const before = createSnapshot(createSampleDataset(2, 1));
    const after = createSnapshot(createSampleDataset(2, 2));
    for (const direction of ['followers', 'following'] as const) {
      before.dataset[direction].metadata.startedAt = before.dataset[
        direction
      ].metadata.endedAt = '2026-01-01T00:00:00Z';
      after.dataset[direction].metadata.startedAt = after.dataset[
        direction
      ].metadata.endedAt = '2026-02-01T00:00:00Z';
    }
    after.dataset.following.metadata.expectedCount = 5;
    expect(() => compareSnapshots(before, after)).toThrow();
  });

  it('neutralizes formula prefixes in every exported field, preserving quoting', () => {
    const payload = '\u00a0=HYPERLINK("https://example.invalid","x")';
    const record = {
      username: payload,
      originalUsername: payload,
      id: payload,
      displayName: payload,
      source: payload,
    };
    const csv = exportCsv([record]);
    const escaped = `"'${payload.replaceAll('"', '""')}"`;
    expect(csv.split('\r\n')[1]).toBe(Array(5).fill(escaped).join(','));
  });
});

describe('independent disabled boundary review; not live-job security proof', () => {
  it('refuses acquisition without consuming even a malformed request body', async () => {
    const request = new Request('https://checker.test/api/scans', {
      method: 'POST',
      headers: { Origin: 'https://checker.test' },
      body: 'not valid JSON',
    });
    const response = await handleApi(request);
    expect(request.bodyUsed).toBe(false);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'AUTOMATIC_UNAVAILABLE',
      complete: false,
      results: null,
    });
  });

  it('does not trust a matching Origin when Fetch Metadata says cross-site', async () => {
    const response = await handleApi(
      new Request('https://checker.test/api/scans', {
        method: 'POST',
        headers: {
          Origin: 'https://checker.test',
          'Sec-Fetch-Site': 'cross-site',
        },
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'ORIGIN_REJECTED' });
  });

  it('does not reflect URLs or graph-like request data in errors', async () => {
    const response = await handleApi(
      new Request(
        'https://checker.test/api/scans/synthetic-private?token=synthetic-canary',
        { headers: { Cookie: 'session=synthetic-private' } },
      ),
    );
    const text = await response.text();
    expect(text).not.toContain('synthetic-private');
    expect(text).not.toContain('synthetic-canary');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.has('Set-Cookie')).toBe(false);
  });
});
