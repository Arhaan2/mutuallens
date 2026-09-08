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
export interface AccountIdentity { username: string; id?: string }
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
}
export interface AccountList { records: AccountRecord[]; metadata: ListMetadata }
export interface Dataset {
  schemaVersion: 1;
  account: AccountIdentity;
  followers: AccountList;
  following: AccountList;
  importedAt: string;
  sample: boolean;
}
export interface Comparison {
  mutuals: AccountRecord[];
  notFollowingBack: AccountRecord[];
  notFollowedBackByYou: AccountRecord[];
  unionCount: number;
  negativesWithheld: boolean;
  warnings: string[];
}
export interface ImportFile { name: string; bytes: Uint8Array }
export interface ImportOptions {
  account: AccountIdentity;
  /** User confirms selected files include every part of both directions. Otherwise unverified. */
  confirmedComplete?: boolean;
  collectedAt?: string;
}
export interface Snapshot { schemaVersion: 1; id: string; savedAt: string; dataset: Dataset }
export interface SnapshotComparison {
  followersAdded: AccountRecord[];
  followersAbsent: AccountRecord[];
  followingAdded: AccountRecord[];
  followingAbsent: AccountRecord[];
  warnings: string[];
}
