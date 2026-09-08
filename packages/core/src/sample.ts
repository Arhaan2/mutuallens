import type { AccountList, AccountRecord, Dataset } from './types';

/** Synthetic records only; never called by an automatic acquisition route. */
export function createSampleDataset(size = 6000, offset = 1500): Dataset {
  if (
    !Number.isSafeInteger(size) ||
    size < 0 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(size + offset)
  )
    throw new Error(
      'Synthetic size and offset must be non-negative safe integers.',
    );
  const now = new Date().toISOString();
  const list = (start: number): AccountList => {
    const records: AccountRecord[] = Array.from({ length: size }, (_, i) => {
      const username = `user${String(start + i + 1).padStart(5, '0')}`;
      return {
        username,
        originalUsername: username,
        id: String(start + i + 1),
        source: 'synthetic fixture',
      };
    });
    return {
      records,
      metadata: {
        source: 'synthetic fixture',
        version: '1',
        startedAt: now,
        endedAt: now,
        rawCount: size,
        uniqueCount: size,
        completeness: 'complete_for_source',
        terminal: true,
        pages: 1,
        warnings: [
          'Synthetic sample data. This is not a live Instagram check.',
        ],
      },
    };
  };
  return {
    schemaVersion: 1,
    account: { username: 'synthetic_example', id: 'synthetic-owner' },
    followers: list(0),
    following: list(offset),
    importedAt: now,
    sample: true,
  };
}
