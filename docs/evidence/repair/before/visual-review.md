# Independent visual/accessibility baseline review

Read-only product review of the fresh built 549e82a preview served by the lead. No product, test, package, git or server changes made. Evidence is synthetic and local only.

## Executed

- Playwright Chromium 153.0.8010.12, isolated contexts, local real Wrangler API, 900 CSS-pixel height.
- Widths 360, 390, 768, 1024, 1440, 1920: public homepage; checker entry; naturally focused synthetic results; results aligned to viewport; import; invalid no-file submission with existing report; empty history.
- Additional 320 CSS-pixel reflow for homepage, entry and results. This is CSS-width reflow, not an installed browser's native zoom interaction.
- Axe home and results at 390 and 1440: zero reported violations. This is automated coverage only.
- Keyboard first Tab reaches visible skip link; inspected actual focused input and site CTA. Reduced-motion preference makes document scroll-behavior auto.
- No uncaught exceptions, console errors or failed requests in the screenshot matrix. No document-wide horizontal overflow across the 42 matrix states or additional 320-width states.

## Reproduced defects and practical repair guidance

| ID | Severity | Reproduction and observation | Root cause | Suggested fix | Evidence |
| --- | --- | --- | --- | --- | --- |
| V1 | P1 | Load sample; scroll to import; enter account; click Compare local files with no files. The viewport looks unchanged. At 390 width submit y=427 but the alert y=-5234; at 1440 submit y=583 but alert y=-4252. Error text exists but cannot be seen near the active workflow. | App.tsx has one global alert/status above results, import and history, with no workflow association or error focus policy. | Put feedback beside the relevant form/actions; after submit error focus an adjacent alert or invalid field when outside viewport; keep status live and avoid moving focus on every progress message. Apply same architecture to worker, storage and export failures. | before-error-at-submit-390.png; before-results.json |
| V2 | P2 | At mobile the entry heading visibly reads “A clearer view ofwho follows you back.” Public homepage has the same merged “ofwho”. | JSX/Astro text directly borders br; CSS .intro h1 br / .hero h1 br becomes display:none without replacement whitespace. | Preserve a literal space around line breaks or use spans that block on wide viewports and remain separated by whitespace on mobile. | before-entry-390.png; before-home-390.png |
| V3 | P2 | Loaded results retain all onboarding. Result section starts y=984 at390 and y=779 at1440. First row is y=2010 at390 and y=1369 at1440. Even aligning result heading to top leaves first mobile record 1026px below it. Natural result focus shows onboarding/status at top; result categories remain below initial viewport. | Entry section/trust strip always rendered, plus global sample notice, sample note, overview, completeness details and repeated sample warning above categories. | Collapse introduction after report load; scroll/focus report heading at a useful top offset; put report in a compact result shell with direct import/history navigation. Consolidate redundant sample notices while retaining persistent synthetic labels and accessible completeness details. Reduce oversized vertical spacing. | before-results-natural-390.png; before-results-360.png; before-results-1440.png |
| V4 | P2 | Keyboard-focused username input and public CTA have pale focus rings. Actual computed outline is 3px solid rgb(162,191,135) checker / rgb(152,181,129) site. Contrast against surrounding #f7f8f5 is 1.91:1 / 2.13:1 (white 2.03:1 / 2.27:1). | Hardcoded pale green focus outlines in both global styles. | Use accent/darker outline with >=3:1 contrast against adjacent surfaces; retain outline offset. | before-checker-focus-390.png; before-site-focus-390.png; focus-results.json |
| V5 | P2 | Public mobile main navigation contains only Open preview; The checker, Guides and About disappear at360/390 with no replacement nav control. Body/footer provide some indirect routes. | .site-header nav > a:not(.nav-cta) { display:none } at <=760. | Let essential navigation wrap to a second row or implement native accessible disclosure. Preserve equivalent destinations without requiring users to discover footer links. Checker header should use coherent navigation labels and structure. | before-home-390.png; before-results.json |
| V6 | P1 (confirmed target) | Homepage sample link href is http://localhost:5173, identical to generic checker entry in every tested width. It does not select sample mode. | index.astro .sample-link uses checker without allowlisted mode. | Supported fragment/allowlisted mode must intentionally load synthetic experience and protect existing imported report. Lead/functional reviewer own routing regression. | before-results.json sampleHref |

## Visual judgment

Brand colors and light utility direction are coherent. No major overflow or broken-asset problem was found. Most body copy is readable, but helpers and important actions repeatedly use 12px text, and heading tracking -0.045em makes the already concatenated phrases look more cramped. Aim for 14px helper/control text where space permits and gentler heading tracking, especially after reducing repeated onboarding.

The notable sample warning appears three times before any record: global success notice, generated-example paragraph, yellow warning, in addition to synthetic eyebrow and per-row labels. Preserve qualifications while using one succinct persistent sample/source message and collapsed detailed provenance.

## Evidence files

- before-results.json: dimensions, overflow checks, axe summaries, browser errors, sample href, natural focus across all six widths.
- before-*.png: compact 900px viewport captures; no towering full-page list screenshots.
- focus-results.json: actual CSS focus/reduced-motion values.
- reflow.json: additional 320 CSS-width checks.
- before.mjs, focus.mjs, layout-metrics.mjs, reflow.mjs: reproducible isolated runners.

After implementation, recheck all matrix states plus history with paginated differences, scoped errors, keyboard focus, cross-origin entry modes and persistent result qualifications. Baseline screenshots are preserved in this directory.
