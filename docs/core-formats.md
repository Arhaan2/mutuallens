# Supplied-file importer

Uploaded followers and following form a working dataset. Both directions are required, but owner identity, collection date and completeness confirmation are optional. Imports use `comparisonBasis: 'supplied_files'`; `terminal` is always false. Ordinary imports remain `unverified` as upstream evidence. Known missing numbered parts, unreadable parts, skipped rows or quarantined identities produce `partial` metadata and visible diagnostic warnings; they do not erase usable records.

## Supported structures

- Instagram JSON arrays and `relationships_followers` / `relationships_following` wrappers, with harmless extra metadata.
- Explicit `followers` / `following` arrays or `data`, `items`, `records`, `edges` list wrappers under recognized structural containers such as `connections`, `relationships`, `data` and `user`.
- Standard `string_list_data` identities, following title/URL variants, direct username or profile URL fields, string lists, and supported `node` wrappers. Case and leading @ normalize. Safe numeric stable IDs normalize to strings. Harmless timestamps, media fields and unknown optional fields do not reject usable rows.
- Instagram HTML cards (`_a6-g` / `_a6-p`), semantic lists, explicitly labeled relationship containers, and recognized follower/following headings with simple account-link wrappers. The htmlparser2 event parser consumes inert text. Scripts, styles, images, markup and embedded resource links are never executed, inserted into the page, fetched or navigated. Navigation/footer/aside and unrelated paragraph links are excluded. Invalid relationship identities are counted by the row parser.
- Multiple loose files, numbered split files, multiple ordinary ZIP downloads, nested folders and bounded nested ZIP containers. Direction is inferred from content and path context, never list length. Truly ambiguous loose lists return structured assignment prompts, then accept `options.directions[fileName]`.
- UTF-8 (with or without BOM) and UTF-16 LE/BE with BOM, for JSON and HTML.
- MutualLens schema-version-1 dataset JSON, including known `exportScope` / `exportLimitations` annotations. Every field used by the app is reconstructed after validation; data is never accepted through a `Dataset` type cast. Unknown account labels are supported. Synthetic labeling and useful diagnostics survive reopening, while terminal/live-completeness claims are not promoted. Select a native dataset by itself rather than mixing it with relationship files.

Blocked accounts, pending requests, close friends, messages, and similar unrelated directions are not followers/following. Unsupported or unreadable entire directions produce a specific request for readable input; a recognized structural empty list is distinct from an absent list. Repeated identities combine. Invalid/conflicting row identities are omitted with counts. Stable-ID ambiguity across otherwise valid rows remains available for comparison's identity handling rather than dropping all usable accounts.

## Archive and memory boundaries

`importInstagramFiles(File[], options = {})` is the browser path. It uses `File.slice()` for the archive tail, central directory, local headers and selected entry contents. It never calls a ZIP File's whole-file `arrayBuffer()`. `importInstagram(ImportFile[], options = {})` remains the compatibility interface for callers that already hold byte arrays.

ZIP metadata inspection is separately bounded at 50,000 entries, a 16 MiB directory, and 32 MiB total metadata reads across the selection. Each entry's path, bounds, local/central headers, overlap and encryption/symlink conditions are checked without reading its media payload. Relationship data has separate limits: 64 MiB selected compressed/input bytes, 128 MiB cumulative selected expanded bytes, 64 MiB per parsed file, 2,000 relevant documents, and a 200:1 selected-entry compression ratio. Nested ZIP depth is bounded at three nested levels. These are byte/format/work safeguards, not account-count caps.

Unrelated photos, videos, messages and other known irrelevant content are not decompressed. Unclassified JSON/HTML can be identified through a bounded prefix probe (up to 64 KiB compressed / 16 KiB expanded per candidate, 8 MiB aggregate compressed discovery reads). This allows large renamed direction wrappers to be recognized without loading unrelated documents in full. A selected full entry still undergoes size and CRC validation. A renamed archive list whose direction cannot be identified can be selected loose for explicit assignment. The tail scan can touch a bounded suffix of the last entry while locating the ZIP directory; it is not a full media load.

ZIP64, split-volume/encrypted ZIP containers, symbolic-link entries and unsupported selected-entry compression remain unsupported with actionable errors. Separate ordinary ZIP downloads are supported. Compressed nested ZIP containers themselves must fit the resource budgets; select their inner archive directly when they do not. Content beyond a prefix-discovery budget is not guessed. No support for every arbitrary export layout is claimed.

## Evidence

`packages/core/test/import-compatibility.test.ts` uses only synthetic structural fixtures. It covers JSON variants, inert HTML/resource references, assignments, gaps, skipped/quarantined records, UTF encodings, native reopen/validation, multiple and nested ZIPs, checksum/encryption/path/metadata failures, irrelevant compression bombs and thousands of unrelated media entries. A virtual File containing an 80 MiB media hole forbids whole-file reads and asserts total sliced reads below 100 KiB. This is importer correctness and selective-read evidence, not live Instagram acquisition evidence.
