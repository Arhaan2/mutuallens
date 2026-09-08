# Seemuapps candidate: pinned adapter and acquisition gate

Assessed September 7, 2026 (Pacific; saved probe timestamps are September 8 UTC). This is **public documentation and metadata evidence plus synthetic adapter verification**, not successful Instagram acquisition. The candidate remains eligible for a controlled test; it has not passed automatic acceptance. No authenticated account read, Actor start, Instagram target request, credit consumption, or deletion of a real provider resource was performed by this workstream.

The current prerequisite is an existing authorized Apify account/token, verified Free allowance and an explicitly authorized Instagram test target. The lead configures the token privately in the server environment; visitors never supply it. Do not put credentials or real graph data in this document, chat, tests, source, or logs. Missing setup is not evidence that acquisition is technically impossible.

## Candidate and exact source

[Actor documentation](https://apify.com/seemuapps/instagram-followers-scraper) describes public-target follower/following retrieval without visitor login, using a username, a direction and continuation cursor. Private target profiles are not supported by the advertised method. A returned relationship account's `isPrivate` flag does not establish private-target graph access. The API output is described as a dataset envelope with nested `results` and `cursor_next`; an envelope is not one Instagram account.

Unauthenticated **GETs only** to [public Actor metadata](https://api.apify.com/v2/acts/seemuapps~instagram-followers-scraper) and [default build metadata](https://api.apify.com/v2/acts/seemuapps~instagram-followers-scraper/builds/default) returned HTTP 200. They identify Actor `2nsQrloj1Sl16uh4z`, build `qZHBzZiV6QmFCKDym`, build number `1.0.35`, input schema version `1`, modified August 12, 2026. The build's `SUCCEEDED` state describes compilation, **not a successful scraping run**. Source code is hidden. The adapter pins this build number and rejects a different returned build ID. Missing build ID is retained as unknown for the integrator to reject before acquisition acceptance.

[Saved sanitized metadata](evidence/acquisition-seemu-public-metadata.json) includes HTTP outcomes and SHA-256 fingerprints. Its [reproducible public probe](evidence/acquisition-seemu-public-probe.mjs) reads exactly those two endpoints and the specified public pricing issue, hashes raw content in memory, and saves selected facts only. It does not retain raw hydration, unrelated public profile metadata, developer deployment keys, or vendor secret references. A separate attempted `/input-schema` API path returned 404; the schema was obtained from the successful build response instead.

## Pagination and runtime contradictions to test

The [input schema](https://apify.com/seemuapps/instagram-followers-scraper/input-schema) exposes `username`, `mode` (`followers`, `following`, `both`), `pageId`, and `maxItems` (integer, minimum 0, default 500). Its description says up to 200 identities per upstream call and 0 means unlimited. The README describes one page per run and up to 500 identities; the public build's Actor-definition description instead mentions 1,000 per run and 50 per API call. These are conflicting claims, not interchangeable limits.

The adapter deliberately starts **one direction per run**, with a positive work budget of 1–500 records per run, 256 MB, an explicit run timeout (default 120 seconds, maximum 300), an explicit charge ceiling, and limited Actor permissions. These are bounded work chunks, not a total account cutoff. More records require continuation. The vendor default timeout is 3,600 seconds; that default is not used. Cloudflare only starts/polls/collects bounded requests; scraping runs on Apify. The public schema names HikerAPI as the upstream service, introducing a separate downstream retention/usage dependency whose implementation is not inspectable here.

Two pagination domains must remain separate:

| Domain             | Cursor/count                                                             | Completion establishes                                                                          |
| ------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Apify dataset      | Numeric `offset`, `limit`, pagination response headers; counts envelopes | All stored envelopes for that Actor run were read                                               |
| Instagram/provider | Opaque input `pageId`, returned `cursor_next`; counts nested identities  | Only an independently credible upstream terminal marker can establish the end of that direction |

The adapter retains `explicitTerminalMarker`, nullable `upstreamTerminal`, `capReached`, `repeatedCursor`, invalid/duplicate counts, and observed records separately. Missing markers, multiple unexpected envelopes, malformed rows, repeated cursors and item-budget boundaries cannot establish a complete direction. A dataset's exhaustion or Actor `SUCCEEDED` does not promote completion. Cross-run duplicate-page detection and cursor-history checks belong to the durable engine, which holds all prior checkpoints.

**Critical live probe:** verify that `maxItems` does not trim part of an upstream response while returning the cursor after the entire response. The documented 500-item default and 200-item upstream page description create a plausible skipped-record boundary. Test a continuation against overlapping independently collected observations, including a non-page-aligned work budget. Neither totals nor a synthetic cursor fixture can disprove this defect. Also test a charge-limited stop: the next batch can be refused while usage remains below the ceiling, and a nominally successful run can still be partial.

## Public Free pricing claims and conditional estimate

The [pricing page](https://apify.com/seemuapps/instagram-followers-scraper/pricing) displays the same event rates for Free and the other displayed tiers, with no Free discount. The observed active PAY_PER_EVENT metadata contains:

| Event                        | Observed public rate      | What needs measurement                                                    |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `user-batch-50`              | $0.009 per billing batch  | Batch count for each direction, partial batches, failed/repeated requests |
| `apify-default-dataset-item` | $0.00001 per dataset item | Whether actual items remain one envelope per mode                         |
| `apify-actor-start`          | $0.00005 per start event  | Actual charged event count at 256 MB                                      |

The public `minimalMaxTotalChargeUsd` is null; this does not prove an effective zero minimum for every account or run. The table's platform-usage price is Free, and its hydration reports that the user does not pay Actor platform usage. That is not evidence that all external storage access is free.

`getReviewedPricing()` performs a fresh metadata GET and validates the Actor ID, limited permissions, one active PPE contract, the exact three expected events, their one-time semantics, and rates no greater than the reviewed ceilings. Extra charge events or higher rates fail closed. The Actor metadata API does not expose the table's Free discount/platform-billing flags, so the helper returns those facts as unknown; it does not manufacture an account-specific Free price guarantee.

In the requested [pricing clarification issue](https://apify.com/seemuapps/instagram-followers-scraper/issues/question-pricing-x83vCvl0FjgjxiPyN), the vendor's July 21 reply confirms that billing batches contain up to 50 identities and that a partly filled batch still bills a whole batch. Therefore a billing batch is neither an individual profile nor necessarily an upstream request/page. The issue was read successfully from inert public hydration; the saved probe verifies both claims without persisting commenters' unrelated metadata.

For illustration only, **if** 12,000 identities require exactly 240 billed batches, 24 runs, and 24 dataset envelopes, the listed event cost is `240×0.009 + 24×0.00005 + 24×0.00001 = $2.16144`. This is arithmetic under assumptions, **not a quote, measured cost, approved budget or complete-list proof**. Smaller or partly filled batches, retries, duplicates, extra runs and storage operations change it. The estimate cannot establish recurring visitor capacity.

[Apify's PPE help](https://help.apify.com/en/articles/10700066-what-is-pay-per-event) says dataset access and storage can carry additional plan-based costs, and describes a maximum run charge. Reserve for external reads/storage, then compare actual account usage before the run, after both directions, after dataset reads and after cleanup. A run's `usageTotalUsd` alone may omit external operations. Missing accounting fields remain null, never zero. Account-specific prices must be checked with the actual credential before a controlled run.

## Account preflight and start idempotency

The lead should privately inspect these documented responses and retain only nonsecret gate facts:

| Official endpoint documentation                                               | Fields needed                                                                                                                                             |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Get private user data](https://docs.apify.com/api/v2/users-me-get)           | `data.plan.tier`, `isEnabled`, `monthlyBasePriceUsd`, `monthlyUsageCreditsUsd`; `data.isPaying`; relevant `effectivePlatformFeatures`                     |
| [Get limits](https://docs.apify.com/api/v2/users-me-limits-get)               | `data.monthlyUsageCycle.startAt/endAt`, `limits.maxMonthlyUsageUsd`, `limits.dataRetentionDays`, `current.monthlyUsageUsd`, `current.activeActorJobCount` |
| [Get monthly usage](https://docs.apify.com/api/v2/users-me-usage-monthly-get) | `data.usageCycle`, `totalUsageCreditsUsdAfterVolumeDiscount`, `totalUsageCreditsUsdBeforeVolumeDiscount`, `monthlyServiceUsage` breakdown                 |

Require actual enabled Free status and a zero base price/nonpaying account, valid matching cycles, known remaining credits, the operation reserve and no other conflicting reservations. API documentation examples mix Free labels with paid sample amounts; copy field names, not their sample values. Unknown fields fail closed. The [Free limit help](https://help.apify.com/en/articles/11079614-reaching-platform-limits) describes a $5 Free ceiling, but the actual account and cycle must be verified. Do not change limits, enable overage, add billing, or create an account to satisfy this gate.

[Run Actor](https://docs.apify.com/api/v2/actors-runs-post) documents asynchronous start, build selection, timeout, memory, `maxTotalChargeUsd`, `restartOnError` and optional webhooks. Its query `maxItems` is a pay-per-result billing option; this PPE adapter instead puts the Actor's own `maxItems` in JSON input. **No run-start idempotency key/start token is documented on that endpoint.** The transport never blindly retries POST start. A lost response, 5xx, timeout, malformed acknowledgement or ambiguous rejection preserves an unknown start outcome and its capacity reservation. A server-side STARTING checkpoint prevents a second start after lease expiry, but cannot discover the lost provider run ID by itself.

[Ad-hoc webhook](https://docs.apify.com/integrations/webhooks/ad-hoc-webhooks) `idempotencyKey` deduplicates webhook creation, not Actor runs. [Webhook actions](https://docs.apify.com/integrations/webhooks/actions) support a payload with a fixed opaque correlation value plus the actual `resource.id`, and a private authentication header through `headersTemplate`. This could help reconcile a lost start, but webhook delivery can retry or duplicate and is not guaranteed. No undocumented Actor input field is used as a fake idempotency mechanism. The current transport does not register webhooks; operator reconciliation of uncertain starts is still required before releasing reservations or restarting.

## Retention, cancellation and deletion

[Abort run](https://docs.apify.com/api/v2/actor-run-abort-post) supports immediate cancellation; the adapter requests `gracefully=false` and does not resurrect/restart. Aborting is not proof of deletion or zero charge. [Delete run](https://docs.apify.com/api/v2/actor-run-delete) is permitted only after the run finishes and requires owner/organization access. Its documentation does not establish that deleting a run also deletes every related storage resource. The adapter exposes separate dataset, key-value-store, request-queue and run deletion methods, each requiring an explicit stored ID and the documented HTTP 204 acknowledgement. An HTTP 404 remains an explicit error for the integrator to reconcile as already absent if appropriate.

[Dataset retention](https://docs.apify.com/storage/dataset) and [key-value-store retention](https://docs.apify.com/storage/key-value-store) say unnamed stores normally expire after seven days unless configured otherwise, while named stores persist. The actual account's retention limit must be read. MutualLens should not rely on these defaults for its shorter graph TTL: stop work, reconcile the run, explicitly delete known resources, and retain non-graph cleanup metadata until successful. A lost run ID can leave an orphan whose storage IDs cannot be deleted automatically by this adapter. Reconcile privately by the authorized operator; do not claim strict provider deletion while an orphan remains.

No source reviewed here establishes HikerAPI/seemuapps downstream cache retention, backup purge or a propagated deletion API. Apify resource deletion is not evidence of downstream erasure. This remains a documented integration/launch caveat; do not promise stronger deletion than was tested. No new legal acceptance occurred.

## Verification status and next credentialed gates

The adapter tests use deliberately synthetic token, run, envelope and identity fixtures. They verify transport bounds, charge-ceiling transmission, pinned builds, no blind start retry, timeouts even if fetch ignores abort, stream cancellation, invalid JSON/UTF-8, accounting validation, separate pagination/counts, cursor ambiguity, identity quarantine, explicit deletion, and 6,201 synthetic records through bounded pages. They establish code behavior, not source functionality.

The owned adapter suite passed **89 synthetic tests**; owned-file ESLint and formatting passed. A whole-worktree TypeScript check had no adapter/test errors but still reported the concurrently repaired core importer's optional-account nullability at `import.ts:393–394`. The lead must rerun the integrated check; this is not recorded as a whole-product TypeScript pass.

1. **A — Credentialed small test: NOT RUN.** Resolve the authorized public username, observe genuine identities in both directions, follow multiple upstream cursors on the verified Free account, measure all charges, test cancel and cleanup. Report source gaps separately from transport errors.
2. **B — Approximately 6,000×6,000: NOT RUN.** Verify both complete directions and continuation semantics, including cap and charge-stop behavior. Plausible aggregate counts are not enough. Account changes during collection require discrepancy analysis, not an invented stationary snapshot.
3. **C — Recurring free capacity: NOT MEASURED.** Derive conservative scans/cycle from observed complete-run cost, reserve and actual recurring allowance. At capacity, stop rather than silently truncate or use paid fallback.
4. **D — Hosted automatic/launch gate: NOT PASSED.** Verify same-session authorization, atomic reservations, restart/cancel/TTL behavior and actual hosted website-only flow. Keep previews noindexed and ad-free until their separate release gates pass. Do not delay the independently useful repaired upload flow for missing provider setup.

The candidate has not yet failed its functional criteria, so no alternative-provider survey is justified by these public-only findings.
