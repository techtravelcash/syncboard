# TC-451 / UI-V2-08 — Arquivados

Integrated presentation slice based on the reviewed TC-450 commit `1656f1d70ac0b94f220f2836f3d3293aff5c6122`, preserving all preceding Home fixes and UI slices. The original isolated candidate was prepared from `e64a1a3bd3b89a4a64aff77c551dd80f256215bc`; current checks below run against the integrated parent. Elmo is the human homologator. Technical deployment and task approval remain separate steps.

## Scope and preserved behavior

- Adds `archive-v2.js`, `archive-v2.css`, an index stylesheet link, and changes only `renderArchivedTasks` plus its new helper import in existing runtime code. Uses the existing Fluxo v2 tokens/font and actual custom → Fluxo → shell → detail → Home → archive stylesheet cascade. No new packages, fonts, assets, routes, APIs, state schema, security, configuration, or storage.
- Replaces dimmed/riscado rows with fully readable text, supplied responsible names, project labels and original project-color markers. People display uses supplied `displayName`, then `name`, then `email`; it performs no current-directory identity join. Plain string responsible entries remain literal. Missing project, title, and responsible content is explicit. Strings and attributes are escaped. Project color is carried through an escaped `data-project-color`, assigned solely to DOM `style.backgroundColor`; valid hex, RGB/HSL and named CSS colors are retained without concatenating CSS declarations.
- Retains `archivedView`, `task-list-row`, `list-row`, `restore-btn`, `delete-btn`, `data-task-id`, `fetchArchivedTasks`, and every existing action handler, callback, access-visibility rule and static index ID. Rows remain in endpoint order. There is no new sort, filter, pagination, detail-opening action, or card-click affordance.
- The existing endpoint queries `status = done`. Only a received `done` gets “Arquivado · Concluída”. No progress value is used to infer completion. If the endpoint anomalously returns an active/unknown status, that row is retained, shows its received status and an “Estado divergente” warning, and triggers a visible contract warning. The count says “tarefas nesta consulta”, not a complete global archive count. A contradictory response is surfaced, never silently filtered, globally rejected, or called completed; fixing the endpoint/reconciliation remains a PF responsibility.
- Date heading is “Última atualização”. Valid supplied `updatedAt` is displayed in the existing UTC day/month/year style. Missing/unparseable date has “Não informada”. There is no current-date fallback and no invented completion date; the summary explains that updatedAt is not a completion timestamp.
- Loading, empty response and read failure are separate states. Failure does not appear as an empty archive. Reopening the view invokes the same existing read again. The patch does not add retry, request cancellation, stale-response ordering, or cross-view reconciliation logic.
- Native 44 px action buttons have visible labels and task-specific accessible names. Restore is the ordinary cobalt action. Permanent deletion is red and keeps the existing irreversible-action confirmation. Restore currently has no confirmation: its existing handler immediately sends `{status: 'todo'}` and does not reset progress. Shared ordinary confirmations remain blue, destructive ones red, through the unchanged wrapper/intent CSS.

## Automated evidence

Run at repository root:

- `node tests/check_archive_v2.mjs`: supplied names without directory lookup; escaping; RGB/HSL/named/hex colors; missing/invalid dates; missing fields; empty and malformed responses; 300 rows with unchanged order; publication100/unknown status uncertainty; no task/user/progress/date mutation; the actual async renderer through loading, success, empty, error and reopen recovery with isolated API/DOM stubs.
- `node tests/check_archive_actions_v2.mjs`: executes the actual unmodified restore/delete branches and real shared confirmation functions. Covers exact todo payload with no progress rewrite; existing errors; no deletion while opening/canceling confirmation; correct confirmed ID; archive/other-view rerender paths; consecutive confirmation replacement; ordinary vs destructive intent. All mutations target in-memory fixtures only.
- `python tests/check_archive_contracts_v2.py`: compares against the stated baseline, checks 125 protected baseline files, exact outside-archive runtime equality, index-only stylesheet addition, static IDs/resources, unchanged endpoint/action contracts, safe color assignment, scoped cascade, and explicit ES-module syntax checking for every frontend JS file. In a git-archive snapshot, set `SYNCBOARD_BASELINE_REPO` to a readable repository containing the baseline; it is used only for git reads.
- Additional passed existing checks: foundation-only, shell isolation-only, startup, login assets, Home model, and baseline Home focus tests. Home model uses baseline git history via a read-only `GIT_DIR` in the archive snapshot. These checks cover their own scopes; they do not constitute whole-product QA.
- `check_detail_compat.py` passes on the integrated snapshot. Its earlier literal cache-marker assertion was reconciled in TC-447; this slice retains the exact current check and detail CSS unchanged.

## Browser/human gates not performed here

Local browser launch/file access was previously blocked; no retry or alternative route around that restriction was attempted. No production/browser interactions were performed. The generated outside-app HTML fixtures are review aids, not screenshots or proof of browser rendering. They include the actual CSS cascade, archive renderer, shared confirmation and delegated actions; fake API/records, substitute icon glyphs and system-font fallback are explicitly labelled. Network is denied by fixture CSP. Responsive wrapper sizes are 1440/1024/768/375/320 px.

Still needed in an authorized suitable environment: actual CSS computed-color/layout review; loaded font/Lucide verification; desktop/mobile/touch, 200% zoom, keyboard and reduced-motion checks; read-only live archive navigation and real identity/data comparison; interrupted/repeated real navigation and focus behavior; error injection and restore/cancel/delete flow only against disposable test data. Do not restore/delete real tasks just to validate presentation. Dark styles inherit current compatibility tokens and are not a new approved dark theme.

## PF boundaries

- PF-07 / TC-391: full query/pagination and completeness.
- PF-10 / TC-394: permanent deletion vs recoverable policy.
- PF-18 / TC-402: archive/restore semantics, progress handling and permission/confirmation changes.
- PF-19 / TC-403: canonical timestamps, including real completion date.
- PF-26 / TC-410 and PF-40 / TC-424: archived detail/history availability and reconciliation. The current detail reader depends on `state.tasks`; archived query results are not injected into that active-state list. No inaccessible detail affordance or fake history is introduced.
- General cross-view request races, modal focus recovery and other functional behavior remain outside this presentation slice.

## Release and rollback

The integrated index adds only the archive stylesheet and advances the release/cache marker to `tc451-archive-1`. All prior stylesheet order and runtime hooks remain intact. Re-run the dedicated archive gates against the exact parent, verify the atomic release commit and Azure result, then perform available read-only live QA before handoff to Elmo. No local check constitutes human approval or task publication.

Expected archive rollback baseline: `1656f1d70ac0b94f220f2836f3d3293aff5c6122`. Reverse only this delta, preferably with a new revert commit for the eventual dedicated release commit, while preserving later Home and other slices. Never reset or force-push main. Deployment/rollback itself is outside this isolated candidate's work.

## Integrated release

Exact reviewed parent: `1656f1d70ac0b94f220f2836f3d3293aff5c6122` (TC-450 collaboration). Current cache markers, Home focus hooks and all prior view/task-space work are preserved. Release marker: `tc451-archive-1`. Historical isolated-candidate cache-query mismatches are not current blockers: the reconciled detail compatibility check is rerun separately. Before activation, create/verify `rollback/ui-v2-archive-baseline-20261007` at this parent. Publish atomically under the expected-head lease, require exact Azure success, then read-only archive QA. Recovery is a new revert commit, never reset/force-push. Human handoff goes to Elmo in Homologação, with mutation/device coverage limits explicit.
