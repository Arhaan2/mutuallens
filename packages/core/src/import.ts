import type {
  AccountList,
  AccountRecord,
  Dataset,
  Direction,
  ImportAssignment,
  ImportFile,
  ImportOptions,
} from './types';
import { indexIdentities, normalizeUsername, validId } from './identity';
import { knownCollectionDate } from './dates';
import {
  IMPORT_LIMITS,
  basename,
  decodeText,
  directionHint,
  excludedPath,
  object,
  partNumber,
  safePath,
} from './import-safety';
import {
  inspectZip,
  newBudget,
  readZipEntry,
  readZipPrefix,
} from './import-archive';
import type { ByteSource, ReadBudget } from './import-archive';
import { parseRelationshipHtml } from './import-html';
import { parseNativeDataset } from './import-native';
export { IMPORT_LIMITS } from './import-safety';

interface Part {
  direction: Direction;
  name: string;
  number: number | null;
  format: 'JSON' | 'HTML';
  rows: unknown[];
  unreadable?: string;
}
interface Collection {
  direction?: Direction;
  rows: unknown[];
}
interface Parsed {
  parts: Part[];
  assignments: ImportAssignment[];
  native?: Dataset;
}
interface RowResult {
  record?: AccountRecord;
  skipped?: boolean;
  quarantined?: boolean;
}
const nativeKeys = ['schemaVersion', 'account', 'followers', 'following'];
const directions = ['followers', 'following'] as const;
function normalizeId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    return validId(String(value));
  return validId(value);
}
function account(options: ImportOptions): Dataset['account'] {
  if (!options.account) return { username: '' };
  const username = options.account.username?.trim()
    ? normalizeUsername(options.account.username)
    : '';
  const id = normalizeId(options.account.id);
  return { username, ...(id ? { id } : {}) };
}
function collectionRows(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (object(value)) {
    for (const key of ['data', 'items', 'records', 'edges'])
      if (Array.isArray(value[key])) return value[key];
  }
  return undefined;
}
function jsonCollections(value: unknown, hint?: Direction): Collection[] {
  const found: Collection[] = [];
  function walk(node: unknown, depth: number): void {
    if (depth > 8 || !object(node)) return;
    for (const direction of directions)
      for (const key of [`relationships_${direction}`, direction])
        if (Object.hasOwn(node, key)) {
          const rows = collectionRows(node[key]);
          if (!rows)
            throw new Error(
              `The ${direction} JSON container is not a supported list.`,
            );
          found.push({ direction, rows });
        }
    if (found.length) return;
    // These are structural wrappers, not an unrestricted traversal through profile links.
    for (const key of [
      'data',
      'connections',
      'relationships',
      'export',
      'instagram',
      'user',
    ])
      if (object(node[key])) walk(node[key], depth + 1);
    if (object(node.edge_followed_by)) {
      const rows = collectionRows(node.edge_followed_by);
      if (rows) found.push({ direction: 'followers', rows });
    }
    if (object(node.edge_follow)) {
      const rows = collectionRows(node.edge_follow);
      if (rows) found.push({ direction: 'following', rows });
    }
  }
  walk(value, 0);
  if (found.length) return found;
  const rows = collectionRows(value);
  if (rows) return [{ ...(hint ? { direction: hint } : {}), rows }];
  throw new Error(
    'Unsupported Instagram JSON schema. Select a relationship array or a recognized followers/following container.',
  );
}
function rowRecord(
  value: unknown,
  direction: Direction,
  source: string,
): RowResult {
  try {
    if (object(value) && object(value.node)) value = value.node;
    if (typeof value === 'string') {
      const username = normalizeUsername(value);
      return { record: { username, originalUsername: value, source } };
    }
    if (!object(value)) return { skipped: true };
    const candidates: string[] = [];
    let invalidIdentity = false;
    const add = (item: unknown, profile = false) => {
      if (item === undefined || item === null || item === '') return;
      if (typeof item !== 'string') {
        invalidIdentity = true;
        return;
      }
      try {
        if (profile && !/^https:\/\//i.test(item.trim())) {
          invalidIdentity = true;
          return;
        }
        candidates.push(item);
      } catch {
        invalidIdentity = true;
      }
    };
    for (const key of ['username', 'user_name', 'userName', 'handle'])
      add(value[key]);
    for (const key of ['href', 'url', 'profile_url', 'profileUrl'])
      add(value[key], true);
    if (Array.isArray(value.string_list_data)) {
      for (const item of value.string_list_data) {
        if (!object(item)) {
          invalidIdentity = true;
          continue;
        }
        add(item.value);
        add(item.username);
        add(item.href, true);
      }
      if (!candidates.length && direction === 'following') add(value.title);
      else if (
        direction === 'following' &&
        typeof value.title === 'string' &&
        value.title.trim() &&
        value.string_list_data.every((item) => object(item) && !item.value)
      )
        add(value.title);
    } else if (value.string_list_data !== undefined) invalidIdentity = true;
    else add(value.value);
    if (!candidates.length) return { skipped: true };
    const names = new Set<string>();
    for (const candidate of candidates) {
      try {
        names.add(normalizeUsername(candidate));
      } catch {
        invalidIdentity = true;
      }
    }
    if (names.size > 1 || invalidIdentity) return { quarantined: true };
    if (!names.size) return { skipped: true };
    const username = names.values().next().value;
    if (!username) return { skipped: true };
    const id = normalizeId(value.id ?? value.pk ?? value.user_id);
    const displayName =
      typeof value.display_name === 'string'
        ? value.display_name
        : typeof value.full_name === 'string'
          ? value.full_name
          : undefined;
    return {
      record: {
        username,
        originalUsername: candidates[0]!,
        source,
        ...(id ? { id } : {}),
        ...(displayName && displayName.length <= 1000 ? { displayName } : {}),
      },
    };
  } catch {
    return { quarantined: true };
  }
}
function parseFile(
  name: string,
  bytes: Uint8Array,
  options: ImportOptions,
  loose: boolean,
): Parsed {
  const hint = directionHint(name),
    assigned = options.directions?.[name];
  if (assigned !== undefined && !directions.includes(assigned))
    throw new Error('Choose followers or following for each assigned file.');
  if (excludedPath(name)) {
    if (loose)
      throw new Error(
        `${basename(name)} is not a follower/following list. Blocked accounts, requests, messages, and other lists are unsupported here.`,
      );
    return { parts: [], assignments: [] };
  }
  const format = /\.html?$/i.test(name) ? 'HTML' : 'JSON';
  let text: string;
  try {
    text = decodeText(bytes);
  } catch (cause) {
    if (hint)
      return {
        parts: [
          {
            direction: hint,
            name,
            number: partNumber(name, hint),
            format,
            rows: [],
            unreadable: (cause as Error).message,
          },
        ],
        assignments: [],
      };
    throw cause;
  }
  let collections: Collection[];
  try {
    if (format === 'HTML')
      collections = parseRelationshipHtml(text, assigned ?? hint);
    else {
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (cause) {
        throw new Error(
          'A relationship file is not valid JSON. Select an original JSON or HTML export.',
          { cause },
        );
      }
      if (
        object(value) &&
        (Object.hasOwn(value, 'schemaVersion') ||
          nativeKeys.every((key) => Object.hasOwn(value, key)))
      )
        return {
          parts: [],
          assignments: [],
          native: parseNativeDataset(value, options),
        };
      collections = jsonCollections(value, assigned ?? hint);
    }
  } catch (cause) {
    if (hint)
      return {
        parts: [
          {
            direction: hint,
            name,
            number: partNumber(name, hint),
            format,
            rows: [],
            unreadable:
              cause instanceof Error
                ? cause.message
                : 'The file could not be read.',
          },
        ],
        assignments: [],
      };
    throw cause;
  }
  const parts: Part[] = [];
  const assignments: ImportAssignment[] = [];
  for (const collection of collections) {
    const direction = collection.direction ?? assigned ?? hint;
    if (!direction) {
      if (loose) {
        assignments.push({
          name,
          reason:
            'This file contains a list but its followers/following direction is not identified. Choose the direction from your export.',
        });
      }
      continue;
    }
    if (assigned && collection.direction && assigned !== collection.direction)
      throw new Error(
        `The assigned direction for ${basename(name)} conflicts with its recognized ${collection.direction} container.`,
      );
    // A recognized content container wins over a renamed basename; never use list length.
    parts.push({
      direction,
      name,
      number: partNumber(name, direction),
      format,
      rows: collection.rows,
    });
  }
  return { parts, assignments };
}
function sourceFromBytes(file: ImportFile): ByteSource {
  return {
    name: file.name,
    size: file.bytes.length,
    read: async (start, end) => file.bytes.subarray(start, end),
  };
}
function sourceFromFile(file: File): ByteSource {
  return {
    name: file.name,
    size: file.size,
    read: async (start, end) =>
      new Uint8Array(await file.slice(start, end).arrayBuffer()),
  };
}
function chargeLoose(size: number, budget: ReadBudget): void {
  if (size > IMPORT_LIMITS.jsonBytes)
    throw new Error(
      'A relationship file exceeds the 64 MiB local parsing budget. Select a smaller original export part.',
    );
  budget.compressedBytes += size;
  budget.expandedBytes += size;
  if (
    budget.compressedBytes > IMPORT_LIMITS.inputBytes ||
    budget.expandedBytes > IMPORT_LIMITS.expandedBytes
  )
    throw new Error(
      'Selected relationship files exceed the 64 MiB input safety budget. Select only the relevant follower/following files.',
    );
}
async function readSources(
  sources: ByteSource[],
  options: ImportOptions,
): Promise<Parsed> {
  if (!sources.length)
    throw new Error(
      'Choose follower and following JSON or HTML files, or their ZIP archives.',
    );
  if (sources.length > IMPORT_LIMITS.entries)
    throw new Error(
      'Too many selected files for safe local processing. Select only the relevant export parts.',
    );
  const looseBytes = sources
    .filter((source) => !/\.zip$/i.test(source.name))
    .reduce((sum, source) => sum + source.size, 0);
  if (looseBytes > IMPORT_LIMITS.inputBytes)
    throw new Error(
      'Selected relationship files exceed the 64 MiB input safety budget. Select only the relevant JSON/HTML parts.',
    );
  const budget = newBudget(),
    result: Parsed = { parts: [], assignments: [] };
  const merge = (parsed: Parsed) => {
    result.parts.push(...parsed.parts);
    result.assignments.push(...parsed.assignments);
    if (parsed.native) {
      if (result.native)
        throw new Error('Select one MutualLens dataset at a time.');
      result.native = parsed.native;
    }
  };
  async function visit(
    source: ByteSource,
    depth: number,
    displayPrefix = '',
  ): Promise<void> {
    safePath(source.name);
    if (/\.zip$/i.test(source.name)) {
      if (depth > IMPORT_LIMITS.nestedArchives)
        throw new Error(
          'ZIP nesting exceeds the safe inspection depth. Select the innermost relationship archive directly.',
        );
      const entries = await inspectZip(source, budget);
      for (const entry of entries) {
        if (entry.name.endsWith('/') || excludedPath(entry.name)) continue;
        if (/\.zip$/i.test(entry.name)) {
          const nested = await readZipEntry(source, entry, budget);
          await visit(
            sourceFromBytes({ name: entry.name, bytes: nested }),
            depth + 1,
            `${displayPrefix}${source.name}/`,
          );
          continue;
        }
        if (!/\.(?:json|html?)$/i.test(entry.name)) continue;
        // A shared export folder alone does not identify a relationship document.
        // Inspect a bounded content prefix for unnamed entries, including files
        // beside the relationship lists, before spending the full parsing budget.
        const recognized = !!directionHint(entry.name);
        // Bounded prefix discovery recognizes large renamed wrappers without loading
        // unrelated documents in full. Full selected content still receives CRC checks.
        let discovered = recognized;
        if (!recognized) {
          const prefix = await readZipPrefix(source, entry, budget);
          const text = new TextDecoder().decode(prefix).replace(/^\uFEFF/, '');
          if (/\.json$/i.test(entry.name))
            discovered =
              /"(?:relationships_followers|relationships_following|followers|following|edge_followed_by|edge_follow|schemaVersion)"\s*:/.test(
                text,
              );
          else {
            try {
              discovered = parseRelationshipHtml(text).some(
                (part) => !!part.direction,
              );
            } catch {
              discovered = false;
            }
          }
        }
        if (!discovered) continue;
        const bytes = await readZipEntry(source, entry, budget);
        const name = `${displayPrefix}${source.name}/${entry.name}`;
        try {
          const parsed = parseFile(name, bytes, options, false);
          if (parsed.parts.length || parsed.native) {
            if (++budget.relevantFiles > IMPORT_LIMITS.entries)
              throw new Error(
                'Too many relationship documents for bounded parsing. Select only the required parts.',
              );
            merge(parsed);
          }
        } catch (cause) {
          if (discovered) throw cause;
        }
      }
    } else {
      if (!/\.(?:json|html?)$/i.test(source.name))
        throw new Error(
          'Unsupported file type. Select Instagram JSON, HTML, ZIP, or a MutualLens dataset JSON file.',
        );
      if (excludedPath(source.name))
        throw new Error(
          `${basename(source.name)} is not a follower/following list. Select the relationship files.`,
        );
      chargeLoose(source.size, budget);
      const bytes = await source.read(0, source.size);
      if (bytes.length !== source.size)
        throw new Error(
          'The selected file could not be read completely. Please select it again.',
        );
      merge(parseFile(source.name, bytes, options, true));
    }
  }
  for (const source of sources) await visit(source, 0);
  if (result.native && (result.parts.length || sources.length > 1))
    throw new Error(
      'Select a MutualLens dataset by itself, or select Instagram relationship files together. Do not mix the formats.',
    );
  return result;
}
async function importSources(
  sources: ByteSource[],
  options: ImportOptions,
): Promise<Dataset> {
  const owner = account(options),
    collectedAt = options.collectedAt || null;
  if (collectedAt !== null && !knownCollectionDate(collectedAt))
    throw new Error(
      'Collection date must be a valid known UTC ISO timestamp and cannot be in the future; leave it blank if unknown.',
    );
  const parsed = await readSources(sources, options);
  if (parsed.assignments.length)
    throw Object.assign(
      new Error(
        'Choose whether each unrecognized list contains followers or following, then compare again.',
      ),
      { assignments: parsed.assignments },
    );
  if (parsed.native) return parsed.native;
  const lists: Partial<Record<Direction, AccountList>> = {};
  for (const direction of directions) {
    const parts = parsed.parts.filter((part) => part.direction === direction);
    if (!parts.length)
      throw new Error(
        `Missing ${direction} input. Select that JSON or HTML list; a missing direction is not an empty list. If an archive uses unfamiliar names, select its relationship files directly.`,
      );
    const numbered = parts
      .filter((part) => part.number !== null)
      .map((part) => part.number!)
      .sort((a, b) => a - b);
    const uniqueNumbers = [...new Set(numbered)];
    const hasGap = uniqueNumbers.some((n, i) => n !== i + 1);
    const warnings: string[] = [];
    if (hasGap)
      warnings.push(
        'Numbered export parts are missing. Differences describe only the supplied records.',
      );
    if (numbered.length && numbered.length !== parts.length)
      warnings.push(
        'Numbered and unnumbered files were combined. Confirm they belong to the same export; duplicate identities were combined.',
      );
    const records: AccountRecord[] = [];
    let rawCount = 0,
      skippedCount = 0,
      quarantinedCount = 0,
      unreadable = 0;
    for (const part of parts) {
      if (part.unreadable) {
        unreadable++;
        warnings.push(
          `${basename(part.name)} could not be read: ${part.unreadable} Its record count is unknown.`,
        );
        continue;
      }
      for (const value of part.rows) {
        rawCount++;
        const result = rowRecord(
          value,
          direction,
          `Instagram ${part.format}: ${basename(part.name)}`,
        );
        if (result.record) records.push(result.record);
        else if (result.quarantined) quarantinedCount++;
        else skippedCount++;
      }
    }
    if (!records.length && rawCount + unreadable > 0)
      throw new Error(
        `No usable ${direction} identities could be read. Select a readable ${direction} file. ${warnings[0] ?? 'The supplied rows were invalid or ambiguous.'}`,
      );
    const indexed = indexIdentities([records]),
      unique = [...indexed.lists[0]!.values()],
      duplicateCount = records.length - unique.length;
    if (duplicateCount)
      warnings.push(
        `${duplicateCount} duplicate records were combined by identity.`,
      );
    if (skippedCount)
      warnings.push(
        `${skippedCount} unreadable relationship rows were skipped; omitted identities may affect the differences.`,
      );
    if (quarantinedCount)
      warnings.push(
        `${quarantinedCount} relationship rows with conflicting or invalid identities were quarantined; omitted identities may affect the differences.`,
      );
    if (indexed.collision)
      warnings.push(
        'Some usernames have conflicting stable IDs. Those identities require separate review.',
      );
    const knownLimitations =
      hasGap || unreadable > 0 || skippedCount > 0 || quarantinedCount > 0;
    lists[direction] = {
      records: unique,
      metadata: {
        source: 'Instagram relationship export',
        version: 'instagram-relationships-v2',
        startedAt: collectedAt,
        endedAt: collectedAt,
        rawCount,
        uniqueCount: unique.length,
        completeness: knownLimitations ? 'partial' : 'unverified',
        terminal: false,
        pages: parts.length,
        warnings,
        skippedCount,
        quarantinedCount,
        duplicateCount,
        files: parts.map((part) => part.name),
      },
    };
  }
  const followers = lists.followers,
    following = lists.following;
  if (!followers || !following)
    throw new Error('Select both followers and following lists.');
  const warnings = [
    ...new Set([
      ...followers.metadata.warnings,
      ...following.metadata.warnings,
    ]),
  ];
  return {
    schemaVersion: 1,
    account: owner,
    followers,
    following,
    importedAt: new Date().toISOString(),
    sample: false,
    comparisonBasis: 'supplied_files',
    importSummary: {
      relevantFiles: new Set(parsed.parts.map((part) => part.name)).size,
      duplicatesCombined:
        (followers.metadata.duplicateCount ?? 0) +
        (following.metadata.duplicateCount ?? 0),
      skippedRecords:
        (followers.metadata.skippedCount ?? 0) +
        (following.metadata.skippedCount ?? 0),
      quarantinedRecords:
        (followers.metadata.quarantinedCount ?? 0) +
        (following.metadata.quarantinedCount ?? 0),
      warnings,
    },
  };
}
/** Compatibility API for byte fixtures and callers that already hold small files. */
export async function importInstagram(
  files: ImportFile[],
  options: ImportOptions = {},
): Promise<Dataset> {
  return importSources(files.map(sourceFromBytes), options);
}
/** Browser API: ZIP metadata and selected entries use Blob.slice; media is not loaded. */
export async function importInstagramFiles(
  files: File[],
  options: ImportOptions = {},
): Promise<Dataset> {
  return importSources(files.map(sourceFromFile), options);
}
