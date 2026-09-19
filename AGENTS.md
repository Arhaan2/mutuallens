# MutualLens integration rules

The user's request controls scope. The active amendments are `docs/specification/Release_Presentation_Amendment.md` for presentation/release and `docs/specification/Core_Product_Amendment.md` for upload behavior; they supersede conflicting older requirements. Specifications are requirements, not evidence of execution. Uploaded follower/following lists are the working dataset: compare immediately without required account identity, collection date or completeness checkbox. Known upload limitations qualify usable differences; missing directions remain errors. Keep automatic-source completeness checks separate: never infer confirmed negatives from partial automatic lists. No arbitrary record cap.

Automatic milestones are separate: credentialed small test, target-scale retrieval, measured recurring-free capacity, and public commercial launch. A controlled Free-credit test does not require commercial-launch readiness. Production still requires the applicable live target-scale, recurring zero-cash and security gates; no paid calls or account creation are authorized.

## Ownership

- Lead: shared contracts (`packages/core/src/types.ts`), all package/config/lockfiles, acquisition implementation, backend, integration, git operations, hosting, release evidence.
- Acquisition investigator: `docs/automatic-feasibility.md`, `docs/evidence/acquisition-*` only in assigned worktree.
- Core engineer: `packages/core/src/` except types.ts, `packages/core/test/`, `docs/core-formats.md` only in assigned worktree.
- UI engineer: `apps/site/src/`, `apps/site/public/`, `apps/checker/src/`, `apps/checker/index.html` only in assigned worktree.
- Independent reviewer: read all; write only `docs/security-qa-review.md` and `tests/review/` in assigned worktree.
  Agents never commit, change dependencies, deploy, or receive secrets. Lead integrates owned files from each worktree and reruns checks.

For the core-product pass, explicit lead assignments may further partition ownership: importer/worker, comparison/UI, acquisition adapter, and independent verification. Shared `types.ts`, dependency/config files, git, credentials and deployments remain lead-owned. Each agent uses its own worktree; no overlapping file edits.

## Commands

Node 24 / npm 11. `npm ci`; `npm run check`; `npm test`; `npm run build`; `npm run test:browser`. Lead maintains commands as implementation lands.

## Constraints

No spending, upgrades, top-ups, automatic overage, paid fallback, new accounts, legal acceptance, unrelated project edits, or repository overwrite. No credentials/real exports/graphs in source, logs, tests, history or agent messages. Synthetic fixtures only. No bypass of Instagram controls or competitor backend reuse. Imports stay in browser; optional snapshot saving defaults off. Ads stay disabled; public/checker origins differ. Unfinished launch surfaces, checker, APIs, staging and preserved test versions remain noindex. Customer-facing copy must not include demo/preview/prototype branding, internal verification panels, release gates or commit stamps. Presentation does not enable automatic collection, indexing or ads. If automatic acceptance is blocked, ship independently verified presentation/upload fixes with concise feature-level unavailability and the upload alternative; report full automatic readiness as BLOCKED/NOT RUN in the authoritative `docs/release-current.md` record. Historical evidence is not current status.
