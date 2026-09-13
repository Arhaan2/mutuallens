# MutualLens — Deliver the Core Product

Continue work on:
https://github.com/Arhaan2/mutuallens

Current reported PR:
#1, branch codex/ui-functional-repair, head abcbcb2.

Existing hosted previews:
https://codex-ui-functional-repair.mutuallens-ddm.pages.dev/
https://codex-ui-functional-repair.mutuallens-app.pages.dev/

Inspect the actual current branch and working tree before changing anything.
Preserve later work, owner changes, existing tags, and the current deployments.

This is not another general visual-polish pass.

The owner has clarified the primary product requirement:

"I upload my Instagram files, and the website shows who does not follow me
back. The other categories are extra utility. Username-only automatic
checking must also become a real working integration."

Deliver that behavior.

## 1. This is an explicit product-spec amendment

The earlier import-completeness policy was too restrictive.

For uploaded files, treat the supplied follower and following lists as the
working dataset and calculate the difference immediately.

Do NOT require:
- A completeness-confirmation checkbox.
- A known collection date.
- Live Instagram verification.
- A provider terminal marker.
- An automatic-acquisition integration.
- The account owner's username merely to perform set comparison.

Account identity can be inferred from reliable metadata or entered optionally
for labeling/history. It must not block basic comparison when absent.

This amendment supersedes earlier requirements that withhold upload-based
non-mutual results solely because export completeness is unverified.

Update active requirements, AGENTS.md where relevant, and tests so that old
instructions do not silently reinstate this behavior. Preserve historical
release evidence as historical evidence.

Do not "fix" this by falsely stamping uploaded data as verified live data
or setting every metadata.terminal value to true.

Separate:
1. The mathematical comparison of supplied records.
2. What the source establishes about current Instagram relationships.

## 2. Make upload comparison useful by default

For two recognized lists:

notFollowingBack = following minus followers
mutuals = intersection
notFollowedBackByYou = followers minus following

Immediately show "Not following you back" as the default result category.

Use a short scope statement:
"Based on your uploaded files. These accounts appear in your following list
but not your followers list."

Treat ordinary supported imports as assumed complete for this comparison,
not independently verified complete on Instagram.

No full-screen caveat, modal, or acknowledgment should prevent this result.

Keep these distinctions:

A. Both directions parsed normally:
Show the comparison immediately, with the short scope statement.

B. Both directions are present, but there are missing numbered parts,
unreadable records, or other known limitations:
Show the usable comparison with a visible warning and label the affected
negative results "Not found in supplied followers" or equivalent.
Do not call them confirmed current non-followers.
Include the limitation in exports, not only the screen.

C. An entire direction is absent or cannot be recognized:
Request the missing input. Do not silently convert missing data into [].

D. A recognized, structurally valid direction explicitly contains zero rows:
Treat that as an empty supplied list.

E. Individual identities are ambiguous:
Report or isolate those records without unnecessarily hiding every other
usable result.

Keep automatic-source completeness rules separate. Do not globally delete
all safeguards from compareDataset just to unblock local import.

## 3. Fix format compatibility

Inspect and repair:
- packages/core/src/import.ts
- packages/core/src/identity.ts
- packages/core/src/types.ts
- apps/checker/src/processing.worker.ts
- The current checker import/results components
- Related fixtures and tests

Support common usable inputs:
- Instagram JSON relationship exports.
- Instagram HTML relationship exports.
- ZIP archives containing those formats.
- Multiple loose files and split relationship files.
- Multiple ordinary ZIP downloads from the same export where supported.
- Nested export folders.
- MutualLens's own exported dataset format, with explicit schema validation.

Use content, structure, and path context to recognize inputs. Do not depend
solely on exact basenames.

For genuinely ambiguous loose files, provide a simple assignment:
"This file contains followers / following."

Never guess direction from which list is larger.

Do not mistake blocked accounts, close friends, pending follow requests,
recently unfollowed accounts, or unrelated profile links for the two required
relationship lists.

For JSON:
- Support established structural variants.
- Ignore irrelevant additional metadata safely.
- Extract identity from supported username/profile-URL fields.
- Handle harmless whitespace, BOMs, and encoding details.
- Normalize case and leading @.
- Deduplicate records.
- Do not reject the entire dataset solely because an otherwise usable row
  has an unfamiliar optional field.

When rows are genuinely invalid or conflicting:
- Count them.
- Explain what was skipped or quarantined.
- Preserve usable rows when meaningful.
- Flag the comparison as provisional when omitted follower identities could
  affect negative results.
- Never silently discard data and present the result as fully parsed.

For HTML:
- Parse it as untrusted inert data with no script execution or resource loads.
- Never insert uploaded markup into the application DOM.
- Do not navigate to or fetch embedded links, styles, images, or scripts.
- Recognize relationship containers and extract validated profile identities.
- Test that imports produce no third-party network requests.

Do not claim support for every arbitrary file format. Provide explicit,
actionable feedback for truly unsupported or corrupt inputs.

## 4. Stop rejecting full archives for irrelevant contents

The existing importer applies whole-archive byte and entry limits before
selecting relevant relationship files.

Refactor archive handling to:
- Inspect bounded archive metadata.
- Select relevant relationship entries.
- Read/decompress only those entries.
- Avoid loading or expanding unrelated photos, messages, and videos.
- Use file slicing or another appropriate bounded approach where needed.

Keep protections against malicious archives, expansion bombs, corrupt bounds,
unsafe paths, encrypted entries, and runaway work.

Separate:
- Limits on actual relationship data being parsed.
- Sensible bounds on archive metadata inspection.
- Unrelated content that is not being decompressed.

Do not simply remove every limit or raise constants until a fixture passes.

When a file genuinely exceeds supported processing capabilities, explain the
specific reason and the smallest useful alternative selection.

## 5. Simplify the main flow

The normal upload journey should be:

Choose or drop files
→ Recognize followers and following
→ Compare
→ Show "Not following you back"

Show a compact import summary:
- Follower records found.
- Following records found.
- Relevant files processed.
- Duplicates combined.
- Any skipped/unreadable data.

Move dates, source diagnostics, and snapshot options behind optional controls.
They must not dominate the main task.

Prioritize the non-followers list, search, profile links, and export.
Keep mutuals and other categories secondary.

All results must remain browsable without an arbitrary account-count cap.
Pagination is fine; making later records available only through CSV is not.

An existing report must not silently disappear when a replacement import fails.

## 6. Run a real automatic-integration workstream in parallel

Automatic checking is currently an unavailable API stub, not a working adapter.

Do not spend this entire pass writing another provider survey.

Investigate this concrete candidate first:

Actor:
seemuapps/instagram-followers-scraper

Documentation:
https://apify.com/seemuapps/instagram-followers-scraper

Input:
https://apify.com/seemuapps/instagram-followers-scraper/input-schema

Pricing:
https://apify.com/seemuapps/instagram-followers-scraper/pricing

Pricing clarification:
https://apify.com/seemuapps/instagram-followers-scraper/issues/question-pricing-x83vCvl0FjgjxiPyN

Treat documentation and advertised prices as claims to verify, not live proof.

The potentially useful distinction is batch-based billing, rather than
per-individual-profile billing.

Verify:
- Actual price applicable to the Free account.
- Billing for both directions.
- Other events/platform charges.
- Minimum charges and rounding.
- Run/page restrictions.
- Whether continuation works on Free.
- Allowed account types and relevant usage conditions.
- Provider retention and deletion behavior.

Do not confuse a billing batch size with an API page size.

Check the current schema and actual response. Documentation describes
username, mode, pageId, maxItems, and output containing results and cursor_next.

Do not assume the documentation is internally consistent or that the latest
build behaves identically to an old example.

## 7. Distinguish an authenticated test from another preflight

Use existing authorized credentials when available. Never print or commit them.

Verify the actual provider account is on Free and has sufficient available
credits. Cloudflare Free does not establish anything about an Apify account.

First run a minimal real, authorized test to establish:
- Username resolution.
- Actual follower identities.
- Actual following identities.
- Continuation behavior across multiple pages.
- Credit consumption and source limitations.

Use an explicitly authorized test account. Do not infer the owner's Instagram
username from their GitHub username.

Then attempt approximately 6,000 followers and 6,000 following when the verified
remaining allowance supports the attempt with a reasonable reserve.

A small successful test is useful intermediate evidence, not target-scale
acceptance.

A 401 response, a schema read, or a mocked adapter is not a successful test.

If a provider account, token, or test-account authorization is missing:
- Identify the exact prerequisite immediately.
- Explain the private setup location, without asking for secrets in chat.
- Continue independent import and integration implementation.
- Do not replace "missing credentials" with a vague "technically impossible."

Do not create accounts, accept new terms, add payment methods, buy credits,
enable auto-recharge, or upgrade plans without owner authorization.

## 8. Preserve the zero-cash requirement without demanding infinite capacity

No spending is authorized.

A verified recurring free allowance can support a capacity-limited prototype.
It does not have to support unlimited visitors to justify a controlled test.

Separate these gates:
A. A genuine username-only scan works.
B. The target-scale scan works.
C. The recurring free allowance supports a measured operating capacity.
D. A public commercial launch is ready.

Do not demand proof of D before attempting A.

Do not call A production completion.

When free capacity is exhausted, stop safely with a service-capacity message.
Do not silently shorten a list to fit the budget.

Do not rotate accounts or otherwise evade free-tier limits.

If this candidate fails, investigate a bounded number of materially different
alternatives and record the actual reason for failure. Do not repeat
unauthenticated probes as evidence of successful acquisition.

## 9. Implement the website-only integration properly

End-user experience:
Enter username → Start → Real progress → Non-followers report.

No extension, bookmarklet, copied cookie, pasted script, provider token,
or downloaded export is required from the visitor.

Start with public accounts where the source genuinely supports them.
Do not advertise private-account access without a verified authorized method.

Use a server-side adapter and resumable job state appropriate to the existing
free Cloudflare deployment.

Implement:
- Server-side provider credentials.
- Same-session authorization for status/results/cancellation.
- Per-direction cursors and collected records.
- Durable progress/checkpoints.
- Bounded polling and retries.
- Repeated-cursor/duplicate-page detection.
- Idempotent job creation to avoid duplicate paid-credit consumption.
- Provider-run timeout and cancellation handling.
- Atomic capacity accounting and concurrency control.
- Explicit retention expiry and cleanup.
- Actual provider errors translated into useful user messages.

Do not put a long, unbounded scraping process inside one web request.

Be careful with two different forms of pagination:
1. Instagram/provider continuation.
2. Pagination through an Apify dataset.

A successful Actor run or exhausted dataset page does not automatically prove
the full upstream relationship list was collected.

Do not count response envelopes as individual Instagram accounts. Normalize
the actual nested account records.

Never fabricate progress percentages or use synthetic records for a real
username.

For incomplete automatic acquisition:
Show observed records and clearly labeled uncertainty, not confirmed
non-followers inferred from a truncated followers list.

## 10. Use subagents with clear ownership

Run independent workstreams:

Agent A — Import compatibility:
JSON, HTML, archives, format detection, parsing diagnostics, realistic fixtures.

Agent B — Comparison/product behavior:
Upload-assumption semantics, main results flow, optional metadata, exports.

Agent C — Automatic acquisition:
Candidate validation, real adapter, pagination, free-credit measurements.

Agent D — Independent verification:
Regression tests, privacy/network checks, browser journeys, deployed behavior.

The lead owns shared types/contracts, integration, deployment, and final review.
Coordinate shared files before parallel edits.

Do not let external acquisition setup block shipment of the repaired importer.

## 11. Acceptance must reflect the owner's actual goal

UPLOAD ACCEPTANCE:
- A valid supported export yields the non-followers list without ticking a
  completeness checkbox or entering a collection date.
- Equivalent JSON, HTML, and ZIP inputs yield equivalent comparisons.
- Split files are combined.
- Harmless optional fields do not break the import.
- Unrelated archive contents are not loaded unnecessarily.
- Missing-direction input receives a specific request for the missing list.
- Known partial inputs produce a clearly qualified usable comparison.
- Native exported datasets can be reopened.
- Downloads include every promised result, not just the visible page.

Use fixtures covering realistic export structures, not only the parser's
preferred synthetic shape.

If the owner's previously rejected files are already available in the task,
reproduce against them privately. Otherwise proceed with structural fixtures;
do not stop and require another upload before fixing confirmed code issues.

SCALE ACCEPTANCE:
6,000 followers + 6,000 following + 4,500 mutuals
= 1,500 in each non-mutual category.

Also retain the larger stress tests, cancellation, and full-result exports.

AUTOMATIC ACCEPTANCE:
Report separate outcomes for:
- Real credentialed small-account test.
- Real multi-page retrieval in both directions.
- Target-scale retrieval.
- Credit consumption.
- Remaining recurring capacity.
- Hosted website-only end-to-end flow.

Do not call an incomplete large scan complete because counts look plausible.
Investigate discrepancies without requiring impossible guarantees that a live
account did not change during collection.

## 12. Verify and deploy the actual repaired product

Run the complete relevant tests and exercise hosted upload flows in Chromium,
WebKit, and Firefox where supported.

Use the deployed website as a visitor:
- Open upload mode.
- Select files.
- Get the default non-followers list.
- Search, paginate, open profiles, and export.
- Confirm that no extra verification step blocks the useful result.

Verify automatic mode independently against the real source when configured.

Preserve separate origins, noindex, and disabled ads for this preview.
Do not modify the Million Beers API or unrelated Cloudflare resources.

Push focused commits and update PR #1 or follow the repository's established
branch workflow. Do not force-push or merge without authorization.

Deploy the repaired preview through the existing authorized free projects.
Record exact code commit, matching CI, deployed build, and hosted evidence.

Final report:
1. What a user can now actually do.
2. Previously rejected formats now supported.
3. The changed upload-comparison behavior.
4. Real automatic tests performed and their results.
5. Any exact remaining owner setup requirement.
6. Free-credit usage and capacity limits.
7. Deployed URLs and commit.

Do not lead with a large test count while the core task still fails.

Success is: the owner uploads their relationship data and immediately gets
a useful non-followers list, while automatic checking advances through a real
integration rather than another permanently disabled placeholder.