/* eslint-disable no-control-regex -- Untrusted filenames and text reject control characters. */
import type { Direction } from './types';

/** Byte/work limits, independent of the number of relationship records. */
export const IMPORT_LIMITS = Object.freeze({
  inputBytes: 64 * 1024 * 1024,
  expandedBytes: 128 * 1024 * 1024,
  jsonBytes: 64 * 1024 * 1024,
  entries: 2000,
  compressionRatio: 200,
  archiveEntries: 50000,
  directoryBytes: 16 * 1024 * 1024,
  metadataBytes: 32 * 1024 * 1024,
  discoveryBytes: 8 * 1024 * 1024,
  nestedArchives: 3,
});
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function basename(name: string): string {
  return name.split('/').at(-1) ?? '';
}
export function safePath(name: string): string {
  const parts = (name.endsWith('/') ? name.slice(0, -1) : name).split('/');
  if (
    !name ||
    name.length > 1024 ||
    name.startsWith('/') ||
    name.includes('\\') ||
    /[:\u0000-\u001f\u007f]/.test(name) ||
    parts.some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('The archive contains an unsafe file path.');
  return name;
}
export function decodeText(bytes: Uint8Array): string {
  try {
    const encoding =
      bytes[0] === 0xff && bytes[1] === 0xfe
        ? 'utf-16le'
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? 'utf-16be'
          : 'utf-8';
    return new TextDecoder(encoding, { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, '');
  } catch {
    throw new Error(
      'The file contains invalid UTF-8 or UTF-16 text. Select an original Instagram JSON or HTML export.',
    );
  }
}
export function excludedPath(name: string): boolean {
  return /(?:^|[/_. -])(?:blocked|blocking|pending|requests?|close[_ -]?friends?|recently[_ -]?unfollowed|unfollowed|restricted|favorites|favourites|messages?|inbox|chats?|comments?|likes?|saved_posts|media|photos?|videos?)(?:[/_. -]|$)/i.test(
    name,
  );
}
export function directionHint(name: string): Direction | undefined {
  if (excludedPath(name)) return undefined;
  const base = basename(name)
    .replace(/\.(?:json|html?)$/i, '')
    .toLowerCase();
  const follower = /(?:^|[_. -])followers?(?:$|[_. -]|\d)/.test(base);
  const following = /(?:^|[_. -])following(?:$|[_. -]|\d)/.test(base);
  if (follower !== following) return follower ? 'followers' : 'following';
  const folders = name.toLowerCase().split('/').slice(0, -1);
  for (const folder of folders.reverse()) {
    if (/^(?:your[_ -])?followers?$/.test(folder)) return 'followers';
    if (/^(?:your[_ -])?following$/.test(folder)) return 'following';
  }
  return undefined;
}
export function partNumber(name: string, direction: Direction): number | null {
  const escaped = direction === 'followers' ? 'followers?' : 'following';
  const match = new RegExp(
    `(?:^|[_. -])${escaped}[_. -]+(?:part[_. -]*)?([1-9][0-9]*)(?:\\.(?:json|html?))?$`,
    'i',
  ).exec(basename(name));
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) ? number : null;
}
export function relationshipContext(name: string): boolean {
  return (
    !excludedPath(name) &&
    /(?:^|[/_. -])(?:connections?|relationships?|followers?_and_following|followers?|following)(?:[/_. -]|$)/i.test(
      name,
    )
  );
}
