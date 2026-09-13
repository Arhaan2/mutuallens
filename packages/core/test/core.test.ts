import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  compareDataset,
  compareSnapshots,
  createSampleDataset,
  createSnapshot,
  exportCsv,
  exportDataset,
  importInstagram,
  normalizeUsername,
} from '../src';
import { IMPORT_LIMITS } from '../src/import';
import { inspectZip, newBudget, readZipEntry } from '../src/import-archive';
import type { AccountRecord, Dataset, ImportFile } from '../src';

const options = {
  account: { username: 'synthetic_owner' },
  collectedAt: '2026-01-01T12:00:00Z',
};
const json = (name: string, data: unknown): ImportFile => ({
  name,
  bytes: strToU8(JSON.stringify(data)),
});
const row = (username: string) => ({
  title: '',
  media_list_data: [],
  string_list_data: [
    {
      value: username,
      href: `https://www.instagram.com/${username}/`,
      timestamp: 1750000000,
    },
  ],
});
const followingRow = (username: string) => ({
  title: username,
  string_list_data: [
    { href: `https://www.instagram.com/_u/${username}`, timestamp: 1750000000 },
  ],
});
const fixture = (size = 6000, offset = 1500): ImportFile[] => {
  const sample = createSampleDataset(size, offset);
  return [
    json(
      'followers_1.json',
      sample.followers.records.map((record) => row(record.username)),
    ),
    json('following.json', {
      relationships_following: sample.following.records.map((record) =>
        followingRow(record.username),
      ),
    }),
  ];
};
const record = (username: string, id?: string): AccountRecord => ({
  username,
  originalUsername: username,
  ...(id ? { id } : {}),
  source: 'synthetic fixture',
});
function replaceRecords(
  dataset: Dataset,
  followers: AccountRecord[],
  following: AccountRecord[],
): Dataset {
  dataset.followers.records = followers;
  dataset.following.records = following;
  for (const direction of ['followers', 'following'] as const) {
    dataset[direction].metadata.rawCount = dataset[direction].records.length;
    dataset[direction].metadata.uniqueCount = new Set(
      dataset[direction].records.map((item) =>
        item.id ? `id:${item.id}` : `name:${normalizeUsername(item.username)}`,
      ),
    ).size;
  }
  return dataset;
}
const archive = (files: ImportFile[], level: 0 | 6 = 6): ImportFile => ({
  name: 'synthetic_export.zip',
  bytes: zipSync(
    Object.fromEntries(
      files.map((file) => [
        `connections/followers_and_following/${file.name}`,
        file.bytes,
      ]),
    ),
    { level },
  ),
});
function zipHeaders(bytes: Uint8Array): {
  view: DataView;
  end: number;
  central: number;
  local: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  const central = view.getUint32(end + 16, true);
  return { view, end, central, local: view.getUint32(central + 42, true) };
}

describe('username validation', () => {
  it.each([
    ['  @Alice.Example_2  ', 'alice.example_2'],
    [
      'https://www.instagram.com/Alice.Example_2/?igsh=example',
      'alice.example_2',
    ],
    ['https://instagram.com/_u/Some_User', 'some_user'],
    ['a.b_c', 'a.b_c'],
  ])('normalizes %s without deleting punctuation', (input, expected) =>
    expect(normalizeUsername(input)).toBe(expected),
  );
  it.each([
    '',
    '@@alice',
    'a b',
    '../alice',
    'a'.repeat(31),
    'http://instagram.com/alice',
    'https://instagram.com.evil.example/alice',
    'https://evil.example/alice',
    'https://alice@instagram.com/bob',
    'https://instagram.com/p/abc',
    'https://instagram.com/alice/bob',
    'https://instagram.com:444/alice',
    'javascript:alert(1)',
    'https://instagram.com/%2e%2e%2fsecret',
  ])('rejects unsafe/non-profile input %s', (input) =>
    expect(() => normalizeUsername(input)).toThrow(),
  );
});

describe('deterministic identity and comparison', () => {
  it('matches the specified synthetic 6,000 × 6,000 result', () => {
    const result = compareDataset(createSampleDataset());
    expect(result.mutuals).toHaveLength(4500);
    expect(result.notFollowingBack).toHaveLength(1500);
    expect(result.notFollowedBackByYou).toHaveLength(1500);
    expect(result.unionCount).toBe(7500);
    expect(result.negativesWithheld).toBe(false);
  });
  it.each([2499, 2500, 2501, 6000, 6001, 50000])(
    'does not cap %i records per direction (synthetic)',
    (size) => {
      const started = performance.now();
      const sample = createSampleDataset(size, 500);
      const result = compareDataset(sample);
      expect(sample.followers.records).toHaveLength(size);
      expect(sample.following.records).toHaveLength(size);
      expect(result.mutuals.length + result.notFollowingBack.length).toBe(size);
      expect(result.mutuals).toHaveLength(size - 500);
      expect(result.unionCount).toBe(size + 500);
      if (size === 50000)
        console.info(
          JSON.stringify({
            metric: 'synthetic_create_and_compare_ms',
            sizePerDirection: size,
            elapsedMs: Number((performance.now() - started).toFixed(2)),
          }),
        );
    },
  );
  it('accepts explicitly supplied empty lists', () => {
    const result = compareDataset(createSampleDataset(0));
    expect(result).toMatchObject({
      mutuals: [],
      notFollowingBack: [],
      notFollowedBackByYou: [],
      unionCount: 0,
      negativesWithheld: false,
    });
  });
  it.each(['partial', 'unverified'] as const)(
    'withholds all source-evidence negatives when followers are %s',
    (completeness) => {
      const dataset = createSampleDataset();
      dataset.comparisonBasis = 'source_evidence';
      dataset.followers.metadata.completeness = completeness;
      const result = compareDataset(dataset);
      expect(result.negativesWithheld).toBe(true);
      expect(result.mutuals).toHaveLength(4500);
      expect(result.notFollowingBack).toEqual([]);
      expect(result.notFollowedBackByYou).toEqual([]);
    },
  );
  it('requires terminal source evidence even with a complete label', () => {
    const dataset = createSampleDataset();
    dataset.comparisonBasis = 'source_evidence';
    dataset.following.metadata.terminal = false;
    expect(compareDataset(dataset).negativesWithheld).toBe(true);
  });
  it.each(['expected count', 'unique count', 'raw count', 'pages'] as const)(
    'withholds negatives for inconsistent %s provenance',
    (field) => {
      const dataset = createSampleDataset(3, 1);
      dataset.comparisonBasis = 'source_evidence';
      if (field === 'expected count')
        dataset.followers.metadata.expectedCount = 4;
      if (field === 'unique count') dataset.followers.metadata.uniqueCount = 1;
      if (field === 'raw count') dataset.followers.metadata.rawCount = -1;
      if (field === 'pages') dataset.followers.metadata.pages = 0;
      expect(compareDataset(dataset).negativesWithheld).toBe(true);
    },
  );
  it('deduplicates case variants and preserves dot and underscore distinctions', () => {
    const dataset = replaceRecords(
      createSampleDataset(0),
      [record('Alice'), record('@ALICE'), record('a.b'), record('a_b')],
      [record('alice'), record('ab')],
    );
    const result = compareDataset(dataset);
    expect(result.mutuals.map((item) => item.username)).toEqual(['alice']);
    expect(result.notFollowedBackByYou).toHaveLength(2);
    expect(result.unionCount).toBe(4);
  });
  it('matches a stable ID across a rename', () => {
    const dataset = replaceRecords(
      createSampleDataset(0),
      [record('old_name', '123')],
      [record('new_name', '123')],
    );
    const result = compareDataset(dataset);
    expect(result.mutuals).toHaveLength(1);
    expect(result.notFollowingBack).toEqual([]);
    expect(result.warnings.join(' ')).toContain('multiple usernames');
  });
  it('uses a unique known ID for mixed ID/username source rows, with uncertainty', () => {
    const dataset = replaceRecords(
      createSampleDataset(0),
      [record('alice', '123')],
      [record('alice')],
    );
    const result = compareDataset(dataset);
    expect(result.mutuals).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('usernames only');
  });
  it('does not silently merge conflicting IDs sharing a username', () => {
    const dataset = replaceRecords(
      createSampleDataset(0),
      [record('alice', '123')],
      [record('alice', '456'), record('bob', '789')],
    );
    dataset.comparisonBasis = 'source_evidence';
    const result = compareDataset(dataset);
    expect(result.mutuals).toEqual([]);
    expect(result.unionCount).toBe(3);
    expect(result.negativesWithheld).toBe(true);
    expect(result.notFollowingBack).toEqual([]);
  });
  it('does not mutate the original dataset', () => {
    const dataset = replaceRecords(
      createSampleDataset(0),
      [record('Alice')],
      [record('ALICE')],
    );
    const original = structuredClone(dataset);
    compareDataset(dataset);
    expect(dataset).toEqual(original);
  });
});

describe('Instagram JSON import (synthetic format fixtures)', () => {
  it('reads both tested following value/title variants and follower wrappers', async () => {
    const valueVersion = await importInstagram(
      [
        json('followers.json', { relationships_followers: [row('alpha')] }),
        json('following.json', { relationships_following: [row('alpha')] }),
      ],
      options,
    );
    const titleVersion = await importInstagram(
      [
        json('followers.json', [row('alpha')]),
        json('following.json', {
          relationships_following: [followingRow('alpha')],
        }),
      ],
      options,
    );
    expect(compareDataset(valueVersion).mutuals).toHaveLength(1);
    expect(compareDataset(titleVersion).mutuals).toHaveLength(1);
  });
  it('produces equivalent split loose and ZIP results while ignoring irrelevant archive files', async () => {
    const parts = [
      json('followers_1.json', [row('alpha'), row('beta')]),
      json('followers_2.json', [row('gamma'), row('ALPHA')]),
      json('following.json', {
        relationships_following: [followingRow('beta'), followingRow('delta')],
      }),
    ];
    const loose = await importInstagram(parts, options);
    const zipped = await importInstagram(
      [
        archive([
          ...parts,
          {
            name: 'irrelevant.json',
            bytes: strToU8('not JSON, deliberately not parsed'),
          },
        ]),
      ],
      options,
    );
    for (const direction of ['followers', 'following'] as const) {
      expect(zipped[direction].records).toEqual(loose[direction].records);
      const { files: loosePaths, ...looseMetadata } = loose[direction].metadata;
      const { files: archivePaths, ...archiveMetadata } =
        zipped[direction].metadata;
      expect(archiveMetadata).toEqual(looseMetadata);
      expect(archivePaths).toEqual(
        loosePaths?.map(
          (name) =>
            `synthetic_export.zip/connections/followers_and_following/${name}`,
        ),
      );
    }
    expect(loose.followers.metadata).toMatchObject({
      rawCount: 4,
      uniqueCount: 3,
      pages: 2,
      completeness: 'unverified',
      terminal: false,
      duplicateCount: 1,
    });
    expect(zipped.importSummary?.relevantFiles).toBe(3);
    expect(compareDataset(zipped)).toMatchObject({
      negativesWithheld: false,
      negativeBasis: 'supplied_files',
    });
  });
  it('reports invalid JSON when a user explicitly selects an unnamed loose document', async () => {
    await expect(
      importInstagram([
        ...fixture(1),
        {
          name: 'irrelevant.json',
          bytes: strToU8('not JSON, deliberately invalid'),
        },
      ]),
    ).rejects.toThrow('not valid JSON');
  });
  it.each([2499, 2500, 2501, 6000, 6001, 50000])(
    'parses and compares all %i synthetic records per direction',
    async (size) => {
      const files = fixture(size);
      const started = performance.now();
      const dataset = await importInstagram(files, options);
      const result = compareDataset(dataset);
      expect(dataset.followers.records).toHaveLength(size);
      expect(dataset.following.records).toHaveLength(size);
      expect(result.mutuals).toHaveLength(size - 1500);
      expect(result.notFollowingBack).toHaveLength(1500);
      expect(result.notFollowedBackByYou).toHaveLength(1500);
      if (size === 6000 || size === 50000)
        console.info(
          JSON.stringify({
            metric: 'synthetic_json_parse_and_compare_ms',
            sizePerDirection: size,
            inputBytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
            elapsedMs: Number((performance.now() - started).toFixed(2)),
            heapUsedBytes: process.memoryUsage().heapUsed,
          }),
        );
    },
  );
  it('parses the compressed 6,000 × 6,000 synthetic fixture', async () => {
    const zipped = archive(fixture());
    const start = performance.now();
    const dataset = await importInstagram([zipped], options);
    const result = compareDataset(dataset);
    expect(result.mutuals).toHaveLength(4500);
    expect(result.unionCount).toBe(7500);
    console.info(
      JSON.stringify({
        metric: 'synthetic_zip_parse_and_compare_ms',
        sizePerDirection: 6000,
        compressedBytes: zipped.bytes.length,
        elapsedMs: Number((performance.now() - start).toFixed(2)),
      }),
    );
  });
  it('compares unverified supplied files without inventing collection dates', async () => {
    const dataset = await importInstagram(fixture(2, 1), {
      account: { username: '@Owner' },
    });
    expect(dataset.account.username).toBe('owner');
    expect(dataset.followers.metadata).toMatchObject({
      completeness: 'unverified',
      terminal: false,
      startedAt: null,
      endedAt: null,
    });
    expect(dataset.comparisonBasis).toBe('supplied_files');
    const result = compareDataset(dataset);
    expect(result.negativesWithheld).toBe(false);
    expect(result.negativeBasis).toBe('supplied_files');
    expect(result.mutuals).toHaveLength(1);
    expect(result.notFollowingBack).toHaveLength(1);
    expect(result.notFollowedBackByYou).toHaveLength(1);
  });
  it('preserves valid empty inputs separately from missing inputs', async () => {
    const files = [
      json('followers.json', []),
      json('following.json', { relationships_following: [] }),
    ];
    const result = compareDataset(await importInstagram(files, options));
    expect(result.unionCount).toBe(0);
    expect(result.negativesWithheld).toBe(false);
    await expect(importInstagram([files[0]!], options)).rejects.toThrow(
      'Missing following',
    );
    await expect(importInstagram([files[1]!], options)).rejects.toThrow(
      'Missing followers',
    );
  });
  it('keeps missing numbered parts partial despite user confirmation', async () => {
    const files = [
      json('followers_1.json', [row('alpha')]),
      json('followers_3.json', [row('beta')]),
      json('following.json', { relationships_following: [row('gamma')] }),
    ];
    const dataset = await importInstagram(files, {
      ...options,
      confirmedComplete: true,
    });
    expect(dataset.followers.metadata.completeness).toBe('partial');
    expect(dataset.followers.metadata.terminal).toBe(false);
    const result = compareDataset(dataset);
    expect(result.negativesWithheld).toBe(false);
    expect(result.negativeBasis).toBe('provisional_files');
    expect(result.notFollowingBack.map((item) => item.username)).toEqual([
      'gamma',
    ]);
    expect(result.notFollowedBackByYou.map((item) => item.username)).toEqual([
      'alpha',
      'beta',
    ]);
    expect(result.warnings.join(' ')).toContain(
      'Numbered export parts are missing',
    );
    expect(
      JSON.parse(exportDataset(dataset)).exportLimitations.join(' '),
    ).toContain('Numbered export parts are missing');
  });
  it.each([
    [json('followers.json', { unknown: [] }), 'schema'],
    [
      json('followers.json', [{ string_list_data: [] }]),
      'No usable followers identities',
    ],
    [
      json('followers.json', [{ string_list_data: [1] }]),
      'No usable followers identities',
    ],
    [
      json('followers.json', [
        {
          string_list_data: [
            { value: 'alpha', href: 'https://www.instagram.com/beta' },
          ],
        },
      ]),
      'No usable followers identities',
    ],
    [{ name: 'followers.json', bytes: strToU8('{bad') }, 'valid JSON'],
    [{ name: 'followers.json', bytes: new Uint8Array([0xff]) }, 'UTF-8'],
  ] as const)(
    'rejects malformed/schema input %# without fabricated data',
    async (file, error) => {
      await expect(
        importInstagram(
          [file, json('following.json', { relationships_following: [] })],
          options,
        ),
      ).rejects.toThrow(error);
    },
  );
  it.each([
    { value: 'alpha', unexpected: true },
    { value: 'alpha', timestamp: 'unknown' },
  ])(
    'accepts harmless optional fields without fabricating identity %#',
    async (value) => {
      const dataset = await importInstagram([
        json('followers.json', [{ string_list_data: [value] }]),
        json('following.json', { relationships_following: [row('alpha')] }),
      ]);
      expect(dataset.followers.records.map((item) => item.username)).toEqual([
        'alpha',
      ]);
      expect(dataset.followers.metadata).toMatchObject({
        skippedCount: 0,
        quarantinedCount: 0,
        completeness: 'unverified',
        terminal: false,
      });
      expect(compareDataset(dataset).mutuals).toHaveLength(1);
    },
  );
  it('combines repeated basenames across folders without dropping distinct records', async () => {
    const dataset = await importInstagram([
      json('one/followers_1.json', [row('alpha'), row('beta')]),
      json('two/followers_1.json', [row('ALPHA'), row('gamma')]),
      json('following.json', { relationships_following: [] }),
    ]);
    expect(
      dataset.followers.records.map((item) => item.username).sort(),
    ).toEqual(['alpha', 'beta', 'gamma']);
    expect(dataset.followers.metadata).toMatchObject({
      rawCount: 4,
      uniqueCount: 3,
      duplicateCount: 1,
      files: ['one/followers_1.json', 'two/followers_1.json'],
    });
    expect(dataset.importSummary).toMatchObject({
      relevantFiles: 3,
      duplicatesCombined: 1,
    });
  });
  it('combines numbered and unnumbered copies with a visible qualification', async () => {
    const dataset = await importInstagram([
      json('followers.json', [row('alpha')]),
      json('followers_1.json', [row('ALPHA'), row('beta')]),
      json('following.json', { relationships_following: [] }),
    ]);
    expect(
      dataset.followers.records.map((item) => item.username).sort(),
    ).toEqual(['alpha', 'beta']);
    expect(dataset.followers.metadata).toMatchObject({
      rawCount: 3,
      uniqueCount: 2,
      duplicateCount: 1,
      terminal: false,
    });
    expect(dataset.importSummary?.warnings.join(' ')).toContain(
      'Numbered and unnumbered files were combined',
    );
    expect(compareDataset(dataset).notFollowedBackByYou).toHaveLength(2);
  });
  it('reads recognized HTML lists without requiring JSON', async () => {
    const dataset = await importInstagram([
      {
        name: 'followers.html',
        bytes: strToU8(
          '<h1>Followers</h1><div><a href="https://www.instagram.com/alpha/">alpha</a></div>',
        ),
      },
      {
        name: 'following.html',
        bytes: strToU8(
          '<h1>Following</h1><div><a href="https://www.instagram.com/beta/">beta</a></div>',
        ),
      },
    ]);
    expect(dataset.followers.records.map((item) => item.username)).toEqual([
      'alpha',
    ]);
    expect(
      compareDataset(dataset).notFollowingBack.map((item) => item.username),
    ).toEqual(['beta']);
    expect(dataset.followers.metadata.terminal).toBe(false);
  });
  it('rejects unrecognized HTML rather than treating it as an empty list', async () => {
    await expect(
      importInstagram(
        [
          { name: 'followers.html', bytes: strToU8('<html>') },
          json('following.json', []),
        ],
        options,
      ),
    ).rejects.toThrow('No usable followers identities');
  });
  it('rejects unsupported loose file types', async () => {
    await expect(
      importInstagram([{ name: 'followers.txt', bytes: strToU8('alpha') }]),
    ).rejects.toThrow('Unsupported file type');
  });
  it.each([
    'yesterday',
    '2025-02-30T00:00:00Z',
    '2999-01-01T00:00:00Z',
    '2025-01-01T25:00:00Z',
  ])(
    'rejects unknown/invalid user-supplied collection date %s',
    async (collectedAt) => {
      await expect(
        importInstagram(fixture(0), { ...options, collectedAt }),
      ).rejects.toThrow('Collection date');
    },
  );
});

describe('archive resource and integrity safeguards', () => {
  it.each(['followers_0.json', 'followers_01.json', 'following_invalid.json'])(
    'includes flexibly named relationship part %s instead of silently dropping it',
    async (name) => {
      const dataset = await importInstagram(
        [archive([...fixture(1), json(name, [row('extra_account')])])],
        options,
      );
      const direction = name.startsWith('followers')
        ? 'followers'
        : 'following';
      expect(dataset[direction].records.map((item) => item.username)).toContain(
        'extra_account',
      );
      expect(dataset[direction].records).toHaveLength(2);
      expect(dataset[direction].metadata.terminal).toBe(false);
      expect(dataset.importSummary?.relevantFiles).toBe(3);
    },
  );
  it.each([
    '../followers.json',
    '/followers.json',
    'C:/followers.json',
    'a\\followers.json',
    'a/../followers.json',
    'a/./followers.json',
  ])('rejects path %s before expansion', async (path) => {
    const bytes = zipSync({ [path]: strToU8('[]') });
    await expect(
      importInstagram([{ name: 'bad.zip', bytes }], options),
    ).rejects.toThrow('unsafe file path');
  });
  it('rejects invalid UTF-8 inside ZIP entries', async () => {
    await expect(
      importInstagram(
        [
          archive([
            { name: 'followers.json', bytes: new Uint8Array([0xff]) },
            json('following.json', { relationships_following: [] }),
          ]),
        ],
        options,
      ),
    ).rejects.toThrow('UTF-8');
  });
  it('rejects dangerous compression ratios before inflating', async () => {
    const bytes = zipSync({ 'followers.json': strToU8(' '.repeat(200000)) });
    await expect(
      importInstagram([{ name: 'bad.zip', bytes }], options),
    ).rejects.toThrow('compression ratio');
  });
  it('rejects excessive directory entries before parsing them', async () => {
    const file = archive(fixture(1));
    const { view, end } = zipHeaders(file.bytes);
    view.setUint16(end + 8, IMPORT_LIMITS.archiveEntries + 1, true);
    view.setUint16(end + 10, IMPORT_LIMITS.archiveEntries + 1, true);
    await expect(importInstagram([file], options)).rejects.toThrow(
      'too many entries for bounded metadata inspection',
    );
  });
  it('rejects a selected-entry expansion budget overflow before allocating output', async () => {
    const file = archive(fixture(1));
    const { view, central, local } = zipHeaders(file.bytes);
    view.setUint32(central + 24, IMPORT_LIMITS.jsonBytes + 1, true);
    view.setUint32(local + 22, IMPORT_LIMITS.jsonBytes + 1, true);
    await expect(importInstagram([file], options)).rejects.toThrow(
      'parsing budget',
    );
  });
  it.each(['compressedBytes', 'expandedBytes'] as const)(
    'rejects cumulative %s overflow before reading the next valid ZIP entry',
    async (field) => {
      const file = archive(fixture(1));
      let reads = 0;
      const source = {
        name: file.name,
        size: file.bytes.length,
        read: async (start: number, end: number) => {
          reads++;
          return file.bytes.subarray(start, end);
        },
      };
      const budget = newBudget();
      const [entry] = await inspectZip(source, budget);
      if (!entry) throw new Error('Synthetic archive must contain an entry');
      // Precharge prior entries without allocating a large synthetic payload.
      const limit =
        field === 'compressedBytes'
          ? IMPORT_LIMITS.inputBytes
          : IMPORT_LIMITS.expandedBytes;
      const nextCost =
        field === 'compressedBytes' ? entry.compressedSize : entry.size;
      budget[field] = limit - nextCost + 1;
      const metadataReads = reads;
      await expect(readZipEntry(source, entry, budget)).rejects.toThrow(
        'memory safety budget',
      );
      expect(reads).toBe(metadataReads);
    },
  );
  it('rejects forged small size metadata during streaming expansion', async () => {
    const file = archive(fixture(6000));
    const { view, central, local } = zipHeaders(file.bytes);
    view.setUint32(central + 24, 10, true);
    view.setUint32(local + 22, 10, true);
    await expect(importInstagram([file], options)).rejects.toThrow(
      'decompression limits',
    );
  });
  it('rejects local/central size disagreement', async () => {
    const file = archive(fixture(1));
    const { view, local } = zipHeaders(file.bytes);
    view.setUint32(local + 22, 999, true);
    await expect(importInstagram([file], options)).rejects.toThrow(
      'sizes or checksums disagree',
    );
  });
  it('rejects invalid checksums even when both headers agree', async () => {
    const file = archive(fixture(1), 0);
    const { view, central, local } = zipHeaders(file.bytes);
    view.setUint32(central + 16, 0, true);
    view.setUint32(local + 14, 0, true);
    await expect(importInstagram([file], options)).rejects.toThrow(
      'checksum is invalid',
    );
  });
  it('rejects encrypted archives', async () => {
    const file = archive(fixture(1));
    const { view, central } = zipHeaders(file.bytes);
    view.setUint16(central + 8, 1, true);
    await expect(importInstagram([file], options)).rejects.toThrow('Encrypted');
  });
  it('rejects archive symlinks', async () => {
    const file = archive(fixture(1));
    const { view, central } = zipHeaders(file.bytes);
    view.setUint32(central + 38, 0xa000 << 16, true);
    await expect(importInstagram([file], options)).rejects.toThrow(
      'symbolic links',
    );
  });
  it('rejects truncated archives', async () => {
    const file = archive(fixture(1));
    file.bytes = file.bytes.subarray(0, file.bytes.length - 12);
    await expect(importInstagram([file], options)).rejects.toThrow(
      'valid directory',
    );
  });
  it('rejects a total input budget overflow before parsing', async () => {
    const file = {
      name: 'followers.json',
      bytes: new Uint8Array(IMPORT_LIMITS.inputBytes + 1),
    };
    await expect(importInstagram([file], options)).rejects.toThrow(
      'input safety budget',
    );
  });
});

describe('snapshots and export safety', () => {
  function pair(): [
    ReturnType<typeof createSnapshot>,
    ReturnType<typeof createSnapshot>,
  ] {
    const before = createSnapshot(createSampleDataset(3, 1));
    const after = createSnapshot(createSampleDataset(3, 2));
    before.dataset.comparisonBasis = after.dataset.comparisonBasis =
      'source_evidence';
    for (const direction of ['followers', 'following'] as const) {
      before.dataset[direction].metadata.startedAt = before.dataset[
        direction
      ].metadata.endedAt = '2026-01-01T00:00:00Z';
      after.dataset[direction].metadata.startedAt = after.dataset[
        direction
      ].metadata.endedAt = '2026-02-01T00:00:00Z';
    }
    return [before, after];
  }
  it('creates an independent explicitly requested snapshot', () => {
    const dataset = createSampleDataset(1);
    const snapshot = createSnapshot(dataset);
    dataset.followers.records.length = 0;
    expect(snapshot.dataset.followers.records).toHaveLength(1);
    expect(snapshot.id).toMatch(/^[\da-f-]{36}$/);
  });
  it('reports qualified presence/absence changes', () => {
    const result = compareSnapshots(...pair());
    expect(result.followersAdded).toEqual([]);
    expect(result.followingAdded.map((item) => item.username)).toEqual([
      'user00005',
    ]);
    expect(result.followingAbsent.map((item) => item.username)).toEqual([
      'user00002',
    ]);
    expect(result.warnings.join(' ')).toContain(
      'do not establish an exact unfollow time',
    );
  });
  it.each([
    'account',
    'schema',
    'source',
    'partial',
    'unknown date',
    'overlapping date',
    'synthetic mix',
  ] as const)('rejects incompatible %s snapshots', (reason) => {
    const [before, after] = pair();
    if (reason === 'account') after.dataset.account.id = 'another-owner';
    if (reason === 'schema')
      (after as unknown as { schemaVersion: number }).schemaVersion = 2;
    if (reason === 'source') after.dataset.followers.metadata.version = 'other';
    if (reason === 'partial')
      after.dataset.followers.metadata.completeness = 'partial';
    if (reason === 'unknown date')
      after.dataset.followers.metadata.startedAt = null;
    if (reason === 'overlapping date')
      after.dataset.followers.metadata.startedAt = '2025-12-01T00:00:00Z';
    if (reason === 'synthetic mix') after.dataset.sample = false;
    expect(() => compareSnapshots(before, after)).toThrow();
  });
  it('discloses username-only historical uncertainty', () => {
    const [before, after] = pair();
    delete before.dataset.account.id;
    delete after.dataset.account.id;
    expect(compareSnapshots(before, after).warnings.join(' ')).toContain(
      'username-reuse uncertainty',
    );
    after.dataset.account.username = 'different_username';
    expect(() => compareSnapshots(before, after)).toThrow('same account');
  });
  it('prefers stable subject IDs across a username change', () => {
    const [before, after] = pair();
    after.dataset.account.username = 'renamed_owner';
    expect(() => compareSnapshots(before, after)).not.toThrow();
  });
  it('withholds historical differences when IDs conflict', () => {
    const [before, after] = pair();
    before.dataset.followers.records = [record('alice', '1')];
    after.dataset.followers.records = [record('alice', '2')];
    before.dataset.followers.metadata.uniqueCount =
      after.dataset.followers.metadata.uniqueCount = 1;
    expect(() => compareSnapshots(before, after)).toThrow('ambiguous');
  });
  it.each([
    '=HYPERLINK("https://example.invalid")',
    '+1+1',
    '-1+1',
    '@SUM(A1)',
    '  =1+1',
    '\t=1+1',
    '\r=1+1',
    '\n=1+1',
  ])('neutralizes CSV formula payload %#', (payload) => {
    const csv = exportCsv([{ ...record('synthetic'), displayName: payload }]);
    expect(csv).toContain(`"'${payload.replaceAll('"', '""')}"`);
  });
  it('quotes commas/newlines and preserves JSON provenance', () => {
    const dataset = createSampleDataset(1);
    expect(
      exportCsv([{ ...record('synthetic'), displayName: 'A, "B"\nC' }]),
    ).toContain('"A, ""B""\nC"');
    const { exportScope, exportLimitations, ...reopened } = JSON.parse(
      exportDataset(dataset),
    );
    expect(reopened).toEqual(dataset);
    expect(exportScope).toBe(
      'Synthetic example only. No Instagram account was checked.',
    );
    expect(exportLimitations).toEqual(compareDataset(dataset).warnings);
  });
});
