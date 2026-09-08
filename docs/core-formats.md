# Core formats, correctness, and synthetic test evidence

Status: implemented and locally tested core for a preview. This is not evidence of website-only automatic Instagram acquisition. All test inputs are generated synthetic data; no real account graph or Instagram export has been used in this worktree.

## Public interface

`packages/core/src/index.ts` exports the fixed functions and types in `docs/contracts.md`. Import and comparison are pure local operations: the package performs no fetch, filesystem, storage, or analytics calls. Snapshots are returned only from an explicit `createSnapshot` call; persistence belongs to the checker UI and defaults off.

## Supported Instagram JSON representations

The following explicit, synthetic-tested structures are accepted:

- `followers.json` or continuous `followers_1.json`, `followers_2.json`, etc.: an array of relationship rows, or an object containing only `relationships_followers` with that array.
- `following.json` or equivalent continuous numbered parts: an object containing only `relationships_following` with an array of relationship rows.
- Each relationship row contains one `string_list_data` entry. A follower entry supplies a string `value` username. A following entry may supply `value`, or use its row's `title` username when the entry has no `value` (the title/profile-link representation).
- Optional `href` must normalize to the same username. Following titles and values must agree. Standard `https://www.instagram.com/name/` and `https://www.instagram.com/_u/name` profile URLs are recognized. Optional relationship timestamps must be nonnegative integer seconds; they are validated but never treated as collection dates or exact historical unfollow times.
- Optional `media_list_data` must be empty. An optional source-supplied row `id` is retained as an opaque, validated stable ID. No ID is invented for Instagram imports.

Only these fields and structures are recognized. Malformed rows and unknown schemas fail with an explicit error; no row is silently dropped. These are supported representations, not a claim that every currently downloadable Instagram archive has been verified. Current real-export compatibility remains unverified until a consented, locally handled example is available. ZIP64, encrypted/multidisk ZIP, HTML exports, and other schema variants are unsupported and receive actionable errors. The normalized JSON download preserves provenance; it is not currently a round-trip Instagram-import format.

Both directions must be explicitly present. `[]` in an accepted followers file and `{"relationships_following":[]}` are valid empty lists; missing or unknown files are not empty lists. Duplicate basenames across folders or selections are rejected to avoid accidentally mixing exports. Mixing numbered and unnumbered files for a direction is rejected. A gap, missing first numbered part, or unsafe part number keeps that direction partial even when the user confirms completeness. Unsupported relationship-looking archive filenames such as `followers_0.json` or `followers_01.json` fail instead of being silently ignored. Unrelated ZIP entries are not inflated or parsed.

## Completeness and identity

Imports default to `unverified`, with no terminal evidence. The user's explicit confirmation that every part of both directions was selected can mark the supplied source complete; it cannot certify Instagram's live state or prove that an export had no hidden truncation. Per-direction metadata retains raw and distinct counts, part counts, known collection timestamp or `null`, source/version, and warnings. Import time never becomes collection time.

Names are trimmed, lowercased, and validated without deleting meaningful dots or underscores. Stable IDs win where available; a username can resolve to a unique known ID across lists. This mixed-identity fallback and username-only records carry rename/reuse uncertainty. Two stable IDs sharing a username are ambiguous: they are preserved separately, observed unambiguous mutuals can remain visible, and all negative categories are withheld. One stable ID associated with several names is matched by ID with a rename warning.

Definitive negative categories require both complete, terminal lists, no identity collision, and consistent provenance. Negative categories are withheld if declared distinct counts disagree with the actual identity index, raw counts are impossible, page/count metadata is invalid, a nonempty list has zero pages, or a supplied expected count does not reconcile. Count agreement alone does not establish completion. All set operations use maps/sets; no path truncates records at a count threshold.

## ZIP and memory safety

Resource budgets are deliberately distinct from follower/following-count restrictions:

| Resource                                                 |   Limit |
| -------------------------------------------------------- | ------: |
| Total selected input bytes                               |  64 MiB |
| Total declared expanded bytes across every archive entry | 128 MiB |
| Each relevant JSON file                                  |  64 MiB |
| Entries across selected archives/files                   |   2,000 |
| Declared and actual compressed expansion ratio           |   200:1 |

The UI must enforce the input budget before `arrayBuffer`; the core repeats the check. These limits bound bytes and containers, never account records. A full media export can exceed them; selecting only the follower/following JSON files avoids unrelated media. Device-specific browser memory limits may be lower than these budgets, so processing in a dedicated worker that can be terminated is part of the UI contract. A 64 MiB JSON input can occupy substantially more heap once decoded and parsed; the budget is not a universal low-memory-device guarantee.

All ZIP central entries and local headers are inspected before extraction: directory and payload bounds, count totals, methods, duplicate paths, encryption, symlinks, traversal, UTF-8 filenames, local/central consistency, expanded sizes, compression ratios, and overlapping ranges. ZIP64/multidisk formats fail closed. Only recognized relationship JSON entries are inflated. DEFLATE receives 4 KiB compressed chunks through `fflate.Inflate`; emitted bytes are checked against the declared size and resource budget before retention, so dishonest small uncompressed metadata cannot cause unbounded output accumulation. Transient decoder output is limited by compressed chunk size; it is not a claim of zero allocation before every check. Expanded size and CRC-32 are verified. JSON text uses a fatal UTF-8 decoder. Corrupt archives never create a fabricated complete dataset.

## Snapshot and CSV semantics

Snapshot comparison requires schema version 1, the same subject account (stable ID preferred), matching source and adapter version per direction, complete/terminal consistent metadata, and known strictly ordered nonoverlapping collection windows. Collection timestamps must be valid UTC ISO timestamps, reject calendar rollover and future dates, and cannot be inferred from import/save time. Partial, unknown-date, mixed synthetic/imported, cross-account, cross-schema, and conflicting-identity comparisons are rejected. Username-only account/history matching includes rename, reactivation, and username-reuse uncertainty. Differences establish only presence in one collection window and absence in another, with no claimed time, motive, or reason.

CSV quotes every field, doubles internal quotes, and prefixes a literal apostrophe to formula markers (`=`, `+`, `-`, `@`) including after leading whitespace/control characters, and to leading tab/newline/carriage-return cells. JSON export retains the complete normalized dataset and provenance. No exports are uploaded by the core.

## Execution evidence

Executed September 7, 2026 in `/tmp/mutuallens-core`, macOS local environment, Node `v24.18.0`, Vitest `5.0.0`, fflate `0.8.3`, TypeScript `6.0.3`:

```
node_modules/.bin/vitest run --root /tmp/mutuallens-core
```

Result: 1 file passed, 106 tests passed, 731 ms suite duration. Tests cover the specified 6,000/6,000 fixture (4,500 mutuals; 1,500 each non-mutual; 7,500 union), 0 separately from missing inputs, boundaries 2,499/2,500/2,501/6,000/6,001, 50,000 each direction, split/ZIP equivalence, schema errors, timestamps, normalization, duplicate and conflicting IDs, partial/inconsistent metadata, snapshots, CSV formulas, and malicious archive cases.

```
node_modules/.bin/tsc --target es2022 --module esnext --moduleResolution bundler --strict --noEmit --skipLibCheck --types node packages/core/src/index.ts packages/core/test/core.test.ts
```

Result: exit 0, no diagnostics. The lead must rerun integrated workspace checks; isolated passes do not certify integration.

For visible timing output (Vitest's agent reporter otherwise suppresses successful console output):

```
node_modules/.bin/vitest run --root /tmp/mutuallens-core --silent=false --reporter=default -t 'parses and compares all 6000|parses and compares all 50000|parses the compressed|does not cap 50000'
```

Result: 4 passed, 102 intentionally filtered/skipped, 531 ms suite duration. Measurements are single-run lab observations, not throughput guarantees, browser measurements, peak memory, or live acquisition evidence:

| Synthetic operation          | Size per direction |                   Input | Measured time |                                    Heap observation |
| ---------------------------- | -----------------: | ----------------------: | ------------: | --------------------------------------------------: |
| Generate and compare         |             50,000 |     In-memory generator |     117.10 ms |                                         Not sampled |
| Loose JSON parse and compare |              6,000 |         1,572,030 bytes |      28.03 ms |  96,775,832 bytes process heap used after operation |
| Loose JSON parse and compare |             50,000 |        13,100,030 bytes |     179.95 ms | 156,631,704 bytes process heap used after operation |
| ZIP parse and compare        |              6,000 | 64,265 compressed bytes |      41.25 ms |                                         Not sampled |

Heap includes the Node test harness and prior allocations; it is not an isolated incremental or peak measurement. Browser responsiveness, local persistence deletion, no-upload behavior, and real export compatibility require separate integration/browser verification. No automatic acquisition, live ~6,000 × ~6,000 account, source permission, recurring free allowance, provider quota, deployment, or ad approval test was performed by this core work.
