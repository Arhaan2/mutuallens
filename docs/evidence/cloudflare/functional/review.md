# Independent hosted functional QA

**Result: 9/9 scenarios passed, no retries or skipped cases.** The run started at 2026-09-08 02:44:23 UTC and took 10.6 seconds. Each browser used a fresh isolated context per test and the actual hosted worker/API implementation. All selected files, account names, reports, and snapshots were synthetic. No routes, API capabilities, workers, or business results were mocked.

Verified browser origins:

- Public: https://codex-ui-functional-repair.mutuallens-ddm.pages.dev
- Checker: https://codex-ui-functional-repair.mutuallens-app.pages.dev

The lead attested these deployments before this review: public `aa38049e`, checker `06df080b`, built from source commit `75a340ec010b62cc90db3f6275313173e9b0ac77`, source digest `947c21a67c37785ddb58a553055bcf531f8820180152d4cb61918566973de157`. This reviewer independently verified the running URLs and behavior; deployment creation and commit attribution remain lead-owned evidence.

## Engines actually exercised

| Engine | Version | Viewport | Scenarios |
| --- | --- | --- | --- |
| Chromium | 153.0.8010.12 | 1440 × 900 | 3 passed |
| WebKit | 26.6 | 1440 × 900 | 3 passed |
| Firefox | 155.0 | 1440 × 900 | 3 passed |

WebKit automation does not establish testing of an installed Safari application. No additional hosted viewport testing is claimed by this review.

## Assertions executed in every engine

1. **Public-to-checker sample entry.** Public document returned HTTPS 200, `X-Robots-Tag` and meta robots contained noindex, canonical matched the real public origin, and the homepage sample link led directly to checker `/#sample`. Reload restored the synthetic sample. All five categories displayed the exact expected counts: 1,500 / 4,500 / 1,500 / 6,000 / 6,000. Only 50 rows rendered on the current page, with no Instagram profile links for sample records. Parsed CSV contained all 1,500 category records, including `user07500`, and every row retained the synthetic source label. Parsed JSON contained 6,000 records per direction and exactly 4,500 mutual usernames. The real capability API returned preview, automatic disabled/blocked, and ads false.
2. **Local ZIP and loose split JSON imports.** A real synthetic ZIP containing split follower files deduplicated four source rows into three followers; following and negative-category counts were asserted. Downloaded JSON was parsed and exact usernames/raw counts verified. A second loose split JSON import without completeness confirmation withheld negative categories and disabled the corresponding CSV export.
3. **Snapshots and complete differences.** Import alone created no IndexedDB database. Two explicit saves persisted after reload, while the in-memory report did not. The real worker compared the dated snapshots; the 65 additions were browsable as 50 then 15 records, including the final account. Parsed difference CSV contained all 65 exact usernames. The public origin had no snapshot database in the same browser context. The Keep snapshots action preserved both records, and confirmed deletion removed them.

## Browser/network observations

All scenarios recorded zero uncaught exceptions, console errors, failed requests, or HTTP responses at or above 400. Observed HTTP requests were GETs for the two origin documents, CSS/JS assets, the module worker, and `/api/capabilities`; there were no query-bearing HTTP request URLs, observed uploads, or third-party HTTP requests. WebKit also reported local `blob:` download requests, which were not network uploads. The final public-origin isolation page was checked for storage but did not have the main page's event listeners attached.

These normal successful tests captured structured evidence rather than screenshots. Failure-only screenshots/traces were configured, and no failures occurred. Separate visual review is needed for hosted appearance and other viewport claims.

## Artifacts and reproduction

- `results.json`: full Playwright report, including attached browser request/error metadata.
- `summary.json`: compact per-engine results and observed versions.
- `tests/hosted/hosted.spec.ts` and `tests/hosted/playwright.config.ts`: isolated hosted test implementation. The config has no `webServer` and never starts or rebuilds the project.

Run from the MutualLens workspace using the existing installed dependencies:

```sh
npx playwright test --config tests/hosted/playwright.config.ts
```

This is hosted preview functionality evidence. Mandatory real website-only automatic Instagram acquisition remains a separate blocked gate; no live Instagram retrieval was performed or simulated.
