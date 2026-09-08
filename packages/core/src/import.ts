/* eslint-disable no-control-regex -- Security validation explicitly rejects control characters. */
import { Inflate } from 'fflate';
import type {
  AccountList,
  AccountRecord,
  Dataset,
  Direction,
  ImportFile,
  ImportOptions,
} from './types';
import { indexIdentities, normalizeUsername, validId } from './identity';
import { knownCollectionDate } from './dates';

// Byte/format safeguards, never follower/following-count restrictions.
export const IMPORT_LIMITS = Object.freeze({
  inputBytes: 64 * 1024 * 1024,
  expandedBytes: 128 * 1024 * 1024,
  jsonBytes: 64 * 1024 * 1024,
  entries: 2000,
  compressionRatio: 200,
});
const utf8 = new TextDecoder('utf-8', { fatal: true });
const relevant = /^(followers|following)(?:_([1-9][0-9]*))?\.json$/i;
const relationshipLike = /^(?:followers|following)(?:[_. -].*)?\.json$/i;
interface Part {
  direction: Direction;
  number: number | null;
  name: string;
  bytes: Uint8Array;
}
interface ZipEntry {
  name: string;
  size: number;
  compressedSize: number;
  crc: number;
  method: number;
  dataStart: number;
  dataEnd: number;
  relevant: boolean;
}

function decode(bytes: Uint8Array): string {
  try {
    return utf8.decode(bytes);
  } catch {
    throw new Error(
      'The import contains invalid UTF-8 text. Export your information as JSON and try again.',
    );
  }
}

function safePath(name: string): string {
  const parts = name.endsWith('/')
    ? name.slice(0, -1).split('/')
    : name.split('/');
  if (
    !name ||
    name.length > 1024 ||
    name.startsWith('/') ||
    name.includes('\\') ||
    /[:\u0000-\u001f\u007f]/.test(name) ||
    parts.some((part) => part === '..' || part === '.' || part === '')
  ) {
    throw new Error('The archive contains an unsafe file path.');
  }
  return name;
}

function basename(name: string): string {
  return name.split('/').at(-1) ?? '';
}
const crcTable = Uint32Array.from({ length: 256 }, (_, number) => {
  let crc = number;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Inspect every central/local header before inflating anything. ZIP64/multidisk/encryption are not supported. */
function inspectZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22) throw new Error('The ZIP archive is truncated.');
  let end = -1;
  for (
    let index = bytes.length - 22;
    index >= Math.max(0, bytes.length - 65557);
    index--
  ) {
    if (
      view.getUint32(index, true) === 0x06054b50 &&
      index + 22 + view.getUint16(index + 20, true) === bytes.length
    ) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error('The ZIP archive has no valid directory.');
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryStart = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== count ||
    count === 0xffff ||
    directoryStart === 0xffffffff ||
    directorySize === 0xffffffff
  )
    throw new Error(
      'Encrypted, multipart, or ZIP64 archives are unsupported. Choose loose JSON files instead.',
    );
  if (count > IMPORT_LIMITS.entries)
    throw new Error(
      'The ZIP contains too many entries for safe local processing. Select only the follower/following JSON files.',
    );
  if (directoryStart + directorySize !== end)
    throw new Error('The ZIP directory bounds are invalid.');
  let cursor = directoryStart;
  let totalExpanded = 0;
  const names = new Set<string>();
  const entries: ZipEntry[] = [];
  const spans: { start: number; end: number }[] = [];
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error('The ZIP directory is malformed.');
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const disk = view.getUint16(cursor + 34, true);
    const attributes = view.getUint32(cursor + 38, true);
    const localStart = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end) throw new Error('The ZIP entry is truncated.');
    if (
      flags & 1 ||
      flags & 64 ||
      disk ||
      size === 0xffffffff ||
      compressedSize === 0xffffffff ||
      localStart === 0xffffffff
    )
      throw new Error(
        'Encrypted, multipart, or ZIP64 entries are unsupported.',
      );
    if (method !== 0 && method !== 8)
      throw new Error(
        'Unsupported ZIP compression. Use a standard ZIP or loose JSON files.',
      );
    if (((attributes >>> 16) & 0xf000) === 0xa000)
      throw new Error('Archive symbolic links are unsupported.');
    const name = safePath(
      decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)),
    );
    if (names.has(name.toLowerCase()))
      throw new Error('The ZIP contains duplicate file names.');
    names.add(name.toLowerCase());
    totalExpanded += size;
    if (totalExpanded > IMPORT_LIMITS.expandedBytes)
      throw new Error(
        'The archive expands beyond the local memory safety limit. Select only the relevant JSON files.',
      );
    if (size > Math.max(1, compressedSize) * IMPORT_LIMITS.compressionRatio)
      throw new Error(
        'The archive has an unsafe compression ratio. Choose loose JSON files.',
      );
    const isRelevant = relevant.test(basename(name));
    if (!isRelevant && relationshipLike.test(basename(name)))
      throw new Error(
        'Unsupported relationship filename in ZIP. Export parts were not silently ignored.',
      );
    if (isRelevant && size > IMPORT_LIMITS.jsonBytes)
      throw new Error('A JSON file exceeds the local memory safety limit.');
    if (
      localStart + 30 > directoryStart ||
      view.getUint32(localStart, true) !== 0x04034b50
    )
      throw new Error('The ZIP local header is invalid.');
    const localNameLength = view.getUint16(localStart + 26, true);
    const localExtraLength = view.getUint16(localStart + 28, true);
    const dataStart = localStart + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (
      dataStart > directoryStart ||
      dataEnd > directoryStart ||
      view.getUint16(localStart + 6, true) !== flags ||
      view.getUint16(localStart + 8, true) !== method ||
      decode(
        bytes.subarray(localStart + 30, localStart + 30 + localNameLength),
      ) !== name
    )
      throw new Error('The ZIP local and central headers disagree.');
    if (
      !(flags & 8) &&
      (view.getUint32(localStart + 14, true) !== crc ||
        view.getUint32(localStart + 18, true) !== compressedSize ||
        view.getUint32(localStart + 22, true) !== size)
    )
      throw new Error('The ZIP entry sizes or checksums disagree.');
    if (method === 0 && compressedSize !== size)
      throw new Error('The ZIP stored entry has invalid sizes.');
    spans.push({ start: localStart, end: dataEnd });
    entries.push({
      name,
      size,
      compressedSize,
      crc,
      method,
      dataStart,
      dataEnd,
      relevant: isRelevant,
    });
    cursor = next;
  }
  if (cursor !== end)
    throw new Error('The ZIP directory size is inconsistent.');
  spans.sort((a, b) => a.start - b.start);
  if (spans.some((span, i) => i > 0 && span.start < spans[i - 1]!.end))
    throw new Error('The ZIP entries overlap.');
  return entries;
}

function inflateEntry(archive: Uint8Array, entry: ZipEntry): Uint8Array {
  let bytes: Uint8Array;
  if (entry.method === 0) bytes = archive.slice(entry.dataStart, entry.dataEnd);
  else {
    const chunks: Uint8Array[] = [];
    let actualSize = 0;
    const inflater = new Inflate((chunk) => {
      actualSize += chunk.length;
      if (
        actualSize > entry.size ||
        actualSize > IMPORT_LIMITS.jsonBytes ||
        actualSize >
          Math.max(1, entry.compressedSize) * IMPORT_LIMITS.compressionRatio
      )
        throw new Error(
          'The ZIP expands beyond its declared size or safe resource limits.',
        );
      chunks.push(chunk);
    });
    try {
      // Small compressed chunks bound transient output even when declared sizes lie.
      for (let start = entry.dataStart; start < entry.dataEnd; start += 4096)
        inflater.push(
          archive.subarray(start, Math.min(start + 4096, entry.dataEnd)),
          start + 4096 >= entry.dataEnd,
        );
      if (entry.compressedSize === 0) inflater.push(new Uint8Array(), true);
    } catch (cause) {
      throw new Error(
        'The ZIP entry is corrupt or exceeds safe decompression limits.',
        { cause },
      );
    }
    if (actualSize !== entry.size)
      throw new Error('The ZIP expanded size does not match its directory.');
    bytes = new Uint8Array(actualSize);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  }
  if (crc32(bytes) !== entry.crc)
    throw new Error('The ZIP entry checksum is invalid.');
  return bytes;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keysAllowed(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseRecords(part: Part): AccountRecord[] {
  if (part.bytes.length > IMPORT_LIMITS.jsonBytes)
    throw new Error('A JSON file exceeds the local memory safety limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(decode(part.bytes));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UTF-8')) throw error;
    throw new Error(
      'A follower/following file is not valid JSON. Request a JSON export, not HTML.',
      { cause: error },
    );
  }
  let rows: unknown;
  if (part.direction === 'followers' && Array.isArray(parsed)) rows = parsed;
  else if (object(parsed)) {
    const key =
      part.direction === 'following'
        ? 'relationships_following'
        : 'relationships_followers';
    if (!keysAllowed(parsed, [key]) || !Array.isArray(parsed[key]))
      throw new Error(
        'Unsupported Instagram JSON schema. Expected a follower array or a relationships_following object.',
      );
    rows = parsed[key];
  }
  if (!Array.isArray(rows))
    throw new Error(
      'Unsupported Instagram JSON schema. Missing input is not an empty list.',
    );
  return rows.map((row) => {
    if (
      !object(row) ||
      !keysAllowed(row, [
        'title',
        'media_list_data',
        'string_list_data',
        'id',
      ]) ||
      !Array.isArray(row.string_list_data) ||
      row.string_list_data.length !== 1 ||
      (row.title !== undefined && typeof row.title !== 'string') ||
      (row.media_list_data !== undefined &&
        (!Array.isArray(row.media_list_data) ||
          row.media_list_data.length !== 0))
    )
      throw new Error(
        'Unsupported relationship row. No records were silently discarded.',
      );
    const item: unknown = row.string_list_data[0];
    if (
      !object(item) ||
      !keysAllowed(item, ['value', 'href', 'timestamp']) ||
      (item.value !== undefined && typeof item.value !== 'string') ||
      (item.href !== undefined && typeof item.href !== 'string') ||
      (item.timestamp !== undefined &&
        (typeof item.timestamp !== 'number' ||
          !Number.isSafeInteger(item.timestamp) ||
          item.timestamp < 0))
    )
      throw new Error('A relationship row has invalid fields.');
    const original =
      typeof item.value === 'string' && item.value.trim()
        ? item.value
        : part.direction === 'following' && typeof row.title === 'string'
          ? row.title
          : undefined;
    if (!original)
      throw new Error('A relationship row has no supported username value.');
    const username = normalizeUsername(original);
    if (
      typeof item.href === 'string' &&
      normalizeUsername(item.href) !== username
    )
      throw new Error(
        'A relationship row has conflicting username and profile URL identities.',
      );
    if (
      typeof row.title === 'string' &&
      row.title.trim() &&
      part.direction === 'following' &&
      normalizeUsername(row.title) !== username
    )
      throw new Error(
        'A following row has conflicting title and username identities.',
      );
    const id = validId(row.id);
    return {
      username,
      originalUsername: original,
      ...(id ? { id } : {}),
      source: `Instagram JSON: ${basename(part.name)}`,
    };
  });
}

export async function importInstagram(
  files: ImportFile[],
  options: ImportOptions,
): Promise<Dataset> {
  if (!files.length)
    throw new Error(
      'Choose follower and following JSON files, or their ZIP archive.',
    );
  const username = normalizeUsername(options.account.username);
  const id = validId(options.account.id);
  const collectedAt = options.collectedAt ?? null;
  if (collectedAt !== null && !knownCollectionDate(collectedAt))
    throw new Error(
      'Collection date must be a valid known UTC ISO timestamp and cannot be in the future; leave it blank if unknown.',
    );
  const inputBytes = files.reduce(
    (total, file) => total + file.bytes.length,
    0,
  );
  if (inputBytes > IMPORT_LIMITS.inputBytes)
    throw new Error(
      'Selected files exceed the 64 MiB input safety budget. Select only the follower/following JSON files.',
    );
  if (files.length > IMPORT_LIMITS.entries)
    throw new Error('Too many input files for safe local processing.');
  const parts: Part[] = [];
  let entryCount = 0;
  let expandedBytes = 0;
  const add = (name: string, bytes: Uint8Array): void => {
    const match = relevant.exec(basename(name));
    if (match)
      parts.push({
        direction: match[1]!.toLowerCase() as Direction,
        number: match[2] ? Number(match[2]) : null,
        name,
        bytes,
      });
  };
  for (const file of files) {
    safePath(file.name);
    if (/\.zip$/i.test(file.name)) {
      const entries = inspectZip(file.bytes);
      entryCount += entries.length;
      expandedBytes += entries.reduce((sum, entry) => sum + entry.size, 0);
      if (
        entryCount > IMPORT_LIMITS.entries ||
        expandedBytes > IMPORT_LIMITS.expandedBytes
      )
        throw new Error(
          'The selected archives exceed the combined safe entry or expanded-byte budget.',
        );
      for (const entry of entries)
        if (entry.relevant) add(entry.name, inflateEntry(file.bytes, entry));
    } else if (relevant.test(basename(file.name))) {
      entryCount++;
      expandedBytes += file.bytes.length;
      if (
        entryCount > IMPORT_LIMITS.entries ||
        expandedBytes > IMPORT_LIMITS.expandedBytes
      )
        throw new Error('The selected files exceed safe resource limits.');
      add(file.name, file.bytes);
    } else
      throw new Error(
        'Unsupported input filename. Choose followers.json, followers_1.json (and every part), following.json, or an Instagram ZIP.',
      );
  }
  const names = new Set<string>();
  for (const part of parts) {
    const key = basename(part.name).toLowerCase();
    if (names.has(key))
      throw new Error(
        'Duplicate relationship filenames may mix different exports. Import one account and collection at a time.',
      );
    names.add(key);
  }
  const result = {} as Record<Direction, AccountList>;
  for (const direction of ['followers', 'following'] as const) {
    const selected = parts.filter((part) => part.direction === direction);
    if (!selected.length)
      throw new Error(
        `Missing ${direction} JSON input. A missing direction cannot be treated as an empty list.`,
      );
    const numbered = selected
      .filter((part) => part.number !== null)
      .sort((a, b) => a.number! - b.number!);
    if (numbered.length && numbered.length !== selected.length)
      throw new Error(
        'Numbered and unnumbered files for one direction cannot be mixed. Import one complete export.',
      );
    const hasGap = numbered.some((part, index) => part.number !== index + 1);
    const records = selected.flatMap(parseRecords);
    const indexed = indexIdentities([records]);
    const unique = [...indexed.lists[0]!.values()];
    const warnings = [...indexed.warnings];
    if (unique.length !== records.length)
      warnings.push(
        `${records.length - unique.length} duplicate records were combined by identity.`,
      );
    if (hasGap)
      warnings.push(
        'Numbered export parts are missing. This list is partial even if completeness was confirmed.',
      );
    if (!options.confirmedComplete)
      warnings.push(
        'All export parts have not been confirmed. Completeness is unverified.',
      );
    if (collectedAt === null)
      warnings.push(
        'Instagram collection date is unknown. Import time is not collection time; relationship timestamps are not used as collection dates.',
      );
    warnings.push(
      'Completeness describes the supplied export only. It does not verify current live Instagram relationships.',
    );
    result[direction] = {
      records: unique,
      metadata: {
        source: 'Instagram JSON export',
        version: 'instagram-relationships-v1',
        startedAt: collectedAt,
        endedAt: collectedAt,
        rawCount: records.length,
        uniqueCount: unique.length,
        completeness: hasGap
          ? 'partial'
          : options.confirmedComplete && !indexed.collision
            ? 'complete_for_source'
            : 'unverified',
        terminal:
          !hasGap && options.confirmedComplete === true && !indexed.collision,
        pages: selected.length,
        warnings,
      },
    };
  }
  return {
    schemaVersion: 1,
    account: { username, ...(id ? { id } : {}) },
    ...result,
    importedAt: new Date().toISOString(),
    sample: false,
  };
}
