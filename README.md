# MutualLens

**Preview only. The mandatory website-only automatic Instagram checker is blocked, not complete.** No complete-list source has passed the consented live ~6,000 followers × ~6,000 following and recurring zero-cash gate. Local import and synthetic examples are secondary preview features, not a substitute.

Source: https://github.com/Arhaan2/mutuallens

Verified hosted previews: [public website](https://codex-ui-functional-repair.mutuallens-ddm.pages.dev) · [checker](https://codex-ui-functional-repair.mutuallens-app.pages.dev). Both are noindexed and ad-free. [Deployment and browser evidence](docs/cloudflare-preview.md).

## Run locally

Use Node 24 and npm 11 (tested versions recorded in `docs/evidence/`).

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium webkit firefox
npm run test:browser
npm run test:browser:dev
npm run test:startup
```

Start the complete local application from one terminal:

```sh
npm run dev
```

For the built preview with the real local Pages API:

```sh
npm run preview
```

Both commands build the current files, refuse occupied ports, start the required processes, and verify readiness. Public site: `http://localhost:4321`; checker: `http://localhost:5173`. Development additionally starts its local API on `127.0.0.1:8788`; Vite proxies it through the checker origin. Ctrl+C stops only the processes started by this command. No provider key or hosting login is needed. These are localhost addresses, not deployed previews.

The startup log records the Git commit and a source-content hash also served at `/build-info.json` on each built origin. A dirty-tree build is explicitly labeled. `npm run test:browser` starts a fresh built runtime (never reuses a server) and tests Chromium, WebKit, and Firefox. `npm run test:browser:dev` runs the normal workflows/transitions in the complete development stack; production headers/404/fault injection are checked in the built suite. Stop an interactive local session before running tests.

See [the repair ledger](docs/ui-functional-repair.md) for browser evidence, reset contracts, external blockers, and current branch/CI status.

## Structure

- `apps/site`: Astro public guides and policies, prepared for SEO but noindexed while preview-only.
- `apps/checker`: React/Vite checker, module-worker file processing, explicit checker-origin IndexedDB snapshots; same-origin Pages API.
- `packages/core`: tested normalization, import, source-aware comparison, CSV/JSON and snapshot semantics.
- `packages/acquisition`: fail-closed capability boundary. **No approved live provider adapter exists.**
- `docs/specification`: unchanged provided specification/checklist, not completed test evidence.
- `docs/automatic-feasibility.md`: provider documentation, auth probes, economics, and missing live evidence.
- `docs/release-evidence.md`: actual release/test/deployment status and rollback.

## Privacy and limits

Selected imports stay on the checker origin in browser memory unless explicitly saved locally. No ad SDK, tracking, session replay, remote avatar, or Instagram credentials. The hosting service can process ordinary network/security metadata. A future automatic mode would involve our server and a named provider and needs a new privacy review. No arbitrary record cutoff; defensive byte/ZIP resource limits fail explicitly. Partial inputs withhold negative categories.

Public pages and checker require **different origins**. Build origins use `PUBLIC_SITE_ORIGIN`, `PUBLIC_CHECKER_ORIGIN`, and `VITE_SITE_ORIGIN`; local defaults are `http://localhost:4321` / `http://localhost:5173`. Production origins must come from actual host reservations. No names/graphs/tokens are passed between origins. All preview documents receive noindex and all ads remain disabled. There is no production-enabling environment switch: release gates must be satisfied and reviewed code must change.

## Deploy

Cloudflare Pages hosts the two separate previews through the existing authorized account. The owner confirmed Workers Free; subscription API access was unavailable. The application source deployed is `75a340ec010b62cc90db3f6275313173e9b0ac77`. No account creation, payment method, upgrades, auto-overage or paid fallbacks are authorized. See `docs/hosting.md`. GitHub Pages is not enabled. CI tests source with read-only permissions and contains no deployment/provider credentials. Direct deployment is owned by the integrator; no untrusted PR can trigger a privileged deployment.

See `AGENTS.md` for ownership and release rules. Use only synthetic data in tests, issues, screenshots and public evidence. Never attach your Instagram export to a public issue.
