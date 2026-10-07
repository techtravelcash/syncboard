# TC-455 secondary-view preview candidate

Baseline: `20c48df793c91dd303abdfb0229701b64a905914`.
Approved structural source: identity repository `e329c93a8d4dfd043c4f1fe7e06b3949426ea359:dist/prototype.{html,css,js}`. Approved screenshot pixels were inspected. No current-v3 demo HTML/assets or demo data is imported.

## Integration

- Apply the `app/js/ui.js` presentation hunks and add `app/js/fidelity-secondary-v2.js`.
- Load `app/css/fidelity-secondary-v2.css` after the baseline CSS in `app/ui-v2-fidelity-preview.html` only. Every CSS selector additionally requires `body.sb-fidelity-v2`.
- Requires shell worker's `fidelity-page-title` and `fidelity-page-subtitle`. Shell sync must run before each per-view renderer so Home can set its existing personal greeting. No second page hero is rendered.
- Does not edit filter predicates, sort comparator/options/callbacks, `updateActiveView`, board, models, account writes, notifications, auth/API/backend, or startup recovery.
- Default-mode Home, List, Archive and People rendered HTML was compared byte-for-byte against the baseline in synthetic DOM fixtures and is unchanged.

## Presentation-only changes

- Home uses the approved four-cell summary strip, full-width task-list/main region and 288px attention rail, with a distribution panel below the list. All six original selections remain accessible as compact `metric-card` buttons before the list; the selection, previous selection persistence, loaded-task model and detail-close focus targets are preserved. Personal counts remain explicitly loaded-subset counts.
- The four summary values are personal active tasks, Parado, Homologação and Publicação. Attention uses actual stopped, pending-personal-homologation and overdue counts, without inventing reasons or next actions already completed. The project panel counts only personal tasks. Distribution includes an explicit unknown-status remainder if present; it is a proportional count visualization, never invented task progress.
- Home rows use task text, stage and deadline columns. Priority and pending-personal-validation information remain visible. Full task titles and project names wrap instead of being truncated. Mobile dates remain visible, unlike the static prototype's hidden dates.
- List is a native table (task, status, responsible people, priority, deadline, progress, compact delete action). The task title is the existing `.info-btn` detail button; the row and delete event handlers remain byte-identical. Full names, reviewer, creation date, attachment counts, unknown progress and out-of-range values remain visible. Columns scroll locally on narrow screens.
- Archive is the equivalent native table with the exact returned item set/order and restore/delete IDs. `updatedAt` is still labeled “Última atualização”; never “Concluída em”. Divergent non-done/unknown statuses and missing values remain explicit. Compact restore/delete buttons retain full accessible descriptions.
- People uses the reference's single 660px panel and 31px identity avatars. All existing `personCard` markup, loaded-set active-task counts, roles/admin distinctions and actions remain. Search/New Member sit in a compact toolbar. Account forms and callback targets are unchanged.
- Meaningful metadata is at least 12px. All new layout rules consume existing light/dark design tokens and remain preview-scoped. The shell owns the font choice: parent selected the runnable v2 prototype’s Arial/Helvetica/sans-serif for literal screenshot fidelity despite the brand kit’s Plus Jakarta Sans token; this stylesheet does not override that choice. Text-only high/urgent priority uses the existing dark-aware error-border color token.

## Verification

Passed on the isolated candidate:

- `node tests/check_fidelity_secondary_v2.mjs`: actual default renderer HTML parity; exact protected contracts; six Home selections/order/callback/focus; 480 List combinations; native title/blank-row callbacks each open once; archive returned rows/order/updated labels/IDs/empty/error/reopen; People exclusion/roles/identities/search and exact form markup; escaping; no state mutation.
- `node tests/check_home_focus_v2.mjs`
- `node tests/check_archive_v2.mjs`
- `node tests/check_archive_actions_v2.mjs`
- `node tests/check_people_v2.mjs`
- ESM syntax checks for changed/new JavaScript.
- Generated List/Archive tables parsed with lxml: valid header/body/table nesting, column headers scoped and cells matched.

The new isolated-source test intentionally asserts the untouched sibling-owned contracts against the baseline. When combining the shell/modal patches, those source assertions need to be reconciled against each sibling's separately reviewed authorized changes; do not weaken the preserved behavioral assertions.

Not performed: local Chromium/file-browser execution (blocked), browser rendering, live backend/account mutation, or visual acceptance. Parent's real HTTPS paired screenshots at 1440×900, 1920×1080 and 390×844 remain required, including dark legibility and actual task/detail flows.
