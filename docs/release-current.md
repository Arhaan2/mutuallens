# MutualLens current release record

Status: implementation and verification in progress. Presentation cleanup has not yet shipped; automatic product acceptance remains blocked. This record supersedes older status summaries, without changing their historical evidence.

## Preservation and initial state

- Starting remote main: `0f0ec2c2545195117fbfb4c2cf81b2fc6d030ae4`.
- Annotated preservation tag, pushed without replacing any ref: `preserve/pre-ship-20260919-0055`.
- Release branch: `codex/mutuallens-ship-20260919`, based on current remote main.
- Initial working tree clean. Existing ignored private work preserved in place; no unknown files staged. Previous local branch retained.
- No open pull requests at inspection. Previous PR #1 had already merged. Main has no branch protection configured (GitHub returned 404); this release still requires passing exact-head checks and independent review, with no bypass.
- All three initial stable URLs serve `00e53a44cc07bf9f19671b56ad40f2497a72a43e`, application source hash `e9c0bc636dbde59ff574ac2ba6da37b8e567cabbf10dfe714e0e0717043ca9a8`.
- GitHub Pages: `https://arhaan2.github.io/mutuallens/`, Actions deployment source.
- Cloudflare public: `https://mutuallens-ddm.pages.dev/`, project `mutuallens`, previous deployment `b6fdaa91-e856-479b-8b94-3175365312ea`.
- Cloudflare checker: `https://mutuallens-app.pages.dev/`, project `mutuallens-app`, previous deployment `ce91374e-6cd0-438c-8b63-3580528b68f7`.

## Build, hosting and rollback

Product build: Node 24 / npm 11, pinned lockfile; `PUBLIC_SITE_ORIGIN=https://mutuallens-ddm.pages.dev PUBLIC_CHECKER_ORIGIN=https://mutuallens-app.pages.dev VITE_SITE_ORIGIN=https://mutuallens-ddm.pages.dev npm run build`. No public base path. Indexing and automatic collection stay disabled. Deploy each app's dist from its application directory using pinned Wrangler, explicit existing project, `--branch main --commit-hash <exact-clean-source-sha>` and `WRANGLER_SEND_METRICS=false`. Never run the localhost preview command between production build and upload.

GitHub artifact: `node scripts/build-pages.mjs` writes only `apps/site/project-dist`; main's existing Actions workflow deploys it after verification. Its static project entry is distinct from the Cloudflare product, with no application, proxy or automatic redirect. HTML noindex governs the project path; its path-local robots file is not an origin-wide directive. The product and checker remain separate origins. This role follows the [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) and [Pages terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#pages); it is an implementation interpretation, not a GitHub approval.

Rollback: Cloudflare project Deployments → select the prior successful production deployment IDs above → Rollback to this deployment, then verify stamps, headers and upload flows. [Cloudflare rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/) excludes branch preview deployments. Alternatively make a separate clean checkout of the exact prior deployed SHA, install the pinned dependencies, build using the three Cloudflare origins above and deploy both artifacts to the existing projects/main. Do not reset or overwrite owner work. GitHub recovery uses a normal reviewed revert PR on main restoring the preserved version, lets Actions redeploy, then verifies `/mutuallens/`; do not force-push or delete refs. Rollback has not been exercised in this pass.

## Current verification

Baseline `npm ci`, format check, lint/TypeScript/Astro, 319 unit/review tests and build passed on Node 24.18.0 / npm 11.16.0. Baseline browser suite passed 153/153. Candidate format/check/build and 320 unit/review tests passed. Final built-browser suite passed 162/162 across Chromium, Playwright WebKit and Firefox. Development-browser suite passed 42/42 and startup lifecycle checks passed 3/3. Browser installation succeeded and npm audit reported zero vulnerabilities; dependencies and lockfile are unchanged. The first candidate run exposed a click/hash navigation race (fixed by applying each navigation once) and an obsolete hidden-control assertion (corrected without dropping behavioral coverage). No private owner exports were supplied or opened; structural fixtures are synthetic.

## Automatic milestones

No APIFY_TOKEN present in the task environment or documented `private/apify.env`, checker `.dev.vars`, root `.env` or `.env.local` locations. No authorized public Instagram target supplied. No credit-consuming operation attempted. Current public provider evidence and exact prerequisites will be linked here; all live milestones remain NOT RUN: genuine small-account both-direction retrieval, multipage continuation, approximately 6,000 + 6,000 retrieval, measured recurring free capacity, and hosted website-only automatic journey. Local synthetic tests do not satisfy these gates.

## Candidate implementation and independent review

Customer-facing development banners, footer labels, page metadata, engineering-gate explanations and public sample entry points are removed. The homepage explains the three relationship categories without fictional profiles or counts. File selection and drop now compare immediately; optional labels/dates, ambiguity assignment and explicit retries remain. A failed replacement preserves the previous report. Existing formats, pagination, complete exports, local snapshots and privacy boundaries remain. Provider capability, indexing and ads remain separately disabled.

Reviewed application source hash: `b45488234e44ef6d8995762733f83d78b8478cc4b53625308815f74c273e5ba7`. Isolated UI, automatic investigation, hosting/test migration and independent verification workstreams were used; agents did not receive secrets, commit, change dependencies or deploy. Independent review passed 21 browser scenarios across Chromium/WebKit/Firefox and 57 focused security/core/API/origin/artifact tests; no open release blocker was found in that scope. Final report: [security-qa-review.md](security-qa-review.md). Lead additionally inspected desktop homepage/checker and mobile result screenshots. WebKit automation is not a physical iPhone test.

[Current automatic evidence](automatic-feasibility.md) rechecked Seemuapps default build 1.0.43 and its 25-record/list, 3-run/day and 30-minute Free cooldown. The two bounded alternatives exceed the documented recurring Free allowance at target scale, so no replacement is justified or enabled. Published limits/prices are source claims, not measured account usage. No viable target-scale recurring-free source, private provider token or authorized test target is available. The next owner setup is an existing Free account token stored in gitignored `private/apify.env` (directory 700/file 600), explicit no-paid-overage confirmation, and an authorized public small-test username; do not paste credentials into chat. This enables evaluating a controlled small test only after an applicable source/build review, not the blocked full-scale release. Hosted automatic work also needs the previously missing MutualLens-only D1/Worker scope; no resources were provisioned.

| Live automatic milestone                             | Outcome                          |
| ---------------------------------------------------- | -------------------------------- |
| Genuine small account, both directions               | NOT RUN                          |
| Genuine multipage continuation/reconciliation        | NOT RUN                          |
| Approximately 6,000 followers + 6,000 following      | NOT RUN / current source blocked |
| Total usage and conservative recurring free capacity | NOT MEASURED                     |
| Actual hosted website-only automatic journey         | NOT RUN; safely disabled         |

PR, exact-head CI, merge and deployments will be recorded after execution. This candidate does not claim complete automatic-product readiness.
