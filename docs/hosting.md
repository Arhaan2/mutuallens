# Hosting feasibility — checked 2026-09-07

Cloudflare Pages is the intended host for two independent new projects. Names in Wrangler files are requested names, **not reserved hostnames or successful deployments**. GitHub Pages is not enabled. No domains are purchased.

Current [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/) says static requests are free/unlimited if they do not invoke Functions. Pages Functions consume Workers request quota; Workers Free has 100,000 requests/day, reset midnight UTC. The generated checker `_routes.json` invokes Functions for `/api/*` only. The [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) list 500 builds/month, 20,000 files and 25 MiB maximum file size on Free. Assets are well below those boundaries; actual build sizes belong in release evidence.

[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) distinguishes free from metered paid plans. A paid account's shared allowance is not a hard no-spending guarantee. Before attaching any Functions, verify the existing account is Workers Free with no paid automatic overage. Do not create or upgrade services to proceed. Static-only Pages requests avoid Function usage, but dropping the API silently is not an acceptable production integration.

The [Cloudflare self-serve agreement](https://www.cloudflare.com/terms/) permits free services subject to its terms; the reviewed text is not limited to noncommercial hobby use. Free services can be terminated and do not carry guaranteed availability. Access/content rights and abuse restrictions still apply. This review is not a legal approval of Instagram collection. By comparison, the design rejects using a noncommercial-only plan as a commercial host.

## Actual authorization check

`npx wrangler whoami` (Wrangler 4.129.1) returned: saved token expired, could not be refreshed, not logged in. Pages listing did not run because authorization failed. The existing Cloudflare browser session reached a login screen. No account was created, legal agreement accepted, plan changed, or deployment performed. Owner reauthentication was requested while independent work continued.

## Preview deployment procedure once access is restored

1. Verify authenticated account and Workers Free plan, list projects and check both names. Never replace a colliding project.
2. Create two new Pages projects only after collision checks. Record actual assigned origins.
3. Build with those origins in `PUBLIC_SITE_ORIGIN`, `PUBLIC_CHECKER_ORIGIN`, `VITE_SITE_ORIGIN`. Run all checks.
4. Direct-upload each built directory from its application working directory using Wrangler, with an explicit project name and commit hash. Both remain noindexed and ad-free. Store real deployment IDs/URLs.
5. Smoke-test actual HTTP headers, routes, assets, capability/blocked endpoints and fresh-browser sample/import behavior. Record origin separation and network requests.

Only acquisition/access/budget/target/runtime gates can unlock a future production release. Successful preview hosting cannot satisfy them.

## Rollback

After the first verified release, keep its Git SHA and build origins. Redeploy that exact source/build to the same two newly created projects as a rollback, then repeat browser/header smoke tests. Cloudflare also documents a [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/) to a prior successful production deployment; a preview deployment is not an eligible rollback target. No rollback is currently tested because no deployment exists. Do not delete projects or modify unrelated hosting resources to recover.

## Source CI zero-cash scope

The repository is public and the workflow uses the standard Ubuntu GitHub runner. [GitHub's current billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) describes standard public-repository runner use as free. No larger runner, artifact upload, paid storage increase or deployment secret is configured. The existing per-repository cache allowance was not raised. Actual successful run and commit are in `evidence/github-ci.json`.
