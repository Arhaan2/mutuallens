# Hosting feasibility — checked 2026-09-07

Cloudflare Pages now hosts two independent noindexed, ad-free branch previews. [Verified URLs, IDs and tests](cloudflare-preview.md). Assigned public subdomain: `mutuallens-ddm.pages.dev`; checker: `mutuallens-app.pages.dev`. The verified entry points use the `codex-ui-functional-repair` branch alias. GitHub Pages is not enabled. No domains were purchased.

Current [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/) says static requests are free/unlimited if they do not invoke Functions. Pages Functions consume Workers request quota; Workers Free has 100,000 requests/day, reset midnight UTC. The generated checker `_routes.json` invokes Functions for `/api/*` only. The [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) list 500 builds/month, 20,000 files and 25 MiB maximum file size on Free. Assets are well below those boundaries; actual build sizes belong in release evidence.

[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) distinguishes free from metered paid plans. A paid account's shared allowance is not a hard no-spending guarantee. Before attaching any Functions, verify the existing account is Workers Free with no paid automatic overage. Do not create or upgrade services to proceed. Static-only Pages requests avoid Function usage, but dropping the API silently is not an acceptable production integration.

The [Cloudflare self-serve agreement](https://www.cloudflare.com/terms/) permits free services subject to its terms; the reviewed text is not limited to noncommercial hobby use. Free services can be terminated and do not carry guaranteed availability. Access/content rights and abuse restrictions still apply. This review is not a legal approval of Instagram collection. By comparison, the design rejects using a noncommercial-only plan as a commercial host.

## Initial authorization check (historical)

`npx wrangler whoami` (Wrangler 4.129.1) returned: saved token expired, could not be refreshed, not logged in. Pages listing did not run because authorization failed. The existing Cloudflare browser session reached a login screen. No account was created, legal agreement accepted, plan changed, or deployment performed. Owner reauthentication was requested while independent work continued.

## Current authorization and deployment

Owner reauthentication succeeded through scoped Wrangler OAuth. Before creation, the Pages project listing was empty. The owner confirmed Workers Free after viewing the account plan; subscription API reads were denied, so billing evidence is owner-confirmed. Only the new `mutuallens` and `mutuallens-app` Pages projects were created and deployed. No existing Worker, billing or subscription was changed. Both deployments are in Cloudflare's preview environment; production branch `main` has no deployment.

The checker project was configured and read back with `fail_open: false` in both environments (Cloudflare requires matching values). Quota exhaustion was not intentionally tested. Static requests avoid invoking Functions outside `/api/*`.

## Initial preview deployment procedure (executed)

1. Verify authenticated account and Workers Free plan, list projects and check both names. Never replace a colliding project.
2. Create two new Pages projects only after collision checks. Record actual assigned origins.
3. Build with those origins in `PUBLIC_SITE_ORIGIN`, `PUBLIC_CHECKER_ORIGIN`, `VITE_SITE_ORIGIN`. Run all checks.
4. Direct-upload each built directory from its application working directory using Wrangler, with an explicit project name and commit hash. Both remain noindexed and ad-free. Store real deployment IDs/URLs.
5. Smoke-test actual HTTP headers, routes, assets, capability/blocked endpoints and fresh-browser sample/import behavior. Record origin separation and network requests.

Only acquisition/access/budget/target/runtime gates can unlock a future production release. Successful preview hosting cannot satisfy them.

For subsequent updates or recovery, reuse only these verified MutualLens projects; do not rerun project creation. From a clean checkout of the source being deployed, build with:

```sh
PUBLIC_SITE_ORIGIN=https://codex-ui-functional-repair.mutuallens-ddm.pages.dev \
PUBLIC_CHECKER_ORIGIN=https://codex-ui-functional-repair.mutuallens-app.pages.dev \
VITE_SITE_ORIGIN=https://codex-ui-functional-repair.mutuallens-ddm.pages.dev \
npm run build
```

Run Wrangler from each application's directory: `wrangler pages deploy dist --project-name mutuallens --branch codex/ui-functional-repair --commit-hash <actual-clean-source-sha>` for `apps/site`, and the same command with project `mutuallens-app` for `apps/checker`. Use the repository's pinned Wrangler executable and `WRANGLER_SEND_METRICS=false`. The checker directory is essential for compiling its Functions. Record actual deployment results and rerun the hosted suite. Do not run `npm run preview` between this build and upload: that local command intentionally rebuilds with localhost origins.

## Rollback

After the first verified release, keep its Git SHA and build origins. Redeploy that exact source/build to the same two newly created projects as a rollback, then repeat browser/header smoke tests. Cloudflare also documents a [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/) to a prior successful production deployment; a preview deployment is not an eligible rollback target. Rollback remains NOT RUN: these are the first deployments, with no earlier hosted version to restore. Current verified source is `75a340ec010b62cc90db3f6275313173e9b0ac77`. Do not delete projects or modify unrelated hosting resources to recover.

## Source CI zero-cash scope

The repository is public and the workflow uses the standard Ubuntu GitHub runner. [GitHub's current billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) describes standard public-repository runner use as free. No larger runner, artifact upload, paid storage increase or deployment secret is configured. The existing per-repository cache allowance was not raised. Actual successful run and commit are in `evidence/github-ci.json`.
