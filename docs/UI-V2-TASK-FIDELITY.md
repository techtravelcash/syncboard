# TC-455 task presentation candidate

Baseline: `20c48df793c91dd303abdfb0229701b64a905914`. Approved geometry read from identity commit `e329c93a8d4dfd043c4f1fe7e06b3949426ea359`, `dist/prototype.css` / `prototype.js`. The approved Kanban and owner's dark task-form screenshot were inspected. No v3 branding/assets/typography are imported. The runnable approved v2 prototype uses Arial/Helvetica/sans-serif, while the v2 brand kit specifies Plus Jakarta Sans. The parent selected the runnable prototype’s Arial/Helvetica stack in the preview shell for literal screenshot fidelity; this modal slice inherits that choice and contains no font-family override.

## Integration, preview only

1. Keep default `app/index.html` unchanged.
2. After creating `app/ui-v2-fidelity-preview.html` with body classes `sb-app sb-fidelity-v2`, run `python scripts/apply_task_fidelity_preview.py app/ui-v2-fidelity-preview.html`.
3. This replaces only `#taskModal` and `#taskHistoryModal`, and appends the CSS/module after existing assets. The script rejects other filenames or a missing preview class.
4. `app/js/task-fidelity-v2.js` independently checks the preview class. It imports the existing canonical `state.js` and `ui.js`, observes the old task-id/render anchor and modal visibility, and adds read-only metadata and panel selection. It uses the exact `state.lastInteractedTaskId` identity populated by the existing detail renderer, without coercing IDs. Removal of the existing progress overlay refreshes only the detail metadata. It never writes model data or calls an API. Its progress button forwards the same task object to the existing progress callback. Existing form callbacks, detail rendering, permissions and Calendar links remain untouched.

## Presentation

- Task form's header and body share `--sb-task-columns: minmax(0, 1fr) 260px`. Link/reference and body metadata use the same `--sb-task-rail-inset: 22px`, including their matching one-pixel left borders. Title and URL labels begin on the same grid row with the same label metrics and 24px top inset. Long titles, help and native invalid field states can increase height without moving either column's starting point. No negative margins or transforms repair alignment.
- The form has one scrollable body and an anchored Cancel/Save footer. Narrow mode at 680px and below uses one column with 20px insets, and preserves all fields.
- Detail is a 960px modal with a 260px metadata rail, compact identity/status strip, large title/narrative/pending work in main, comments/attachments/history tabs, metadata and existing actions in the rail, and Close/Edit footer. No invented criteria, dates, people, percentages or upload states.
- The real `#comments-feed`, `#history-feed`, attachment containers, legacy comment input and composer are preserved. The old `.glass-separator-v` mount class is relocated to the comments panel and its `.p-6.mt-auto` descendant is unchanged; `ui.renderTaskHistory` therefore injects its exact original rich editor in the main column. The original history toggle and onclick remain in markup as a hidden compatibility control; the History tab exposes the real feed.
- No rich content, mentions, link URLs, datasets, editor commands or attachment handlers are rewritten. No `aria-modal=true` assertion is added. Tabs provide selected state, associated panels and Arrow/Home/End selection.
- Normal confirmations remain blue. Existing destructive intent remains red. Dark mode uses existing approved token variables and the same geometry.

## Exact source manifest

- `app/fragments/taskModal-fidelity-v2.html`
- `app/fragments/taskHistoryModal-fidelity-v2.html`
- `app/css/task-fidelity-v2.css`
- `app/js/task-fidelity-v2.js`
- `scripts/apply_task_fidelity_preview.py`
- `tests/check_task_fidelity_contracts.py`
- `tests/check_task_fidelity_adapter.mjs`
- `tests/check_task_fidelity_flows.mjs`
- `docs/UI-V2-TASK-FIDELITY.md`

All 139 baseline tracked files remain byte-identical in this isolated candidate, including default entry, `main.js`, `ui.js`, startup optional-photo-claims recovery, brand vectors, API, backend and configuration.

## Checks performed

- `python tests/check_task_fidelity_contracts.py`: all 54 existing modal IDs, native field types/required/options/values, links and event attributes preserved; legacy editor mount verified; baseline file equality and preview root gating checked.
- `node tests/check_task_fidelity_adapter.mjs`: guard/duplicate install, missing/known/out-of-range progress semantics, empty/filled comments/files metadata, tab click/keyboard/reopen behavior, exact forwarding of close/progress, no model or rich content mutation.
- `node tests/check_task_fidelity_flows.mjs`: actual existing callback bodies with the new fragment markup, fake APIs and isolated DOM; create empty optional link/date, multiple people, project/color/priority, edit filled link, edit-cancel, save-error retention, AI cancel/apply, progress 0/99/100, mandatory missing-work validation and cancel.
- Existing startup/profile claims and collaboration fixture checks are run separately. The native browser validity attributes remain unchanged; these DOM fixtures do not claim to test browser-native constraint validation.

## Remaining acceptance gate and known limits

No browser was launched and no local-file/browser workaround was attempted. The preview still needs real HTTPS captures and comparison at matched 1440×900, 1920×1080, 390×844, 100% zoom, loaded canonical Arial/Helvetica/sans-serif stack, light and dark. Check create and edit with short and long titles, empty and filled URL, native malformed-URL and empty required-field errors, helper/error wrapping, suggestions/colors, tabs, attachments, rich comments and repeated close/reopen. No save, comment or external write is authorized by merely opening a preview.

Existing limitations are preserved rather than silently broadened into this presentation change: the Sem data checkbox does not clear an already entered date; progress updates mutate local task state before backend success and lack an in-flight guard; rich-editor rerender can discard an unsent draft; no new modal focus trap/restoration or realtime/draft recovery guarantee. Progress opened from detail uses the existing handler; returning to detail does not independently refetch data.
