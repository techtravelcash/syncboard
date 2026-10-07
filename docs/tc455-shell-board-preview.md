# TC-455: V2 fidelity shell and board candidate

## Scope and source

Isolated local candidate built from `20c48df793c91dd303abdfb0229701b64a905914`. Default `app/index.html`, default CSS, API, auth routes, state store, SignalR and startup/profile guard are unchanged. Only the opt-in `app/ui-v2-fidelity-preview.html` loads the new CSS and supplies `body.sb-fidelity-v2`.

The supplied rejected production and approved V2 screenshot pixels were inspected before implementation. Geometry comes from identity repository commit `e329c93a8d4dfd043c4f1fe7e06b3949426ea359`, `dist/prototype.css`: 212px sidebar, 67px topbar, 31px/34px content inset, 29px hero, equal flexible five-column board with214px minimums and14px gaps, 20px gaps on large viewports, compact card metadata, 4px progress track and single footer. Below1000px columns deliberately scroll horizontally at220px, and at mobile258px. At1200px and below the desktop sidebar contracts to185px and uses the approved40px mark instead of the lockup. The preview uses the canonical680px mobile breakpoint for both CSS and the shell focus/inert lifecycle. Widths681–767 explicitly neutralize the legacy mobile toggle/account-panel rules and retain the185px desktop rail; the default application keeps its original767px behavior.

Typography discrepancy: V2 brand-kit tokens identify Plus Jakarta Sans, but the approved runnable V2 prototype and screenshot use Arial/Helvetica. The preview scope deliberately uses Arial/Helvetica for literal fidelity; existing V2 SVG logo assets and all default-page typography are unchanged.

No demo records, fake counts, review ribbon, V3 brand assets, new backend endpoint or alternate auth path were introduced. Projects and counts come from loaded task records; profile content copies the same resolved production profile/photo fallback. Unknown progress remains explicitly “Não informado.”

## Composition and action mapping

- Sidebar: existing authorized views, workspace identity, loaded project links/counts, resolved user profile at bottom.
- Topbar: breadcrumb, notification trigger using the existing notification callback and unread badge ID, account tools.
- Main: common hero with the original `addTaskBtn`, compact search/four independent native selectors, result count and native board/list switch, then existing view containers.
- Task title: `.expand-btn` retains the original details listener and task ID.
- Progress: `.progress-update-btn` retains the original modal listener and task object.
- Action disclosure: native `<details>/<summary>` containing `.info-btn`, the original `.approve-btn` or `.publish-btn` markup under unchanged status conditions, and `.delete-task-btn` under its original confirmation listener. No per-card action toolbar remains.
- Full assignee/validator/pending information remains in the unchanged real details/editor flows. Avatars expose all owners in an accessible name, including overflow owners.
- Every API call, state-transition payload, homologator selection, deletion confirmation, role check and no-filter reorder payload is retained.

## Shared hooks

`app/js/fidelity-v2.js` is side-effect-free on import. `isFidelityV2()` gates every shared code change.

`syncFidelityShell(state, filteredActiveTasks)` runs at the start of `updateActiveView`, updates common hero defaults, real sidebar counts, native option choices, visible results and filter feedback. Secondary view renderers can override hero copy afterward. Shared IDs:

- `fidelity-page-header`
- `fidelity-page-eyebrow`
- `fidelity-page-title`
- `fidelity-page-subtitle`
- `fidelity-page-actions`

`finishFidelityView(state)` restores the concise breadcrumb after the legacy router writes its labels, then emits `sb:fidelity-view-updated`. The preview listener refreshes Sortable only after filtered DOM updates.

`initializeFidelityControls(state, {refresh})` routes project/responsible choices and view buttons through existing source controls. UI-local priority/status values live only in this helper. Existing project/responsible/search predicates and list sorting retain their semantics. Clear resets UI-local values before dispatching the same old clear/search callbacks.

Any active project/responsible/search/priority/status filter destroys/disables drag and reordering. The result line explains that filters must be cleared to move/reorder. An onEnd guard also prevents a partially filtered order write if filters change during an in-progress drag. No-filter callbacks/options remain original except excluding interactive controls from drag initiation.

Empty lanes keep a real104px minimum-height Sortable list. The empty placeholder shares the same CSS grid row as a pointer-transparent sibling; it is never among draggable children or reorder payloads. Existing mobile drawer focus management now includes the additional bottom navigation in background inertness, with null checks preserving the default page.

## Checks performed

- `node --input-type=module --check` for each modified/new JavaScript file.
- `python tests/check_fidelity_contracts.py`: baseline20c isolation, full CSS order, all original IDs, unchanged modal structures, preserved handlers/payloads/startup guard, scoped responsive rules and empty-lane source geometry.
- `node tests/check_fidelity_v2.mjs`: default card byte parity, real compact renderer callbacks/conditions, escaping and absent progress, filter intersections, source callback routing, counts, filter explanation, five actual empty-list identities, all filters disabling drag and a mid-drag filter race without API writes.
- Existing passing runtime suites: archive/actions, collaboration, Home/focus, Kanban/actions, people, startup, photo-claims recovery, task-space flows.

The historical `check_list_filters_v2.mjs` asserts byte equality to an earlier pre-collaboration baseline and already rejects newer baseline20c changes. Its blanket historical source-equality gate is not a current integration verdict. This candidate adds focused baseline20c contracts instead. Historical Python suites similarly target their own release baselines; do not describe them as a current aggregate pass.

## Remaining acceptance gates

No supported browser render was run in this child. Local Chromium/socket and file browsing are blocked and were not retried. Source tests are not visual acceptance. Parent must merge secondary-view/modal fragments, run combined checks, deploy only its reviewed authorized same-domain preview, and capture matched viewport/zoom light-theme screenshots before default activation. Required live checks include empty-lane pointer drops, menu keyboard/escape focus, native selectors and clear, board/list persistence, narrow horizontal scrolling, mobile drawer inertness, long/multi-owner cards, dark contrast, real startup/profile, detail/editor/notification flows and all views. No push, ref mutation, deployment, approval or task status update was performed by this child.
