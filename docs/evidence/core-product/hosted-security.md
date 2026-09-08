# Independent hosted security verification

**PASS for the examined deployed preview boundary: 79 of 79 assertions.** The run at `2026-09-08T05:45:11.513Z`–`05:45:14.546Z` used anonymous HTTPS reads and isolated Chromium with synthetic storage values and disabled-API inputs. It made no real Instagram request or provider run and changed no account, deployment or application setting.

The public and checker branch URLs and both immutable build-info responses independently matched commit `f0165de28d71180f9018eed8c1bd30633bfd6415` and source hash `ffbc199edb1b72999beae53778e41f8b9f29b50d2652d6d82bd14df18643b1e1`:

- [Public branch preview](https://codex-ui-functional-repair.mutuallens-ddm.pages.dev), [immutable public build](https://10037ccf.mutuallens-ddm.pages.dev/build-info.json).
- [Checker branch preview](https://codex-ui-functional-repair.mutuallens-app.pages.dev), [immutable checker build](https://80455a41.mutuallens-app.pages.dev/build-info.json).

| Examined behavior | Observed result |
| --- | --- |
| Document responses | HTTPS 200; HTML and response-header noindex; self-only script/connect CSP, no frames/objects, nosniff and no-referrer |
| Capability discovery | Preview release; automatic disabled/blocked; advertising disabled before any synthetic mutation |
| Disabled scan, result, session and start routes | Four 503 responses with `AUTOMATIC_UNAVAILABLE`, null results and `complete: false`; no provider/private response fields or session cookie |
| Mutation origin boundary | Public-origin, absent-Origin and explicit cross-site session requests each rejected with 403 |
| API response privacy | Every examined API response private/no-store, noindex, inert CSP and no CORS grant |
| Delivered browser code | Main bundle and compiled import worker scanned; no checked provider endpoint, credential-variable, Actor/build identifier, billing-event or provider-token signature |
| Browser isolation | Checker cannot read public local/session storage or change its values; public access to checker DOM throws SecurityError |
| Initial browser activity | Six first-party requests; no third-party request attempt or runtime error; no checker IndexedDB database or MutualLens session cookie |

The delivered main bundle was 243,638 bytes, SHA-256 `16da2f253e05c882eafa620bd040db71240f8cfc5d9a8e326035b9fbff1b5732`. The compiled worker was 89,307 bytes, SHA-256 `2510d70452043345a00f407af4b27c5415ce8731c65702d243e16b068bc33094`. Signature exclusion is a targeted check, not a comprehensive secret or dependency audit. Response bodies, cookie values, raw asset text and graph data are not retained in the sanitized evidence.

**Static CORS caveat:** Pages static documents, build information, robots files and assets returned `Access-Control-Allow-Origin: *`. They are publicly readable static content. The private API returned no CORS grant, and actual browser DOM/storage isolation passed; this review does not claim that every hosted resource lacks CORS.

The [initial harness result](hosted-security.initial-harness-failure.json) is preserved. It stopped because the harness incorrectly required robots `Disallow: /`. The actual explicit `Allow: /` policy permits crawlers to read the already-verified document noindex. The final harness checks an explicit robots policy while retaining both noindex assertions; this was a test-assumption correction, not a product repair.

The automatic gate remained disabled. Enabled-session ownership/CSRF behavior, live acquisition, provider deletion, hosted scheduled TTL execution, real credit usage and publisher approval were **NOT RUN**. The isolated browser used synthetic sentinels and no actual automatic session or graph. The separate UI agent owns application journeys; their results are not counted in these 79 assertions. This approves only the exercised preview boundary and does not establish production automatic completion.

Evidence: [sanitized observations and assertions](hosted-security.json), [reproducible probe](hosted-security.mjs). Later deployments require their own exact build attribution; this record remains attached to the commit and source hash above.
