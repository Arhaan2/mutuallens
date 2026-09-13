# Independent hosted integration/security smoke test

Observed 2026-09-08T02:48:57Z. **PASS within this bounded hosted-preview scope: 33 assertions. No new P0/P1 defect found.**

- Public origin: https://codex-ui-functional-repair.mutuallens-ddm.pages.dev
- Checker origin: https://codex-ui-functional-repair.mutuallens-app.pages.dev
- Served build commit on both origins: `75a340ec010b62cc90db3f6275313173e9b0ac77`.
- Served source hash: `947c21a67c37785ddb58a553055bcf531f8820180152d4cb61918566973de157`.
- Browser: Playwright Chromium 153.0.8010.12, macOS/arm64, isolated new context, valid HTTPS certificate required. No installed Safari claim.

## Executed checks

Both HTTPS home documents returned 200, with noindex, restrictive CSP including self-only connections and no framing, no-referrer, nosniff, and DENY framing headers. Home bytes and loaded public CSS/checker CSS/JavaScript/module-worker bytes matched the recorded deployment manifest hashes. Both build-info responses identified the expected commit and source hash.

The actual hosted capability endpoint returned disabled preview capability with ads false. GET `/api/scans` returned 503 with `results:null` and `complete:false`. A POST with the public origin and cross-site Fetch Metadata was rejected with 403/ORIGIN_REJECTED. A same-origin POST remained unavailable with 503/null. These were bounded empty-body requests; no Instagram username or real graph was supplied. All tested API responses carried `private, no-store`, noindex, restrictive API CSP, and no cross-origin CORS permission.

In the real browser, direct synthetic mode loaded the actual module worker, exposed no real Instagram profile links, and created no snapshot database before explicit saving. Saving created the checker-origin snapshot store; public-origin `indexedDB.databases()` remained empty. An actual checker popup referenced from the public document raised `SecurityError` when the public document tried to read its DOM. Test-owned synthetic snapshots were explicitly deleted afterward, and the isolated browser context was closed.

The normal public/checker/sample/snapshot/popup flow produced 11 requests, all to the two intended origins. No external ad/tracker/avatar request, browser exception, console error, failed request, or failed asset response was observed. This is observation of the exercised flow, not a claim to have tested every site route or future feature.

## Evidence interpretation and caveats

- Cloudflare static responses included `Access-Control-Allow-Origin: *`; tested API responses did not. Do not describe the entire deployment as having no wildcard CORS. The static HTML/code contains no imported graph, and static CORS does not grant access to a live checker document or its IndexedDB; those origin boundaries were directly tested.
- `deployments.json` was captured at 02:43:46Z with the initial checker `fail_open:true`. `fail-closed.json`, captured later at 02:45:23Z, records both checker project environment values changed/verified false. A final read confirmed the added post-deployment annotation explicitly points to the later verified setting. The public static project's initial value is not evidence about checker Functions.
- The fail-closed record has `latestDeploymentFailOpen:null`, and quota-exhaustion behavior was explicitly NOT RUN. These browser/API checks do not establish behavior after shared quota exhaustion. Do not intentionally exhaust quota to turn a configuration observation into a runtime claim.
- The Free plan evidence is the owner's explicit confirmation; subscription API verification was unavailable to the deliberately scoped authorization. This reviewer made no billing/account API request and does not independently certify account-wide billing settings.
- A final read confirmed `hosting.md` and `release-evidence.md` now contain current hosting addenda linked to `cloudflare-preview.md`, and mark old authorization/no-deployment statements as historical. A successful noindexed branch preview is not production completion or an eligible historical production rollback by itself.
- Mandatory automatic Instagram acquisition remains BLOCKED. No live account, complete upstream list, recurring allowance, target-scale acquisition test, ad approval, or production release was established here.

## Artifacts and scope control

`hosted-evidence.json` contains selected nonsensitive response headers, status/payload evidence, commit stamps, hashes, browser request URLs, and boolean isolation results. No tokens, cookies, real exports, or social graph contents are included. `hosted-check.mjs` was the task-local scratch harness and is not retained in the repository. Its first run passed 30 checks before a scratch-script URL accessor error; that run is retained separately as `harness-error-evidence.json`. The accessor was corrected and the complete run passed all 33 checks. This was a harness correction, not a product repair.

No source, Git, build, deployment, Cloudflare settings, credentials, or unrelated project was modified. No local server was started or quota deliberately exhausted. The web text viewer could not open these new branch URLs; the recorded HTTPS requests and browser checks used the actual authorized origins directly.
