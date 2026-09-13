> **Current amendment:** See [Core product delivery](core-product-delivery.md) and [the controlling user amendment](specification/Core_Product_Amendment.md). The evidence below retains its original dates, source commits and scope. In particular, the old upload-checkbox policy and earlier per-profile provider economics do not govern the new supplied-file comparison or the newly investigated Seemuapps batch-billed candidate.

# Executed acceptance ledger

> **2026-09-08 repair addendum:** Browser-verified repair of baseline `549e82a` is documented in [ui-functional-repair.md](ui-functional-repair.md): 140 unit/security tests, 126 built-preview browser tests and 42 development scenarios across Chromium/WebKit/Firefox passed locally. See the repair PR for the final pushed head and its matching CI. Historical evidence below remains attributed to its original commits. Automatic acquisition remains BLOCKED. Hosted preview was subsequently deployed and verified; see the current hosting addendum below. No production completion is claimed.

Date: September 7, 2026 (America/Los_Angeles). **Overall PREVIEW-ONLY. Mandatory automatic gate BLOCKED.** The original checklist in `specification/` remains unchanged. PASS below is limited to the explicitly tested preview behavior; it cannot stand for unimplemented production functionality.

## Current hosting addendum — September 7, 2026 PDT

Two noindexed, ad-free Cloudflare previews are deployed and browser-verified from source `75a340ec010b62cc90db3f6275313173e9b0ac77`, whose [CI run 34178568380](https://github.com/Arhaan2/mutuallens/actions/runs/34178568380) succeeded. [Actual URLs, deployment IDs, owner-confirmed Free plan, hosted tests, screenshots and rollback limits](cloudflare-preview.md). This supersedes hosting BLOCKED/NOT RUN entries in the historical baseline below. The nine hosted functional scenarios passed across Chromium/WebKit/Firefox; Chromium visual checks passed at 390/1440px. Automatic acquisition and live target-scale testing remain BLOCKED/NOT RUN. Host rollback and free-quota exhaustion were not executed.

## Historical baseline evidence

The following entries retain their original implementation and execution scope. They are not current statements about hosting access or deployment status.

## 1. Mandatory acquisition

| Check                                                                    | Status                  | Evidence                                                                                                     |
| ------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Fresh visitor username → scan → complete results                         | BLOCKED                 | No source selected; API reports automatic disabled and returns 503/null for scans                            |
| Actual complete followers and following source                           | BLOCKED                 | [Feasibility investigation](automatic-feasibility.md); schemas/auth probes do not demonstrate complete lists |
| Consented live ~6,000 × ~6,000                                           | NOT RUN                 | No target/provider prerequisites; [live ledger](evidence/acquisition-live-gate.json) has null actual counts  |
| Pagination, terminal, duplicates, caps, mismatch reconciliation          | NOT RUN for live source | Generic core metadata contradictions are tested, not real upstream collection                                |
| Owner reference reconciliation                                           | NOT RUN                 | No real graph/export acquired; no reference supplied                                                         |
| Recurring free capacity, observed scan credits and hard overage controls | BLOCKED                 | Inspected candidates do not establish qualifying target-scale operation; no paid calls made                  |
| Appropriate provider/platform/commercial access                          | BLOCKED                 | Specific unresolved provider and platform restrictions documented                                            |
| Actual deployed free-runtime acquisition                                 | NOT RUN                 | No verified source and no hosting authorization                                                              |

## 2–3. Comparison, imports and snapshots

| Check                                                                                         | Status                                | Execution/evidence                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6,000 followers / 6,000 following → 4,500 mutuals, 1,500 each negative, union 7,500           | PASS (synthetic)                      | `npm test`; `packages/core/test/core.test.ts`; browser sample assertions                                                                                          |
| 2,499 / 2,500 / 2,501 / 6,000 / 6,001 and 50,000 per direction without trimming               | PASS (synthetic)                      | Core boundary/stress tests and verbose test log                                                                                                                   |
| Empty valid datasets distinct from missing input; duplicates/case/@/punctuation/IDs/conflicts | PASS                                  | Core + independent adversarial tests                                                                                                                              |
| Partial/unverified/mismatched counts withhold negative categories                             | PASS in engine and UI                 | Core metadata tests and browser partial input; blocked API never returns any classification                                                                       |
| Active API partial-job response semantics                                                     | NOT RUN                               | Active jobs unimplemented, not inferred from disabled-route tests                                                                                                 |
| Loose, split and ZIP JSON equivalent union                                                    | PASS for documented synthetic schemas | `core-formats.md` and core/browser tests                                                                                                                          |
| Compatibility with an actual current owner export                                             | NOT RUN                               | Schema support is fixture-tested; no real export was supplied or inspected                                                                                        |
| Unknown/malformed/missing/misnamed parts and invalid UTF-8                                    | PASS                                  | Strict parser and adversarial fixtures; no silent missing-direction empty list                                                                                    |
| Path traversal, entries, compression ratio, declared/actual bytes and CRC safety              | PASS for tested cases                 | Streaming expansion plus core/adversarial tests; safe file preflight before read                                                                                  |
| ZIP descriptor validation completeness                                                        | LIMITED                               | Optional bit-8 data descriptor bytes not independently reconciled; central/local metadata, payload size and CRC are validated. ZIP64/encrypted/multidisk rejected |
| CSV formula neutralization across fields                                                      | PASS                                  | Core + independent injection cases                                                                                                                                |
| Import file bytes never transmitted by application                                            | PASS in exercised browser flows       | Network assertions in local loose import; worker has no network access code                                                                                       |
| Explicit saving off by default, persistence, export, delete-all                               | PASS                                  | Browser tests verify no IndexedDB before saving; reload persistence; store count 0 after deletion                                                                 |
| Snapshot identity/source/schema/partial/unknown-date compatibility                            | PASS                                  | Core tests; visible browser comparison and different-owner rejection                                                                                              |
| No exact unfollow times/reasons claimed; username-only uncertainty                            | PASS in tested UI/core                | Snapshot warnings and browser assertions; public guide copy                                                                                                       |

## 4. Automatic jobs and quotas

| Check                                                                   | Status                         | Evidence                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| Preview cannot proxy arbitrary URL or initiate a charged upstream job   | PASS                           | Disabled API never consumes request bodies or calls fetch; 503/results:null                |
| Origin/Fetch Metadata rejection and no cross-origin API permission      | PASS for preview routes        | Unit and local Workers browser tests; no wildcard CORS                                     |
| Session-bound IDs; start/read/advance/result/cancel ownership           | NOT RUN                        | No sessions, IDs, graph storage or active jobs exist                                       |
| Idempotency and duplicate charged-job prevention                        | NOT RUN for active integration | Repeated preview requests are unavailable; this is not active-job idempotency proof        |
| Cursor/page loops; stale resume; account switching; real cancellation   | NOT RUN                        | No adapter/continuation contract selected                                                  |
| Upstream timeouts, 429/401/403, malformed payloads, bounded Retry-After | NOT RUN                        | Auth preflights received 401 only; no active adapter retry mechanism                       |
| Atomic durable quotas/concurrency, credit reservation race tests        | NOT RUN                        | No D1/resource created; no in-memory budget substituted                                    |
| Free exhaustion cannot cause paid fallback                              | PASS only for disabled preview | No provider integration or paid fallback code exists; live billing controls remain BLOCKED |
| Verified short-lived job cleanup and provider retention                 | NOT RUN                        | No jobs; provider retention unresolved                                                     |

## 5. Privacy and security

| Check                                                                             | Status                                            | Evidence                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| No provider/deployment credentials or real social graph in public source/fixtures | PASS within reviewed/scanned scope                | No provider configured; generated data only; source/build/history pattern scan recorded separately                  |
| Automatic privacy copy names future server/provider involvement                   | PASS                                              | Public privacy draft; no false all-local automatic claim                                                            |
| Separate public/checker browser origins                                           | PASS locally                                      | Build rejects same origins; browser verifies public IndexedDB is separate and checker DOM read raises SecurityError |
| Deployed-origin isolation and hosting log settings                                | NOT RUN                                           | No deployment; actual hosting account settings unverified                                                           |
| Checker ads, marketing analytics, replay, embeds, remote avatars absent           | PASS                                              | Source inspection + no-external-request browser assertions                                                          |
| No names/graphs/tokens in cross-origin URLs/messages                              | PASS in implemented navigation                    | Direct origin links, no message handler, no username submission while unavailable                                   |
| Secure cookies and short-lived metadata                                           | NOT RUN for future jobs                           | Preview sets no cookies and creates no server metadata                                                              |
| API no-store/private and noindex headers                                          | PASS in local Workers runtime                     | API unit/browser assertions; static security headers also checked                                                   |
| Safe string rendering/profile links; no password/cookie-copying/bypass UI         | PASS within reviewed paths                        | React text rendering, strict username validation, constructed HTTPS links, inspected source                         |
| Hosting data handling / zero-collection claim                                     | PASS for truthful disclosure; host review BLOCKED | Privacy draft acknowledges normal infrastructure metadata and future provider processing                            |

## 6. UI and performance

| Check                                                                        | Status                                | Evidence                                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Desktop/narrow mobile, readable results and no horizontal overflow           | PASS in tested viewports              | Chromium screenshots at desktop and 390px; additional 640px reflow assertions                                               |
| Keyboard-only navigation/sample/result focus                                 | PASS                                  | Browser keyboard scenario; fixed post-result focus race                                                                     |
| 200% layout zoom / reduced motion                                            | PASS for CSS zoom and media emulation | Browser screenshot/overflow checks; native browser-toolbar 200% zoom NOT RUN                                                |
| Capability unavailable/failure, malformed/empty/partial, large result states | PASS for exercised preview states     | Ten browser scenarios; real provider progress/cancel/resume NOT RUN                                                         |
| Accessibility automation                                                     | PASS in tested pages/states           | Axe on checker desktop/mobile/reflow and all public content pages; not a blanket WCAG certification                         |
| Synthetic target/stress/ZIP timings                                          | PASS, measurements recorded           | `unit-tests-verbose.txt` JSON metrics; no live latency inference                                                            |
| Search interaction                                                           | PASS on reference machine             | `browser-performance.json`, input + assertion round trip under 100ms in recorded run                                        |
| Memory observation                                                           | RECORDED, limited                     | Node heap metrics + coarse Chromium estimate; no universal low-memory-device claim                                          |
| Public-page performance                                                      | RECORDED lab only                     | `public-lab-performance.json`: one local unthrottled FCP/LCP/CLS/navigation observation; field Core Web Vitals NOT MEASURED |

## 7. SEO and advertising

| Check                                                                             | Status                        | Evidence                                                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Original truthful public content, distinct guides, no fabricated ratings/contacts | PASS within review            | Ten public routes; GitHub feedback is real; private contact channel clearly unconfigured                           |
| Exact current Instagram export menu walkthrough                                   | BLOCKED for full verification | Official detailed Help Center requires login; guide states limitation and links official Accounts Center reference |
| Titles/descriptions/canonicals/social/sitemap/internal links/statuses             | PASS locally                  | Built routes and browser assertions; actual deployed origins NOT RUN                                               |
| No account SEO/result-history pages, all previews/checker noindex                 | PASS locally                  | Noindex metadata + headers; sitemap only public content; actual host crawlers not tested                           |
| Ads disabled causes no network requests / no fabricated ads.txt                   | PASS                          | No ad code shipped; browser verifies no external calls and ads.txt404                                              |
| Actual publisher approval, IDs, consent/CMP, operator/private contact             | BLOCKED / NOT CONFIGURED      | Inert component requires a separately reviewed implementation; no activation performed                             |
| Approved ad layout/consent behavior                                               | NOT RUN                       | No ads served anywhere; no approval/indexing/ranking/revenue claims                                                |

## 8. Repository and release

| Check                                                                        | Status                           | Evidence                                                                         |
| ---------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Authenticated owner and new repository availability                          | PASS                             | Connector/CLI identity Arhaan2; repository GET404 before successful creation     |
| Other projects and colliding resources preserved                             | PASS within performed operations | Only intended new repo/workspace and task worktrees changed; no hosting mutation |
| Lockfile/setup/AGENTS/CI/source docs/test suite                              | PASS                             | Versioned source; pinned actions/read-only workflow; no privileged PR deployment |
| Final remote commit and CI                                                   | See release-evidence.md          | Real SHA/run recorded after push, not presumed here                              |
| Actual free host account plan / live deployment / clean hosted-browser smoke | BLOCKED                          | Expired Wrangler auth; no successful deployment or URL                           |
| Ads/indexability on deployed preview                                         | NOT RUN                          | Local builds verified noindex/ad-free; no hosted page to claim                   |
| Rollback                                                                     | NOT RUN on host                  | Exact rebuild/redeploy procedure documented; no deployment exists to roll back   |

## Evidence and commands

- [Core/unit/review tests](evidence/unit-tests-verbose.txt): 134 tests.
- [Type/lint/Astro checks](evidence/checks.txt), [build](evidence/build.txt), [browser tests](evidence/browser-tests.txt): 10 browser scenarios.
- [Independent review](security-qa-review.md); [dependency audit](evidence/dependency-audit.json).
- [Source formats/limits](core-formats.md), [acquisition evidence](automatic-feasibility.md), [hosting/rollback](hosting.md).

Commands: `npm run format:check`; `npm run check`; `npm test -- --reporter=verbose`; `npm run build`; `npm run test:browser`; `npm audit --audit-level=high`. Browser tests start two local Wrangler Pages runtimes. Local environment Node24.18.0/npm11.16.0, macOS arm64, Chromium153.0.8010.12. These local checks are separate from remote CI and hosted production.
