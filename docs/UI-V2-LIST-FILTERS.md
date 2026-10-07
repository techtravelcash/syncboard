# TC-448 / UI-V2-05: Lista, filtros e ordenação

## Candidate scope

Integrated candidate follows the reviewed TC-447 release `688358589d48ac498030c0f8afadff8b6d7a0773`. The Home model, close/live-render focus hooks and Kanban presentation are preserved. Application changes are presentation-only; no backend or task-write contract is changed.

- The visible band shows the existing title/ID search, selected project/responsible, current sort direction, active filter count and clear action.
- Project/responsible options and the sort criteria remain in the existing accessible shell panels. No priority/status filtering, endpoint, persisted setting or additional permission is added.
- List rows show the existing task ID, status label, complete title, project, complete responsible names, homologador when relevant, priority, deadline, read-only progress, creation date and attachment count.
- Existing row/detail/delete callbacks are preserved exactly. Native buttons expose task-specific accessible names. Long row values wrap. No list text uses ellipsis or mobile-only hiding.
- The current loaded collection distinguishes an empty active list from no matches. Missing progress is shown as “Não informado”; the supplied numeric progress stays visible, with an explicit “fora da faixa” label when outside 0–100. Only the visual meter is bounded; values are never written back.
- Selected filters remain visible even when their final matching task disappears. Current state values and the original exact name-based identities are retained.
- Existing scrolling scale/fade effects are no longer attached to the list. Rows remain opaque and stable while scrolling.

## Integration

Load `app/css/list-filters-v2.css` after the existing v2 shell/detail styles. `orb-filter` moves outside the header, before main content, and contains search, existing filter/sort triggers and clear/count feedback. IDs remain unique; all 127 baseline IDs are preserved. Forms/modals are unchanged.

`initializeShell()` reserves the band's actual height through `ResizeObserver` and `--sb-filter-height`. The drawer's existing inert handling includes the moved band. No extra keyboard/toggle handler was added. The band caps at 44dvh / 360px and scrolls for very long selections or short landscape viewports; panels are fixed to escape that scroll container. Browser verification of this geometry is still required.

Only these application files are changed:

- `app/index.html`
- `app/js/ui.js`
- `app/js/shell-v2.js`
- `app/css/list-filters-v2.css` (new)

## Verification performed

All results are static or isolated fixtures, with no network/task mutations:

- `node tests/check_list_filters_v2.mjs`: passed 1,500 before/after ordered-ID comparisons, covering combined project/responsible/search, accents, title/ID search, all existing sorting keys/directions and ties. The filter predicates, comparator, sort callback and row/delete callbacks are byte-identical to baseline. Existing imports, attachment/Home/Kanban code and archive/user renderers are exact to the parent. 84 backend/workflow/state/realtime/API/assets/main-handler and Home/Kanban support files unchanged.
- Same isolated fixture: selection persistence, historical names, clear through existing callbacks, list↔board switching, arrival of matching fixture data during search, full metadata, escape handling, distinct empty states, row versus button/link separation. Delete fixture opens its original confirmation only; it never calls its destructive callback.
- `python tests/check_list_filters_markup_v2.py`: passed original IDs, unique IDs, references, modal HTML, labels, shell control contracts, drawer inertness, one keyboard/toggle handler and JS syntax.
- Existing checks passed: `check_ui_v2.py --foundation-only`, `check_shell_v2.py --isolation-only`, `check_shell_integration.py`, `check_detail_compat.py`, `check_login_assets.py`, `check_startup_v2.mjs`.
- `git diff --check`: passed.

For an isolated archive that lacks the original commit objects, pass `SYNCBOARD_BASELINE_ROOT=/path/to/read-only/baseline/repository` to the two new tests. The complete integration gate was executed with the baseline repository's object directory exposed through `GIT_ALTERNATE_OBJECT_DIRECTORIES`; no writes were made there.

## Parent-owned HTTPS QA still required

No browser screenshots or measured layout proof are included. Local Chromium and cloud file URL routes were previously unavailable/denied and were not retried.

Verify at 320, 375, 768, 1024 and 1440 px, 200% zoom and short landscape height:

1. Visible band reserves the right height without hiding the list/board. Long selected labels and the band's own overflow remain usable; fixed panels are not clipped.
2. Project/responsible/sort open, close, Escape, keyboard activation and focus return work once per action. Navigation drawer inerts the filter band and restores it on close. Touch targets work.
3. Combine all existing filters, clear them, invert each sort, switch list↔board, and receive live updates while searching. The same query returns the same IDs and order.
4. Full titles/names, no-project rows, historical people, priorities, deadlines and progress remain readable on both themes. Dark mode is compatibility only, not v2 design approval.
5. Row click/detail button/delete confirmation preserve separation. Do not execute destructive confirmation in production.

## Preserved PF-dependent limits

- PF-22 / TC-406: no priority or status filter exists in this patch. Search lowercases but does not remove accents. Due-date descending preserves the baseline behavior that missing deadlines sort first, despite its old comment saying they go last. The presentation does not change those semantics.
- PF-22 / TC-406 and PF-58 / TC-442: existing filter chip callbacks stop propagation, so the existing delegated `updateDragAndDropState()` listener is bypassed. This pre-existing functional path was not changed; clearing deliberately uses the same existing callbacks. The Kanban drag-state interaction requires separate functional review.
- PF-30 / TC-414: responsible filtering still uses `name` or legacy strings, not canonical email identity. This patch does not resolve/merge identities.
- PF-21 / TC-405: project names and colors remain presentation data, with no access-control interpretation. Stored CSS project colors are assigned through the DOM style API from escaped data attributes. There is no hex-only rewrite or HTML/CSS string injection.
- PF-58 / TC-442: the existing shell restores focus after keyboard-triggered option rerenders. Focus/scroll preservation during unrelated live-data redraws is not established by these fixtures and remains a real-browser/system-flow criterion.
- Current realtime handlers redraw views but do not universally repopulate the project/responsible menus for newly introduced identities. This baseline parity/data-reconciliation limitation remains with PF-22 / TC-406 and PF-40 / TC-424; existing selected identities are retained.

The candidate is ready for parent integration and HTTPS validation, not a claim of release approval, publication, completion or full product parity.

## Integration checks and recovery

Release marker: `tc448-list-1`. Missing person names show their supplied email or “Nome não informado”; no identity is inferred or rewritten. Copy uses the approved 14/12 px control/metadata scale. The Home controller fixture stubs only the new filter-label refresh while retaining all real Home focus logic.

Before release, record and verify the exact current parent in `rollback/ui-v2-list-baseline-20261007`. Commit atomically under an expected-head lease, require exact-SHA Azure success, then verify the full legacy stylesheet cascade in the live app. Recover with a new revert commit for this release, preserving later unrelated changes; never reset or force-push main. Human handoff is Homologação for Elmo after the available QA, with remaining PF and device-test limits explicit.
