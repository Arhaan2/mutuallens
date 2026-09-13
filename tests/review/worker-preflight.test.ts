import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_LIMITS } from '../../packages/core/src/import';

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
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('independent worker memory boundary; declared-size test doubles allocate no oversized payload', () => {
  it('rejects total selected byte overflow before any file read', async () => {
    const read = vi
      .fn()
      .mockRejectedValue(new Error('Must never read this oversized selection'));
    const slice = vi.fn(() => {
      throw new Error('Must never slice this oversized selection');
    });
    await harness.onmessage!({
      data: {
        id: 1,
        kind: 'import',
        files: [
          {
            name: 'followers.json',
            size: IMPORT_LIMITS.inputBytes / 2 + 1,
            arrayBuffer: read,
            slice,
          },
          {
            name: 'following.json',
            size: IMPORT_LIMITS.inputBytes / 2,
            arrayBuffer: read,
            slice,
          },
        ],
        options: { account: { username: 'synthetic_owner' } },
      },
    });
    expect(read).not.toHaveBeenCalled();
    expect(slice).not.toHaveBeenCalled();
    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        error: expect.stringContaining('input safety budget'),
      }),
    );
  });

  it('rejects excessive file count before any file read even when declared byte size is zero', async () => {
    const read = vi
      .fn()
      .mockRejectedValue(new Error('Must never read this excessive selection'));
    const slice = vi.fn(() => {
      throw new Error('Must never slice this excessive selection');
    });
    await harness.onmessage!({
      data: {
        id: 2,
        kind: 'import',
        files: Array.from(
          { length: IMPORT_LIMITS.entries + 1 },
          (_, index) => ({
            name: `followers_${index + 1}.json`,
            size: 0,
            arrayBuffer: read,
            slice,
          }),
        ),
        options: { account: { username: 'synthetic_owner' } },
      },
    });
    expect(read).not.toHaveBeenCalled();
    expect(slice).not.toHaveBeenCalled();
    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        error: expect.stringContaining('Too many selected files'),
      }),
    );
  });

  it('reads actual File slices and compares uploaded records without a completeness checkbox', async () => {
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
    const followers = new File([followerBytes], 'followers.json', {
      type: 'application/json',
    });
    const following = new File([followingBytes], 'following.json', {
      type: 'application/json',
    });
    const first = vi.spyOn(followers, 'slice');
    const second = vi.spyOn(following, 'slice');
    const wholeFollowers = vi
      .spyOn(followers, 'arrayBuffer')
      .mockRejectedValue(new Error('Whole-file reader must not be used'));
    const wholeFollowing = vi
      .spyOn(following, 'arrayBuffer')
      .mockRejectedValue(new Error('Whole-file reader must not be used'));
    await harness.onmessage!({
      data: {
        id: 3,
        kind: 'import',
        files: [followers, following],
        options: {},
      },
    });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledWith(0, followerBytes.length);
    expect(second).toHaveBeenCalledWith(0, followingBytes.length);
    expect(wholeFollowers).not.toHaveBeenCalled();
    expect(wholeFollowing).not.toHaveBeenCalled();
    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 3,
        result: expect.objectContaining({
          dataset: expect.objectContaining({
            account: { username: '' },
            comparisonBasis: 'supplied_files',
            followers: expect.objectContaining({
              metadata: expect.objectContaining({
                completeness: 'unverified',
                terminal: false,
                startedAt: null,
                endedAt: null,
              }),
            }),
          }),
          comparison: expect.objectContaining({
            negativesWithheld: false,
            negativeBasis: 'supplied_files',
            mutuals: [],
            notFollowingBack: [
              expect.objectContaining({ username: 'synthetic_b' }),
            ],
            notFollowedBackByYou: [
              expect.objectContaining({ username: 'synthetic_a' }),
            ],
          }),
        }),
      }),
    );
  });
});
