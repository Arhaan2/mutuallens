# Independent hosted preview visual smoke test

**PASS within this bounded hosted scope.** Tested 2026-09-08 at 02:44 UTC using Playwright Chromium 153.0.8010.12, isolated browser contexts, at 390 × 900 and 1440 × 900 CSS pixels. No source, configuration, git, authorization or deployment changes were made.

## Exact tested URLs and observed provenance

- Public: https://codex-ui-functional-repair.mutuallens-ddm.pages.dev/ — HTTPS 200.
- Checker: https://codex-ui-functional-repair.mutuallens-app.pages.dev/ — HTTPS 200.
- Clicking the actual public homepage sample link navigated across origin to https://codex-ui-functional-repair.mutuallens-app.pages.dev/#sample at both widths and loaded synthetic results.
- Both `/build-info.json` URLs returned HTTPS 200 and the same served provenance: commit `75a340ec010b62cc90db3f6275313173e9b0ac77`, source hash `947c21a67c37785ddb58a553055bcf531f8820180152d4cb61918566973de157`, built at `2026-09-08T02:41:33.672Z`. Raw responses are preserved in `results.json`.

## Executed checks and findings

- Captured and visually opened all eight images: public homepage, checker entry, sample results at their natural scroll position, and sample results aligned to the viewport, at both widths.
- Rendered pages match the final locally reviewed light visual style. Mobile navigation, headings, primary/secondary controls, disabled automatic state, synthetic labels and report structure are coherent. No clipped labels, overlapping controls, broken visual assets or pagewide horizontal overflow were observed in these states.
- Axe homepage, checker entry and sample results at both widths: zero reported violations across six scans. This is bounded automated accessibility coverage, not a complete certification.
- No uncaught page exceptions, console errors, failed requests or HTTP errors were recorded. The checker script, stylesheet and actual module worker loaded successfully. Observed requests stayed on the two intended site/checker origins; no tracker, ad-script or remote-avatar request was observed.
- Displayed sample category counts are exactly 1,500 / 4,500 / 1,500 / 6,000 / 6,000, with 50 rendered rows on the first results page. These are synthetic records; no Instagram account was scanned.
- Public and checker responses include `X-Robots-Tag: noindex, nofollow`; document metadata also remains noindexed. Served capability endpoint reports preview release, automatic disabled/blocked, and ads false.

## Evidence and scope limits

- `results.json`: exact URLs, HTTP response headers, served build-info bodies, capability response, request inventory, browser errors, dimensions, axe results and sample counts.
- `home-390.png`, `home-1440.png`.
- `entry-390.png`, `entry-1440.png`.
- `sample-natural-390.png`, `sample-natural-1440.png`.
- `sample-390.png`, `sample-1440.png`.
- The original isolated smoke-test runner was executed from task scratch space; it is not a retained repository artifact.
- `manifest.json`: SHA-256 hashes of the eight screenshots.

This hosted smoke test supplements the comprehensive local review. It did not rerun every import/history/error/export workflow on the public host and does not establish mandatory automatic acquisition, a live 6,000 × 6,000 account test, recurring-free upstream access, advertising approval, or production product completion.
