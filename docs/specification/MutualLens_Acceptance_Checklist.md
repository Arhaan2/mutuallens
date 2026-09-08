# MutualLens — Acceptance and Release Evidence

**Prepared September 7, 2026.** This is a checklist, not a record of completed tests. All evidence fields begin unverified.

Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. Every `PASS` needs a command, test artifact, source reference, or reproducible observation. Never substitute a narrative assertion for execution evidence.

## 1. Automatic functionality — mandatory

| Check | Required evidence | Status |
|---|---|---|
| Website-only experience | Fresh visitor completes username -> scan -> results without installation, export, cookies/code, or personal API key. | NOT RUN |
| Complete list access | Both directions supported; source is not a count-only or sampled endpoint. | NOT RUN |
| Target-scale live run | Consented target near 6,000 followers AND 6,000 following; actual counts and timestamps recorded. | NOT RUN |
| Completion semantics | Terminal evidence, deduplication, known caps, repeated-cursor checks, and mismatch handling. | NOT RUN |
| Reference reconciliation | Compare against owner-provided reference where available; explain collection-window differences. If absent, record reduced confidence. | NOT RUN |
| Zero-cash operation | Current allowance, recurring/trial status, no top-up/overage, request/credit use, measured available scan capacity. | NOT RUN |
| Appropriate source usage | Relevant access/provider/platform conditions documented; unresolved issues stated. | NOT RUN |
| Real deployed runtime | Live integration tested from actual free hosting environment, not just local machine. | NOT RUN |

**Gate:** A mock, small-profile test, import test, or single successful trial-funded call does not establish a production-ready automatic service.

## 2. Deterministic comparison

Generate fixtures, never real accounts, for repeatable tests:

- Followers `{user00001 ... user06000}`.
- Following `{user01501 ... user07500}`.
- Expected mutuals: 4,500.
- Expected not following back: 1,500.
- Expected you do not follow back: 1,500.
- Expected union: 7,500.

Test 0-record valid datasets separately from missing inputs. Test duplicate records, casing, leading `@`, punctuation, optional IDs, and conflicting identities.

Boundary sizes: 2,499, 2,500, 2,501, 6,000, and 6,001 per direction. Add a clearly labeled synthetic stress test such as 50,000 records per direction. No code path may silently trim data at any of these sizes.

For a partial followers list, assert that absence is not classified as a definitive non-follower. Test this in the engine, API response, and visible UI.

## 3. Import and snapshots

- Supported JSON schema samples are current and covered by tests.
- Loose JSON and split follower files produce the same union as the equivalent ZIP.
- A missing followers or following input produces a meaningful error, not zero accounts.
- A malformed or unknown schema is not silently accepted.
- Decompression/resource limits fail safely without a fabricated complete result.
- ZIP path traversal, excessive entries, dangerous compression ratios, and invalid text are handled.
- CSV export neutralizes spreadsheet-formula payloads.
- Local export files are not transmitted through network requests.
- Snapshot saving is explicit and off by default.
- Delete-all removes app-controlled local snapshots; shared-device implications are disclosed.
- Comparisons reject or flag mixed account identities, incompatible schemas, partial snapshots, and unknown dates.
- Username-only changes do not claim verified historical unfollows or exact change times.

## 4. Automatic jobs and quotas

- Invalid username/profile URL cannot become arbitrary server-side fetching.
- Job IDs are session-bound; another browser session cannot read/advance/cancel them.
- Origin/CSRF protections work on state-changing routes.
- Repeated requests are idempotent and do not create extra charged upstream jobs.
- Repeated cursors and repeated pages stop with partial/error status.
- Timeouts, 429, 401/403, malformed provider payloads, and quota exhaustion have explicit outcomes.
- Retry handling obeys upstream instructions and uses bounded attempts.
- Cancellation halts new work and attempts provider cancellation when supported.
- Resume requires both valid continuation metadata and the previously accumulated data.
- Account changes cannot merge two users' datasets.
- Durable concurrency/credit accounting prevents double reservation and spending races.
- Free allowance exhaustion cannot trigger a paid plan or provider fallback.
- Short-lived metadata has a verified expiry/deletion mechanism; provider retention is stated.

## 5. Privacy, security, and public repository

- No provider/deployment secret in source, build output, CI logs, screenshots, or git history.
- No real export, username list, account graph, or session token in public fixtures/artifacts.
- Automatic privacy copy explicitly names server/provider involvement.
- Checker and ad-funded public site use different browser origins.
- Checker contains no ad SDK, marketing analytics, session replay, or social embed.
- Visiting the public site cannot read checker IndexedDB or DOM in a browser test.
- No usernames/graphs/tokens in cross-origin query strings or messages.
- Cookies are securely scoped and response caching is appropriate for job data.
- User-generated strings render safely; external links are constructed safely.
- No login/password/cookie-copying form, extension, bookmarklet, or bypass instruction.
- Security/hosting logging is reviewed; unsupported “zero data collection” claims are absent.

## 6. UI and performance

Test desktop and a narrow mobile viewport, keyboard-only use, 200% zoom, reduced motion, loading/failure/empty states, and a large result list.

Record:

| Measurement | Environment | Actual result |
|---|---|---|
| Synthetic target parse/compare | To be recorded | NOT RUN |
| Synthetic stress parse/compare | To be recorded | NOT RUN |
| Search interaction timing | To be recorded | NOT RUN |
| Memory observations | To be recorded | NOT RUN |
| Public-page lab performance | To be recorded | NOT RUN |
| Accessibility automation + manual checks | To be recorded | NOT RUN |

Do not present lab results as field Core Web Vitals. Do not claim “instant” automatic scans based only on local set-comparison timing.

## 7. SEO and ads

- Public content is original, useful, and accurately describes currently enabled capability.
- Titles, descriptions, canonicals, sitemap, status codes, and links match deployed origins.
- No fictional ratings, testimonials, contact details, keyword volumes, or author credentials.
- No per-user/account SEO pages or public result history.
- Checker/preview documents are noindexed; private API data is authorization-protected.
- Ads disabled means no ad-network requests anywhere.
- Ad code can run only on eligible public pages after actual approval/configuration.
- No ads on loading, error, empty, checker, or results screens.
- Actual publisher IDs and ads.txt are required; no placeholders go live as real identifiers.
- Consent/CMP activation and truthful operator/contact/privacy information are verified before ads.
- Layout and labels avoid accidental clicks and disruptive shifts.
- Indexing, ranking, revenue, and AdSense approval are not claimed without evidence.

## 8. Repository and deployment

- Authenticated GitHub identity verified; only the intended new repository changed.
- Existing projects and colliding repositories preserved.
- Lockfile, setup instructions, AGENTS.md, CI, tests, and source/architecture docs committed.
- CI permissions are minimal and untrusted PRs do not receive secrets.
- Actual free host plan and constraints documented.
- Production URL, commit, deployment IDs, and release status are real and recorded.
- Fresh-browser smoke test reaches working site, assets, routes, and API.
- Ads and indexability match release status.
- Rollback procedure is tested or its untested parts are explicitly identified.

## 9. Release decision template

```
Overall status: PRODUCTION-READY / PREVIEW-ONLY / BLOCKED
Automatic gate: PASS / FAIL / BLOCKED / NOT RUN
Zero-cash operating mode: [actual recurring allowance / trial-only / unverified]
Source access/usage review: [evidence and unresolved issues]
Repository: [actual URL or blocker]
Accepted commit: [actual SHA]
Deployment(s): [actual URLs and IDs]
Live target: [actual counts and collection window]
Reference reconciliation: [method, timestamp, discrepancies]
Synthetic tests: [commands and results]
Browser/security tests: [commands and results]
Observed credits/requests per completed scan: [measured]
Available free capacity: [measured estimate, assumptions, reset]
Ads: DISABLED / APPROVED AND CONFIGURED
Indexing: PREVIEW NOINDEX / PUBLIC CONTENT INDEXABLE
Owner actions still required: [specific authorization/configuration only]
Rollback: [actual procedure]
Known limitations: [explicit]
```

A finished manual checker plus a disabled automatic button is **preview-only**, not fulfillment of the product brief.
