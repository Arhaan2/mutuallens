import type {
  AccountIdentity,
  AccountList,
  AccountRecord,
  Dataset,
  ImportOptions,
  ListMetadata,
} from './types';
import { indexIdentities, normalizeUsername, validId } from './identity';
import { knownCollectionDate } from './dates';
import { object } from './import-safety';

const fail = (): never => {
  throw new Error(
    'This MutualLens dataset is damaged or uses an unsupported schema. Choose an original JSON or HTML relationship export.',
  );
};
function text(value: unknown, max = 2048): string {
  if (typeof value !== 'string' || value.length > max) return fail();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    return fail();
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 2000) return fail();
  return value.map((v) => text(v));
}
function timestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !knownCollectionDate(value)) return fail();
  return value;
}
function identity(value: unknown): AccountIdentity {
  if (!object(value)) return fail();
  const label = text(value.username, 30);
  const username = label ? normalizeUsername(label) : '';
  const id = validId(value.id);
  return { username, ...(id ? { id } : {}) };
}
function record(value: unknown): AccountRecord {
  if (!object(value)) return fail();
  const name = text(value.username, 30);
  const username = normalizeUsername(name);
  if (username !== name) return fail();
  const id = validId(value.id);
  const originalUsername = text(value.originalUsername, 2048),
    source = text(value.source);
  const displayName =
    value.displayName === undefined ? undefined : text(value.displayName, 1000);
  return {
    username,
    originalUsername,
    source,
    ...(id ? { id } : {}),
    ...(displayName === undefined ? {} : { displayName }),
  };
}
function list(value: unknown): AccountList {
  if (
    !object(value) ||
    !Array.isArray(value.records) ||
    !object(value.metadata)
  )
    return fail();
  const records = value.records.map(record),
    m = value.metadata;
  const source = text(m.source),
    version = text(m.version),
    startedAt = timestamp(m.startedAt),
    endedAt = timestamp(m.endedAt),
    rawCount = count(m.rawCount),
    uniqueCount = count(m.uniqueCount),
    pages = count(m.pages),
    warnings = strings(m.warnings);
  if (
    typeof m.terminal !== 'boolean' ||
    !['partial', 'unverified', 'complete_for_source'].includes(
      String(m.completeness),
    ) ||
    rawCount < records.length ||
    uniqueCount !== indexIdentities([records]).lists[0]!.size ||
    uniqueCount > rawCount ||
    (records.length > 0 && pages === 0)
  )
    return fail();
  if (startedAt && endedAt && Date.parse(startedAt) > Date.parse(endedAt))
    return fail();
  const metadata: ListMetadata = {
    source,
    version,
    startedAt,
    endedAt,
    rawCount,
    uniqueCount,
    pages,
    warnings: [
      ...warnings,
      'Reopened from an uploaded MutualLens dataset. Live Instagram completeness was not verified.',
    ],
    completeness: m.completeness === 'partial' ? 'partial' : 'unverified',
    terminal: false,
  };
  if (m.expectedCount !== undefined)
    metadata.expectedCount = count(m.expectedCount);
  for (const key of [
    'skippedCount',
    'quarantinedCount',
    'duplicateCount',
  ] as const)
    if (m[key] !== undefined) metadata[key] = count(m[key]);
  if (m.files !== undefined) metadata.files = strings(m.files);
  if (
    (metadata.skippedCount ?? 0) > 0 ||
    (metadata.quarantinedCount ?? 0) > 0 ||
    (metadata.expectedCount !== undefined &&
      metadata.expectedCount !== uniqueCount)
  )
    metadata.completeness = 'partial';
  return { records, metadata };
}
/** Reconstruct known schema fields explicitly; imported JSON is never trusted via a cast. */
export function parseNativeDataset(
  value: unknown,
  options: ImportOptions = {},
): Dataset {
  try {
    if (
      !object(value) ||
      value.schemaVersion !== 1 ||
      typeof value.sample !== 'boolean' ||
      typeof value.importedAt !== 'string' ||
      !knownCollectionDate(value.importedAt)
    )
      return fail();
    if (
      value.comparisonBasis !== undefined &&
      !['supplied_files', 'source_evidence'].includes(
        String(value.comparisonBasis),
      )
    )
      return fail();
    if (value.exportScope !== undefined) text(value.exportScope);
    if (value.exportLimitations !== undefined) strings(value.exportLimitations);
    const account = identity(value.account),
      followers = list(value.followers),
      following = list(value.following);
    const dataset: Dataset = {
      schemaVersion: 1,
      account: options.account ? identity(options.account) : account,
      followers,
      following,
      importedAt: new Date().toISOString(),
      sample: value.sample,
      comparisonBasis: 'supplied_files',
    };
    if (value.importSummary !== undefined) {
      if (!object(value.importSummary)) return fail();
      const s = value.importSummary;
      dataset.importSummary = {
        relevantFiles: count(s.relevantFiles),
        duplicatesCombined: count(s.duplicatesCombined),
        skippedRecords: count(s.skippedRecords),
        quarantinedRecords: count(s.quarantinedRecords),
        warnings: strings(s.warnings),
      };
    } else
      dataset.importSummary = {
        relevantFiles: 1,
        duplicatesCombined:
          (followers.metadata.duplicateCount ?? 0) +
          (following.metadata.duplicateCount ?? 0),
        skippedRecords:
          (followers.metadata.skippedCount ?? 0) +
          (following.metadata.skippedCount ?? 0),
        quarantinedRecords:
          (followers.metadata.quarantinedCount ?? 0) +
          (following.metadata.quarantinedCount ?? 0),
        warnings: ['Reopened an uploaded MutualLens dataset.'],
      };
    return dataset;
  } catch (cause) {
    throw new Error(
      'This MutualLens dataset is damaged or uses an unsupported schema. Choose an original JSON or HTML relationship export.',
      { cause },
    );
  }
}
