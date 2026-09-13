# Shared interfaces

The controlling upload requirements are [Core_Product_Amendment.md](specification/Core_Product_Amendment.md). Earlier completeness-checkbox rules are historical and do not gate uploaded comparisons.

`packages/core/src/types.ts` is lead-owned. The core exports normalization, `compareDataset`, `importInstagram` (byte inputs), `importInstagramFiles` (sliced File/Blob inputs), sample creation, CSV/dataset exports and snapshot comparison. See [core-formats.md](core-formats.md) for exact compatibility and resource budgets.

Uploaded datasets use `comparisonBasis: 'supplied_files'`. They do not gain live verification or artificial terminal markers. Ordinary supplied lists yield both set differences immediately. Known omitted rows/parts produce provisional labels, counts and export limitations. Conflicting identities are quarantined locally; usable identities still compare. An entirely missing direction is an actionable error; a recognized empty list is valid. Unknown account identity is `{username:''}` and only prevents account-linked history. Optional collection date and account labels never block basic comparison.

Automatic datasets use `comparisonBasis: 'source_evidence'`. Negative relationships remain withheld unless both source lists have adequate completion evidence and safe identity resolution. Synthetic examples stay labeled synthetic. The worker returns import assignments when loose-file direction cannot be established; it never chooses based on list size.

The checker API always sends private/no-store/noindex responses, has no CORS access, and rejects cross-origin state changes. In the deployed unconfigured preview, capabilities report `enabled:false`, scan routes return503/null results, and no provider calls occur. The implemented configured routes are:

- `POST /api/session`: same-origin HttpOnly, Secure, SameSite Strict session cookie.
- `POST /api/scans`: username + UUID idempotency key, reserving capacity atomically.
- `GET /api/scans/:id/status`, `POST .../advance`, `DELETE /api/scans/:id`: session-owned bounded job steps and cancellation.
- `GET .../result?direction=followers|following&offset=N`: terminal-job record pages, with stable source metadata. Dataset offsets are separate from upstream continuation cursors.

The client retains only an opaque job ID in sessionStorage for explicit resume. The server stores hashed session ownership, per-direction records/checkpoints and credit reservations. See [automatic-integration.md](automatic-integration.md) for activation, retention and unmeasured live gates. No fake progress percentages or synthetic fallback exist.

Public and checker origins differ; no account data is passed between them. Preview metadata and HTTP headers enforce noindex. Ads are disabled and no publisher identifiers or ads.txt are fabricated.
