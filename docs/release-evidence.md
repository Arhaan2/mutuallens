> **Current amendment:** See [Core product delivery](core-product-delivery.md) and [the controlling user amendment](specification/Core_Product_Amendment.md). The evidence below retains its original dates, source commits and scope. In particular, the old upload-checkbox policy and earlier per-profile provider economics do not govern the new supplied-file comparison or the newly investigated Seemuapps batch-billed candidate.

# MutualLens release evidence

## September 12, 2026 release execution ledger

| Work                            | Owner                                        | Dependency                                              | Current disposition                                                     |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Checker UI and worker lifecycle | UI/UX implementer; lead integration          | Existing core worker                                    | Integrated; lifecycle races fixed; three-engine local acceptance passed |
| Public guides and SEO output    | SEO/content implementer; lead host config    | Accepted origin/index gate                              | Integrated; GitHub subpath/noindex artifact verified locally            |
| Automatic acquisition hardening | Automatic implementer; lead contracts/config | Current provider, private token/target, D1/Worker scope | Integrated fail-closed; live gates blocked/not run                      |
| Correctness/security review     | Independent reviewer                         | Application candidate `aca05c15`                        | PASS for noindexed preview; no open P0-P3 in reviewed scope             |
| Browser/release verification    | Independent verifier                         | Local application candidate and deployed URLs           | Local PASS; hosted verification pending                                 |
| Merge and deployments           | Lead                                         | Exact-head CI, dependency gate, hosted readback         | BLOCKED before push by the dependency gate below                        |

Confirmed defects and dispositions: the WebKit Vite worker cancellation was a
real same-tick lifecycle race, not an ignorable network error; the UI now uses a
synchronous active-task guard. Independent review also reproduced two
provider-error/cancellation interleavings that could leave the sole job slot
occupied until expiry; both now converge to terminal cancellation and have
deterministic regressions. A terminal-dot preview-hostname indexing edge was
also closed. Existing session cookies are renewed with five minutes of headroom
beyond the one-hour job lifetime. Provider-era jobs, stale/late writes,
cross-page identity conflicts, mismatched charge/dataset accounting, abandoned
reservations and exhausted cleanup retries now fail closed.

Local evidence for the shipping preview: formatting and check gates pass;
TypeScript/Astro reports zero diagnostics; 16 unit/review files with 319 tests
pass; checker and 13-page site builds pass; startup/port safety passes 3/3. The
lead's built-preview suite passed 153/153 and development suite passed 42/42
across Chromium, Playwright WebKit and Firefox. The separate browser verifier
repeated those 153 and 42 scenarios at `f20bf993`, inspected 15 responsive
checker states at 320/390/768/1440/1920 pixels with zero Axe violations or
overflow, parsed a complete 1,500-row CSV and 6,000-per-direction JSON export,
and verified the noindexed `/mutuallens` Pages artifact. Later application
deltas only repaired reviewed server-side cancellation and preview-host
normalization; exact-head CI still must repeat the full matrix before merge.

The dependency audit is the remaining code-release blocker: the locked
development toolchain uses Wrangler 4.129.1 and reports three high-severity
entries through Miniflare/Sharp. npm identifies non-major Wrangler 4.131.1 as
the fix. The lead requested explicit owner permission for that development-only
upgrade; CI intentionally retains `npm audit --audit-level=high` and has not
been weakened. No branch push, merge, Pages setup, or release deployment will
be represented as complete until this gate passes on the exact head.

The configured provider's September 12 Free/cursor change advertises only 25
results per list/run, three runs per day, and a 30-minute cooldown. At least 480
one-direction runs would be required for 12,000 identities, so the 6,000 ×
6,000 automatic target is not feasible on that current advertised Free scope.
Chargeable starts remain disabled.

This ledger is the current release record. Application candidate
`aca05c15b5bd5afa92f34208e46f0c553a307df4` is independently approved for a
noindexed preview, not for live automatic acquisition or commercial launch.
Final source/CI/merge/deployment provenance and hosted verification remain
pending. Older evidence below remains attributed to its recorded SHA and must
not be used as proof for this candidate.

> **2026-09-08 repair addendum:** Browser-verified repair of baseline `549e82a` is documented in [ui-functional-repair.md](ui-functional-repair.md): 140 unit/security tests, 126 built-preview browser tests and 42 development scenarios across Chromium/WebKit/Firefox passed locally. See the repair PR for the final pushed head and its matching CI. Historical evidence below remains attributed to its original commits. Automatic acquisition remains BLOCKED. Hosted preview was subsequently deployed and verified; see the current hosting addendum below. No production completion is claimed.

**Overall: PREVIEW-ONLY. Automatic gate: BLOCKED. Hosted preview: PASS.**

The independent preview is implemented and locally tested. Website-only automatic acquisition has not met the fixed product brief. No source adapter is selected; no real Instagram list was acquired; no 6,000 × 6,000 live run or source reconciliation occurred. Signup credits, API schemas, 401 probes, and synthetic tests are not substituted for that gate.

## Current hosting addendum — September 7, 2026 PDT

Two noindexed, ad-free Cloudflare previews are deployed and browser-verified from source `75a340ec010b62cc90db3f6275313173e9b0ac77`, whose [CI run 34178568380](https://github.com/Arhaan2/mutuallens/actions/runs/34178568380) succeeded. [Actual URLs, deployment IDs, owner-confirmed Free plan, hosted tests, screenshots and rollback limits](cloudflare-preview.md). This supersedes hosting BLOCKED/NOT RUN entries in the historical baseline below. The nine hosted functional scenarios passed across Chromium/WebKit/Firefox; Chromium visual checks passed at 390/1440px. Automatic acquisition and live target-scale testing remain BLOCKED/NOT RUN. Host rollback and free-quota exhaustion were not executed.

## Historical baseline evidence

The following entries retain their original implementation and execution scope. They are not current statements about hosting access or deployment status.

## Repository and acceptance

- Repository created: https://github.com/Arhaan2/mutuallens
- Identity: existing GitHub connector and network-enabled CLI returned `Arhaan2`; intended repository returned HTTP404 before creation.
- Accepted implementation commit: `0c24c4f1dfc957183048f659263ecaf78f3b47db` ([source](https://github.com/Arhaan2/mutuallens/commit/0c24c4f1dfc957183048f659263ecaf78f3b47db)).
- Remote CI: [Verify preview run 34171998126](https://github.com/Arhaan2/mutuallens/actions/runs/34171998126), **SUCCESS**. Clean `npm ci`, formatting, lint/types, 134 unit tests, production builds, audit and 10 browser scenarios completed on the GitHub standard Ubuntu runner. Machine-readable steps/SHA are in `evidence/github-ci.json`.
- A subsequent evidence commit adds immutable run/manifest references and corrects only the benchmark platform label to read the actual platform; application code remains the accepted implementation above.
- Local preview verified reachable: [public site](http://localhost:4321) and [checker](http://localhost:5173), running separate local Wrangler Pages runtimes. These are local inspection addresses, not public hosting deployments.
- Build file counts, byte sizes and SHA-256 hashes: `evidence/build-manifest.json`. Source and published main history known-credential scans found zero matches; these scans are bounded pattern checks, not exhaustive proof.
- Local checks: 134 unit/security tests and 10 browser scenarios passed; formatting, lint, TypeScript/Astro check, production build, and dependency audit passed. See [full acceptance ledger](acceptance-results.md).
- Source operations scoped to this new repository and isolated task worktrees; no other projects modified.

## Enabled capability

The username entry is visibly unavailable. The API exposes truthful capability status and fails closed with 503/null results. Secondary features include labeled generated sample, strict local JSON/ZIP import, source-aware set comparison, search/sort/pagination, safe CSV/JSON exports, and explicit local snapshots with compatible historical comparison.

All preview documents are noindexed and ad-free. Public and checker browser origins differ, with build-time validation and executed local storage/DOM isolation tests. No provider secret, paid source, API top-up, new account, domain purchase, plan upgrade or overage was enabled.

## Automatic evidence and economics

See [automatic-feasibility.md](automatic-feasibility.md) for exact schemas/endpoints/conditions/pricing, primary sources, reproducible no-target authentication probes and gate ledger. Actual scan request/credit usage: **NOT MEASURED**. Available target-scale recurring-free service capacity: **not established**. The specifically reviewed Apify Actor's published Free rate would exceed a fresh monthly allowance for 12,000 delivered records; that arithmetic is not a completed scan observation.

No actual usernames/graphs/reference exports are included in public test evidence. All local test data is generated. Future automatic mode must disclose server/provider involvement and prove durable quotas, session-bound jobs, pagination, retry/cancel/resume, retention and access rights before activation.

## Deployment and rollback

Cloudflare Pages is prepared as two new projects. `npx wrangler whoami` failed because the saved token expired and could not refresh. The in-app browser reached Cloudflare login; an additional existing Chrome-profile check timed out. No project name was reserved, account plan verified, deployment uploaded, deployment ID issued, or production/preview host URL established.

Accepted source is retained as tag `preview-2026-09-07` after the verified CI pass. Rollback on a host is **NOT RUN**. The documented procedure in [hosting.md](hosting.md) rebuilds the exact accepted source with recorded origins and redeploys it to the same two intended projects, or uses Cloudflare's eligible prior-deployment rollback after a real release. No unrelated resource should be changed to recover.

## Remaining prerequisites

1. A source with appropriate complete-list access/usage conditions and a recurring free allowance sufficient for a target scan, with enforceable zero-cash operation. No inspected candidate is approved.
2. An authorized public account near 6,000 followers and following, then real target/source/reference/runtime testing. Owner reference data is engineering validation only, not a mandatory end-user export workflow.
3. Restore existing Cloudflare authorization; verify actual free plan and name availability; deploy both noindexed previews and run hosted smoke tests. This only unblocks preview hosting, not automatic production.
4. Before ads or public launch: actual publisher/site approval and IDs, applicable consent/CMP configuration, genuine private operator/contact channel and policy review.

No owner approval or success is inferred from silence. Production completion is not claimed.
