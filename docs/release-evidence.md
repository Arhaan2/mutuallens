> **Current amendment:** See [Core product delivery](core-product-delivery.md) and [the controlling user amendment](specification/Core_Product_Amendment.md). The evidence below retains its original dates, source commits and scope. In particular, the old upload-checkbox policy and earlier per-profile provider economics do not govern the new supplied-file comparison or the newly investigated Seemuapps batch-billed candidate.

# MutualLens release evidence

## September 12, 2026 release execution ledger

| Work                            | Owner                                        | Dependency                                              | Current disposition                                                    |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Checker UI and worker lifecycle | UI/UX implementer; lead integration          | Existing core worker                                    | Merged and hosted; local and hosted three-engine acceptance passed     |
| Public guides and SEO output    | SEO/content implementer; lead host config    | Accepted origin/index gate                              | Merged and hosted as noindexed Cloudflare preview and GitHub demo      |
| Automatic acquisition hardening | Automatic implementer; lead contracts/config | Current provider, private token/target, D1/Worker scope | Integrated fail-closed; live gates blocked/not run                     |
| Correctness/security review     | Independent reviewer                         | Final candidate `efa81e43`                              | PASS for noindexed preview; no open P0-P3 in reviewed scope            |
| Browser/release verification    | Independent verifier; lead hosted readback   | Accepted deployment URLs                                | Local and hosted PASS; no release-blocking UI/SEO/browser defect       |
| Merge and deployments           | Lead                                         | Exact-head CI and hosted readback                       | PR #1 merged; GitHub Pages and both Cloudflare Pages projects deployed |

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

Local evidence for the shipping preview: formatting and check gates passed;
TypeScript/Astro reported zero diagnostics; 16 unit/review files with 319 tests
passed; checker and 13-page site builds passed; startup/port safety passed 3/3.
The lead's built-preview suite passed 153/153 and development suite passed 42/42
across Chromium, Playwright WebKit and Firefox. The separate browser verifier
repeated those 153 and 42 scenarios, inspected 15 responsive checker states at
320/390/768/1440/1920 pixels with zero Axe violations or overflow, parsed a
complete 1,500-row CSV and 6,000-per-direction JSON export, and verified the
noindexed `/mutuallens` Pages artifact. The lead also exercised the exact built
candidate with synthetic uploads and visually inspected the entry and results.

The dependency gate was repaired with the owner's explicit approval.
Wrangler is exactly pinned from 4.129.1 to 4.131.1 and its required Cloudflare
types are exactly pinned from 5.20260907.1 to 5.20260911.1. A clean `npm ci`,
Wrangler version check, and `npm audit --audit-level=high` now pass with zero
known vulnerabilities. CI intentionally retains the same audit threshold.

The configured provider's September 12 Free/cursor change advertises only 25
results per list/run, three runs per day, and a 30-minute cooldown. At least 480
one-direction runs would be required for 12,000 identities, so the 6,000 ×
6,000 automatic target is not feasible on that current advertised Free scope.
Chargeable starts remain disabled.

### Final source, CI and merge provenance

- Independently approved PR head: `efa81e4385c2d17d794012fdbe7b2268f24a9ba0`.
- [PR #1](https://github.com/Arhaan2/mutuallens/pull/1) merged normally without
  admin bypass, force push or branch deletion at 2026-09-12 19:25 PDT.
- Accepted merge/source SHA:
  `00e53a44cc07bf9f19671b56ad40f2497a72a43e`.
- Exact-head [PR CI run 34732636866](https://github.com/Arhaan2/mutuallens/actions/runs/34732636866)
  passed before merge. Post-merge [main run 34733033964](https://github.com/Arhaan2/mutuallens/actions/runs/34733033964)
  passed all verification, GitHub Pages build and deployment jobs against the
  accepted merge SHA.
- The post-merge run repeated clean install, formatting, TypeScript/Astro,
  319 tests, build, high-severity audit, 153 built-browser cases, 42 development
  cases and 3 startup cases. Browser cases ran in Chromium, Playwright WebKit
  and Firefox. WebKit automation is not a physical Safari or iPhone test.

### Deployed preview provenance and hosted checks

- GitHub Pages project/demo: <https://arhaan2.github.io/mutuallens/>. Workflow
  deployment `6416905477` / successful status `18278609354` serves commit
  `00e53a44`. The `/mutuallens/` base, CSS, guides and helpful 404 reloads return
  the expected status; `build-info.json` matches the accepted SHA. HTML is
  `noindex`, `robots.txt` allows retrieval of that directive, and the demo
  sitemap is an empty URL set. GitHub does not serve the Cloudflare `_headers`
  control file, so no `X-Robots-Tag` header is claimed on this host.
- Cloudflare public preview: <https://mutuallens-ddm.pages.dev/>, deployment
  `b6fdaa91-e856-479b-8b94-3175365312ea` from `main`/`00e53a4`.
- Cloudflare checker: <https://mutuallens-app.pages.dev/>, deployment
  `ce91374e-6cd0-438c-8b63-3580528b68f7` from `main`/`00e53a4`; the Pages
  Functions bundle compiled and deployed.
- Both stable Cloudflare aliases return the accepted build stamp and enforce
  `X-Robots-Tag: noindex, nofollow`; their HTML also contains noindex. Direct
  content and hashed checker assets return 200. Capability readback reports
  preview, automatic blocked and ads false. An unauthenticated/cross-origin
  scan start fails closed with 403 `ORIGIN_REJECTED`.
- The production-alias hosted suite passed 12/12 scenarios without application
  failures across Chromium, Playwright WebKit and Firefox. It parsed downloads,
  reopened native data, exercised ZIP/split/partial inputs, local snapshots and
  the exact 6,000-followers + 6,000-following + 4,500-mutual result. The first
  attempt exposed only a Firefox harness boundary: immediate navigation canceled
  two otherwise-200 icon fetches. Waiting for actual network idle (not ignoring
  failures or sleeping) made the complete rerun pass. The lead also opened and
  visually inspected the stable GitHub and Cloudflare aliases.
- The independent hosted verifier separately returned PASS for the exact source
  SHA and stable aliases. Six product journeys passed across Chromium,
  Playwright WebKit and Firefox at 1440 × 900 and 390 × 844 with parsed exports,
  sample/upload counts, search, no horizontal overflow and no product console
  errors. It captured 18 entry/sample/upload states, manually inspected six
  representative captures, repeated all three build stamps twice, and verified
  the GitHub subpath/404/indexing output plus Cloudflare headers/capability.
  Sanitized evidence is retained at
  `/private/tmp/mutuallens-hosted-evidence-20260913/`.

Reproduce the hosted matrix from a clean checkout with:

```sh
MUTUALLENS_HOSTED_SITE_ORIGIN=https://mutuallens-ddm.pages.dev \
MUTUALLENS_HOSTED_CHECKER_ORIGIN=https://mutuallens-app.pages.dev \
npx playwright test --config tests/hosted/playwright.config.ts
```

### Rollback and remaining gates

The release artifacts are reproducible from merge SHA `00e53a44`; source hash
`e9c0bc636dbde59ff574ac2ba6da37b8e567cabbf10dfe714e0e0717043ca9a8`
matches all three hosted build records. Prior verified Cloudflare branch-preview
deployments remain available as read-only comparison points. This was the first
production-branch deployment, so no destructive production rollback was run;
recovery is an explicit rebuild/redeploy of the accepted SHA followed by the
same hosted suite.

Automatic acquisition remains disabled and BLOCKED/NOT RUN. No credentialed
provider retrieval, target-scale retrieval, recurring-free measurement, D1
migration or maintenance Worker deployment was performed. The exact owner
action is to place `APIFY_TOKEN` and an explicitly authorized public test
username in ignored `private/apify.env`, then refresh Wrangler authorization
with D1/Workers scope. Secrets must not be pasted into chat or committed. The
current configured provider Free limits are insufficient for the 6,000 by 6,000
target, so no provider start is authorized until a zero-cash path is proven.
Physical Safari/iPhone testing, trace-level Chrome DevTools Core Web Vitals and
the owner's previously rejected private exports were unavailable and are not
claimed. Production indexability, advertising and commercial launch remain
blocked; this is a noindexed, ad-free preview release.

This ledger is the current release record. Older evidence below remains
attributed to its recorded SHA and must not be used as proof for this release.

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
