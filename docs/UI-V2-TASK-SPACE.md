# TC-449 / UI-V2-06 — Task-space presentation candidate

Base: `a5d3bcfdc9af1a63b5d579a7ee03d8f3c9e4dfd9`. This is an isolated, unpublished patch. No task records, production data, APIs, deployment configuration or parent checkout were changed.

## Presentation included

- Opt-in `task-space-v2.css` after `detail-compat-v2.css`, using the existing approved Fluxo v2 tokens. No new brand asset or font source.
- Task create/edit: explicit field labels and required indicators, visible title-AI action, separate description/attachment and context columns, scrolling content and an always-available save/cancel footer. Mobile stacks the same controls.
- Task detail: wrapping title/project context, visible external-reference and Calendar-template labels, accessible close/edit/signal/approval names, responsible people's full supplied names, distinct homologator and deadline context.
- Project/responsible/color controls retain their existing IDs, dynamic selections, values, color locks and payload extraction. Existing project colors remain literal user data, including preview backgrounds.
- AI: explicit “generate, review, apply, save” copy and blue ordinary actions. Apply only changes the existing form field, as before.
- Progress: labelled fields, legible disabled state, explicit separation of 100% progress from approval/publication. The display-only 100% sentinel now reads “Progresso informado: 100%”; its matching clear-on-return check uses the same new literal. Validation, transitions and save payload remain unchanged.
- Homologator chooser: explicit select label and matching tokens; reuses TC-447 IDs `homologadorTitle` and `homologadorDescription` for its dialog name/description. No permission or state change.
- Comments, rich editor, history entries and attachment operations are deliberately not redesigned. Their containers fit the new task space; TC-450 owns their presentation. `detail-compat-v2.css` is byte-identical.

## Boundaries verified

All 132 baseline element IDs and 75 modal field/data/event contracts are retained. Dialogs retain `role="dialog"` and proper labels, without `aria-modal="true"`: this presentation patch does not supply focus trapping or background inertness. Task title `oninput`, history disclosure `onclick`, data attributes, required/type/value/min/max/multiple, status and priority values remain unchanged. Save remains a submit button; Cancel remains type=button. `main.js` is byte-identical, including create/edit/save/cancel, AI, approval, attachment and payload logic.

The `ui.js` patch adds visible supplied names to detail, accessible color-button names, progress dialog markup/labels and the neutral progress-100 presentation sentinel. Both sentinel occurrences are replaced together; the static gate normalizes only that literal and proves the remaining progress listener/payload code is byte-identical. Project and responsible selection functions, close/detail editor functions, calendar URL generation and approval conditions remain unchanged. Shared destructive confirmation styling remains red; normal task save/apply/approve/confirm actions use blue. Dark detail non-primary action/link text uses `--sb-focus` (`#9BB3FF`), while primary Approve remains white on blue. Dark responsible-tag removal uses `#FFB6AD`. The pre-existing dark compatibility tokens are reused, not newly approved as a full dark theme.

## Verification run

Passed against this isolated candidate:

1. `python tests/check_task_space_v2.py --baseline-root <repository-containing-base-commit>`: original field/data contracts, labels, asset/adapter/state/workflow/CSS protection and JavaScript parsing. This reads the exact base Git object, not mutable working files.
2. `node tests/check_task_space_flows.mjs`: actual main/progress callback bodies with fake DOM/API. Covers create with multiple responsible people/color/priority/empty date/link; edit/cancel/back to detail; edit/save; save failure; AI generate/review/cancel/apply and repeat open/close; progress 0/99/100, the 99 → 100 → 99 display/clear transition, missing-work validation, duplicate-open guard and cancel. Includes a characterization of the existing “Sem data” defect; that test records existing behavior, not an acceptance pass for the defect.
3. Existing `python tests/check_detail_compat.py` and `node tests/check_startup_v2.mjs` passed.
4. HTML parsed without errors; taskForm has header, scrolling body, footer siblings; cancel stays in the form and responsible input stays in the existing payload container.

These are focused checks. The old pilot/shell freeze tests expect task markup and UI code to be untouched; they are not acceptance gates for this new slice without reconciling their stage-specific allowlist. The new static gate intentionally compares an isolated candidate, so later integrated changes to `main.js`, shell CSS or Home must be reviewed separately rather than weakening its assertions silently.

Not run: actual rendered layout/contrast, screenshots, browser keyboard order/focus trap/restoration, physical mobile/virtual keyboard, 200% zoom, realtime event arrival, live role-specific/API/AI/upload operations. Browser validation is blocked by the provided environment: local Chromium socket creation is denied and the existing cloud browser cannot open local files. No workaround or production-browser operation was attempted after that limit was confirmed. The next verification route is independent code review followed by an authorized HTTPS staging/live review. No render or end-to-end success is claimed.

## Known functional dependencies, unchanged

- PF-08/TC-392 and PF-09/TC-393: “Sem data” has no change/click binding in the baseline; the submit handler reads the date input directly. A genuinely empty date produces null, but checking the box after entering a date leaves that date in the payload. This acceptance criterion is blocked on the functional package.
- PF-13/TC-397 and PF-14/TC-398: changing progress to 100 now displays “Progresso informado: 100%” in the disabled pending-work field. Save continues to send `missingToComplete: ''` at 100; returning below 100 clears the display sentinel and requires a pending-work value, exactly as before. The presentation correction does not change progress evidence, completion or publishing rules.
- PF-13/TC-397 and PF-58/TC-442: progress save mutates the local task before backend success and has no in-flight save guard. This is not fixed by styling disabled/loading states.
- PF-58/TC-442: no new draft persistence, navigation protection, event-during-edit recovery, cancellation of pending AI requests, focus trap or restoration is implemented. The form warns that unsaved edits may be lost. An isolated save failure retaining a form is not a draft-recovery guarantee.
- PF-12/TC-396 / PF-21/TC-405: the existing responsible/project suggestions are click-driven divs, without full keyboard combobox navigation. Labels/focus styles improve discoverability but do not establish keyboard-complete selectors.
- PF-48/TC-432: the existing “Resumir/Profissional” chips have no dedicated binding in baseline source. Their styling does not claim a newly functional instruction shortcut. The actual generate/cancel/apply path is covered by fixtures.
- PF-56/TC-440 / PF-57/TC-441: external links and Calendar remain references/templates. No meeting is created or confirmed here.

## Integration order

1. Keep the TC-444 foundation and TC-445 shell/detail compatibility prerequisites. Finish the parent's TC-446–448 changes first if they are already in progress.
2. Apply only this patch's listed files/hunks, not the candidate's whole baseline checkout. The shared `app/index.html` stylesheet insertion may need to be placed after other new view styles; it must follow `detail-compat-v2.css`. Preserve the parent's release marker and scripts.
3. Apply the taskModal/taskHistoryModal/aiTitleModal fragment and the homologadorModal fragment, retaining intervening delete/signal/alert markup. Reconcile only the small `ui.js` detail/name/color/progress hunks; never overwrite the full file after Home/board/list changes.
4. Integrate TC-450 after this task-space structure. Its feed/editor/attachment styles should avoid undoing the container scroll behavior or recoloring persisted rich content. Preserve explicit destructive intent.
5. Rerun callback tests and integrated ID/data/payload/role checks; perform approved browser QA at 320, 375, 768, 1024 and 1440 px, short landscape/virtual-keyboard height and 200% zoom. Use fictional data and intercept writes for behavioral tests.
6. Keep known PF criteria marked blocked and rendered checks not-run until verified. This artifact does not authorize push/deploy, approval, conclusion or changing task status.

Rollback for this isolated visual slice: remove its stylesheet include/file and reverse only its exact markup/UI hunks against the current head, preserving later unrelated work. No data migration or data rollback is involved.

## Sequential integration

The candidate preserves the preceding Home, Kanban and List/filter releases. The homologator retains `homologadorTitle` and `homologadorDescription`, and its visible label includes both existing Kanban and task-space style classes. Only the release marker is excluded from unchanged data-attribute checks. Before activation, record a rollback reference at the exact List parent above; release with an expected-head lease, verify Azure for the exact commit, then run the available read-only task-space QA. Recovery uses a new revert commit, never reset or force-push. Release marker: `tc449-task-space-1`. Human handoff: Homologação for Elmo.

The shell compatibility gate explicitly allows only five additional help/title IDs from this slice; original modal/control/data contracts are still compared exactly. New task-space gate protects87 existing files, including prior Home/Kanban/List CSS and the current shell module. Synthetic fixtures stay local/test-only, and live production QA uses read-only opening/cancel paths rather than fabricated task records.

Five actual detail-population fixtures additionally cover supplied string/full names, email-only/null responsible entries and literal angle-bracket metadata. Raw directory-name lookup is retained; separate display fallbacks prevent absent avatar initials from throwing. Calendar still uses only supplied emails, skipping a null entry rather than throwing, with the same template URL for valid data. Names and initials are escaped only where rendered as markup; tasks and identity values are never rewritten. Typography is14px labels,16px body,12px metadata including mobile help.
