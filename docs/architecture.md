# Architecture and release boundary

The public Astro site and React checker are separate applications on different browser origins. The public site contains content only. Future ad scripts must remain there; checker storage/DOM is protected by the browser origin boundary. Links carry no account data. No cross-origin postMessage handler exists.

The checker module worker imports and compares local files. Only a small page of results renders; pagination is a UI window, not truncation. Source records and provenance are retained in browser memory. Saving a snapshot writes checker-local IndexedDB only after a click. User-asserted complete import parts establish completeness for supplied source only, not live completeness. Unknown dates and username-only identities are disclosed in history.

The API is intentionally unavailable. Capability reads report `enabled:false`; scan operations return 503 with `results:null`. Cross-origin state-changing requests return 403. All API responses are private/no-store, noindexed and contain no sessions or graphs. No upstream requests, provider secrets, durable database, reservations or jobs exist. This cannot be switched on by setting an environment variable.

After an acquisition source passes its gate, the next integration must implement the provider's real pagination/asynchronous model, stable account binding, session-owned jobs, idempotency, atomic durable credit/concurrency reservations, no paid fallback, timeouts/retry/cancel semantics, complete accumulated-data resume and verified expiry/cleanup. Current disabled-route tests do **not** pass those unimplemented live-job requirements.

Ads have no live integration. An advertising activation additionally needs actual publisher/site approval, IDs, genuine operator/contact details, relevant certified CMP configuration and a security review. No fake ads.txt is generated. Preview indexing is hard-disabled by metadata and HTTP headers; robots allows crawling so noindex can be seen.

## Development decisions

TypeScript 6 is pinned because the current Astro checker rejects TypeScript 7. Npm lifecycle allowlist permits only pinned esbuild/workerd setup scripts. No remote application dependency is required for local comparison. Runtime code does not call AI, a CMS, a queue, a proxy, or another data service.

References for hosting/API behavior and limits appear in `hosting.md`; current registry versions and lockfile record actual dependencies. No synthetic test is evidence of Instagram access.
