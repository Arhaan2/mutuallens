import { describe, expect, it } from 'vitest';
import { compareDataset } from '../src/identity';
import { createSampleDataset } from '../src/sample';
import { exportCsv, exportDataset } from '../src/exports';
import { compareSnapshots, createSnapshot } from '../src/snapshots';
import type { Dataset } from '../src/types';

const uploaded = (size = 4, offset = 1): Dataset => {
  const data = createSampleDataset(size, offset);
  data.sample = false;
  data.comparisonBasis = 'supplied_files';
  data.account = { username: '' };
  for (const list of [data.followers, data.following]) {
    list.metadata.completeness = 'unverified';
    list.metadata.terminal = false;
    list.metadata.startedAt = null;
    list.metadata.endedAt = null;
    list.metadata.warnings = [];
  }
  return data;
};

describe('supplied-file product comparison', () => {
  it('compares ordinary uploads without identity, dates, terminal markers or confirmation', () => {
    const result = compareDataset(uploaded());
    expect(result.negativesWithheld).toBe(false);
    expect(result.negativeBasis).toBe('supplied_files');
    expect(result.notFollowingBack.map((r) => r.username)).toEqual([
      'user00005',
    ]);
    expect(result.notFollowedBackByYou.map((r) => r.username)).toEqual([
      'user00001',
    ]);
    expect(result.mutuals).toHaveLength(3);
  });
  it('keeps useful differences with explicit provisional basis when supplied data has known omissions', () => {
    const data = uploaded();
    data.followers.metadata.completeness = 'partial';
    data.followers.metadata.skippedCount = 2;
    data.followers.metadata.warnings = [
      'Two follower records could not be read.',
    ];
    const result = compareDataset(data);
    expect(result.negativeBasis).toBe('provisional_files');
    expect(result.negativesWithheld).toBe(false);
    expect(result.notFollowingBack).toHaveLength(1);
    expect(result.warnings.join(' ')).toMatch(/Two follower records/);
  });
  it('quarantines conflicting identities without hiding unrelated useful differences', () => {
    const data = uploaded();
    data.followers.records[0] = {
      ...data.followers.records[0]!,
      username: 'collision',
      id: 'a',
    };
    data.following.records[0] = {
      ...data.following.records[0]!,
      username: 'collision',
      id: 'b',
    };
    const result = compareDataset(data);
    expect(result.negativeBasis).toBe('provisional_files');
    expect(result.quarantinedCount).toBe(2);
    expect(result.notFollowingBack.map((r) => r.username)).toEqual([
      'user00005',
    ]);
    expect(result.notFollowedBackByYou.map((r) => r.username)).toEqual([
      'user00002',
    ]);
    expect(result.mutuals).toHaveLength(2);
  });
  it('preserves strict incomplete automatic-source safeguards', () => {
    const data = uploaded();
    data.comparisonBasis = 'source_evidence';
    expect(compareDataset(data).negativesWithheld).toBe(true);
    expect(compareDataset(data).notFollowingBack).toEqual([]);
    delete data.comparisonBasis;
    expect(compareDataset(data).negativesWithheld).toBe(true);
  });
  it('handles empty supplied lists and target scale without false source certification', () => {
    expect(compareDataset(uploaded(0, 0)).notFollowingBack).toEqual([]);
    const data = uploaded(6000, 1500);
    const result = compareDataset(data);
    expect(result.mutuals).toHaveLength(4500);
    expect(result.notFollowingBack).toHaveLength(1500);
    expect(result.notFollowedBackByYou).toHaveLength(1500);
    expect(data.followers.metadata.terminal).toBe(false);
    expect(data.followers.metadata.completeness).toBe('unverified');
  });
  it('exports comparison scope and known limitations alongside records', () => {
    const data = uploaded();
    data.followers.metadata.completeness = 'partial';
    data.followers.metadata.warnings = ['Missing follower part 2.'];
    const json = JSON.parse(exportDataset(data));
    expect(json.exportScope).toMatch(/uploaded files/i);
    expect(json.exportLimitations.join(' ')).toContain(
      'Missing follower part 2.',
    );
    expect(json.followers.metadata.terminal).toBe(false);
    const csv = exportCsv(compareDataset(data).notFollowingBack, {
      scope: 'Not found in supplied followers. Based on uploaded files.',
      limitations: ['Missing follower part 2.'],
    });
    expect(csv).toContain('Not found in supplied followers');
    expect(csv).toContain('Missing follower part 2.');
    expect(csv).toContain('user00005');
  });
  it('does not compare saved uploads whose account identities are both unknown', () => {
    const first = createSnapshot(uploaded()),
      second = createSnapshot(uploaded());
    expect(() => compareSnapshots(first, second)).toThrow(
      /account.*label|identity.*unknown|unknown.*identity/i,
    );
  });
  it('compares labeled dated upload snapshots without pretending they have source terminal markers', () => {
    const first = uploaded(),
      second = uploaded(4, 2);
    first.account.username = second.account.username = 'synthetic_owner';
    for (const list of [first.followers, first.following])
      list.metadata.startedAt = list.metadata.endedAt =
        '2026-08-01T00:00:00.000Z';
    for (const list of [second.followers, second.following])
      list.metadata.startedAt = list.metadata.endedAt =
        '2026-08-02T00:00:00.000Z';
    const result = compareSnapshots(
      createSnapshot(first),
      createSnapshot(second),
    );
    expect(result.followingAdded).toHaveLength(1);
    expect(result.followingAbsent).toHaveLength(1);
    expect(result.warnings.join(' ')).toMatch(/supplied|uploaded/i);
  });
});
