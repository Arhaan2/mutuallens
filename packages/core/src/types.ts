/** Lead-owned data contract. Completion describes the supplied source, never atomic live truth. */
export type Completeness = 'complete_for_source' | 'partial' | 'unverified';
export type Direction = 'followers' | 'following';
export interface AccountRecord {
  username: string;
  originalUsername: string;
  id?: string;
  displayName?: string;
  source: string;
}
export interface AccountIdentity {
  username: string;
  id?: string;
}
export interface ListMetadata {
  source: string;
  version: string;
  startedAt: string | null;
  endedAt: string | null;
  rawCount: number;
  uniqueCount: number;
  expectedCount?: number;
  completeness: Completeness;
  terminal: boolean;
  pages: number;
  warnings: string[];
  skippedCount?: number;
  quarantinedCount?: number;
  duplicateCount?: number;
  files?: string[];
}
export interface AccountList {
  records: AccountRecord[];
  metadata: ListMetadata;
}
export interface Dataset {
  schemaVersion: 1;
  account: AccountIdentity;
  followers: AccountList;
  following: AccountList;
  importedAt: string;
  sample: boolean;
  /** Supplied-file math is separate from evidence of upstream completeness. */
  comparisonBasis?: 'supplied_files' | 'source_evidence';
  importSummary?: {
    relevantFiles: number;
    duplicatesCombined: number;
    skippedRecords: number;
    quarantinedRecords: number;
    warnings: string[];
  };
}
export interface Comparison {
  mutuals: AccountRecord[];
  notFollowingBack: AccountRecord[];
  notFollowedBackByYou: AccountRecord[];
  unionCount: number;
  negativesWithheld: boolean;
  warnings: string[];
  negativeBasis?: 'supplied_files' | 'provisional_files' | 'source_evidence';
  quarantinedCount?: number;
}
export interface ImportFile {
  name: string;
  bytes: Uint8Array;
}
export interface ImportOptions {
  /** Optional label/history identity; absent identity must not block upload comparison. */
  account?: AccountIdentity;
  /** Deprecated compatibility field; never gates supplied-file comparison. */
  confirmedComplete?: boolean;
  collectedAt?: string;
  /** Explicit user assignment for ambiguous loose relationship files, keyed by file name. */
  directions?: Record<string, Direction>;
}
export interface ImportAssignment {
  name: string;
  reason: string;
}
export interface Snapshot {
  schemaVersion: 1;
  id: string;
  savedAt: string;
  dataset: Dataset;
}
export interface SnapshotComparison {
  followersAdded: AccountRecord[];
  followersAbsent: AccountRecord[];
  followingAdded: AccountRecord[];
  followingAbsent: AccountRecord[];
  warnings: string[];
}
