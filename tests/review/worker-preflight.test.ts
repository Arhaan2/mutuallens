import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Harness = {
  onmessage?: (message: { data: unknown }) => Promise<void>;
  postMessage: ReturnType<typeof vi.fn>;
};
let harness: Harness;

beforeEach(async () => {
  vi.resetModules();
  harness = { postMessage: vi.fn() };
  vi.stubGlobal('self', harness);
  await import('../../apps/checker/src/processing.worker');
});
afterEach(() => vi.unstubAllGlobals());

describe('independent worker memory boundary; declared-size test doubles allocate no oversized payload', () => {
  it('rejects total selected byte overflow before any file read', async () => {
    const read = vi
      .fn()
      .mockRejectedValue(new Error('Must never read this oversized selection'));
    await harness.onmessage!({
      data: {
        id: 1,
        kind: 'import',
        files: [
          { name: 'followers.json', size: 40 * 1024 * 1024, arrayBuffer: read },
          { name: 'following.json', size: 40 * 1024 * 1024, arrayBuffer: read },
        ],
        options: { account: { username: 'synthetic_owner' } },
      },
    });
    expect(read).not.toHaveBeenCalled();
    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        error: expect.stringContaining('memory safety budget'),
      }),
    );
  });

  it('rejects excessive file count before any file read even when declared byte size is zero', async () => {
    const read = vi
      .fn()
      .mockRejectedValue(new Error('Must never read this excessive selection'));
    await harness.onmessage!({
      data: {
        id: 2,
        kind: 'import',
        files: Array.from({ length: 2001 }, (_, index) => ({
          name: `followers_${index + 1}.json`,
          size: 0,
          arrayBuffer: read,
        })),
        options: { account: { username: 'synthetic_owner' } },
      },
    });
    expect(read).not.toHaveBeenCalled();
    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        error: expect.stringContaining('memory safety budget'),
      }),
    );
  });

  it('allows safe files through and retains unverified negatives by default', async () => {
    const encode = (data: unknown) =>
      new TextEncoder().encode(JSON.stringify(data));
    const followerBytes = encode([
      { string_list_data: [{ value: 'synthetic_a' }] },
    ]);
    const followingBytes = encode({
      relationships_following: [
        { string_list_data: [{ value: 'synthetic_b' }] },
      ],
    });
    const first = vi.fn().mockResolvedValue(followerBytes.buffer);
    const second = vi.fn().mockResolvedValue(followingBytes.buffer);
    await harness.onmessage!({
      data: {
        id: 3,
        kind: 'import',
        files: [
          {
            name: 'followers.json',
            size: followerBytes.length,
            arrayBuffer: first,
          },
          {
            name: 'following.json',
            size: followingBytes.length,
            arrayBuffer: second,
          },
        ],
        options: { account: { username: 'synthetic_owner' } },
      },
    });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 3,
        result: expect.objectContaining({
          comparison: expect.objectContaining({
            negativesWithheld: true,
            notFollowingBack: [],
            notFollowedBackByYou: [],
          }),
        }),
      }),
    );
  });
});
