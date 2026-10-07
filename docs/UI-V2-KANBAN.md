# TC-447 / UI-V2-04 — Kanban Fluxo v2

## Scope and baseline

Integrated after TC-446, baseline `12e8600a4a6c9fa04ba43fc9d0071a1303e09987`. The newer Home model and return-focus hook are preserved. Uses the approved Fluxo v2 tokens already in `fluxo-v2.css`; it does not change brand assets. It does not publish, approve, archive, reorder or otherwise mutate any real task.

Production changes are limited to `app/css/kanban-v2.css`, the `createTaskElement` and `renderKanbanView` presentation sections of `app/js/ui.js`, and the stylesheet/dialog accessibility labels in `app/index.html`. `main.js`, API/state/realtime modules, original CSS and backend files remain unchanged. Card listeners below their existing event-listener marker are byte-identical.

## Presentation

- Five lanes keep `todo`, `stopped`, `inprogress`, `homologation`, and `publication`; only `done` is excluded from this active view. The publication header explicitly says “Etapa ativa · antes do arquivo”.
- Fixed minimum lane widths avoid shrinking five columns into unreadable cards: 304 px desktop and 286 px below 768 px. Existing shell horizontal scrolling remains the board navigation; lists scroll vertically.
- Task ID, full title, project name/color, priority, primary owner, all co-responsible names, full homologator name, due-date absence/overdue text, attachment/comment counts, progress and existing pending text remain visible.
- `responsible[0]` is labeled “Principal”, matching the existing detail view. All remaining array entries are shown as “Corresponsáveis”. Missing display names use the supplied email or an explicit “Nome não informado” label, without changing stored identity. Neither order nor identity is changed.
- A project-color swatch uses the existing `projectColor`; status is conveyed separately by the lane label. No project colors are reassigned.
- Missing progress is displayed as “Não informado”; an explicit 0 remains `0%`. The underlying `task.progress || 0` fallback and all existing mutation payloads remain unchanged. No percentage, pending task or evidence is invented.
- Details, approve, publish and delete buttons keep their original classes and `data-task-id`. Progress uses a native `button` with the original click listener so Enter/Space can invoke it. All actions remain visible on touch and keyboard focus, with minimum 44 px targets.
- Empty-state text is a sibling of each `.kanban-task-list`, never a Sortable child. CSS responds to `:empty`, including after DOM dragging.
- Existing Sortable classes `opacity-50` and `rotate-2` are styled, along with focus, highlight, chosen/ghost, disabled and reduced-motion states.
- Homologator dialog retains all original IDs, select values, cloned handlers and lifecycle. It gains a dialog role, title/description references, a visible select label, readable surfaces and focus/disabled styling.

## Passed checks

1. `python3 tests/check_kanban_v2.py` checks exact baseline isolation, original listener preservation, five statuses, field/ID contracts, empty-state placement, syntax and token text contrast.
2. `node tests/check_kanban_v2.mjs` exercises the real card renderer with controlled DOM mocks: absent/0/48/100 progress, long text/escaping, all responsible names, pictures, priority, due date, project color, native action tags, repeated details clicks, progress callback and delete confirmation.
3. `node tests/check_kanban_flow_v2.mjs` executes unchanged production drag/dialog functions against mock DOM/API objects: same-lane/cross-lane order, publication's existing 100% behavior, homologator interception, clearing homologator on departure, cancel/no-selection, correct confirmation payload and error/retry behavior.
4. Existing foundation, shell isolation, shell integration, detail compatibility, login asset and startup gates pass. The legacy shell integration assertion is adjusted only to allow the two new dialog label IDs.
5. All frontend JavaScript and the isolated fixture script pass syntax checks. Selected text/token contrast ratios range from 5.79:1 to 17.74:1 in light surfaces; tested dark text combinations exceed 8:1.

These are static and controlled-mock results, not browser or backend end-to-end claims.

## Browser verification still required

Native Chromium could not launch because the executor denies the necessary socket operation. The cloud browser blocks `file://` URLs. No workaround or production mutation was attempted after those limits were confirmed. Browser QA belongs on the parent's already authorized HTTPS deployment route.

An isolated, API-free fixture is supplied in the candidate evidence folder. Its responsive wrapper provides 1440/768/375/320 px iframe sizes. It uses the real renderer and existing dialog function, mock API/handlers, fictitious tasks, a small utility fallback for the Tailwind CDN, and the system font fallback. It is a review/testing artifact, not a production asset. Its browser assertions are prepared but were not executed here.

On the authorized preview, verify actual app font/icons and cascade; all five columns with horizontal navigation; 320/375/768/1440 px and 200% zoom; empty/long title/4-person cards; publication visibility; Enter/Space on existing controls; ghost/chosen styling; dialog readable layout, cancel, disabled save and error feedback. Read-only production observation may verify presentation, but drag, approval, publication, deletion and writes must stay in a separately authorized test environment.

## Existing PF-dependent gaps, unchanged

- PF-11 / TC-395 and PF-58 / TC-442: no complete keyboard alternative to arbitrary drag transitions/manual ordering is available in this baseline. Existing details, progress and status-specific actions are keyboard-usable; this slice does not introduce a new transition API or shortcut.
- PF-58 / TC-442: the homologator modal's current lifecycle does not move focus into the dialog, trap focus, support Escape or restore focus after close. Labels and focus styling are improved, but complete modal accessibility is not claimed.
- PF-20 / TC-404 and PF-37 / TC-421: drag failure re-renders optimistically changed in-memory state without restoring the previous state. Controlled tests expose this existing behavior. No fake success feedback is added.
- PF-11 / TC-395, PF-17 / TC-401 and PF-18 / TC-402: approval/publication controls retain current role visibility, payloads and repeated-click behavior. Existing divergent authorization/transition rules are not hidden or reimplemented. Publication is still an active lane; the existing publish action sends `status: 'done'` to the archive.
- PF-13 / TC-397: existing transitions to publication still force 100% progress. This presentation does not reinterpret that as independently verified completion evidence.

The candidate is ready for integration and browser review, not for declaring these functional gaps closed or for owner/Elmo approval on their behalf.

Integration marker: `tc447-kanban-1`. Title/control/metadata text follows the foundation 16/14/12 px sizing. Current Home code, model and scoped focus-return repair remain intact.

## Release recovery

Create and verify `rollback/ui-v2-kanban-baseline-20261007` at the integrated parent SHA above before activation. Publish this frontend slice atomically under an expected-head lease. If its live check shows a regression, revert the Kanban release commit with a new commit on current main; preserve any later unrelated work, rerun checks and verify the same Azure workflow for the revert SHA. Do not reset, force-push or delete history.
