# MutualLens — Product and Technical Design

**Version:** 1.0  
**Prepared:** September 7, 2026  
**Owner:** Arhaan Aggarwal  
**Intended repository:** `Arhaan2/mutuallens` — proposed, not created or checked for availability  
**Status:** Implementation specification. Automatic data acquisition is an unresolved launch dependency, not a verified feature.

## 1. Product definition and fixed decisions

MutualLens is a public, readable Instagram follow-back checker. The primary experience is entirely website-based: enter a username, start a check, and inspect the results. Users must not install an extension, execute a bookmarklet, paste code into a console, provide session cookies, create a developer account, or download an export to use the automatic path.

The owner has fixed the following decisions:

- The name is **MutualLens**.
- Website-only automatic checking is mandatory for version one. An import-only product does not fulfill the brief.
- There is no application-imposed follower/following-count cutoff. The initial live target is approximately **6,000 followers and 6,000 following**.
- Tools and infrastructure must require **$0 cash outlay initially**. No subscriptions, paid upgrades, purchased domains, prepaid top-ups, or auto-recharge are authorized.
- GitHub hosts the source. Production hosting may be elsewhere.
- The business model is organic search traffic plus advertising, without sacrificing readability.
- Codex should use bounded subagents and own repository creation, implementation, tests, and deployment through existing authorized accounts.

**Initial access scope:** automatic support may be claimed only for publicly accessible accounts supported by a verified acquisition method. Private accounts can use their own locally imported exports. This is an explicit coverage limitation, not a claim that username-only access to private data is available. The product is for understanding accounts users own or manage; do not position it as covert monitoring of partners or other people.

**Non-goals for v1:** scheduled monitoring, email alerts, cloud account histories, follower growth services, automated unfollowing, paid plans, private-account bypass, data resale, mobile apps, and runtime AI.

## 2. Feasibility findings and the release boundary

### 2.1 What the reference product demonstrates

FollowsBack advertises a username-based automatic workflow for public accounts following fewer than 2,500 accounts. Its public pages do not disclose the complete acquisition implementation. Its existence establishes that this experience is marketed; it does not prove that unrestricted, complete acquisition at MutualLens's target size is free or reliable. [S1]

### 2.2 What remains unresolved

The reviewed Meta user and business-discovery documentation describes aggregate counts and other profile fields; it does not establish a general-purpose endpoint that returns both complete follower and following lists for arbitrary ordinary accounts. A total count is not sufficient for set comparison. [S2]

A normal webpage does not gain access to another site's DOM or logged-in session simply because Instagram is open in another tab. Browser origin restrictions apply. An iframe, a popup, `credentials: include`, or `mode: no-cors` is not a general solution for reading protected cross-origin data. [S3]

A backend can move the network request off the browser. It does not itself create an authorized, complete, reliable Instagram data source.

Examples of third-party offerings reviewed:

| Candidate | Publicly stated offering | What it does not establish |
|---|---|---|
| HikerAPI | Followers/following features, 100 free requests, then prepaid per-request pricing. | A permanent free allowance, complete 6,000-by-6,000 retrieval, or suitable rights for this product. |
| SocialCrawl | Paginated list endpoints and 100 **one-time** free credits. | An ongoing free production budget or independently tested completeness. |
| Apify | Free-plan platform credit; official documentation describes a renewing free allowance and suspension after it is exhausted. | Every Actor's suitability. Actors have independent prices, restrictions, and behavior. One reviewed Actor explicitly caps free API runs at 1,000 results. |

These are **research candidates, not recommended or approved production dependencies**. Provider marketing is not proof of completeness or of permission to obtain/reuse the data. [S4–S7]

Instagram's terms restrict unauthorized automated collection. An end user's consent or a vendor's working API does not, on its own, settle platform-permission or commercial-reuse questions. Record the applicable terms and unresolved concerns instead of making blanket legal-compliance claims. [S8]

### 2.3 The mandatory acquisition gate

Before enabling production automatic checks, produce `docs/automatic-feasibility.md` with:

1. The exact method/provider, endpoint version, access scope, authentication needs, and relevant primary documentation.
2. A distinction between full lists, sampled lists, and aggregate counts.
3. Pagination semantics, terminal conditions, per-list caps, ordering assumptions, and mutable-data limitations.
4. Free allowance type: recurring quota, one-time credits, or trial; expiry/reset details; billing controls; and commercial-use/access issues.
5. A consented live test near 6,000 followers and 6,000 following. Capture counts, duplicates, pages/requests, wall time, retries, and free credits consumed.
6. Reconciliation against an owner-supplied reference where available, with explicit timestamps and mismatch explanations. Counts alone are not proof of completeness.
7. Evidence that the selected deployment runtime can execute the integration within the free plan.
8. An explicit decision: `PASS`, `BLOCKED`, or `FAILED`, with evidence links and untested items.

A fresh export can be used **internally to validate the integration**. It must not become a mandatory step in the end user's automatic flow.

`PASS` requires evidence for functionality, the target scale, appropriate access/usage conditions, and a credible zero-cash operating mode. A successful run funded only by one-time trial credits is a prototype result, not evidence of an ongoing free public service. A recurring free quota can support a limited-volume beta, but the actual capacity must be measured and stated.

If the gate does not pass, continue useful isolated work on parsing, UI, tests, and documentation. A clearly labeled preview may be deployed with `noindex` and ads disabled. **Do not mark the product complete, advertise working automatic checks, or substitute the importer for the mandatory feature.**

## 3. Product behavior and user experience

### 3.1 Brand and visual system

**Positioning:** “A clearer view of who follows you back.”

Use a clean, light-first interface with off-white background, white surfaces, dark readable text, restrained borders, and a single accent. Keep body text around 16px or greater, use a system font stack initially, and support keyboard focus, reduced motion, zoom, and comfortable touch targets. Treat accessibility checks as tests, not as proof of full compliance.

The list is the product. Do not bury it under oversized metric cards, charts, gradients, promotions, or empty whitespace. Do not copy FollowsBack's branding, source code, proprietary assets, or marketing claims.

Use the MutualLens wordmark as text. A bespoke logo or illustration is not a launch dependency.

### 3.2 Public website and checker entry

The public site explains the tool and offers **Check automatically** as its primary call to action. The secondary action is **Import your Instagram export**. Both open the checker website directly; no installation is required.

The checker entry has:

- One username field, one primary start button, and a compact explanation of supported accounts and data handling.
- A clearly labeled sample-data option.
- A secondary local-import route.
- An honest availability state driven by backend capability, not a hard-coded green badge.

Do not put the username field on a document that loads advertising scripts. See the origin separation in Section 5.

### 3.3 Automatic scan states

Use a real state machine:

`idle -> validating -> preparing -> reading_followers -> reading_following -> verifying -> complete`

Additional states: `temporarily_unavailable`, `rate_limited`, `partial`, `canceled`, `failed`, and `expired`.

Progress should display actual collected records, the current stage, and elapsed time. Show a percentage only when there is a meaningful denominator, and distinguish an approximate profile count from an exact total.

Offer cancel. Offer resume only when the adapter has a valid continuation and the browser still has the necessary accumulated records, or the user explicitly enabled local saving. If the browser loses an in-memory dataset, a server-side cursor by itself is not sufficient to resume that dataset correctly.

Do not promise that scans continue after a browser tab is closed. If the selected provider runs asynchronous jobs, disclose that behavior and ensure cancellation/cleanup are implemented as supported.

Example incomplete-state copy:

> This check is incomplete. We collected 4,180 follower records, but could not establish that the list was complete. Missing accounts have not been classified as “not following you back.”

Example quota-state copy:

> Automatic checks are temporarily unavailable because the service's free processing allowance is exhausted. Your current data has not been classified as a complete result.

This is a service-capacity restriction, not a hidden account-size cutoff.

### 3.4 Results

Use compact category controls above a virtualized or otherwise efficiently rendered list:

- Not following you back.
- Mutuals.
- You don't follow back.
- All followers.
- All following.

Every report displays source, account identity, collected/imported timestamps, completeness status, and relevant warnings. Automatically collected data represents a collection window, not necessarily an atomic Instagram snapshot.

Each row shows username prominently, optional supplied display name secondarily, and an explicit profile link. Render text safely. Do not fetch additional profile details or remote avatars just for decoration.

Provide instant local search, alphabetical sorting, category counts, keyboard navigation, CSV export, and JSON export with provenance. Date sorting is available only when the source supplies a valid date with an understood meaning. Collection time is not “followed on” time.

On mobile, adapt rows to cards or a single-column list without horizontal scrolling. Keep the search control and category selector easy to reach.

### 3.5 Local import

Support the current tested Instagram JSON export structures, including ZIP archives and loose relevant JSON files. Recognize split follower files, combine them, and validate that required directions are present. Unsupported formats must produce a useful error; do not guess at HTML structures or silently discard unknown data.

Only extract relevant supported files. Enforce defensible archive and memory safety limits based on decompressed size, entry count, compression ratio, paths, and actual device constraints. These are resource protections, not an arbitrary cap on valid account records.

Never interpret a missing or unrecognized followers file as an empty followers list.

### 3.6 Optional history

Include local snapshots only after explicit user action. Store on the checker origin, show account/date/source labels, and provide export and delete-all controls. Import and scan data otherwise stays in memory by default.

Compare only compatible snapshots for the same account. Prefer stable account IDs where supplied. Where identity is username-only, disclose rename/reactivation uncertainty.

Describe changes as “present in the earlier snapshot; absent in the later snapshot” or another appropriately qualified difference. Do not invent an exact unfollow time, intent, or reason.

## 4. Data and correctness contract

### 4.1 Normalized records

The shared core should expose typed records containing:

- Stable platform ID, when actually supplied.
- Normalized username and original display form.
- Optional display name and relevant source timestamps.
- Source reference and source schema/version.

Normalization trims whitespace, handles a leading `@`, and compares usernames case-insensitively without removing meaningful punctuation. Validate username/profile-URL input; never accept an arbitrary server-fetch URL. Prefer IDs for identity when consistently available. Do not silently merge ambiguous records.

### 4.2 Per-direction provenance

Followers and following each need independent metadata:

- Source method and adapter version.
- Start/end timestamps.
- Raw rows and distinct records.
- Approximate expected count, if supplied.
- Terminal pagination evidence.
- Duplicate/repeated-cursor indicators.
- Completeness status: `complete_for_source`, `partial`, or `unverified`.
- Warnings, known caps, and unsupported semantics.

Use “complete for supplied data/source,” not “guaranteed perfect live truth.” A count match can support a check but cannot prove absence of sampling or hidden truncation.

### 4.3 Set comparison

For complete, compatible inputs:

```
notFollowingBack = following - followers
notFollowedBackByYou = followers - following
mutuals = following intersect followers
```

Use sets/maps rather than nested cross-comparison loops. Typical comparison work is linear in the number of records; rendering and sorting are separate costs.

The default UX should withhold definitive negative categories until both lists meet the completeness contract. Observed mutuals may be shown on partial inputs as observations, with an incomplete-report warning. Do not label an unobserved record as absent from an incomplete list.

### 4.4 No arbitrary count cap

There must be no `2500`, `6000`, or similar product cutoff used to truncate valid account lists. Test boundaries above the reference product's limit.

Resource limits and service quotas remain real. On exhaustion, preserve honest status and explain the limit. Never convert a safety stop, provider maximum, deadline, or credit exhaustion into “complete.”

A job should be admitted only if its expected resource needs are compatible with the available allowance, where this can be estimated. If the estimate is uncertain, checkpoint and stop before incurring unauthorized charges; disclose the incomplete result.

## 5. Architecture and privacy boundaries

### 5.1 Proposed stack

Use a small TypeScript workspace:

```
apps/
  site/           # Astro static public pages: product, guides, policies
  checker/        # React + Vite checker; no advertising dependencies
  checker/functions/  # Cloudflare Pages Functions /api routes, if selected
packages/
  core/           # Identity, schemas, import, comparison, snapshots
  acquisition/    # Server-only adapter contracts and verified implementation
  fixtures/       # Generated synthetic data, never real personal exports
  ui/             # Small shared tokens/components only where useful
docs/
  automatic-feasibility.md
  architecture.md
  security-and-privacy.md
  seo-and-ads.md
  acceptance-evidence.md
  deployment.md
  release.md
AGENTS.md
```

Keep acquisition separate from comparison. The browser should not receive provider API keys. Never expose a general-purpose scraping proxy.

Astro is proposed for the indexable public content, with React limited to interactive surfaces. Astro's islands approach supports that division. [S12]

### 5.2 Two browser origins, one product

Use two free Cloudflare Pages projects initially:

- Public website: a provider-assigned `*.pages.dev` origin.
- Checker application and its same-origin API: a different provider-assigned `*.pages.dev` origin.

Names such as `mutuallens` and `mutuallens-app` are requested project names, not reserved URLs. Record the actual URLs returned by deployment.

The public site may later load approved advertising on eligible content pages. The checker must not load ad scripts, marketing analytics, session replay, or remote social embeds. Cross-origin navigation stays visually consistent and requires no installation.

This separation matters because same-origin scripts can access same-origin browser storage. Merely removing ad components from the results route is not a strong boundary if other same-origin documents still load third-party scripts and local histories persist. [S3]

Do not move usernames, reports, or scan tokens through query strings between origins. Use direct navigation to an empty checker entry. No wildcard cross-origin messaging or cross-origin graph transfer.

Use host-only secure cookies for checker sessions, strict origin/CSRF validation, and `Referrer-Policy: no-referrer` on checker documents. If an anti-abuse security script is necessary, permit only its documented origin and disclose its data handling; it is not an exception for ads or analytics.

### 5.3 Backend role

The backend is a narrow broker to a verified acquisition source. It validates requests, protects provider credentials, tracks job progress, enforces allowances, and returns normalized pages/results. Automatic mode is **not entirely on-device**: the backend and provider necessarily process requested account data. Privacy copy must say this clearly.

Suggested route contracts, to be finalized after the acquisition prototype:

```
GET    /api/capabilities
POST   /api/scans
GET    /api/scans/:id/status
POST   /api/scans/:id/advance
DELETE /api/scans/:id
```

`advance` is for cursor-based providers. An asynchronous provider may instead need bounded polling and result-page retrieval. Do not invent a pagination model incompatible with the chosen provider.

Use a session-bound job identifier and idempotency mechanism. Verify authorization on every job route. Rate-limit before making upstream requests. A public username does not make an individual user's scan session publicly readable.

Never run a full browser inside a free edge function by assumption. Cloudflare's reviewed free Workers limits include 100,000 requests/day, 10ms CPU per request, and 50 subrequests per invocation; these limits make large monolithic collectors an unsuitable default. Measure actual runtime behavior. [S10]

### 5.4 Job state and budgets

Use free-plan durable storage such as D1 for minimal job metadata, idempotency records, and atomic allowance reservations when necessary. Do not rely on per-process memory for distributed concurrency or spending limits. Reverify current quotas before implementation. [S11]

Avoid storing full social graphs server-side by default. Store provider cursors/run IDs and minimal metadata with a proposed maximum application retention of 24 hours, expiring reads immediately and deleting records through a verified cleanup mechanism. If a provider retains datasets independently, investigate deletion controls and disclose the real retention rather than implying our local deletion removes its copies.

Do not add queues, paid durable services, object storage, browser-rendering subscriptions, or a separate database without demonstrated need and a verified free mode.

### 5.5 Security requirements

- Credentials are server-side secrets only; no secrets in frontend bundles, git history, screenshots, or logs.
- No Instagram password, session-cookie, access-token-copying, or console-code onboarding.
- No login/CAPTCHA bypass, account/proxy rotation to evade blocks, or access to private account data without authorization.
- Provider endpoint allowlists, schema validation, bounded payloads, and explicit network timeouts.
- Respect upstream `Retry-After`; no infinite retries or silent provider switching.
- Safe CSV export against spreadsheet formula injection.
- Safe HTML rendering, safe profile-link construction, and archive-bomb/path-traversal defenses.
- No shared/CDN caching of user job responses; use private/no-store headers where applicable.
- No raw usernames, account graphs, cookies, or request bodies in analytics or error reporting. Review host/provider logging separately.
- No public result pages, public scan histories, bulk-enumeration endpoint, or search-engine index of account graphs.

## 6. SEO and acquisition strategy

### 6.1 Start with useful pages, not volume

Proposed public routes:

| Route | Distinct purpose |
|---|---|
| `/` | Brand introduction, clear supported workflow, direct link to checker. |
| `/instagram-follow-back-checker/` | Primary explanatory landing page for the tool and its limitations. |
| `/guides/download-instagram-followers/` | Verified export instructions with troubleshooting. |
| `/guides/followers-vs-following/` | Explain the two sets with concrete examples. |
| `/guides/not-following-back-vs-unfollowed/` | Explain the difference between present state and historical change. |
| `/guides/instagram-export-troubleshooting/` | Missing files, split exports, date ranges, and malformed input. |
| `/about/`, `/privacy/`, `/terms/`, `/contact/` | Real ownership, data handling, limitations, and contact details. |

These topics are editorial hypotheses, not researched keyword-volume or ranking claims. Do not create hundreds of near-duplicate keyword pages, synthetic account landing pages, invented testimonials, or fake reviews. Google's spam guidance explicitly addresses scaled low-value content created to manipulate rankings. [S13]

### 6.2 Technical SEO

Pre-render useful public text and navigation. Provide accurate titles/descriptions, one clear main heading, canonical URLs derived from the deployed origin, sitemap, robots directives, internal links, and social metadata. Structured data must reflect visible real content; no fabricated ratings or guarantees of rich-result eligibility.

Exclude checker sessions, APIs, exports, and results from public sitemaps. Use `noindex` on checker documents and previews; protect data with authorization rather than relying on robots controls. Do not combine a blanket crawl block with an expectation that crawlers will read a page's `noindex` directive. [S14]

Keep staging noindexed. Only enable public indexability after mandatory product gates pass and copy matches actual capability. Google does not guarantee indexing or ranking because a sitemap or metadata exists. [S15]

### 6.3 Performance

Targets for public pages: LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1 at the 75th percentile when field measurements become available. These are targets, not prelaunch results. Use lab measurements initially and distinguish them from field evidence. [S16]

Reserve ad space when ads are enabled, avoid layout shifts, minimize JavaScript, and make main content usable without waiting for ad scripts.

For the checker, benchmark generated 6,000-by-6,000 data and a larger synthetic stress fixture. Record hardware/browser, timing, and memory observations. A proposed search-interaction budget is <=100ms on the recorded reference environment; report actual measurements and revise implementation rather than inventing benchmark results.

## 7. Advertising and business model

### 7.1 Monetization placement

Build an optional ad component for **public content pages only**, disabled by default. Enable it only after the owner's publisher account/site is approved and real IDs and required consent settings exist.

Start with one clearly labeled placement below useful page content and, where appropriate, one nonintrusive placement on longer guides. Do not add popups, fake download buttons, forced ad interactions, or ads inside the checker/results. No ads on empty, error, loading, or incomplete-preview screens.

Google's policies restrict ads on low-value or non-content screens and placements that interfere with navigation. Original useful content and policy compliance matter; a tool with an ad placeholder is not automatically approved. [S17–S18]

Render no advertising network request when ads are disabled. Publisher IDs must never be invented. Generate `ads.txt` only from verified publisher configuration.

### 7.2 Consent and policies

Plan an integration with a Google-certified consent platform where required. Google's guidance specifies CMP requirements for relevant advertising in the EEA, UK, and Switzerland. Recheck the current requirements and available Google consent tools at activation. A cosmetic hand-built cookie banner is not proof of compliance. [S19]

Prepare truthful privacy and terms drafts, but do not claim a legal review has occurred. Do not insert fictional addresses, support emails, registration numbers, or platform affiliations. The owner must supply actual operator/contact information before the public advertising launch.

### 7.3 Economics and measurement

Separate the concepts:

- No count cap: do not truncate a valid dataset.
- Free user access: users do not pay to check.
- Zero initial owner spending: use only verified free allowances.
- Unlimited service capacity: **not promised**.

Model:

```
gross_ad_revenue = monetized_public_pageviews / 1000 * page_RPM
contribution = gross_ad_revenue - acquisition_costs - hosting_costs
cost_per_completed_scan = all_attributable_scan_costs / completed_scans
```

The cost-per-scan denominator must include the burden of failed/retried jobs in the numerator. Ad-free checker views are not monetized pageviews.

Illustration only, not a forecast: 100,000 monetized public pageviews at an assumed $5 page RPM produce $500 gross. If 10,000 checks each eventually cost an assumed $0.05, acquisition alone consumes $500. Therefore a functioning collector is necessary but not sufficient for an ad-supported business.

At launch, record only minimized aggregate operational measures: start/completion/failure counts, error categories, request/credit consumption, and latency buckets. Avoid graph data and target usernames. Public-site analytics are optional and require privacy review; Search Console can help measure organic visibility after owner verification.

## 8. Zero-cash hosting and repository plan

Keep code on GitHub, but do not use GitHub Pages as the commercial production application host. Its published limits restrict business/commercial-SaaS hosting. Cloudflare Pages is the proposed initial host; use only its verified free offerings and review current terms. Vercel Hobby should not be silently substituted for an ad-supported commercial product because its documentation restricts it to personal noncommercial use. [S9–S10, S20]

Create a new repository only after checking the authenticated GitHub owner and whether the proposed repo already exists. Never overwrite an unrelated repository or modify NextPlay, Portfolio, or other existing projects. If the exact name collides, report it and keep the local project intact rather than deleting anything.

Use existing authorized GitHub and Cloudflare accounts. Do not create accounts, accept legal agreements, add payment methods, or purchase domains without the owner. Missing authorization is an explicit deployment blocker, not a reason to fabricate a successful URL.

CI should install from a lockfile and run type checks, lint, unit/integration tests, production builds, and relevant browser tests. Use read-only default GitHub Actions permissions, trusted pinned actions, and protected secrets. Forked/untrusted PRs must not receive deployment/provider credentials.

Deploy previews separately from production. Record the actual commit, deployment IDs, actual URLs, release status, and rollback procedure. On a successful release, create a release tag and verify the deployed site in a clean browser context.

**No GitHub repository, hosting account, live test, publisher application, or deployment has been performed as part of this specification.**

## 9. Implementation phases and subagents

The lead agent owns contracts, integration, shared configuration, git history, and deployment. Use at most a small number of concurrent subagents with clear boundaries; add more only when independent tasks justify them. OpenAI's subagent guidance favors bounded delegation and cautions about write conflicts. [S21]

Suggested roles:

| Role | Ownership |
|---|---|
| Acquisition investigator | Primary-source research and feasibility evidence; no deployment or secret disclosure. |
| Core/test engineer | Parser, normalization, comparison, synthetic fixtures, core tests. |
| UI/SEO engineer | Readable interface and static public content after contracts are fixed. |
| Independent reviewer | Security, partial-data correctness, tests, accessibility, and release audit. |

Do not let several writers edit the same files simultaneously. Use separate branches/worktrees for independent changes. Shared types and lockfiles belong to the lead. A subagent's “pass” summary is not acceptance evidence until the lead inspects the work and reruns checks.

### Phase 0 — Feasibility and architecture

Research and test the automatic path, establish free-budget and runtime evidence, record provider constraints, and finalize architecture. If access credentials or a consented target are missing, mark live verification blocked and continue only independent work.

### Phase 1 — Repository and shared core

Create the new repo, workspace, AGENTS.md, schemas, tests, generated fixtures, importer, comparison engine, snapshot formats, and CI skeleton.

### Phase 2 — Acquisition integration

Implement only the approved/verified adapter and its narrow backend. Add job/session isolation, idempotency, durable quotas, bounded retries, partial states, cancellation, and secret handling. Keep feature disabled until evidence passes.

### Phase 3 — Checker UX

Implement entry, real progress, useful errors, readable results, local search/sort/export, optional snapshots, mobile behavior, and sample mode. No real automatic request may return sample data.

### Phase 4 — Public site, SEO, ad readiness

Build original public pages and truthful policies, correct metadata and indexing controls, cross-origin navigation, and disabled ad integration. Do not publish claims beyond proven behavior.

### Phase 5 — Independent verification

Run unit, integration, browser, security, source-completeness, quota, and performance tests. Use real automatic evidence separately from synthetic tests. Fix failures before release.

### Phase 6 — Deployment and release

Deploy through authorized accounts, test actual URLs, verify secrets/headers/indexing/disabled ads, preserve rollback, and produce an evidence-based report. Production launch requires the mandatory acquisition gate; previews do not count.

## 10. Acceptance summary

Use the companion `MutualLens_Acceptance_Checklist.md` for detailed evidence. The minimum release criteria are:

- A real website-only automatic workflow at the target scale; no extension/export prerequisite.
- No silent truncation and no false negatives caused by incomplete lists.
- The 6,000/6,000 synthetic fixture with 4,500 mutuals produces 1,500 in each non-mutual category.
- Tested current export formats, multi-file handling, and malformed-input safety.
- Free-plan billing protections and honest quota behavior.
- Origin separation from ads; no secrets or graphs in public artifacts.
- Actual deployed behavior verified in clean browser contexts.
- No claimed indexing, AdSense approval, revenue, or private-account capability without evidence.

## 11. Sources and revalidation

Research checked September 7, 2026. Some Meta pages were available only through indexed official documentation snippets; those limited observations must not be treated as a full API audit. Revalidate current primary documentation when implementing. Third-party vendor statements are explicitly unverified capability claims.

- **S1 — FollowsBack automatic product:** https://www.followsback.com/pro
- **S2 — Meta user/reference documentation:** https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user ; https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery
- **S3 — Browser origin restrictions and fetch:** https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy ; https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
- **S4 — HikerAPI published pricing:** https://hikerapi.com/pricing
- **S5 — SocialCrawl published pricing:** https://www.socialcrawl.dev/pricing
- **S6 — Apify pricing and recurring free mode:** https://apify.com/pricing ; https://docs.apify.com/account/subscriptions ; https://docs.apify.com/academy/actor-marketing-playbook/promote-your-actor/affiliates
- **S7 — Example Actor-specific free-API restriction:** https://apify.com/scraping_solutions/instagram-scraper-followers-following-no-cookies
- **S8 — Instagram terms:** https://www.facebook.com/help/581066165581870
- **S9 — GitHub Pages restrictions:** https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- **S10 — Cloudflare product, pricing, limits, terms:** https://www.cloudflare.com/products/pages/ ; https://developers.cloudflare.com/pages/functions/pricing/ ; https://developers.cloudflare.com/workers/platform/limits/ ; https://www.cloudflare.com/terms/
- **S11 — D1 free-plan pricing:** https://developers.cloudflare.com/d1/platform/pricing/
- **S12 — Astro islands:** https://docs.astro.build/en/concepts/islands/
- **S13 — Google spam policies:** https://developers.google.com/search/docs/essentials/spam-policies
- **S14 — Google noindex and access-control distinctions:** https://developers.google.com/search/docs/crawling-indexing/block-indexing ; https://developers.google.com/search/docs/crawling-indexing/control-what-you-share
- **S15 — Google SEO starter guide:** https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- **S16 — Core Web Vitals:** https://web.dev/articles/vitals
- **S17 — Low-value/non-content ad screens:** https://support.google.com/publisherpolicies/answer/11112688?hl=en
- **S18 — Google publisher policies:** https://support.google.com/adsense/answer/10502938?hl=en
- **S19 — Google CMP requirements:** https://support.google.com/adsense/answer/13554116?hl=en ; https://support.google.com/adsense/answer/16918505?hl=en
- **S20 — Vercel Hobby scope:** https://vercel.com/docs/plans/hobby
- **S21 — Codex subagents:** https://developers.openai.com/codex/subagents/
