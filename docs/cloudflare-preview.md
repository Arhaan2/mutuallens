# Verified Cloudflare preview — September 7, 2026 PDT

**Hosting PASS for this preview. UI repair PASS within recorded coverage. Mandatory automatic Instagram acquisition BLOCKED.** This is not production product completion. All preview pages remain noindexed and ad-free.

| Surface        | Verified branch preview                                     | Deployment ID                          |
| -------------- | ----------------------------------------------------------- | -------------------------------------- |
| Public website | https://codex-ui-functional-repair.mutuallens-ddm.pages.dev | `aa38049e-b79b-4ead-b9e1-0c67156d461c` |
| Checker        | https://codex-ui-functional-repair.mutuallens-app.pages.dev | `06df080b-3142-4713-ab77-cd80cedc70d2` |

Immutable deployment addresses: [public](https://aa38049e.mutuallens-ddm.pages.dev), [checker](https://06df080b.mutuallens-app.pages.dev). Application links intentionally use the stable branch aliases. The projects' production branch is `main`, with no production deployment. Bare project hostnames are not the verified preview entry points.

## Source and authorization

Both uploads used clean source commit [`75a340ec010b62cc90db3f6275313173e9b0ac77`](https://github.com/Arhaan2/mutuallens/commit/75a340ec010b62cc90db3f6275313173e9b0ac77), on `codex/ui-functional-repair`. Its matching [GitHub CI run 34178568380](https://github.com/Arhaan2/mutuallens/actions/runs/34178568380) succeeded. The [repair PR](https://github.com/Arhaan2/mutuallens/pull/1) remains open and unmerged. Subsequent hosting evidence/test files do not change the deployed application.

Both served `/build-info.json` responses identify that commit, source SHA-256 `947c21a67c37785ddb58a553055bcf531f8820180152d4cb61918566973de157`, and build time `2026-09-08T02:41:33.672Z`.

The owner restored authorization to their existing Cloudflare account with scoped Wrangler OAuth. Pages listing was empty before creation. Only the two new projects `mutuallens` and `mutuallens-app` were created. Cloudflare assigned `mutuallens-ddm.pages.dev` to the public project. The owner's existing Million Beers API Worker was not changed.

The owner explicitly confirmed **Workers Free** after opening their account plan page. Subscription API reads were denied by the scoped authorization, so this is owner-confirmed plan evidence, not independent API billing verification. No account, domain, payment method, upgrade, top-up, paid fallback or overage was added. OAuth credentials are absent from source and evidence.

## Executed hosted verification

- [HTTP and asset verification](evidence/cloudflare/http-assets.json): 25 checks passed. Every uploaded content file matched its local build SHA-256; all public page canonicals used the assigned public origin. Security/noindex headers were present, and unknown routes plus `ads.txt` returned 404 on both origins.
- [Independent functional review](evidence/cloudflare/functional/review.md): nine normal hosted scenarios passed without retries across Chromium 153.0.8010.12, WebKit 26.6 and Firefox 155.0 at 1440 × 900. Direct sample entry, exact synthetic 6,000/6,000/4,500 counts, parsed full exports, ZIP/split imports, incomplete-data safeguards, explicit snapshot persistence, all 65 differences, and deletion were exercised. No uncaught, console, failed-network or third-party HTTP requests were recorded.
- [Independent visual review](evidence/cloudflare/visual/findings.md): Chromium at 390 × 900 and 1440 × 900. Eight screenshots were opened and inspected; homepage, checker entry and results were coherent without overflow. Six axe scans reported zero violations. The real CSS, JavaScript and module worker loaded. The lead also inspected the hosted mobile results image.
- [Independent security/integration review](evidence/cloudflare/integration/review.md): 33 hosted assertions passed, including private/no-store API responses, cross-origin POST rejection, blocked scans with null results, and actual browser DOM/IndexedDB separation. Static assets carry Cloudflare wildcard CORS; the API does not grant cross-origin access. Ordinary hosting metadata/log retention was not independently audited.
- The actual API reported `release: preview`, automatic disabled/blocked and `ads: false`. No Instagram retrieval was performed. Synthetic counts and successful imports are not automatic-acquisition evidence.

Reproduce the bounded hosted functional suite after `npm ci` and browser installation:

```sh
npx playwright test --config tests/hosted/playwright.config.ts
```

It accesses the recorded public preview aliases, uses synthetic data, and does not build or start local servers. Comprehensive local repair coverage remains in [ui-functional-repair.md](ui-functional-repair.md).

## Runtime, limits and recovery

The public site is static. The checker routes only `/api/*` to its Pages Function; file processing, reports and snapshots remain browser-local. The checker uses compatibility date `2026-09-07` and `nodejs_compat`.

The checker project's [verified configuration](evidence/cloudflare/fail-closed.json) sets `fail_open: false` in both environments. Cloudflare rejected a preview-only update because both values must match; the matching update succeeded. Free-quota exhaustion was **NOT RUN** because the account quota is shared with the owner's other project. This setting does not create an automatic source or prove its economics. See [Cloudflare routing](https://developers.cloudflare.com/pages/functions/routing/) and [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).

Rollback execution is **NOT RUN**: these are the first deployments, with no previous hosted version to restore. Preserve this source commit, the [asset manifest](evidence/cloudflare/build-manifest.json), and [deployment metadata](evidence/cloudflare/deployments.json). Recovery is an explicit rebuild of this exact source with the recorded origins and direct upload to the same two projects/branch, followed by hosted checks. [Cloudflare's rollback action](https://developers.cloudflare.com/pages/configuration/rollbacks/) requires an eligible previous production deployment; these previews are not eligible targets. Do not delete projects or change the unrelated Worker to recover.

The complete-list source, consented live target-scale run, recurring zero-cash acquisition allowance, publisher approval/IDs, consent configuration and private operator contact remain unresolved. Hosting cannot satisfy those gates.
