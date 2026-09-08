import { Inflate } from 'fflate';
import { IMPORT_LIMITS, safePath } from './import-safety';

export interface ByteSource {
  name: string;
  size: number;
  read(start: number, end: number): Promise<Uint8Array>;
}
export interface ReadBudget {
  metadataBytes: number;
  archiveEntries: number;
  compressedBytes: number;
  expandedBytes: number;
  discoveryBytes: number;
  relevantFiles: number;
}
export const newBudget = (): ReadBudget => ({
  metadataBytes: 0,
  archiveEntries: 0,
  compressedBytes: 0,
  expandedBytes: 0,
  discoveryBytes: 0,
  relevantFiles: 0,
});
export interface ZipEntry {
  name: string;
  size: number;
  compressedSize: number;
  crc: number;
  method: number;
  flags: number;
  localStart: number;
  dataStart: number;
  dataEnd: number;
}
async function read(
  source: ByteSource,
  start: number,
  end: number,
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    end > source.size
  )
    throw new Error('The ZIP entry bounds are invalid.');
  const bytes = await source.read(start, end);
  if (bytes.length !== end - start)
    throw new Error('The ZIP archive is truncated.');
  return bytes;
}
async function metadata(
  source: ByteSource,
  start: number,
  end: number,
  budget: ReadBudget,
): Promise<Uint8Array> {
  budget.metadataBytes += end - start;
  if (budget.metadataBytes > IMPORT_LIMITS.metadataBytes)
    throw new Error(
      'Archive metadata exceeds the bounded inspection budget. Select the followers/following folder or its relationship files only.',
    );
  return read(source, start, end);
}
function decodeName(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      'The ZIP contains invalid UTF-8 filenames. Select the relationship files directly.',
    );
  }
}

/** Read bounded directory/header metadata; never read unrelated entry contents. */
export async function inspectZip(
  source: ByteSource,
  budget: ReadBudget,
): Promise<ZipEntry[]> {
  if (source.size < 22) throw new Error('The ZIP archive is truncated.');
  const tailStart = Math.max(0, source.size - 65557);
  const tail = await metadata(source, tailStart, source.size, budget);
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--)
    if (
      tailView.getUint32(i, true) === 0x06054b50 &&
      i + 22 + tailView.getUint16(i + 20, true) === tail.length
    ) {
      end = i;
      break;
    }
  if (end < 0) throw new Error('The ZIP archive has no valid directory.');
  const count = tailView.getUint16(end + 10, true),
    directorySize = tailView.getUint32(end + 12, true),
    directoryStart = tailView.getUint32(end + 16, true);
  if (
    tailView.getUint16(end + 4, true) ||
    tailView.getUint16(end + 6, true) ||
    tailView.getUint16(end + 8, true) !== count ||
    count === 0xffff ||
    directorySize === 0xffffffff ||
    directoryStart === 0xffffffff
  )
    throw new Error(
      'Encrypted, multipart, or ZIP64 archives are unsupported. Select ordinary ZIP parts separately or loose relationship files.',
    );
  budget.archiveEntries += count;
  if (budget.archiveEntries > IMPORT_LIMITS.archiveEntries)
    throw new Error(
      'The archives contain too many entries for bounded metadata inspection. Select the relationship folder only.',
    );
  if (directorySize > IMPORT_LIMITS.directoryBytes)
    throw new Error(
      'The ZIP directory exceeds the metadata inspection budget. Select the relationship folder only.',
    );
  if (directoryStart + directorySize !== tailStart + end)
    throw new Error('The ZIP directory bounds are invalid.');
  const directory = await metadata(
    source,
    directoryStart,
    directoryStart + directorySize,
    budget,
  );
  const view = new DataView(
    directory.buffer,
    directory.byteOffset,
    directory.byteLength,
  );
  const names = new Set<string>();
  const entries: ZipEntry[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    if (
      cursor + 46 > directory.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error('The ZIP directory is malformed.');
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      crc = view.getUint32(cursor + 16, true),
      compressedSize = view.getUint32(cursor + 20, true),
      size = view.getUint32(cursor + 24, true),
      nameLength = view.getUint16(cursor + 28, true),
      extraLength = view.getUint16(cursor + 30, true),
      commentLength = view.getUint16(cursor + 32, true),
      disk = view.getUint16(cursor + 34, true),
      attributes = view.getUint32(cursor + 38, true),
      localStart = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > directory.length) throw new Error('The ZIP entry is truncated.');
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
    if (((attributes >>> 16) & 0xf000) === 0xa000)
      throw new Error('Archive symbolic links are unsupported.');
    const name = safePath(
      decodeName(directory.subarray(cursor + 46, cursor + 46 + nameLength)),
    );
    if (names.has(name.toLowerCase()))
      throw new Error('The ZIP contains duplicate file names.');
    names.add(name.toLowerCase());
    if (
      localStart + 30 > directoryStart ||
      localStart + 30 + compressedSize > directoryStart
    )
      throw new Error('The ZIP entry bounds are invalid.');
    entries.push({
      name,
      flags,
      method,
      crc,
      compressedSize,
      size,
      localStart,
      dataStart: 0,
      dataEnd: 0,
    });
    cursor = next;
  }
  if (cursor !== directory.length)
    throw new Error('The ZIP directory size is inconsistent.');
  // Header reads are bounded metadata and use modest concurrency, including for media.
  // Checking all spans catches forged overlap without ever loading media payloads.
  for (let start = 0; start < entries.length; start += 16)
    await Promise.all(
      entries.slice(start, start + 16).map(async (entry) => {
        const header = await metadata(
          source,
          entry.localStart,
          entry.localStart + 30,
          budget,
        );
        const h = new DataView(
          header.buffer,
          header.byteOffset,
          header.byteLength,
        );
        if (h.getUint32(0, true) !== 0x04034b50)
          throw new Error('The ZIP local header is invalid.');
        const nameLength = h.getUint16(26, true),
          extraLength = h.getUint16(28, true);
        entry.dataStart = entry.localStart + 30 + nameLength + extraLength;
        entry.dataEnd = entry.dataStart + entry.compressedSize;
        if (
          entry.dataStart > directoryStart ||
          entry.dataEnd > directoryStart ||
          h.getUint16(6, true) !== entry.flags ||
          h.getUint16(8, true) !== entry.method
        )
          throw new Error('The ZIP local and central headers disagree.');
        const name = await metadata(
          source,
          entry.localStart + 30,
          entry.localStart + 30 + nameLength,
          budget,
        );
        if (decodeName(name) !== entry.name)
          throw new Error('The ZIP local and central headers disagree.');
        if (
          !(entry.flags & 8) &&
          (h.getUint32(14, true) !== entry.crc ||
            h.getUint32(18, true) !== entry.compressedSize ||
            h.getUint32(22, true) !== entry.size)
        )
          throw new Error('The ZIP entry sizes or checksums disagree.');
        if (entry.method === 0 && entry.compressedSize !== entry.size)
          throw new Error('The ZIP stored entry has invalid sizes.');
      }),
    );
  const spans = [...entries].sort((a, b) => a.localStart - b.localStart);
  if (
    spans.some((entry, i) => i > 0 && entry.localStart < spans[i - 1]!.dataEnd)
  )
    throw new Error('The ZIP entries overlap.');
  return entries;
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
export async function readZipEntry(
  source: ByteSource,
  entry: ZipEntry,
  budget: ReadBudget,
): Promise<Uint8Array> {
  if (entry.method !== 0 && entry.method !== 8)
    throw new Error(
      'Unsupported relationship ZIP compression. Select loose JSON or HTML files.',
    );
  if (entry.size > IMPORT_LIMITS.jsonBytes)
    throw new Error(
      'A relationship file exceeds the 64 MiB local parsing budget. Select a smaller original export part.',
    );
  if (
    entry.size >
    Math.max(1, entry.compressedSize) * IMPORT_LIMITS.compressionRatio
  )
    throw new Error(
      'A relationship entry has an unsafe compression ratio. Select the loose relationship files.',
    );
  budget.compressedBytes += entry.compressedSize;
  budget.expandedBytes += entry.size;
  if (
    budget.compressedBytes > IMPORT_LIMITS.inputBytes ||
    budget.expandedBytes > IMPORT_LIMITS.expandedBytes
  )
    throw new Error(
      'Selected relationship data exceeds the compressed or expanded local memory safety budget. Select only the required relationship parts.',
    );
  const compressed = await read(source, entry.dataStart, entry.dataEnd);
  let bytes: Uint8Array;
  if (entry.method === 0) bytes = compressed;
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
        throw new Error('The ZIP expands beyond declared safe bounds.');
      chunks.push(chunk);
    });
    try {
      for (let start = 0; start < compressed.length; start += 4096)
        inflater.push(
          compressed.subarray(start, Math.min(start + 4096, compressed.length)),
          start + 4096 >= compressed.length,
        );
      if (!compressed.length) inflater.push(new Uint8Array(), true);
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

/** Bounded content discovery for renamed documents; output is only a format hint.
 * A selected full entry is subsequently decompressed and CRC-validated normally. */
export async function readZipPrefix(
  source: ByteSource,
  entry: ZipEntry,
  budget: ReadBudget,
): Promise<Uint8Array> {
  if (entry.method !== 0 && entry.method !== 8) return new Uint8Array();
  const length = Math.min(entry.compressedSize, 65536);
  if (budget.discoveryBytes + length > IMPORT_LIMITS.discoveryBytes)
    return new Uint8Array();
  budget.discoveryBytes += length;
  const input = await read(source, entry.dataStart, entry.dataStart + length);
  if (entry.method === 0) return input.subarray(0, 16384);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const stop = new Error('Discovery prefix collected');
  const inflater = new Inflate((chunk) => {
    const available = Math.min(chunk.length, 16384 - size);
    if (available > 0) {
      chunks.push(chunk.subarray(0, available));
      size += available;
    }
    if (size >= 16384) throw stop;
  });
  try {
    for (let i = 0; i < input.length; i += 256)
      inflater.push(
        input.subarray(i, Math.min(i + 256, input.length)),
        i + 256 >= input.length && length === entry.compressedSize,
      );
  } catch (cause) {
    if (cause !== stop) return new Uint8Array();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
