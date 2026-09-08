# Automatic acquisition feasibility

**Gate: BLOCKED. Mandatory website-only automatic checking is not implemented or proven.**

Investigation date: **2026-09-07 UTC**. All linked sources below were accessed on that date. Requirements in `docs/specification` are requirements, not test evidence. No provider was selected. No account was created, money spent, target username submitted, Instagram session used, or social graph acquired by this investigation.

The investigated sources either lack a demonstrated complete-list route for the required audience, have only introductory credits, exceed the recurring free allowance at the initial target, or impose incompatible record restrictions. This is a bounded investigation of the named providers and several specific alternatives, not proof that every possible future source is impossible.

## Gate ledger

| Gate                                                                | Status                                        | Evidence / exact remaining prerequisite                                                        |
| ------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Exact source returning both complete directions                     | BLOCKED                                       | Candidate schemas exist; no authenticated pagination run or end-of-list reconciliation         |
| Existing authorized provider access                                 | BLOCKED                                       | Investigator received no credentials; no-target calls to HikerAPI and SocialCrawl returned 401 |
| Consented approximately 6,000 followers × 6,000 following target    | NOT RUN                                       | No authorized target/reference supplied to investigator; no third-party account substituted    |
| Recurring zero-cash operation at target                             | FAILED for inspected candidate configurations | Trial-only sources and costs/caps below; no qualifying configuration selected                  |
| Provider/upstream permission for this public commercial use         | BLOCKED                                       | No applicable permission evidence; material terms issues below                                 |
| Free-host runtime measured with actual source                       | NOT RUN                                       | No verified adapter or live job                                                                |
| Pagination completeness, error recovery, credits and reconciliation | NOT RUN                                       | Schema examples and auth rejection are not list tests                                          |
| Production automatic release                                        | BLOCKED                                       | All preceding mandatory gates must pass                                                        |

Keep automatic operations disabled, return an explicit unavailable response, and label any working sample/import product as a preview. Preview pages remain noindex and ad-free. An import or fixture success cannot change this gate.

## 1. Meta official APIs

Meta's maintained [Facebook Login collection](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login) identifies Business/Creator accounts, requires a linked Page, and excludes consumer accounts. Its [Instagram Login documentation](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00) also targets professionals; it removes the Page-link requirement, not the professional-account requirement.

The reviewed [Meta SDK IGUser model](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/ig-user.js) exposes `followers_count` and `follows_count`; those scalar fields are not relationship lists. No complete followers/following edge for ordinary consumers was substantiated by the inspected official materials. This is **not a viable selected source**. Aggregate insight/count calls would not satisfy the acceptance gate.

The supplied [IGUser reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user) did not load through the research browser. The newer [Facebook Login reference](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/) and [Instagram Login reference](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/) returned 429 through that browser. No access-control workaround was attempted; Meta's own Postman collection and SDK were used as primary fallback sources. No Graph API token request or authenticated API test was run. Endpoint version, list pagination, and full-list allowances therefore remain **not established**, not inferred from a SDK example.

## 2. HikerAPI

The [published Swagger](https://api.hikerapi.com/) recommends `/g2/user/followers` and `/g2/user/following` over `/v2/user/followers` and `/v2/user/following`. The [GraphQL reference](https://hiker-doc.readthedocs.io/en/latest/api-reference/gql/) documents GET requests with `x-access-key`, required string `user_id`, and optional opaque `page_id` for both g2 directions. These are **one-page** calls, not whole-list calls. A username lookup is separate. Neither fixed page size nor target-scale completeness is demonstrated. Legacy `gql/.../chunk` has a different cursor and billing model; it must not be mixed into a g2 adapter as an undocumented fallback.

One unauthenticated documentation read of [OpenAPI JSON](https://api.hikerapi.com/openapi.json) returned schema version **1.8.1**, SHA-256 `3d5122a9eef33248dde201c891e43340d007b9e08498b4d6d8c20d249e3ca872`. Its g2 operations referenced `PageResponse`; the followers example included `response.should_limit_list_of_followers: true`. That is a material truncation warning in documentation, not an observed target result. The complete g2 terminal contract still needs verification. Later fixed preflight reads of that same schema returned 401; the successful exploratory read is recorded here from executed tool output, not represented as a retained raw schema artifact.

[Pricing](https://hikerapi.com/pricing) offers prepaid requests and 100 free requests. [Quick start](https://hiker-doc.readthedocs.io/en/latest/getting-started/quick-start/) places the 100 requests at signup; no recurring replenishment was established. The pricing page counts 200/400/403/404 responses as chargeable, unlike 50x. No top-up is authorized. **Recurring-free gate: FAILED for the advertised signup configuration.**

[Terms](https://hikerapi.com/help/terms-of-service) contain a personal/non-commercial Content license and a prohibition on commercial exploitation of Content/Site. Whether a separate API agreement grants the required public commercial use is unresolved; marketing use cases are insufficient permission evidence. No commercial adapter should be enabled on this record.

For page counts `Pfollowers` and `Pfollowing`, base request use is approximately `1 + Pfollowers + Pfollowing`, plus reconciliation and chargeable failures. As an explicit **unmeasured illustration**, 50 users/page means 241 base requests for 6,000 × 6,000; 100/page means 121. Neither page size is a promise or observation. Full-list elapsed time, duplicates, omissions and real credits: **NOT RUN**.

## 3. SocialCrawl

The [Instagram endpoint reference](https://www.socialcrawl.dev/docs/instagram) and [OpenAPI schema](https://www.socialcrawl.dev/v1/openapi.json) identify **GET `/v1/instagram/followers`** and **GET `/v1/instagram/following`**, each **5 credits per page**. Authentication is `x-api-key`; callers supply `handle` or `user_id`, then `cursor`. The observed schema is **1.0.0 / OpenAPI 3.1.0**, hash `80ad52d1ca0b5da3f25e0726d251fc16b7f3226b9896386d45a562d9217f0f67`. `data.items[].author` supplies identity fields; `data.dropped` and `_warnings` require inspection. This is a schema read, not an example passing target dataset.

The [pagination guide](https://www.socialcrawl.dev/docs/pagination) says to return `pagination.next_cursor` unchanged as `cursor`, and stop only at `pagination.has_more: false`. Empty pages/counts do not independently establish completion. These two endpoints have no page-size control. Unknown page size, upstream limitations and missing records prevent predicting actual target success. A terminal source flag must still be reconciled, not blindly relabeled complete.

[Pricing](https://www.socialcrawl.dev/pricing) explicitly labels the free 100 credits **one-time**, without expiry; auto-recharge is opt-in. This buys at most 20 billed relationship pages before other calls. At illustrative 50 or 100 users/page, the target needs 1,200 or 600 relationship credits respectively, plus any profile reads. These are conditional estimates, not observed usage. Cache hits do not supply an ongoing free complete-list acquisition guarantee. **Recurring-free gate: FAILED.**

[Terms §§7–9](https://www.socialcrawl.dev/legal/terms-and-conditions) allow analytics/application use conditionally, prohibit raw-response mirroring and platform-term violations, limit collection to public data without login barriers, and give no completeness warranty. They describe a short-lived 2–30 minute cache; exact upstream retention remains unresolved. Whether public list exports and relationship comparisons fit the applicable license requires resolution before integration. No terms were accepted.

## 4. Apify platform and exact Actors

[Apify pricing](https://apify.com/pricing) provides **$5/month** on Free. [Subscriptions](https://docs.apify.com/account/subscriptions) confirm that exhausting Free suspends service until the next billing cycle; pay-as-you-go is available only on paid plans. Unused monthly usage expires. An existing account's actual plan and usage still need inspection by the lead; published terms do not prove account state. Never upgrade, enable overage, or multiply accounts to enlarge the allowance.

| Exact Actor                                                           | Source-level finding                                                                                                     | Target zero-cash result                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `scraping_solutions/instagram-scraper-followers-following-no-cookies` | Public-profile directions and continuation support are documented; API free users limited to 1,000 delivered results/run | Free $0.85/1,000 → **$10.20** for 12,000; cannot fit one $5 cycle                        |
| `apify/instagram-followers-following-scraper`                         | Apify-maintained; both directions, `FOLLOWER` / `FOLLOWING`; no Instagram login claimed                                  | Free $2/1,000 → **$24** for 12,000                                                       |
| `coderx/instagram-followers-following-scraper-no-cookies-login`       | Both directions; cursor resume documented for paid users                                                                 | Headline minimum $1.10/1,000 already → **at least $13.20**; Free rate not established    |
| `crawlerbros/instagram-follower-scraper`                              | Either supplied session cookies or provider-managed shared sessions; both directions                                     | Headline minimum $5/1,000 already → **at least $60**; access conditions unresolved       |
| `afanasenko/instagram-follower-tracker`                               | Free: one account, 15 runs/month, 2,500-follower cap; following list documented up to 1,000                              | Fails required scale and no arbitrary count cutoff regardless of cheap per-run allowance |
| `louisdeconinck/instagram-following-scraper`                          | Headline discount concerns cookie mode; no-cookie Free mode is $4/1,000                                                  | **$24 plus start** for 6,000 following alone; does not establish both directions         |

Sources: [Scraping Solutions README](https://apify.com/scraping_solutions/instagram-scraper-followers-following-no-cookies) and [Free pricing](https://apify.com/scraping_solutions/instagram-scraper-followers-following-no-cookies/pricing); [Apify-maintained README](https://apify.com/apify/instagram-followers-following-scraper) and [Free pricing](https://apify.com/apify/instagram-followers-following-scraper/pricing); [CoderX README](https://apify.com/coderx/instagram-followers-following-scraper-no-cookies-login); [Crawler Bros README](https://apify.com/crawlerbros/instagram-follower-scraper); [Afanasenko README](https://apify.com/afanasenko/instagram-follower-tracker); [Louis pricing](https://apify.com/louisdeconinck/instagram-following-scraper/pricing) and [input](https://apify.com/louisdeconinck/instagram-following-scraper/input-schema).

For the specified Scraping Solutions Actor, inputs are `Account`, `dataToScrape`, `resultsLimit`, and optional `continuationToken`. Continuation metadata is in Actor `OUTPUT`, not dataset rows: `continuations`, `hasNextPage`, `nextContinuationToken`, and expiry. Tokens bind to the same single account and direction. The README's success state can mean the requested limit was delivered; absence of continuation metadata is not independently proven to mean a full upstream list. Explicit limits, budget exhaustion, restricted accounts and upstream availability must remain incomplete. Actual Actor build/version, terminal behavior and scale were **NOT RUN**.

Minimum delivered-item costs above are arithmetic from published per-item pricing. They exclude uncertainty/retries where applicable. The specified Actor has capacity **zero completed 6,000 × 6,000 scans per fresh monthly Free allowance**. Spreading one scan across multiple months cannot establish a contemporary complete dataset; credits do not accumulate, cursors may expire, and relationships change. No smaller test was substituted.

[Apify terms](https://docs.apify.com/legal/general-terms-and-conditions) require authorized data use, make third-party access permissions the customer's responsibility, prohibit unapproved multiple personal accounts, and disclaim completeness. Actor output is stored in datasets/key-value stores. Applicable retention/deletion and usage-data handling must be tested and disclosed before any live source adoption. No Actor was run and no provider-retention claim was validated.

## 5. Runtime and browser constraints

The [browser same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) prevents MutualLens from reading a separate Instagram tab's private document/session. A server integration does not itself grant upstream data access. Extensions, bookmarklets, copied cookies/code, browser flags and exports remain excluded from the primary workflow.

Current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) list Free at 100,000 requests/day, 10 ms CPU per request, 128 MB memory, 50 subrequests and six simultaneous outbound connections per request. Network waits do not count as CPU. [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) shares the Workers request allowance, reset at midnight UTC. These numbers are documented allowance, **not measured MutualLens resource use**.

REST page adapters could use short page-at-a-time advances with durable ownership/checkpoints. An Apify adapter would start an [asynchronous Actor run](https://docs.apify.com/api/v2/actors-runs-post), poll [run state](https://docs.apify.com/api/v2/actor-run-get), and fetch [dataset pages](https://docs.apify.com/api/v2/dataset-items-get) using offset/limit and returned dataset pagination totals. Dataset completion is distinct from complete upstream acquisition. No headless Instagram scraper is established as compatible with Free Workers. Full payload parsing, cancellation, global concurrency/budget accounting and runtime limits still need actual measurements.

## 6. Executed prototype and evidence

The isolated [preflight script](evidence/acquisition-probe.py) performs only six fixed GETs: two documentation reads and four no-target/no-credential authentication checks. It cannot take a username or start a provider run. It stores field names and hashes, never documentation sample profiles, credentials or graph bodies.

Executed observations are in [current preflight results](evidence/acquisition-probe-results.json) and [first preflight results](evidence/acquisition-probe-results-previous.json). At 2026-09-07 23:39:31 UTC, all four list requests returned **HTTP 401**. SocialCrawl reported `MISSING_API_KEY` and `credits_used: 0`. Hiker's 401 body had `error`/`state`; billing was not observed. No account was addressed. SocialCrawl schema retrieval returned HTTP 200. The first preflight hit its 8 MiB documentation limit; the rerun used a 32 MiB bound and preserved first observations. Earlier restricted-shell DNS failure was a local transport limitation, not provider rejection.

This is an **authentication/schema preflight**, not a successful automatic-acquisition prototype. Acquired live followers, following, page counts, deduplication, elapsed list time, retries, completion markers and consumed scan credits remain **NOT RUN**. See [live-gate record](evidence/acquisition-live-gate.json). A successful documentation GET or expected 401 cannot pass acquisition.

## 7. Bounded method to reopen the gate

No researched candidate currently qualifies for a funded-free live prototype under the fixed constraints. The lead should reopen acquisition only when an existing authorized source has a documented recurring allowance sufficient for both full lists, applicable usage permission, and a provider-enforced no-cash ceiling. Additional trial credits alone do not meet this prerequisite. Credentials stay server-side with the lead.

When those prerequisites exist:

1. Obtain explicit consent for one test account approximately 6,000 × 6,000 and record a private reference identifier. Do not commit its username, graph or export. Record consent scope and collection window privately. A current owner export may be used only as an engineering reference.
2. Pin the real endpoint/schema/Actor build. Verify allowed account types, every terminal and truncation signal, cursor expiry, per-page charging, and provider retention. Set provider no-overage controls and durable atomic reservations before starting.
3. Fetch both directions to genuine terminal signals, preserving page metadata and deduplicating by stable ID. Track raw/unique counts, duplicates, dropped rows, repeated cursors/pages, errors, retries and timestamps. Stop as incomplete for any cap, quota, restriction, identity inconsistency or unknown termination; do not manufacture negative relationships.
4. Reconcile both lists privately against the reference by identity, explain actual account changes across the collection window, and investigate unexplained omissions. Reaching aggregate counts is necessary context, not sufficient proof. Publish only redacted aggregate evidence and endpoint/build identifiers.
5. Measure credits before/after, elapsed time, network/CPU/memory and global budget reservations on the intended free runtime. Test cancellation, restart/cursor validity, repeated requests, cross-session access, quota exhaustion and private/unsupported accounts without bypassing controls.
6. Run again within the documented recurring operating model and calculate whole scans available after shared usage and a safety reserve. A free global availability budget may stop new jobs; it may never turn a partly collected account into a complete result or impose a disguised per-account count cap.

Production remains blocked until the consented target, recurring zero-cash, runtime, privacy/security and actual completeness gates are independently reviewed and recorded as PASS.
