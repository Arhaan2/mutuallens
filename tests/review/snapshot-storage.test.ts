import { describe, it, expect } from 'vitest';
import { createSampleDataset, createSnapshot } from '@mutuallens/core';
import { validSnapshot } from '../../apps/checker/src/local-snapshots';

describe('mutable browser storage boundary', () => {
  it('accepts actual synthetic snapshots including the nonnumeric sample account ID', () => {
    expect(validSnapshot(createSnapshot(createSampleDataset(3, 1)))).toBe(true);
  });
  it.each([
    null,
    { id: 'damaged', savedAt: '2025-01-01' },
    {
      ...createSnapshot(createSampleDataset(1, 0)),
      dataset: { schemaVersion: 1 },
    },
  ])('rejects damaged snapshot shape before rendering: %j', (value) => {
    expect(validSnapshot(value)).toBe(false);
  });
  it('rejects malformed stored records and unsupported versions', () => {
    const valid = createSnapshot(createSampleDataset(1, 0));
    const record = structuredClone(valid);
    record.dataset.followers.records[0]!.username = '<script>';
    expect(validSnapshot(record)).toBe(false);
    expect(validSnapshot({ ...valid, schemaVersion: 2 })).toBe(false);
  });
  it('preserves the core contract for opaque stable IDs and rejects control characters', () => {
    const snapshot = createSnapshot(createSampleDataset(1, 0));
    snapshot.dataset.sample = false;
    snapshot.dataset.account.id = 'opaque-account';
    snapshot.dataset.followers.records[0]!.id = 'opaque-record';
    expect(validSnapshot(snapshot)).toBe(true);
    snapshot.dataset.followers.records[0]!.id = 'bad\nrecord';
    expect(validSnapshot(snapshot)).toBe(false);
  });
});
