# MutualLens release evidence

> **2026-09-08 repair addendum:** Browser-verified repair of baseline `549e82a` is documented in [ui-functional-repair.md](ui-functional-repair.md): 140 unit/security tests, 126 built-preview browser tests and 42 development scenarios across Chromium/WebKit/Firefox passed locally. See the repair PR for the final pushed head and its matching CI. Historical evidence below remains attributed to its original commits. Automatic acquisition remains BLOCKED. Hosted preview was subsequently deployed and verified; see the current hosting addendum below. No production completion is claimed.

**Overall: PREVIEW-ONLY. Automatic gate: BLOCKED. Hosted preview: PASS.**

The independent preview is implemented and locally tested. Website-only automatic acquisition has not met the fixed product brief. No source adapter is selected; no real Instagram list was acquired; no 6,000 × 6,000 live run or source reconciliation occurred. Signup credits, API schemas, 401 probes, and synthetic tests are not substituted for that gate.

## Current hosting addendum — September 7, 2026 PDT

Two noindexed, ad-free Cloudflare previews are deployed and browser-verified from source `75a340ec010b62cc90db3f6275313173e9b0ac77`, whose [CI run 34178568380](https://github.com/Arhaan2/mutuallens/actions/runs/34178568380) succeeded. [Actual URLs, deployment IDs, owner-confirmed Free plan, hosted tests, screenshots and rollback limits](cloudflare-preview.md). This supersedes hosting BLOCKED/NOT RUN entries in the historical baseline below. The nine hosted functional scenarios passed across Chromium/WebKit/Firefox; Chromium visual checks passed at 390/1440px. Automatic acquisition and live target-scale testing remain BLOCKED/NOT RUN. Host rollback and free-quota exhaustion were not executed.

## Historical baseline evidence

The following entries retain their original implementation and execution scope. They are not current statements about hosting access or deployment status.

## Repository and acceptance

- Repository created: https://github.com/Arhaan2/mutuallens
- Identity: existing GitHub connector and network-enabled CLI returned `Arhaan2`; intended repository returned HTTP404 before creation.
- Accepted implementation commit: `0c24c4f1dfc957183048f659263ecaf78f3b47db` ([source](https://github.com/Arhaan2/mutuallens/commit/0c24c4f1dfc957183048f659263ecaf78f3b47db)).
- Remote CI: [Verify preview run 34171998126](https://github.com/Arhaan2/mutuallens/actions/runs/34171998126), **SUCCESS**. Clean `npm ci`, formatting, lint/types, 134 unit tests, production builds, audit and 10 browser scenarios completed on the GitHub standard Ubuntu runner. Machine-readable steps/SHA are in `evidence/github-ci.json`.
- A subsequent evidence commit adds immutable run/manifest references and corrects only the benchmark platform label to read the actual platform; application code remains the accepted implementation above.
- Local preview verified reachable: [public site](http://localhost:4321) and [checker](http://localhost:5173), running separate local Wrangler Pages runtimes. These are local inspection addresses, not public hosting deployments.
- Build file counts, byte sizes and SHA-256 hashes: `evidence/build-manifest.json`. Source and published main history known-credential scans found zero matches; these scans are bounded pattern checks, not exhaustive proof.
- Local checks: 134 unit/security tests and 10 browser scenarios passed; formatting, lint, TypeScript/Astro check, production build, and dependency audit passed. See [full acceptance ledger](acceptance-results.md).
- Source operations scoped to this new repository and isolated task worktrees; no other projects modified.

## Enabled capability

The username entry is visibly unavailable. The API exposes truthful capability status and fails closed with 503/null results. Secondary features include labeled generated sample, strict local JSON/ZIP import, source-aware set comparison, search/sort/pagination, safe CSV/JSON exports, and explicit local snapshots with compatible historical comparison.

All preview documents are noindexed and ad-free. Public and checker browser origins differ, with build-time validation and executed local storage/DOM isolation tests. No provider secret, paid source, API top-up, new account, domain purchase, plan upgrade or overage was enabled.

## Automatic evidence and economics

See [automatic-feasibility.md](automatic-feasibility.md) for exact schemas/endpoints/conditions/pricing, primary sources, reproducible no-target authentication probes and gate ledger. Actual scan request/credit usage: **NOT MEASURED**. Available target-scale recurring-free service capacity: **not established**. The specifically reviewed Apify Actor's published Free rate would exceed a fresh monthly allowance for 12,000 delivered records; that arithmetic is not a completed scan observation.

No actual usernames/graphs/reference exports are included in public test evidence. All local test data is generated. Future automatic mode must disclose server/provider involvement and prove durable quotas, session-bound jobs, pagination, retry/cancel/resume, retention and access rights before activation.

## Deployment and rollback

Cloudflare Pages is prepared as two new projects. `npx wrangler whoami` failed because the saved token expired and could not refresh. The in-app browser reached Cloudflare login; an additional existing Chrome-profile check timed out. No project name was reserved, account plan verified, deployment uploaded, deployment ID issued, or production/preview host URL established.

Accepted source is retained as tag `preview-2026-09-07` after the verified CI pass. Rollback on a host is **NOT RUN**. The documented procedure in [hosting.md](hosting.md) rebuilds the exact accepted source with recorded origins and redeploys it to the same two intended projects, or uses Cloudflare's eligible prior-deployment rollback after a real release. No unrelated resource should be changed to recover.

## Remaining prerequisites

1. A source with appropriate complete-list access/usage conditions and a recurring free allowance sufficient for a target scan, with enforceable zero-cash operation. No inspected candidate is approved.
2. An authorized public account near 6,000 followers and following, then real target/source/reference/runtime testing. Owner reference data is engineering validation only, not a mandatory end-user export workflow.
3. Restore existing Cloudflare authorization; verify actual free plan and name availability; deploy both noindexed previews and run hosted smoke tests. This only unblocks preview hosting, not automatic production.
4. Before ads or public launch: actual publisher/site approval and IDs, applicable consent/CMP configuration, genuine private operator/contact channel and policy review.

No owner approval or success is inferred from silence. Production completion is not claimed.
