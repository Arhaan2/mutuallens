# Shared interfaces

`packages/core/src/types.ts` is owned by the lead. The core package exports:

```
normalizeUsername(value: string): string // throws on invalid username/profile URL; preserve dot/underscore
compareDataset(dataset: Dataset): Comparison
importInstagram(files: ImportFile[], options: ImportOptions): Promise<Dataset>
createSampleDataset(size?: number, offset?: number): Dataset // default 6000 and 1500; synthetic only
exportCsv(records: AccountRecord[]): string
exportDataset(dataset: Dataset): string
createSnapshot(dataset: Dataset): Snapshot
compareSnapshots(before: Snapshot, after: Snapshot): SnapshotComparison
```

React imports these from `@mutuallens/core`. `importInstagram` supports ZIP and loose/split JSON through `fflate`, enforces byte/entry/ratio/path/text safety. It must not invent archive collection dates or assume missing directions empty. Import completeness defaults unverified until user confirms all parts. Unknown account identity/date prevents historical comparison. Identity collisions withhold negatives. Snapshots stored explicitly in checker IndexedDB by UI, off by default. Lists remain in memory otherwise. Worker processing preferred for import/compare.

The checker fetches `GET /api/capabilities` returning `{ release: 'preview', automatic: { enabled: false, status: 'blocked', reason: string }, ads: false }`. All scan routes fail closed with HTTP 503 and code `AUTOMATIC_UNAVAILABLE`; no provider or synthetic data is called. A verified provider, real live gate, durable budget/session safeguards are prerequisites for replacing this boundary. Do not simulate live progress.

Public site configured with `PUBLIC_SITE_ORIGIN` and `PUBLIC_CHECKER_ORIGIN`, checker with `VITE_SITE_ORIGIN`. Local defaults `http://localhost:4321` and `http://localhost:5173`. All preview pages noindex, all ads disabled, no ads.txt fabricated. Deployment origins will be filled only after actual reservation. Public titles/canonicals/social metadata/sitemap derive from configured origin. Public content accurately labels preview limitations.
