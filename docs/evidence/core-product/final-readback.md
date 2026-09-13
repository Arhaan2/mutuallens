# Final hosted readback

**PASS: 21/21 assertions**, observed `2026-09-08T18:26:00.919Z`–`18:26:02.506Z`. This was a bounded readback and one synthetic browser-local file comparison. No deployment, account setting, source code, provider run or real Instagram target was changed or used.

The deployed origins have **different commit stamps** and the same application source hash:

| Observed endpoint                                                                                               | Commit                                     | Source hash                                                        |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| [Public branch build information](https://codex-ui-functional-repair.mutuallens-ddm.pages.dev/build-info.json)  | `f0165de28d71180f9018eed8c1bd30633bfd6415` | `ffbc199edb1b72999beae53778e41f8b9f29b50d2652d6d82bd14df18643b1e1` |
| [Checker branch build information](https://codex-ui-functional-repair.mutuallens-app.pages.dev/build-info.json) | `a5d7f32b14fa69240e3e4c4322f0042eb3b00a3e` | `ffbc199edb1b72999beae53778e41f8b9f29b50d2652d6d82bd14df18643b1e1` |
| [Checker immutable build information](https://50318048.mutuallens-app.pages.dev/build-info.json)                | `a5d7f32b14fa69240e3e4c4322f0042eb3b00a3e` | `ffbc199edb1b72999beae53778e41f8b9f29b50d2652d6d82bd14df18643b1e1` |

All three reads returned HTTP 200. The public build date remains `2026-09-08T05:37:32.494Z`; both checker stamps report `2026-09-08T05:48:34.043Z`. The lead reports that the public stamp refresh did not execute because automatic approval review timed out. This readback independently confirms the resulting split stamps, not the approval system's internal state. No deployment retry was attempted by this reviewer.

[GET capabilities](https://codex-ui-functional-repair.mutuallens-app.pages.dev/api/capabilities) returned HTTP 200, preview release, automatic disabled/blocked and ads disabled. Its reason is: “Automatic checking is awaiting provider account setup and authorized live validation. File comparison is available now.” The response is private/no-store, noindex, has no CORS grant and sets no cookie. Public build-info responses retain static `Access-Control-Allow-Origin: *`; this is separate from the private API boundary.

Fresh isolated Chromium loaded the actual checker branch and selected two synthetic Instagram-shaped JSON files through its file input. Followers were `readback_fan` and `readback_mutual`; following were `readback_followed` and `readback_mutual`. No account, date or completeness confirmation was entered. Comparison displayed “Your uploaded files,” exactly one non-follower (`readback_followed`), one mutual, one account not followed back, two followers and two following, with the visible supplied-file qualification.

The browser observed exactly five first-party GET requests: document, main JavaScript, stylesheet, capabilities and compiled processing worker. There were no upload/other-method requests, third-party request attempts, runtime errors or failed requests. The browser context was closed after the comparison. This small synthetic import is not automatic-acquisition evidence.

The earlier [79-assertion security verification](hosted-security.md) retains its original `f0165de` attribution. This final readback does not claim a full security-suite rerun, live acquisition, enabled-session authorization, real free-credit validation or provider erasure. CI and deployment administration remain lead-owned evidence. The hosted product remains a noindexed, ad-free preview with automatic acquisition disabled.

The [fresh JSON evidence](final-readback.json) records all HTTP observations, public capability/build responses, browser request metadata and assertions. All read-only checks completed on the first execution; no retry loop was needed.
