# Independent integration review, baseline 549e82a

Scope: read-only source inspection; isolated synthetic browser contexts against lead-confirmed fresh Wrangler local preview. No repository changes, server changes, dependency changes, deployment/account/provider actions, or real graph access. Chromium runtime launched after sandbox rejected macOS browser process startup; permitted escalation used. Initial WebKit and Firefox launch probes found binaries absent. This does not establish that they cannot be installed/tested later.

## Reproduced baseline defects

| ID | Severity | Reproduction | Actual | Root cause | Regression |
|---|---|---|---|---|---|
| INT-01 | P1 | Hold capability response, advance browser clock by 8,001ms | Loading continues; real sample remains functional | Fetch lacks timeout/retry state | Fault suite capability tests |
| INT-02 | P1 | Override URL.createObjectURL to throw, export real synthetic report | Uncaught error, no alert | Download wrapper lacks catch/feedback | Fault suite export allocation test |
| INT-03 | P0 data/context | Hold completed real snapshot worker reply, change Earlier selector to equal Later, release old reply | Historical difference appears under invalid/new selectors | Selector handlers clear view but do not invalidate worker task | Fault suite selection-race test |
| INT-04 | P1 | Hold history worker reply, confirm snapshot deletion, release reply | Difference reappears below empty saved history | deleteAll clears state but not in-flight task | Fault suite deletion-race test |
| INT-05 | P0 crash under injected corruption | Store synthetic record with ID/savedAt and missing dataset; open history | Entire React application blanks; TypeError reading account | loadSnapshots trusts persisted runtime shape | Fault suite corrupt-record test |
| INT-06 | P1 under injected worker failure | Worker dispatches messageerror | Processing stays active, no alert | Only onmessage/onerror handled | Fault suite messageerror test |
| INT-07 | P1 recoverability | Capability non-JSON, null, invalid enabled payload | Correctly fails closed but no Retry availability action | One mount-only request | Fault suite three retry cases |

Severity for injected faults describes impact, not prevalence. The held-worker harness uses the actual module worker and real parser/comparison results. It delays delivery only; releasing a stored callback after terminate deliberately tests the separate task-ID stale-response guard. No synthetic live automatic result exists.

## Baseline preserved behavior

Normal cancellation increments task ID, terminates worker, and late held reply cannot restore a report. Worker constructor, worker error event, and postMessage throw each show existing alert/retry works; postMessage catch needs cleanup review despite current UI test passing. Sample works when capability network fails. IndexedDB denial preserves report with a visible alert. IndexedDB operations resolve on transaction completion (correct), although synchronous exceptions can leak open database handles.

Source boundaries remain intact: separate public/checker configured origins; no imported graph network code, remote avatars, telemetry or ad scripts; API returns disabled preview and never consumes scan request bodies or calls upstream. Complete-list/live/free/hosting gates unchanged.

## Baseline evidence

- `baseline-probes.mjs`, `baseline-findings.json`: manually orchestrated four primary fault observations and engine executable availability.
- `storage-probe.mjs`, `storage-finding.json`: deterministic corrupt synthetic storage crash.
- `repair-faults.spec.ts`: 15 regression assertions, no permanent arbitrary sleeps. Independent TypeScript strict check passes.
- `baseline-fault-results.json`: first assertion suite against baseline: 9 failed, 6 passed. Initial hang assertion failed on loading-copy mismatch; then broadened to accept old and new loading copy and rerun. Rerun reached virtual 8,001ms and failed on unchanged loading, confirming missing timeout. Retry assertions subsequently add explicit visibility check before click to fail promptly when missing.

## Startup recommendations

Root startup should own all needed children, reject occupied fixed ports, use strict frontend port selection, parse capabilities through checker origin, verify HTML/asset readiness, record mode/PIDs/commit or content fingerprint, reject stale built output, and shut down only spawned children/groups on signal/failure. Playwright should use this command without opportunistically reusing unrelated existing servers. A running Vite frontend is not evidence that its API proxy target exists. Local built runtime remains necessary even if development succeeds.

## Baseline coverage gaps

Ten Chromium scenarios capture pageerror only in one test; no global console/requestfailed/broken-asset capture; CSV asserted filename only, no actual downloaded CSV/JSON/difference/snapshot content; no explicit timeout/retry, cancel/race, messageerror, denial/corrupt-storage tests; history UI only first 50 browsable; no WebKit/Firefox project. Additional normal-journey and visual reviewers own broader interaction/layout coverage.
