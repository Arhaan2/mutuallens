# Independent security and QA review

Review date: September 12, 2026 (America/Los_Angeles)

Candidate: `9e190ac1b02c7642886f48df581427d8093de9cf..aca05c15b5bd5afa92f34208e46f0c553a307df4`

Reviewer permissions were limited to this report and `tests/review/**`. No implementation, configuration, dependency, credential, provider, hosting, deployment, or git mutation was performed as part of the review. The reviewer's earlier public-site SEO/content implementation is excluded from independent approval. Browser/Playwright testing was assigned to a separate reviewer and was deliberately not run here.

## Findings first

### Open findings

None. No unresolved P0, P1, P2, or P3 correctness/security finding was found in the exact candidate.

### Resolved during this review

**P3 / Low — a terminal-dot preview hostname could evade the generic indexability guard.**

- Original path: `scripts/origins.ts:65-81` compared the unnormalized lowercase hostname against literal preview suffixes. On `b7cad6038641c5068b1b7bb60112e7c813cb59d1`, a trusted build with `PUBLIC_INDEXABLE=true` treated `https://mutuallens.pages.dev.` as indexable.
- Resolution in the candidate: `scripts/origins.ts:74` removes one terminal DNS dot before the localhost, `pages.dev`, and `github.io` checks. `tests/unit/origins.test.ts` now covers dotted `pages.dev.` and `github.io.` hosts.
- Verification on exact root HEAD `aca05c15b5bd5afa92f34208e46f0c553a307df4`: the direct reproduction returned `false` for both dotted hosts, and the focused origins plus cancellation suite passed 5/5.

**P1 / High — cancellation queued under a held lease was discarded by the retryable-provider-error checkpoint.**

- Original path: retry handling in `packages/acquisition/src/jobs.ts:667-694` saved and released the lease without honoring a cancellation that DELETE had queued while the lease was held.
- Reproduction: the first case at `tests/review/cancellation-race.test.ts:82-165` starts an existing provider run, holds its refresh, requests cancellation, returns a retryable provider error, and requires the final state to be `cancelled` with one provider abort.
- Resolution in the candidate: the lease owner checks the persisted cancellation flag before retry checkpointing (`packages/acquisition/src/jobs.ts:672-681`).

**P1 / High — the first correction retained a check-then-save cancellation window.**

- Original path: cancellation could arrive after the pre-save flag read but before the checkpoint SQL executed. DELETE could not claim the still-held lease, while the checkpoint then released the lease and returned `running`; the cancellation-mode client polls rather than advancing (`apps/checker/src/AutomaticCheck.tsx:413-415`).
- Reproduction: the pausing SQL driver and second case at `tests/review/cancellation-race.test.ts:30-64,167-251` inject DELETE exactly between the flag read and checkpoint write. It failed against `f20bf9937dd39e341c882c87a58554a9f292e68d` with final status `running`.
- Resolution in the candidate: immediately after the retry checkpoint releases the lease, the service re-reads the cancellation flag and executes normal cancellation (`packages/acquisition/src/jobs.ts:691-694`). A cancellation after that re-read can claim the already released lease itself. Both deterministic interleavings pass on `aca05c15b5bd5afa92f34208e46f0c553a307df4`.

## Decision

**The non-SEO candidate is mergeable for a noindexed preview.** The two P1 cancellation races and P3 hostname-normalization edge found during review are repaired and permanently covered. No open correctness/security finding remains in the reviewed scope.

This is not approval to enable automatic checking publicly or commercially. Automatic collection remains disabled in source, and the required credentialed small test, target-scale retrieval, measured recurring-zero-cash capacity, live completeness behavior, provider-side erasure, hosted scheduler behavior, and commercial-use gates are not established by this static/synthetic review. Ads must remain disabled. The current GitHub Pages project was reported unconfigured outside this run; deployment and hosted response behavior were not authorized or verified here.

## Coverage and conclusions

- **Comparison semantics and identities:** core import/comparison paths treat supplied files as the working dataset without requiring account identity, collection time, or a completeness checkbox. Missing directions still error. Supplied-file differences remain qualified; incomplete automatic directions withhold confirmed negatives. Stable IDs, username-only uncertainty, collision handling, cross-page result retrieval, and history invariants are exercised by the passing unit suite. No arbitrary record-count cap was found.
- **Provider completeness:** a provider dataset ending is not itself treated as proof that the upstream list is complete. Explicit reviewed terminal behavior and direction terminal state are required before complete results; retry exhaustion, cancellation, ambiguous start acknowledgment, charge limits, and source errors remain partial/uncertain and withhold absence classifications. Automatic setup remains fail closed while `APIFY_STARTS_REVIEWED` is false.
- **Session and API isolation:** enabled routes require a single well-formed HttpOnly, Secure, SameSite=Strict host cookie on HTTPS; job access is scoped through a session digest; UUID-shaped job IDs avoid alternate routing forms; mutating requests require exact same Origin and reject explicit cross-site Fetch Metadata. API responses are private/no-store and noindex with no graph CORS grant. Bodies are bounded to 2 KiB before parsing.
- **Leases, cancellation, reset, and React lifetime:** D1 checkpoint and terminal writes require the current unexpired lease. Unknown provider-start outcomes stop without blind retries. Both retry/cancel interleavings now converge. React cleanup terminates the worker and clears both `worker.current` and `activeTask.current` (`apps/checker/src/App.tsx:310-315`), closing the StrictMode remount/direct-hash stale-guard failure. Generation checks and abort controllers discard stale automatic UI work.
- **Free-credit accounting:** capacity creation, reservation, and terminal accounting are batched. Known spend cannot exceed the reservation; uncertain/unfinished provider work conservatively consumes the full reservation rather than assuming zero. Pricing freshness, billing-event headroom, and one-active-job constraints are covered by synthetic tests. This does not prove actual provider pricing or a recurring free allowance.
- **Expiry and erasure:** expired local job/graph data is removed independently of provider availability, with only redacted provider cleanup identifiers queued. Capacity is conservatively settled and idempotency receipts survive briefly. Remote deletion retries are bounded; retry exhaustion remains an operator privacy obligation and does not prove provider-side erasure.
- **Data handling:** imports are parsed in a local module worker; graph data is rendered through React text nodes. Optional snapshots require explicit saving and stay in browser storage. Automatic provider credentials and transport remain server-side. This review used synthetic records only and performed no provider/network request.
- **GitHub Pages boundary:** actions are commit-pinned, checkout credentials are not persisted, verification has read-only contents permission, and deployment alone receives `pages: write` / OIDC. Deployment waits for the full verify job. The Pages build requires a non-root base path, removes Cloudflare control files, adds `.nojekyll`, checks every HTML document for `noindex, follow`, rejects root-relative references that escape `/mutuallens`, requires a base-aware canonical/robots sitemap URL, and requires an empty sitemap. Local artifact verification passed.

## Commands actually run

The comprehensive commands below ran from `/private/tmp/mutuallens-review-20260912` at exact predecessor `b7cad6038641c5068b1b7bb60112e7c813cb59d1`. The final candidate changes only `scripts/origins.ts` and `tests/unit/origins.test.ts`; that delta and its focused final-candidate verification follow this block.

```text
npm ci --ignore-scripts
PASS — 429 packages installed from the lockfile; no package or lockfile edits.

npx --no-install vitest run tests/review/cancellation-race.test.ts tests/review/acquisition-erasure.test.ts tests/unit/automatic-api.test.ts tests/unit/origins.test.ts
PASS — 4 files, 17 tests.

npm run check
PASS — ESLint and TypeScript passed; Astro checked 20 files with 0 errors, 0 warnings, 0 hints.

npm test
PASS — 16 files, 319 tests.

npm run build
PASS — checker Vite build, 13-page Astro build, and security artifact generation.

npm run format:check
PASS — all matched files use Prettier formatting (rerun after this report update).

PUBLIC_SITE_ORIGIN=https://arhaan2.github.io PUBLIC_SITE_BASE_PATH=/mutuallens PUBLIC_CHECKER_ORIGIN=https://mutuallens-app.pages.dev VITE_SITE_ORIGIN=https://arhaan2.github.io ASTRO_TELEMETRY_DISABLED=1 npm run build -w @mutuallens/site
PASS — 13 static pages generated under the configured Astro base.

PUBLIC_SITE_ORIGIN=https://arhaan2.github.io PUBLIC_SITE_BASE_PATH=/mutuallens PUBLIC_CHECKER_ORIGIN=https://mutuallens-app.pages.dev VITE_SITE_ORIGIN=https://arhaan2.github.io ASTRO_TELEMETRY_DISABLED=1 node scripts/build-pages.mjs
PASS — noindex, base-path, canonical, robots, empty-sitemap, and artifact-boundary checks passed.

# In /Users/arhaan/Documents/ChatGPT/mutuallens at exact HEAD aca05c15b5bd5afa92f34208e46f0c553a307df4:
git diff --check b7cad6038641c5068b1b7bb60112e7c813cb59d1..aca05c15b5bd5afa92f34208e46f0c553a307df4
PASS — no whitespace errors; delta is 3 insertions and 1 deletion across the origin helper and its unit test.

node --experimental-strip-types --input-type=module -e "import { isPublicReleaseIndexable } from './scripts/origins.ts'; console.log(isPublicReleaseIndexable({ PUBLIC_INDEXABLE: 'true', PUBLIC_SITE_ORIGIN: 'https://mutuallens.pages.dev.' })); console.log(isPublicReleaseIndexable({ PUBLIC_INDEXABLE: 'true', PUBLIC_SITE_ORIGIN: 'https://arhaan2.github.io.' }));"
PASS — output was `false` then `false`.

npx --no-install vitest run tests/unit/origins.test.ts tests/review/cancellation-race.test.ts
PASS — 2 files, 5 tests.
```

Historical defect reproduction retained for audit clarity:

```text
# On superseded candidate f20bf9937dd39e341c882c87a58554a9f292e68d:
npx --no-install vitest run tests/review/cancellation-race.test.ts
FAIL as intended — 1 passed, 1 failed; the injected check/save race ended `running` rather than `cancelled` at line 249.
```

Playwright/browser suites, live-provider tests, deployment, hosted probing, `npm audit` network access, and credential/history scans were **NOT RUN** by this reviewer.

## Artifacts and residual risks

Static rendered evidence produced locally:

- `apps/site/dist/index.html`
- `apps/site/dist/404.html`
- `apps/site/dist/robots.txt`
- `apps/site/dist/sitemap.xml`
- `apps/site/dist/build-info.json`
- `apps/checker/dist/index.html`
- `apps/checker/dist/404.html`
- `apps/checker/dist/_headers`
- `apps/checker/dist/_routes.json`

Residual/out-of-scope items requiring lead or separate-review evidence:

- Keep GitHub Pages noindexed/noncommercial and configure/verify the actual Pages environment before expecting deployment to succeed.
- Obtain separate browser evidence for the exact SHA, including the 390×844/WebKit repair paths, direct-hash StrictMode case, accessibility, network isolation, and rendered layout.
- Do not enable automatic acquisition until the amendment's live credentialed, target-scale, recurring-free, completeness, retention/erasure, and security gates pass with current evidence.
- Provider cleanup retry exhaustion still requires operational reconciliation; local erasure does not prove downstream deletion.
- This report does not independently approve the reviewer's earlier SEO/content implementation.
