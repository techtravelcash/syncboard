# TC-464 — current workspace and board context

Scope: visual disclosure only, based on the approved two-row mockup. There is no workspace/board switch, API request, stored selection, backend or authorization change. Current workspace is the existing sidebar label `SyncBoard NT`; current board uses the existing Quadro page title `Quadro de trabalho` (`app/js/fidelity-v2.js`, `viewCopy.kanban`). The application has no named board model in `state.js`; illustrative mockup data such as Produto is not represented as real data.

Both labels remain visible when either panel opens. Only one panel opens at once, shows the current context and explains that switching is future work. Native disclosure buttons expose expanded/controls state; Escape closes and restores focus, outside click and focus leaving the block close it. No animation was introduced (including for reduced-motion users).

## Verification on local candidate

- Parent candidate: TC-463 `6d9c09a` (pending refresh after TC-461/463 publication).
- Independent source/mock review: accepted by review_cube_loading_ui; no blockers found.
- `node tests/check_context_selector.mjs`: passed current-only content, label provenance, ARIA, repeat toggles, mutual exclusion, Escape/focus restoration, outside click and focus exit; no network/state mutation.
- `node tests/check_main_menu.mjs`: passed.
- All `app/js/*.js` syntax and `git diff --check`: passed.
- Full existing test sweep: 17 passed, 29 failed. The same 29 tests fail on unchanged TC-463 parent (16 passed there). Failures involve missing historical git objects and old baseline/preview assertions. This is not an aggregate green result.
- Browser verification is pending. Attempted local isolated-component Chromium launch could not run because sandbox socket creation was denied; no screenshots or native QA are claimed.
- Publication, remote commit verification and CI are pending the ordered TC-461/TC-463 gates. PR #10 / TC-462 untouched.

## Rollback

Revert only the TC-464 commit after publication; preserve TC-463 and TC-461. The change consists of the context markup/stylesheet, independent presentation-only module, and its test/documentation. No migration or data reversal is needed. Re-run context/menu/startup checks and verify the prior single-workspace card returns. A local reverse-patch application check is required before publication.

## Native QA checklist

Verify desktop widths (including 185px sidebar), mobile drawer, both names visible, opening each panel, switching between disclosures, repeated clicks, Escape focus restore, Tab leaving, outside click, navigation/drawer close, and unchanged tasks/Users permission visibility. Move delivery to Homologação only once ready for the user's validation; do not approve or conclude on their behalf.
