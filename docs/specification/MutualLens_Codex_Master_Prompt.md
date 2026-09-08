# MutualLens — Codex Master Build Prompt

Copy the instructions below into a new Codex project/task. Make the design document and acceptance checklist available to that task. This prompt is also intentionally usable as a standalone brief.

---

You are the lead engineer, product implementer, and release integrator for **MutualLens**, a new public Instagram follow-back checker owned by Arhaan Aggarwal. Build the project from scratch, create a new GitHub repository under `Arhaan2` if authorized, push the code, and deploy through a suitable free host. Do the work, run the checks, and report evidence rather than merely proposing a plan.

Read `MutualLens_Design_Document.md` and `MutualLens_Acceptance_Checklist.md` if provided. Copy the approved specification into the repository's `docs/` directory. Treat the user's fixed requirements below as authoritative; record any technically necessary deviations instead of silently changing the product.

## A. Fixed requirements

1. Product name: **MutualLens**. Proposed repository: `Arhaan2/mutuallens`.
2. The primary flow is **website-only automatic checking**: a visitor enters an Instagram username and receives a comparison without installing anything, pasting cookies/code, obtaining a developer key, or downloading an export.
3. This automatic path is a mandatory launch requirement. A manual-import-only site is not a completed version one.
4. No arbitrary follower/following-count cutoff or silent truncation. The initial live validation target is approximately **6,000 followers and 6,000 following**. Synthetic larger-data tests are also required.
5. The application must be clear, readable, responsive, accessible, and visually restrained. Avoid promotional clutter and oversized dashboard cards.
6. The owner authorizes **no spending**: no paid plans, API top-ups, domains, subscriptions, proxy purchases, or automatic overage. A documented recurring free allowance can support a limited-volume beta; one-time trial credits do not prove an ongoing free production service.
7. The plan is public SEO traffic plus ads. Keep code on GitHub; prefer Cloudflare Pages/free Functions rather than using GitHub Pages as the commercial production host. Reverify current host terms and free quotas. Do not silently use a noncommercial-only hosting plan for a commercial site.
8. Include local export import as a useful secondary route, never as a substitute for automatic checking. Include optional locally saved snapshots with accurate comparison semantics.
9. Keep ads disabled until the owner has actual publisher approval/IDs and the applicable consent configuration. Do not invent approval, revenue, contacts, credentials, or domain ownership.
10. Do not ask the owner to repeat product choices already fixed here. Proceed on independent work when an external authorization or live-test prerequisite is missing, and report the exact blocker.

## B. Working method and subagents

Use your available subagent capabilities. Start with a bounded plan and a small group of independent roles:

- **Acquisition investigator:** research primary sources, exact API capability, free allowances, platform/provider usage conditions, and live-test methodology.
- **Core/test engineer:** normalized types, importer, set comparison, generated fixtures, and core tests.
- **UI/SEO engineer:** interface, public content structure, responsive behavior, and metadata once contracts are fixed.
- **Independent reviewer:** partial-data correctness, security/privacy, accessibility, deployment, and evidence review.

You are the lead integrator and own shared schemas, dependency/lockfile changes, git operations, production configuration, and deployment. Use separate worktrees/branches for independent writers; never allow overlapping uncontrolled edits. Keep provider and deployment secrets with the lead. Do not expose them in subagent transcripts.

Create `AGENTS.md` with file ownership, commands, security constraints, and acceptance gates. Use subagents for genuinely parallel tasks; do not simulate delegation or claim agents ran when unavailable. If spawning is unavailable in the environment, report that limitation and complete the work serially with separate review passes.

Maintain an implementation log and evidence files. A subagent's summary is not proof: inspect its diff and rerun the applicable tests. Do not claim browser tests, live API checks, deployments, or billing guards passed without executing them.

## C. Phase 0 — Prove the automatic integration

The automatic data source is not preselected or verified. Do not assume Instagram's official APIs expose complete follower/following lists for ordinary users. Aggregate counts, first-page samples, and vendor landing-page claims are insufficient.

Research the exact source in current primary documentation. Candidate vendors mentioned in the design document are only research leads, not approved dependencies. Distinguish a genuinely recurring free quota from one-time credits, trial periods, paid per-result calls, and endpoint-specific free-user caps.

A normal webpage cannot simply read a user's logged-in Instagram tab. Do not propose iframes, `no-cors`, copied session cookies, browser security flags, extensions, bookmarklets, or console scripts as fulfillment of the primary website-only requirement. A backend is an integration layer, not proof that the source exists.

Create `docs/automatic-feasibility.md` and a small isolated prototype before building the product around a provider. Record:

- Exact source, endpoint/schema version, authentication, supported account types, and documentation URLs/access dates.
- Whether both full lists are returned; pagination, caps, hidden sampling, and terminal conditions.
- Access and commercial-reuse conditions; unresolved platform/provider issues. Do not claim legal approval from a vendor's technical response alone.
- Free allowance, expiry/reset, actual credits/requests needed per scan, and hard controls that prevent cash charges.
- Compatibility with the actual free deployment runtime.
- A consented live test around the 6,000-by-6,000 target; counts, unique records, duplicates, pages, elapsed time, errors/retries, source completion evidence, and credit consumption.
- Reference reconciliation when an owner-supplied export is available. Reference files are for engineering validation, not the end user's mandatory workflow.

Do not access private accounts without authorization, collect Instagram passwords/session cookies, bypass login/CAPTCHA/access controls, rotate identities or proxies to evade blocks, or reuse a competitor's private backend as our data provider. Respect provider terms and upstream restrictions. A technical HTTP 200 is not a permission or completeness guarantee.

Use `PASS`, `BLOCKED`, or `FAILED`. A small-profile success or synthetic 6,000-record test cannot pass the live target. If a source only provides one-time free credits, label it prototype-only unless there is a verified sustainable zero-cash operating mode. Quantify any recurring-free beta's actual service capacity; do not disguise capacity limits as unlimited service.

If no source satisfies the gate or credentials/consented reference data are missing, continue isolated core, UI, tests, and preview work. Keep production automatic checks disabled and all preview pages noindexed, with ads off. Report that the mandatory feature remains incomplete. Do not declare the app production-ready or replace the requirement with manual import.

## D. Repository and proposed stack

Verify the authenticated GitHub identity and repository availability using existing authorized tools/CLI before creating anything. Create only the new intended repository. A public repository is the proposed default; exclude all personal data and secrets. Do not overwrite an existing repository, delete a colliding repository, or modify NextPlay, Portfolio, or any unrelated project. If the repository already exists, inspect its identity and report the collision rather than assuming it is safe to replace.

Use a TypeScript workspace with:

- `apps/site`: Astro static public site and original guides.
- `apps/checker`: React + Vite application.
- Checker same-origin `/api` routes through Cloudflare Pages Functions or an equivalent verified free option.
- `packages/core`: pure types, normalization, importer, comparison, snapshots, and exports.
- `packages/acquisition`: server-only source contract and verified adapter.
- Generated synthetic fixtures and comprehensive tests.

Select stable compatible dependencies, pin a lockfile, and document runtime/package-manager versions. Keep the stack small. Avoid runtime AI, a CMS, complex queues, or paid infrastructure without a demonstrated need and explicit owner approval for any cost.

The public site and checker must have **different browser origins** so future public-site advertising scripts cannot read checker-local IndexedDB/history. Two free Pages projects are acceptable. Keep shared visual identity and direct website navigation. Do not pass usernames, reports, tokens, or graphs through cross-origin URLs/messages.

## E. Core correctness and privacy

Create a normalized record model with stable IDs when supplied, username, optional display name, and source provenance. Compare usernames case-insensitively without deleting meaningful punctuation. Prefer stable IDs where consistently available. Handle ambiguous identity and rename cases explicitly.

For each direction independently, track source/version, collection window, raw/unique counts, expected count if known, pagination evidence, completeness status, and warnings.

For complete compatible datasets:

- `notFollowingBack = following - followers`
- `notFollowedBackByYou = followers - following`
- `mutuals = intersection(followers, following)`

Use sets/maps rather than nested list searches. Do not classify absence from a partial list as a negative relationship. Default to withholding definitive negative categories until both lists meet the completeness contract; partial inputs may show observed mutuals with clear warnings.

The importer must support tested current Instagram JSON structures, loose supported JSON, ZIP archives, and split follower files. Reject malformed/unsupported data explicitly. Missing files are not empty lists. Process only relevant archive entries. Protect against decompression bombs, path traversal, unsafe text, CSV formula injection, and memory exhaustion. No arbitrary account-record cutoff.

Import files are processed locally. Automatic mode involves our backend/provider: describe this honestly. Keep lists in browser memory by default, optional explicit local saving on the checker origin, and deletion/export controls. Do not store complete social graphs server-side by default or upload them to analytics.

Compare snapshots only for compatible account identities. Do not equate “not following back” with “unfollowed,” invent dates, or infer reasons for changes.

## F. Automatic API and free-budget protection

After Phase 0, implement only the chosen verified source. Keep API keys server-side; do not create a public general-purpose proxy.

Use short, bounded requests with authenticated job ownership, input schemas, endpoint allowlists, CSRF/origin checks, idempotency, and timeouts. Support cursor-based advances or asynchronous provider jobs according to the actual provider contract; do not fake persistence with an indefinitely running edge request.

Provide capability/status, start, progress, cancel, and appropriate advance/result endpoints. Never return fixture data for a real scan. Test session isolation, repeated cursors, duplicate pages, stale checkpoints, cancellation, account switching, and credit exhaustion.

Use durable atomic accounting for global/free-budget reservations and concurrency, such as free D1 where suitable. Per-process memory is not an adequate global spending guard. Keep only minimal short-lived metadata and verify cleanup. Investigate and disclose any external provider retention.

Respect upstream retry instructions. No infinite retries or silent expensive fallback. Stop before unauthorized spending. Check quotas before starting and checkpoint honestly on exhaustion. Resource safety and free-service availability limits must not be mislabeled as complete results or hidden per-account caps.

Measure actual Cloudflare runtime and database quota use. Do not assume a large headless-browser scrape can run within free edge limits.

## G. UI implementation

Use a light-first, restrained visual system: clear typography, neutral surfaces, one accent, visible focus, good spacing, and responsive rows. The wordmark can be text. No giant gradient hero, promotional popup, decorative chart, or excessive dashboard card layout.

Implement:

- Website-only username entry with truthful capability status.
- Distinct labeled sample mode and secondary import.
- Real progress stages and collected counts; percentages only with justified denominators.
- Cancel and only genuinely supported resume behavior.
- Helpful private/unsupported/rate-limited/incomplete/error states.
- Readable category views: not following back, mutuals, you don't follow back, followers, following.
- Local search, alphabetical sorting, profile links, CSV/JSON export, optional snapshots.
- Source/completeness/time labels beside results.

No ad or marketing script may load anywhere on the checker origin. Remote avatars and social embeds are off by default. Any essential anti-abuse security script must be narrowly allowlisted and disclosed.

## H. SEO and advertising readiness

Build original static public pages for the product and a small set of distinct guides: obtaining an Instagram export, followers versus following, non-mutuals versus historical unfollows, and export troubleshooting. Verify actionable instructions against current official documentation.

Add appropriate titles, descriptions, canonical URLs using actual deployment origins, sitemap, internal navigation, social metadata, and structured data only where truthful. No fake reviews, ratings, authors, testimonials, keyword-volume claims, or hundreds of near-duplicate pages.

Checker/results/API/session pages must not appear in public sitemaps. Use real authorization for private job data and `noindex` for checker documents and previews. Do not rely on robots.txt as privacy protection or prevent crawlers from reading an intended noindex directive.

Build ad components only for eligible public content pages, off by default with no external ad requests. No ads on scan, result, error, empty, or loading screens. Label placements clearly and prevent layout shifts. Do not fake `ads.txt` or publisher IDs. Activation requires real account/site approval and applicable consent/CMP configuration; the owner must supply actual legal/contact details. A cookie banner alone is not compliance evidence.

Do not guarantee search indexing, ranking, AdSense acceptance, or revenue. Record acquisition requests/credits and failures so actual economics can be assessed without logging target usernames or follower graphs.

## I. Testing and release gates

Required test evidence includes:

1. Synthetic fixture: 6,000 followers, 6,000 following, 4,500 mutuals -> 1,500 in each non-mutual category.
2. Boundary fixtures around 2,500 and above 6,000, with no truncation.
3. Larger synthetic stress data, explicitly not presented as a live Instagram result.
4. Missing/split/malformed input, duplicates, case normalization, ambiguous identities, and snapshot mismatch.
5. Partial lists and exhausted quotas cannot generate definitive false negatives.
6. A consented live automatic target test, separate from all mocks and fixtures.
7. Job authorization, CSRF, idempotency, API-key secrecy, log redaction, and concurrency/budget correctness.
8. Mobile/desktop browser flows, keyboard navigation, reduced motion, zoom, and accessibility checks.
9. Public/checker origin separation and no ad/analytics requests on the checker, including after visiting the public ad-enabled site in tests.
10. Actual deployed URLs, assets, API routes, headers, canonical/indexing settings, and clean-session smoke tests.

Run formatting, linting, type checking, unit/integration tests, production builds, browser tests, and relevant dependency/security checks. Record commands and outcomes. Treat lab performance measurements separately from field Core Web Vitals; record environment and actual timings.

## J. Deployment and final report

Use existing authorized GitHub/Cloudflare access. Do not create accounts, accept legal terms, add a payment method, or purchase a domain. If login or a narrowly scoped token is unavailable, prepare everything else and report the minimum necessary owner action without exposing secrets.

Configure CI/CD with least-privilege permissions and trusted pinned actions. Do not expose deployment/provider secrets to untrusted pull requests. Deploy a noindexed, ad-free preview while mandatory acquisition evidence is missing. Deploy/advertise production automatic capability only after required gates pass. Do not enable GitHub Pages as a duplicate commercial app or create conflicting canonical sites.

Record actual repository URL, accepted commit, actual deployment URLs/IDs, enabled capabilities, verified scale, budget mode, unresolved issues, and rollback procedure. Preserve a tested release tag when appropriate. Do not invent successful repository creation, completed deployment, a reserved hostname, or publisher approval.

Finish with an evidence-based report containing:

- Overall status: production-ready, preview-only, or blocked, with the mandatory automatic gate named explicitly.
- What was actually built and tested versus mocked/unverified.
- Real repo/commit/deployment identifiers, or exact blockers.
- Live acquisition evidence, observed free-credit usage, and honest operating capacity.
- Security/privacy/SEO/ad-readiness results and remaining owner approvals.
- Rollback instructions and any remaining required tasks.

Proceed through all feasible phases now. Do not end with only a plan. Do not turn a beautiful demo into a false completion claim.
