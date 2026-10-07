# TC-455 — staged fidelity reconstruction

## Status of this commit

This is an authenticated, opt-in **preview** at `/ui-v2-fidelity-preview.html`, using the same existing production data and callbacks as the app. Its marker is `tc455-fidelity-preview-1`. The normal `index.html` remains byte-identical to the recovered production baseline `20c48df793c91dd303abdfb0229701b64a905914` (`tc452-people-2`). Opening the preview does not create demo records. Actions inside it are real production actions; QA must use read-only flows and Cancel unless a genuine authorized workflow transition is due.

The owner rejected the preceding rollout's visual fidelity. Prior functional checks did not establish visual acceptance. TC-455 is the explicit reconstruction task; human validation by Elmo and publication of the task remain separate from a technical deployment.

## Approved reference and typography

Geometry and presentation come from the archived, approved V2 prototype at identity commit `e329c93a8d4dfd043c4f1fe7e06b3949426ea359`, plus the owner's supplied screenshots. Current V3 HTML/assets are not used. The original V2 vector assets are unchanged.

The runnable V2 prototype uses Arial/Helvetica, although its brand-kit token file names Plus Jakarta Sans. For this owner-requested screenshot-fidelity correction, the opt-in presentation follows the runnable reference's Arial/Helvetica stack. The default page and original brand assets remain unchanged. No new font binary, license or dependency was introduced.

The online reference prompted for a separate login and was not accessed beyond that point. Comparisons use the already supplied pixels and archived V2 source. Available cloud-browser dimensions and ordinary zoom must be recorded exactly; reduced-zoom desktop captures are not physical-device or exact-viewport/100%-zoom tests.

## Composition and preservation

- Shell and board restore the workspace/project/profile sidebar, breadcrumb, page hero, compact independent filters, result/view switch, equal-width wide-desktop columns and compact card composition.
- Home, List, Archive and People follow the reference's panel/table composition while retaining actual loaded record sets, identities, sort callbacks and honest absence values.
- Detail/form use common header/body grid tracks to align Title and Link DevOps/externo, a main-content/metadata-rail composition and real comments/files/history tabs.
- New priority/status filters are local to the preview. Any active filter disables dragging/reordering, with visible explanation and a final onEnd guard against partial-order writes. Existing unfiltered transition payloads remain intact.
- Only three existing source files change: `main.js`, `ui.js`, `shell-v2.js`. Their new hooks are presentation-gated. API, auth, roles, backend, configuration, model files, default HTML and original V2 assets remain exact.
- The optional-picture-claims recovery in20c is preserved. Reverting only that recovery would reintroduce the known startup failure.

## Technical gates

Each isolated slice passed its original scope freezes and real-function fixtures before composition. Those isolated freezes intentionally cannot all describe the combined source. Current gates are:

1. `python tests/check_fidelity_integrated.py`: 136 baseline files unchanged,145 original static IDs retained, explicit reviewed-source hashes/slices, form/handler/data/payload/startup preservation and full legacy CSS cascade before new scoped styles.
2. `node tests/check_fidelity_composed.mjs`: auditable composition of unchanged behavioral suites plus cross-filter/List/Home/router/default and empty-lane cases. Its output states which isolated sibling-freeze assertions were separated from the behavioral bodies.
3. `node tests/check_fidelity_v2.mjs`: real card/default parity, actions, filters, five empty-destination move payloads and filtered-drag guard.
4. `node tests/check_task_fidelity_adapter.mjs` and `node tests/check_task_fidelity_flows.mjs`: actual task/detail adapter and existing callback behavior, with fake APIs only.
5. `node tests/check_startup_v2.mjs` and `node tests/check_profile_claims_recovery.mjs`: six startup and15 optional-profile/mandatory-session scenarios.
6. Explicit ES-module syntax and tracked diff whitespace checks.

These are source/fixture checks, not browser, security, full accessibility or backend end-to-end certification. Historical per-release freezes remain historical evidence rather than a universal current-suite claim.

## Before default activation

Require exact-commit Azure success, then normal HTTPS preview checks: sidebar/page/column geometry, readable compact cards, real counts/IDs, menus/keyboard, all five filters/clear/sort, empty lanes, all views, Title/DevOps alignment, detail tabs/editor attachment visibility, repeated open/close/Cancel, default-page recovery and light/dark/reflow. No artificial task mutation is required for these checks. Pointer transition writes should use only a genuine authorized task handoff, not test records or arbitrary production tasks.

Capture and inspect real screenshots with their viewport, zoom, theme and marker. Compare them against the approved screenshot/source and record differences. Physical phone/tablet, touch, orientation, virtual keyboard and unexecuted native validity/SSO/write flows remain explicitly unverified. TC-453 stays blocked on its outstanding device coverage; successful preview checks do not close it.

## Rollback

Verified backup ref: `rollback/ui-v2-before-fidelity-preview-20261007` at `20c48df793c91dd303abdfb0229701b64a905914`, tree `c187a315a4572a2d74a2b66322e90854947be445`. Before every main update, verify the actual current head and use a non-forced expected-head lease. Never reset or force-push main.

If this preview commit causes a regression, create a normal revert commit over the then-current main, review conflicts and preserve subsequent legitimate changes, deploy through the same Azure workflow, and verify the exact recovery commit online. Reverting this preview returns the20c startup recovery intact. The old18-commit rollback rehearsal started at5c and does not cover this release.
