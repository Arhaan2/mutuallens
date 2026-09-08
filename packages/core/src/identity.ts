/* eslint-disable no-control-regex -- Security validation explicitly rejects control characters. */
import type { AccountRecord, Comparison, Dataset } from './types';

const RESERVED = new Set([
  'accounts',
  'about',
  'api',
  'developer',
  'developers',
  'direct',
  'directory',
  'explore',
  'legal',
  'p',
  'reel',
  'reels',
  'stories',
  'web',
]);

/** Returns only a username. This function never fetches a user-supplied URL. */
export function normalizeUsername(value: string): string {
  if (typeof value !== 'string')
    throw new Error('Enter an Instagram username or profile URL.');
  let username = value.trim();
  if (/^https?:\/\//i.test(username)) {
    let url: URL;
    try {
      url = new URL(username);
    } catch {
      throw new Error('Enter a valid Instagram profile URL.');
    }
    if (
      url.protocol !== 'https:' ||
      !['instagram.com', 'www.instagram.com'].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    ) {
      throw new Error('Only HTTPS Instagram profile URLs are supported.');
    }
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === '_u') segments.shift();
    if (
      segments.length !== 1 ||
      RESERVED.has((segments[0] ?? '').toLowerCase())
    )
      throw new Error(
        'Use a profile URL, not an Instagram post or other page.',
      );
    try {
      username = decodeURIComponent(segments[0]!);
    } catch {
      throw new Error('The profile URL contains invalid text.');
    }
  } else if (username.startsWith('@')) {
    username = username.slice(1);
  }
  if (
    !/^[a-zA-Z0-9._]{1,30}$/.test(username) ||
    !/[a-zA-Z0-9_]/.test(username)
  ) {
    throw new Error(
      'Usernames must contain 1–30 letters, numbers, dots, or underscores.',
    );
  }
  return username.toLowerCase();
}

export function validId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error('The source contains an invalid account ID.');
  return value.trim();
}

export interface IdentityIndex {
  lists: Map<string, AccountRecord>[];
  collision: boolean;
  warnings: string[];
}

/** One index shared by all lists lets a consistently supplied stable ID win over a rename. */
export function indexIdentities(input: AccountRecord[][]): IdentityIndex {
  const namesToIds = new Map<string, Set<string>>();
  const idToNames = new Map<string, Set<string>>();
  let usernameOnly = false;
  const normalized = input.map((records) =>
    records.map((record) => {
      const username = normalizeUsername(record.username);
      const id = validId(record.id);
      if (id !== undefined) {
        const ids = namesToIds.get(username) ?? new Set<string>();
        ids.add(id);
        namesToIds.set(username, ids);
        const names = idToNames.get(id) ?? new Set<string>();
        names.add(username);
        idToNames.set(id, names);
      } else usernameOnly = true;
      return { ...record, username, ...(id === undefined ? {} : { id }) };
    }),
  );
  const collision = [...namesToIds.values()].some((ids) => ids.size > 1);
  const warnings: string[] = [];
  if (collision)
    warnings.push(
      'Conflicting stable IDs share a username. Identity is ambiguous; negative relationships are withheld.',
    );
  if ([...idToNames.values()].some((names) => names.size > 1))
    warnings.push(
      'A stable ID has multiple usernames in the supplied data. Records were matched by stable ID; names may have changed.',
    );
  if (usernameOnly)
    warnings.push(
      'Some identities use usernames only. Renames or reused usernames can affect matching.',
    );
  const lists = normalized.map((records) => {
    const map = new Map<string, AccountRecord>();
    for (const record of records) {
      const knownIds = namesToIds.get(record.username);
      const resolved =
        record.id ??
        (knownIds?.size === 1 ? knownIds.values().next().value : undefined);
      const key =
        resolved === undefined
          ? `username:${record.username}`
          : `id:${resolved}`;
      const previous = map.get(key);
      if (!previous || (!previous.id && record.id)) map.set(key, record);
    }
    return map;
  });
  return { lists, collision, warnings };
}

function completenessEvidence(dataset: Dataset): {
  complete: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let complete = true;
  for (const direction of ['followers', 'following'] as const) {
    const list = dataset[direction];
    const meta = list.metadata;
    if (meta.completeness !== 'complete_for_source' || !meta.terminal)
      complete = false;
    const distinct = indexIdentities([list.records]).lists[0]!.size;
    if (
      ![meta.rawCount, meta.uniqueCount, meta.pages].every(
        (count) => Number.isSafeInteger(count) && count >= 0,
      ) ||
      meta.rawCount < list.records.length ||
      meta.rawCount < meta.uniqueCount ||
      meta.uniqueCount !== distinct ||
      (distinct > 0 && meta.pages === 0)
    ) {
      complete = false;
      warnings.push(
        `${direction} provenance has inconsistent row, unique-record, or page counts. Negative relationships are withheld.`,
      );
    }
    if (
      meta.expectedCount !== undefined &&
      (!Number.isSafeInteger(meta.expectedCount) ||
        meta.expectedCount < 0 ||
        meta.expectedCount !== distinct)
    ) {
      complete = false;
      warnings.push(
        `${direction} expected count does not reconcile with distinct supplied records. A count mismatch cannot establish completeness.`,
      );
    }
  }
  return { complete, warnings };
}

export function listComplete(dataset: Dataset): boolean {
  return completenessEvidence(dataset).complete;
}

export function compareDataset(dataset: Dataset): Comparison {
  if (dataset.schemaVersion !== 1)
    throw new Error('Unsupported dataset schema version.');
  const indexed = indexIdentities([
    dataset.followers.records,
    dataset.following.records,
  ]);
  const followers = indexed.lists[0]!;
  const following = indexed.lists[1]!;
  const evidence = completenessEvidence(dataset);
  const warnings = [
    ...indexed.warnings,
    ...evidence.warnings,
    ...dataset.followers.metadata.warnings,
    ...dataset.following.metadata.warnings,
  ];
  const negativesWithheld = !evidence.complete || indexed.collision;
  if (!evidence.complete)
    warnings.push(
      'One or both lists are partial or unverified. Missing accounts are not classified as negative relationships.',
    );
  const mutuals: AccountRecord[] = [];
  const notFollowingBack: AccountRecord[] = [];
  const notFollowedBackByYou: AccountRecord[] = [];
  for (const [key, record] of following) {
    if (followers.has(key)) mutuals.push(record);
    else if (!negativesWithheld) notFollowingBack.push(record);
  }
  if (!negativesWithheld)
    for (const [key, record] of followers)
      if (!following.has(key)) notFollowedBackByYou.push(record);
  return {
    mutuals,
    notFollowingBack,
    notFollowedBackByYou,
    unionCount: followers.size + following.size - mutuals.length,
    negativesWithheld,
    warnings: [...new Set(warnings)],
  };
}
