# MutualLens integration rules

The user's request controls scope. Specifications in docs/specification are requirements, not evidence of execution. Mandatory website-only automatic acquisition must pass a consented live ~6,000 × ~6,000 test and recurring zero-cash gate before production. No arbitrary record cap; never infer negative relationships from partial lists.

## Ownership

- Lead: shared contracts (`packages/core/src/types.ts`), all package/config/lockfiles, acquisition implementation, backend, integration, git operations, hosting, release evidence.
- Acquisition investigator: `docs/automatic-feasibility.md`, `docs/evidence/acquisition-*` only in assigned worktree.
- Core engineer: `packages/core/src/` except types.ts, `packages/core/test/`, `docs/core-formats.md` only in assigned worktree.
- UI engineer: `apps/site/src/`, `apps/site/public/`, `apps/checker/src/`, `apps/checker/index.html` only in assigned worktree.
- Independent reviewer: read all; write only `docs/security-qa-review.md` and `tests/review/` in assigned worktree.
  Agents never commit, change dependencies, deploy, or receive secrets. Lead integrates owned files from each worktree and reruns checks.

## Commands

Node 24 / npm 11. `npm ci`; `npm run check`; `npm test`; `npm run build`; `npm run test:browser`. Lead maintains commands as implementation lands.

## Constraints

No spending, upgrades, top-ups, automatic overage, paid fallback, new accounts, legal acceptance, unrelated project edits, or repository overwrite. No credentials/real exports/graphs in source, logs, tests, history or agent messages. Synthetic fixtures only. No bypass of Instagram controls or competitor backend reuse. Imports stay in browser; optional snapshot saving defaults off. Ads stay disabled; public/checker origins differ. Preview documents remain noindex. A disabled automatic button plus working imports is preview-only. Report BLOCKED/NOT RUN honestly.
