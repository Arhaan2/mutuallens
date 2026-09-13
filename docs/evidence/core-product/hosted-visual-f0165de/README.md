# Hosted verification — f0165de

Verified the actual public and checker previews on 2026-09-08 UTC:

- Public: https://codex-ui-functional-repair.mutuallens-ddm.pages.dev/
- Checker: https://codex-ui-functional-repair.mutuallens-app.pages.dev/
- Both `/build-info.json` responses: HTTP 200, commit `f0165de28d71180f9018eed8c1bd30633bfd6415`, source hash `ffbc199edb1b72999beae53778e41f8b9f29b50d2652d6d82bd14df18643b1e1`, built `2026-09-08T05:37:32.494Z`.

The existing four hosted scenarios passed in Chromium 153.0.8010.12, WebKit 26.6, and Firefox 155.0: 12 passed, zero failures/skips/retries, 31.2 seconds. Raw results are preserved at `/tmp/mutuallens-hosted-final.json` and `/tmp/mutuallens-hosted-final.txt`.

Coverage includes sample metadata/counts/full exports; split ZIP deduplication and qualified missing-part results; explicit snapshot persistence/deletion and all 65 historical differences; and a direct synthetic 6,000-followers × 6,000-following upload without an account label, date, or confirmation. The uploaded result has 4,500 mutuals and 1,500 non-followers. Search, pagination, complete CSV, native JSON reopening, and equivalent HTML files were exercised on the deployed checker.

An isolated Chromium inspection captured the public page and checker entry/results at 390×844, plus checker entry/results at 1440×900. The repaired mobile entry controls have a measured 10px horizontal gap and visually distinct labels. No page overflow, Axe violations, application console/page errors, broken responses, external asset requests, or non-read network requests were observed in the inspected page/import states. Screenshots were visually inspected. Long synthetic usernames wrap visibly in mobile rows; their complete text and profile controls remain present.

The actual hosted website's profile link was clicked and opened a new browser tab with the correct synthetic profile URL. The destination was **simulated by Playwright route fulfillment**, with no real Instagram destination request/response. The new tab had `window.opener === null` and an empty `document.referrer`. This verifies the website's navigation/isolation behavior, not a real Instagram profile or relationship.

Files in this directory contain the reproducible inspection script, structured evidence, and viewport screenshots. All relationship inputs were synthetic, processed locally, and were not automatically saved. These results do not establish live automatic acquisition or production gate completion.
