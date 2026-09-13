import type {
  AccountRecord,
  Dataset,
  Snapshot,
  SnapshotComparison,
} from './types';
import {
  indexIdentities,
  listComplete,
  normalizeUsername,
  validId,
} from './identity';
import { knownCollectionDate } from './dates';

export function createSnapshot(dataset: Dataset): Snapshot {
  if (dataset.schemaVersion !== 1)
    throw new Error('Unsupported dataset schema version.');
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    dataset: structuredClone(dataset),
  };
}

export function compareSnapshots(
  before: Snapshot,
  after: Snapshot,
): SnapshotComparison {
  if (
    before.schemaVersion !== 1 ||
    after.schemaVersion !== 1 ||
    before.dataset.schemaVersion !== 1 ||
    after.dataset.schemaVersion !== 1
  )
    throw new Error('Snapshots use incompatible schema versions.');
  const previous = before.dataset;
  const next = after.dataset;
  if (previous.sample !== next.sample)
    throw new Error('Synthetic and imported snapshots cannot be compared.');
  const oldId = validId(previous.account.id);
  const newId = validId(next.account.id);
  const warnings: string[] = [];
  if (oldId && newId) {
    if (oldId !== newId)
      throw new Error(
        'Choose snapshots for the same account. Stable account IDs differ.',
      );
  } else {
    if (!previous.account.username.trim() || !next.account.username.trim())
      throw new Error(
        'Account identity is unknown. Add the same optional account label before saving snapshots to compare them.',
      );
    if (
      normalizeUsername(previous.account.username) !==
      normalizeUsername(next.account.username)
    )
      throw new Error(
        'Choose snapshots for the same account. Usernames differ and a shared stable ID is unavailable.',
      );
    warnings.push(
      'Account identity is username-only in at least one snapshot. Rename, reactivation, and username-reuse uncertainty remains.',
    );
  }
  const suppliedFiles =
    previous.comparisonBasis === 'supplied_files' &&
    next.comparisonBasis === 'supplied_files';
  if (
    (previous.comparisonBasis === 'supplied_files') !==
    (next.comparisonBasis === 'supplied_files')
  )
    throw new Error(
      'Uploaded-file and automatic-source snapshots use different comparison scopes.',
    );
  if (!suppliedFiles && (!listComplete(previous) || !listComplete(next)))
    throw new Error(
      'Snapshot differences require complete, terminal lists in both snapshots. Partial or unverified snapshots cannot establish absence.',
    );
  for (const direction of ['followers', 'following'] as const) {
    const older = previous[direction].metadata;
    const newer = next[direction].metadata;
    if (older.source !== newer.source || older.version !== newer.version)
      throw new Error(
        'Snapshots use incompatible source formats or adapter versions.',
      );
    if (
      !knownCollectionDate(older.startedAt) ||
      !knownCollectionDate(older.endedAt) ||
      !knownCollectionDate(newer.startedAt) ||
      !knownCollectionDate(newer.endedAt)
    )
      throw new Error(
        'Collection dates are unknown or invalid. Import/save times do not establish when Instagram collected the lists.',
      );
    if (
      Date.parse(older.startedAt) > Date.parse(older.endedAt) ||
      Date.parse(newer.startedAt) > Date.parse(newer.endedAt) ||
      Date.parse(older.endedAt) >= Date.parse(newer.startedAt)
    )
      throw new Error(
        'Snapshot collection windows must be valid, known, and strictly ordered without overlap.',
      );
  }
  const indexed = indexIdentities([
    previous.followers.records,
    next.followers.records,
    previous.following.records,
    next.following.records,
  ]);
  if (indexed.collision && !suppliedFiles)
    throw new Error(
      'Conflicting stable IDs make snapshot identity ambiguous. Historical differences are withheld.',
    );
  if (suppliedFiles)
    warnings.push(
      'These differences compare the supplied uploaded files; they are not verified current Instagram relationship changes.',
      ...previous.followers.metadata.warnings,
      ...previous.following.metadata.warnings,
      ...next.followers.metadata.warnings,
      ...next.following.metadata.warnings,
    );
  warnings.push(
    ...indexed.warnings,
    'Differences mean present in one collection window and absent in the other. They do not establish an exact unfollow time, intent, or reason.',
  );
  const difference = (
    left: Map<string, AccountRecord>,
    right: Map<string, AccountRecord>,
  ): AccountRecord[] =>
    [...left]
      .filter(([key]) => !right.has(key) && !indexed.ambiguousKeys.has(key))
      .map(([, record]) => record);
  return {
    followersAdded: difference(indexed.lists[1]!, indexed.lists[0]!),
    followersAbsent: difference(indexed.lists[0]!, indexed.lists[1]!),
    followingAdded: difference(indexed.lists[3]!, indexed.lists[2]!),
    followingAbsent: difference(indexed.lists[2]!, indexed.lists[3]!),
    warnings: [...new Set(warnings)],
  };
}
