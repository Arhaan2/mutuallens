# Automatic integration: implementation and live gates

This is an implemented **unconfigured preview path**, not a successful live scan. See [the concrete candidate investigation](acquisition-seemuapps.md). The default deployed checker keeps automatic capability disabled; local import does not depend on this setup.

## Exact owner prerequisites

1. An **existing** Apify Free account, with the owner authorizing its use and confirming no payment/upgrade/auto-recharge. A token was not found in the task environment or private setup files. Store it privately as `APIFY_TOKEN=...` in `/Users/arhaan/Documents/ChatGPT/mutuallens/private/apify.env` (directory mode700, file mode600), or use the existing secret-management setup. This directory is gitignored. Never send the token in chat or public evidence. No account creation or terms acceptance is authorized.
2. Explicit authorization identifying a public Instagram account for the first small/multipage test, then the approximately6,000×6,000 target. No target is inferred from GitHub identity. None was provided in this pass.
3. For hosted automatic validation: extend existing Cloudflare authorization to D1 and Worker deployment, bind a new **MutualLens-only** D1 database, and deploy its maintenance Worker. Current saved OAuth scopes authorize Pages, not these additional resources. Never change Million Beers or other resources. These resources have not been created in this pass.

## Four independent outcomes

| Gate                                                                           | Current evidence                                                                                                                    |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| A: genuine username-only small scan, both directions and multiple source pages | **NOT RUN** — missing authorized token/account/target. Public schema200 and synthetic tests are not substitutes.                    |
| B: complete approximately6,000×6,000 source retrieval                          | **NOT RUN** — follows A, actual credit check and continuation/charge-stop validation.                                               |
| C: measured recurring free operating capacity                                  | **NOT MEASURED** — actual allowance, total usage, external storage/read cost and reserve are unknown.                               |
| D: hosted website-only automatic validation / commercial launch                | **NOT RUN / NOT READY** — no automatic D1/token deployment; launch also requires its independent privacy/advertising/release gates. |

A does not require proof of B, C at unlimited visitor scale, or commercial launch readiness. Missing credentials are not a candidate failure. No Actor runs or chargeable provider operations were started; actual account credit consumption and remaining allowance are unknown, not reported as zero.

## Implemented bounded execution

The pinned build is `seemuapps/instagram-followers-scraper`1.0.35, build ID`qZHBzZiV6QmFCKDym`. The adapter starts one direction at a time and pins a500-item work chunk,120-second Actor timeout, explicit run charge ceiling and limited permissions. It validates bounded metadata/dataset bodies and uses deadlines. These are per-step limits, not an account-count cutoff. There is no advertised private-account support.

`ScanService` stores the target, per-direction cursor/records, raw/unique counts, fingerprints, provider-run IDs and separate dataset offsets in D1. Each HTTP advance performs one bounded stage. Source pagination, dataset envelope pagination and200-record visitor result pages are independent. Counts reflect observed identities; no percentage is invented. Incomplete source lists do not create confirmed negative classifications.

A same-origin HTTP-only host cookie is hashed for database ownership. Every status, result, advance and cancellation checks it. A session+UUID idempotency key returns the same job; atomic D1 SQL reserves the whole job budget, with a unique active-job constraint. A durable STARTING checkpoint is written before the chargeable POST. An uncertain acknowledgment is never retried automatically and conservatively consumes the reservation. No documented Apify start-idempotency API is assumed.

The initial proposed settings are a$4.50/cycle internal ceiling, $3/job reservation, $.10/run ceiling and $.50 account reserve, with **one concurrent job**. These are prospective protective settings, not measured capacity or approved recurring scan counts. Fresh account and reviewed event-price checks run before starting work. Unknown/paid/expired allowances fail closed. The actual Free account, account-wide active work, effective features, no-overage behavior and platform/storage charges still require private verification. The user's zero-cash requirement controls every test.

A logical scan has a20-minute runtime budget. Polling/read retries are bounded and honor bounded Retry-After; no new run is started on a lost start response. Cancellation aborts known active runs. Unknown usage, unfinished aborts or failed cleanup keep the full reservation accounted rather than pretending zero cost.

## Completion validation is concrete operator evidence

`AUTOMATIC_VALIDATION_ID` must reference retained, redacted real evidence for the pinned build's continuation and terminal behavior. A made-up string, synthetic fixture or generic approval is not evidence. Before setting it, test username resolution and actual rows in both directions; multi-page continuation; non-page-aligned maxItems (does it skip rows?); null/missing/repeated cursors; low-charge stop semantics; maximum atomic/grouped charge behavior; and actual usage/cleanup. The engine also requires explicit terminal output, one expected envelope, a below-cap final chunk, no omitted identities, and headroom for an additional reviewed batch event. The headroom check cannot establish hidden Actor semantics by itself.

The controlled private test may use the adapter directly before enabling any visitor route. Use minimal verified budget, save only counts/page facts/hash references/timing/charges publicly, and keep actual identities private. Compare provider `usageTotalUsd` with whole-account monthly usage before/after reads and deletion; extra storage usage can be outside run usage. Escalate to target scale only when actual remaining credits cover the estimate and reserve. Reconcile discrepancies; aggregate counts alone are not acceptance.

## Prospective hosting and cleanup

Normal `apps/checker/wrangler.jsonc` remains the existing disabled preview config. `wrangler.automatic.jsonc` is a separate disabled template. It lacks a real database ID deliberately; do not deploy it blindly or let provisioning create resources as a side effect. After authorized D1 creation, record its real ID, apply `packages/acquisition/migrations/0001_jobs.sql`, set the server secret privately, and deploy/verify the scheduled maintenance Worker before enabling scans. Generate bindings with pinned Wrangler. Never put the token in a Wrangler variable or build-time Vite environment.

Jobs expire after one hour (or the end of the verified allowance cycle, if sooner); expired reads fail immediately. A five-minute scheduled cleanup erases local relationship rows and target-bearing job payloads transactionally, independent of remote availability. A minimal remote cleanup queue retains only resource IDs/status, with bounded exponential retries. It continues when new scans are disabled. Session/key-only receipts expire after seven days to prevent replaying expired creation requests; the credit ledger stores totals, not graphs.

The provider dataset, key-value store, request queue and finished run are explicitly deleted. Provider failures are pending, not claimed success. An unknown start without a run ID needs private operator reconciliation and can leave an orphan. Apify deletion does not establish downstream HikerAPI/seemuapps cache/backup erasure. A token outage can delay remote deletion; local deletion remains governed by D1 maintenance. Do not revoke the maintenance binding before cleanup is verified. Scheduled production execution, actual deletion latency and D1 quota behavior are **NOT RUN**.

All implementation tests use synthetic transports and local SQLite. Configured HTTP tests verify request/cookie/error boundaries; they do not establish real Cloudflare D1 or provider access. Keep current previews noindexed and ads disabled regardless of these unit outcomes.
