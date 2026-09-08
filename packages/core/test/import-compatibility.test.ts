import { describe, it, expect, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  importInstagram,
  importInstagramFiles,
  IMPORT_LIMITS,
} from '../src/import';
import { createSampleDataset } from '../src/sample';
import type { ImportFile } from '../src/types';
const row = (value: string) => ({
  title: '',
  media_list_data: [],
  string_list_data: [
    {
      value,
      href: `https://www.instagram.com/${value.replace(/^@/, '')}/`,
      timestamp: 1700000000,
    },
  ],
});
const json = (name: string, value: unknown): ImportFile => ({
  name,
  bytes: strToU8(JSON.stringify(value)),
});
const following = (names: string[]) => ({
  relationships_following: names.map(row),
});
const pair = () => [
  json('followers_1.json', [row('alpha'), row('mutual')]),
  json('following.json', following(['beta', 'mutual'])),
];
const html = (name: string, title: string, names: string[]) => ({
  name,
  bytes: strToU8(
    `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">${names.map((n) => `<div class="_a6-p"><a target="_blank" href="https://www.instagram.com/_u/${n}">${n}</a><div>Jan 1, 2025</div></div>`).join('')}</div></body></html>`,
  ),
});
const names = (list: { records: { username: string }[] }) =>
  list.records.map((r) => r.username);
const zip = (files: ImportFile[], name = 'export.zip', level: 0 | 6 = 6) => ({
  name,
  bytes: zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes])), {
    level,
  }),
});
function headers(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  const central = v.getUint32(end + 16, true);
  return { v, end, central };
}

describe('supplied-file compatibility and diagnostics', () => {
  it('does not require identity/date/confirmation and never grants live terminal evidence', async () => {
    const d = await importInstagram(pair());
    expect(d.account).toEqual({ username: '' });
    expect(d.comparisonBasis).toBe('supplied_files');
    expect(d.followers.metadata).toMatchObject({
      terminal: false,
      completeness: 'unverified',
      startedAt: null,
      endedAt: null,
    });
    expect(names(d.followers)).toEqual(['alpha', 'mutual']);
    expect(d.importSummary).toMatchObject({
      relevantFiles: 2,
      duplicatesCombined: 0,
      skippedRecords: 0,
      quarantinedRecords: 0,
    });
    const confirmed = await importInstagram(pair(), {
      confirmedComplete: true,
    });
    expect(confirmed.followers.metadata.terminal).toBe(false);
  });
  it('recognizes direction from wrappers despite arbitrary file names and extra metadata', async () => {
    const d = await importInstagram([
      json('part-a.json', {
        metadata: { harmless: true },
        relationships_followers: [
          {
            ...row('@Alpha'),
            unknown: { ok: true },
            media_list_data: [{ irrelevant: 'image' }],
          },
        ],
      }),
      json('part-b.json', {
        generated_by: 'Instagram',
        relationships_following: [
          {
            title: 'beta',
            string_list_data: [
              {
                href: 'https://www.instagram.com/_u/beta',
                timestamp: 'unknown',
                optional: 42,
              },
            ],
          },
        ],
      }),
    ]);
    expect(names(d.followers)).toEqual(['alpha']);
    expect(names(d.following)).toEqual(['beta']);
    expect(d.importSummary?.skippedRecords).toBe(0);
  });
  it('accepts profile URL-only, direct username, numeric IDs, strings and nested data variants', async () => {
    const d = await importInstagram([
      json('data.json', {
        connections: {
          followers: {
            data: [
              { username: '@ALPHA', id: 42, full_name: 'Alpha Person' },
              { href: 'https://www.instagram.com/_u/beta/' },
              '@mutual',
            ],
          },
          following: { edges: [{ node: { username: 'MUTUAL', pk: '99' } }] },
        },
      }),
    ]);
    expect(names(d.followers)).toEqual(['alpha', 'beta', 'mutual']);
    expect(d.followers.records[0]).toMatchObject({
      id: '42',
      displayName: 'Alpha Person',
    });
    expect(names(d.following)).toEqual(['mutual']);
  });
  it('offers explicit direction assignment without guessing from list sizes', async () => {
    const files = [
      json('people.json', [row('alpha'), row('beta')]),
      json('connections.json', [row('alpha')]),
    ];
    await expect(importInstagram(files)).rejects.toMatchObject({
      assignments: [
        { name: 'people.json', reason: expect.any(String) },
        { name: 'connections.json', reason: expect.any(String) },
      ],
    });
    const d = await importInstagram(files, {
      directions: {
        'people.json': 'following',
        'connections.json': 'followers',
      },
    });
    expect(names(d.followers)).toEqual(['alpha']);
    expect(names(d.following)).toEqual(['alpha', 'beta']);
  });
  it('rejects assignments conflicting with content and never accepts blocked/request lists as directions', async () => {
    await expect(
      importInstagram(pair(), {
        directions: { 'following.json': 'followers' },
      }),
    ).rejects.toThrow('conflicts');
    await expect(
      importInstagram(
        [
          json('blocked_accounts.json', [row('a')]),
          json('following.json', following(['b'])),
        ],
        { directions: { 'blocked_accounts.json': 'followers' } },
      ),
    ).rejects.toThrow('not a follower/following');
    await expect(
      importInstagram([
        json('followers.json', {
          relationships_follow_requests_sent: [row('a')],
        }),
        json('following.json', following(['b'])),
      ]),
    ).rejects.toThrow('No usable followers');
  });
  it('deduplicates split files while preserving known gaps as qualified input', async () => {
    const d = await importInstagram([
      json('followers_1.json', [row('alpha')]),
      json('followers_3.json', [row('alpha'), row('mutual')]),
      json('following.json', following(['beta'])),
    ]);
    expect(names(d.followers)).toEqual(['alpha', 'mutual']);
    expect(d.followers.metadata).toMatchObject({
      rawCount: 3,
      uniqueCount: 2,
      duplicateCount: 1,
      completeness: 'partial',
      terminal: false,
      pages: 2,
    });
    expect(d.importSummary?.warnings.join(' ')).toContain('missing');
  });
  it('counts malformed and contradictory rows while retaining usable records', async () => {
    const d = await importInstagram([
      json('followers.json', [
        row('alpha'),
        null,
        {},
        {
          string_list_data: [
            { value: 'beta', href: 'https://www.instagram.com/gamma/' },
          ],
        },
        { username: 'delta', extra_optional: { anything: true } },
      ]),
      json('following.json', following(['alpha', 'epsilon'])),
    ]);
    expect(names(d.followers)).toEqual(['alpha', 'delta']);
    expect(d.followers.metadata).toMatchObject({
      rawCount: 5,
      uniqueCount: 2,
      skippedCount: 2,
      quarantinedCount: 1,
      completeness: 'partial',
    });
    expect(d.importSummary).toMatchObject({
      skippedRecords: 2,
      quarantinedRecords: 1,
    });
  });
  it('preserves usable parts when one recognized part is unreadable and reports unknown omitted volume', async () => {
    const d = await importInstagram([
      json('followers_1.json', [row('alpha')]),
      { name: 'followers_2.json', bytes: strToU8('{corrupt') },
      json('following.json', following(['beta'])),
    ]);
    expect(names(d.followers)).toEqual(['alpha']);
    expect(d.followers.metadata.completeness).toBe('partial');
    expect(d.followers.metadata.warnings.join(' ')).toContain(
      'record count is unknown',
    );
  });
  it('distinguishes a structural empty list from missing or entirely unusable input', async () => {
    const d = await importInstagram([
      json('followers.json', []),
      json('following.json', following([])),
    ]);
    expect(names(d.followers)).toEqual([]);
    expect(names(d.following)).toEqual([]);
    await expect(importInstagram([pair()[0]!])).rejects.toThrow(
      'Missing following',
    );
    await expect(
      importInstagram([json('followers.json', [null, {}]), pair()[1]!]),
    ).rejects.toThrow('No usable followers');
  });
  it.each(['utf8', 'utf16le', 'utf16be'])(
    'accepts %s BOM JSON',
    async (encoding) => {
      const text = JSON.stringify([row('alpha')]);
      let bytes: Uint8Array;
      if (encoding === 'utf8')
        bytes = Uint8Array.from([239, 187, 191, ...strToU8(text)]);
      else {
        bytes = new Uint8Array(text.length * 2 + 2);
        const view = new DataView(bytes.buffer);
        view.setUint16(0, 0xfeff, encoding === 'utf16le');
        for (let i = 0; i < text.length; i++)
          view.setUint16(i * 2 + 2, text.charCodeAt(i), encoding === 'utf16le');
      }
      const d = await importInstagram([
        { name: 'followers.json', bytes },
        pair()[1]!,
      ]);
      expect(names(d.followers)).toEqual(['alpha']);
    },
  );
  it.each(['not-a-date', '2099-01-01T00:00:00Z'])(
    'only validates optional date when supplied: %s',
    async (collectedAt) => {
      await expect(importInstagram(pair(), { collectedAt })).rejects.toThrow(
        'Collection date',
      );
    },
  );
});

describe('inert relationship HTML', () => {
  it('matches equivalent JSON and real export card/container structure', async () => {
    const d = await importInstagram([
      html('who-follows.html', 'Followers', ['alpha', 'mutual']),
      html('who-i-follow.htm', 'Following', ['beta', 'mutual']),
    ]);
    expect(names(d.followers)).toEqual(['alpha', 'mutual']);
    expect(names(d.following)).toEqual(['beta', 'mutual']);
    expect(d.followers.metadata.terminal).toBe(false);
  });
  it('ignores scripts/resources/nav/footer and unrelated links while counting invalid relationship links', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const document = `<title>Followers</title><script>globalThis.__importExecuted=true;fetch('https://invalid.example/script')</script><link rel="stylesheet" href="https://invalid.example/a.css"><img src="https://invalid.example/a.png"><nav><a href="https://www.instagram.com/nav_owner">nav_owner</a></nav><h1>Followers</h1><ul><li><a href="https://www.instagram.com/alpha/">alpha</a></li><li><a href="javascript:alert(1)">bad</a></li></ul><p><a href="https://www.instagram.com/blog_owner">blog_owner</a></p><footer><a href="https://www.instagram.com/footer_owner">footer_owner</a></footer>`;
    try {
      const d = await importInstagram([
        { name: 'followers.html', bytes: strToU8(document) },
        html('following.html', 'Following', ['beta']),
      ]);
      expect(names(d.followers)).toEqual(['alpha']);
      expect(d.followers.metadata.quarantinedCount).toBe(1);
      expect(fetch).not.toHaveBeenCalled();
      expect(Object.hasOwn(globalThis, '__importExecuted')).toBe(false);
    } finally {
      fetch.mockRestore();
    }
  });
  it('separates explicit followers/following sections and excludes pending or blocked sections', async () => {
    const d = await importInstagram([
      {
        name: 'connections.html',
        bytes: strToU8(
          `<section aria-label="Followers"><ul><li><a href="https://www.instagram.com/alpha">alpha</a></li></ul></section><section aria-label="Pending requests"><ul><li><a href="https://www.instagram.com/pending_one">pending_one</a></li></ul></section><section id="list" aria-label="Following"><ul><li><a href="https://www.instagram.com/beta">beta</a></li></ul></section>`,
        ),
      },
    ]);
    expect(names(d.followers)).toEqual(['alpha']);
    expect(names(d.following)).toEqual(['beta']);
  });
  it('recognizes explicit empty relationship HTML but rejects an unrelated renamed page', async () => {
    const d = await importInstagram([
      html('followers.html', 'Followers', []),
      html('following.html', 'Following', []),
    ]);
    expect(names(d.followers)).toEqual([]);
    await expect(
      importInstagram([
        {
          name: 'followers.html',
          bytes: strToU8(
            '<title>Followers</title><p>A blog discussing followers.</p>',
          ),
        },
        html('following.html', 'Following', ['beta']),
      ]),
    ).rejects.toThrow('No usable followers');
  });
  it('asks for assignment for a loose relationship list with no direction label', async () => {
    const d = {
      name: 'people.html',
      bytes: strToU8(
        '<ul><li><a href="https://www.instagram.com/alpha">alpha</a></li></ul>',
      ),
    };
    await expect(importInstagram([d, pair()[1]!])).rejects.toMatchObject({
      assignments: [{ name: 'people.html', reason: expect.any(String) }],
    });
    const parsed = await importInstagram([d, pair()[1]!], {
      directions: { 'people.html': 'followers' },
    });
    expect(names(parsed.followers)).toEqual(['alpha']);
  });
});

describe('selective bounded archives', () => {
  it('supports multiple ZIP downloads, nested folders, HTML and repeated basenames', async () => {
    const d = await importInstagram([
      zip(
        [json('export/connections/followers_1.json', [row('alpha')])],
        'first.zip',
      ),
      zip(
        [
          json('second/followers_2.json', [row('mutual')]),
          html('second/following.html', 'Following', ['beta', 'mutual']),
        ],
        'second.zip',
      ),
    ]);
    expect(names(d.followers)).toEqual(['alpha', 'mutual']);
    expect(names(d.following)).toEqual(['beta', 'mutual']);
    expect(d.importSummary?.relevantFiles).toBe(3);
  });
  it('supports bounded nested ZIP containers', async () => {
    const d = await importInstagram([zip([zip(pair(), 'inner.zip')])]);
    expect(names(d.followers)).toEqual(['alpha', 'mutual']);
  });
  it('uses path context and small envelope discovery without exact basenames', async () => {
    const d = await importInstagram([
      zip([
        json('connections/followers/part001.json', [row('alpha')]),
        json('renamed.json', {
          relationships_following: [row('beta')],
          more: { metadata: true },
        }),
      ]),
    ]);
    expect(names(d.followers)).toEqual(['alpha']);
    expect(names(d.following)).toEqual(['beta']);
  });
  it('ignores irrelevant expansion bombs and thousands of irrelevant media entries', async () => {
    const irrelevant: Array<ImportFile> = Array.from(
      { length: 2100 },
      (_, i) => ({ name: `photos/photo-${i}.jpg`, bytes: new Uint8Array() }),
    );
    irrelevant.push({
      name: 'photos/huge.jpg',
      bytes: strToU8('x'.repeat(300000)),
    });
    const d = await importInstagram([zip([...pair(), ...irrelevant])]);
    expect(names(d.followers)).toEqual(['alpha', 'mutual']);
  });
  it('rejects a relevant compression bomb before parsing', async () => {
    await expect(
      importInstagram([
        zip([
          { name: 'followers.json', bytes: strToU8(' '.repeat(300000)) },
          pair()[1]!,
        ]),
      ]),
    ).rejects.toThrow('compression ratio');
  });
  it.each(['../followers.json', '/followers.json', 'a\\followers.json'])(
    'rejects unsafe path %s even before selected payloads are read',
    async (name) => {
      await expect(
        importInstagram([zip([{ name, bytes: strToU8('[]') }, pair()[1]!])]),
      ).rejects.toThrow('unsafe file path');
    },
  );
  it('rejects corrupted CRC, encrypted entries, directory bounds and excessive metadata', async () => {
    const corrupt = zip(pair(), 'bad.zip', 0);
    const { v, central } = headers(corrupt.bytes);
    v.setUint32(central + 16, 123, true);
    v.setUint32(14, 123, true);
    await expect(importInstagram([corrupt])).rejects.toThrow('checksum');
    const encrypted = zip(pair());
    const h = headers(encrypted.bytes);
    h.v.setUint16(h.central + 8, 1, true);
    await expect(importInstagram([encrypted])).rejects.toThrow('Encrypted');
    const bounds = zip(pair());
    const b = headers(bounds.bytes);
    b.v.setUint32(b.end + 16, b.central + 1, true);
    await expect(importInstagram([bounds])).rejects.toThrow('directory bounds');
    const excess = zip(pair());
    const e = headers(excess.bytes);
    e.v.setUint16(e.end + 8, IMPORT_LIMITS.archiveEntries + 1, true);
    e.v.setUint16(e.end + 10, IMPORT_LIMITS.archiveEntries + 1, true);
    await expect(importInstagram([excess])).rejects.toThrow('too many entries');
  });
  it('uses File.slice instead of reading a full archive with an 80 MiB media hole', async () => {
    const ordinary = zip(
      [...pair(), { name: 'photos/large.jpg', bytes: new Uint8Array([0]) }],
      'full.zip',
      0,
    );
    const { v, end, central } = headers(ordinary.bytes);
    let c = central;
    for (let i = 0; i < 2; i++)
      c +=
        46 +
        v.getUint16(c + 28, true) +
        v.getUint16(c + 30, true) +
        v.getUint16(c + 32, true);
    const mediaLocal = v.getUint32(c + 42, true),
      dataStart =
        mediaLocal +
        30 +
        v.getUint16(mediaLocal + 26, true) +
        v.getUint16(mediaLocal + 28, true);
    const mediaSize = 80 * 1024 * 1024,
      delta = mediaSize - 1;
    v.setUint32(mediaLocal + 18, mediaSize, true);
    v.setUint32(mediaLocal + 22, mediaSize, true);
    v.setUint32(c + 20, mediaSize, true);
    v.setUint32(c + 24, mediaSize, true);
    v.setUint32(end + 16, central + delta, true);
    const prefix = ordinary.bytes.slice(0, dataStart),
      suffix = ordinary.bytes.slice(dataStart + 1);
    const size = ordinary.bytes.length + delta;
    const reads: { start: number; end: number }[] = [];
    class VirtualFile extends File {
      constructor() {
        super([], 'full.zip', { type: 'application/zip' });
      }
      override get size() {
        return size;
      }
      override async arrayBuffer(): Promise<ArrayBuffer> {
        throw new Error('Whole archive read forbidden');
      }
      override slice(start = 0, end = this.size, type = '') {
        reads.push({ start, end });
        if (end - start > 65557) throw new Error('Unexpected large read');
        const out = new Uint8Array(end - start);
        for (const [offset, part] of [
          [0, prefix],
          [dataStart + mediaSize, suffix],
        ] as const) {
          const a = Math.max(start, offset),
            b = Math.min(end, offset + part.length);
          if (a < b) out.set(part.subarray(a - offset, b - offset), a - start);
        }
        return new Blob([out], { type });
      }
    }
    const d = await importInstagramFiles([new VirtualFile()]);
    expect(names(d.followers)).toEqual(['alpha', 'mutual']);
    expect(reads.reduce((sum, r) => sum + r.end - r.start, 0)).toBeLessThan(
      100000,
    );
    expect(Math.max(...reads.map((r) => r.end - r.start))).toBeLessThanOrEqual(
      65557,
    );
  });
});

describe('native MutualLens schema validation', () => {
  it('reopens exported data with optional export annotations and keeps sample labeling', async () => {
    const original = createSampleDataset(6000, 1500);
    const d = await importInstagram([
      json('mutuallens-synthetic-dataset.json', {
        ...original,
        exportScope: 'Synthetic sample',
        exportLimitations: ['Not a live account'],
      }),
    ]);
    expect(d.sample).toBe(true);
    expect(d.followers.records).toHaveLength(6000);
    expect(d.following.records).toHaveLength(6000);
    expect(d.comparisonBasis).toBe('supplied_files');
    expect(d.followers.metadata.terminal).toBe(false);
  });
  it('round-trips a supplied-file dataset with unknown owner and diagnostic counts', async () => {
    const first = await importInstagram([
      json('followers.json', [row('alpha'), null]),
      pair()[1]!,
    ]);
    const reopened = await importInstagram([
      json('mutuallens-dataset.json', first),
    ]);
    expect(reopened.account.username).toBe('');
    expect(reopened.followers.records).toEqual(first.followers.records);
    expect(reopened.followers.metadata.completeness).toBe('partial');
    expect(reopened.importSummary?.skippedRecords).toBe(1);
  });
  it.each(['version', 'record', 'counts', 'account', 'warnings'])(
    'rejects malformed native %s instead of casting it to a dataset',
    async (kind) => {
      const d: Record<string, unknown> = {
        ...structuredClone(createSampleDataset(2, 1)),
      };
      if (kind === 'version') d.schemaVersion = 99;
      if (kind === 'record')
        d.followers = { records: [{ username: 'bad name' }], metadata: {} };
      if (kind === 'counts') {
        const followers = d.followers as { metadata: { uniqueCount: number } };
        followers.metadata.uniqueCount = 99;
      }
      if (kind === 'account') delete d.account;
      if (kind === 'warnings') d.exportLimitations = [{ script: 'bad' }];
      await expect(
        importInstagram([json('mutuallens-dataset.json', d)]),
      ).rejects.toThrow('dataset');
    },
  );
});

describe('large and simple supported content variants', () => {
  it('reads recognized headings with simple div/account-link wrappers', async () => {
    const d = await importInstagram([
      {
        name: 'f.html',
        bytes: strToU8(
          '<h1>Followers</h1><div><a href="https://www.instagram.com/alpha">alpha</a></div>',
        ),
      },
      {
        name: 'g.html',
        bytes: strToU8(
          '<h1>Following</h1><div><a href="https://www.instagram.com/beta">beta</a></div>',
        ),
      },
    ]);
    expect(names(d.followers)).toEqual(['alpha']);
    expect(names(d.following)).toEqual(['beta']);
  });
  it.each([6000, 50000])(
    'preserves all %i records per direction without an owner or confirmation',
    async (size) => {
      const person = (n: number) => `synthetic_${String(n).padStart(6, '0')}`;
      const followers = Array.from({ length: size }, (_, i) => person(i));
      const followed = Array.from({ length: size }, (_, i) => person(i + 1500));
      const d = await importInstagram([
        json('followers.json', followers),
        json('following.json', { following: followed }),
      ]);
      expect(names(d.followers)).toEqual(followers);
      expect(names(d.following)).toEqual(followed);
      const set = new Set(names(d.followers));
      expect(names(d.following).filter((n) => set.has(n))).toHaveLength(
        size - 1500,
      );
    },
  );
  it('discovers a large renamed compressed direction wrapper through bounded content inspection', async () => {
    const rows = Array.from({ length: 12000 }, (_, i) => ({
      ...row(`synthetic_${i}`),
      extra: 'metadata data padding for realistic document bytes',
    }));
    const d = await importInstagram([
      zip([
        json('renamed-large.json', { relationships_followers: rows }),
        pair()[1]!,
      ]),
    ]);
    expect(d.followers.records).toHaveLength(12000);
  });
});
