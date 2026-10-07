# TC-450 / UI-V2-07: collaboration and evidence

## Delivery boundary

This guide documents the owner-authorized presentation slice and its staged technical release. Elmo is the human homologator. Deployment evidence and available QA must be recorded separately; a technical commit does not approve or complete the SyncBoard task on the owner's behalf.

Integrated baseline: `2ddbabf398bd744d3509209ae8dbb6b452bd038d` (reviewed TC-449 task-space commit). The original isolated candidate was prepared from TC-446 at `e64a1a3bd3b89a4a64aff77c551dd80f256215bc`; those historical results are not substituted for the integrated checks. The current integration preserves all preceding Home repairs, Kanban, List and task-space changes.

## Implemented presentation

- A dedicated `collaboration-v2.css` after the legacy/custom, v2 shell and detail-compatibility layers. Reuses Plus Jakarta Sans and existing `--sb-*` tokens; no new fonts, assets or external dependency.
- Comment cards with complete author display, available date, a source-provided `editedAt` label, and clearly separated event history. Long lines, rich lists, links, existing inline mentions and filenames remain present rather than truncated. Missing author/date values are labelled honestly; history descriptions remain unchanged and no structured event author is invented.
- Current own-comment edit/delete visibility and its original task IDs, comment indexes/keys and encoded text datasets are preserved exactly. The identity resolver is not a security guarantee and was not changed.
- Editor toolbar and send control have names and 44px targets; contenteditable has a named multiline textbox role and a truthful warning about unsent text. Formatting commands, Enter/Shift+Enter behavior, rich HTML and the mention insertion template are unchanged. The rich suggestion items are native `type="button"` controls with the same datasets, selection and propagation callbacks. No new mention destination resolution/delivery or popup-positioning logic was introduced.
- File lists keep complete names and existing links/removal callbacks. Actual `File` instances show “Selecionado neste formulário”; object references in the form show “Arquivo com link”; objects read from `task.attachments` in the detail show “Vinculado à tarefa”. A URL alone does not imply the current form was saved. A local File object may also remain after upload succeeds but task saving fails, so selection labels deliberately make no sent/not-sent claim. The existing file input is visually clipped rather than display-hidden so it remains keyboard-reachable through its original ID/label.
- Shared confirmation keeps exact callback/timing semantics. It has `role="dialog"`, title and description references, without an unsupported `aria-modal` claim. Current ordinary intent stays blue and destructive intent red. Cancel remains neutral. Existing messages identify the action/category; richer target-specific text is not invented when the caller does not supply it.
- Existing toast type/message/timing is retained with token styling and status/alert roles. No new request, save or upload success state is synthesized.

## Important unchanged boundaries

`main.js`, API adapters, state, realtime, authentication/routing, backend, deployment workflow, existing CSS, v2 assets, upload/delete handlers and payloads are byte-identical to the candidate baseline. Other UI renderers and task-close behavior are byte-identical. `c.text`, history descriptions and the stored `mentionHtml` insertion template are not rewritten or migrated. Only display-only author/initial/filename text is escaped with the existing `escapeHomeText` helper so quotes and angle brackets remain literal labels; raw identity matching, URLs and action datasets retain their original values.

Display-label encoding is not a broader HTML/URL security validation; existing stored rich HTML and URL handling are preserved. Existing attachment `target="_blank"`/URL behavior and lack of explicit `rel="noopener noreferrer"` remain unchanged because security behavior was excluded from this presentation slice. Any later hardening belongs in an authorized functional/security change.

## Verification run

Run from the candidate root:

```sh
python tests/check_collaboration_v2.py --baseline-repo /path/to/read-only-source-repository
node tests/check_collaboration_flows.mjs --baseline-repo /path/to/read-only-source-repository
node tests/check_startup_v2.mjs
node tests/check_home_focus_v2.mjs
```

Both TC-450 checks default to the exact baseline above; `--baseline-ref <verified-pre-TC450-integration-commit>` allows rerunning against a later integrated parent without treating earlier UI slices as changes from this patch. Do not point this option at an arbitrary ref to hide differences.

Passed in this isolated candidate:

1. 125 original static IDs plus field types/values, existing data attributes and inline handlers retained. 87 protected existing source/asset/config files unchanged. All frontend JavaScript parses.
2. Source identity, rich-send and shared confirmation callbacks and the complete stored mention insertion implementation are byte-identical. The menu's button markup is the sole rich-mention change apart from empty image alt text.
3. Actual baseline/candidate renderer outputs for 0, 3 and 80 comments; long accented text/filenames; source-supplied edited date; missing photo/date/author; unchanged rich HTML; original chronological indexes and key/author action visibility; editable attachments vs read-only detail attachments; local/link/task-linked labels; literal metadata containing quotes, angle brackets and ampersands.
4. Actual callback fixtures for rich send and unchanged HTML/author payload; failed send; two rapid sends; re-render during unsent editing; edit prompt/cancel/save; delete confirm/cancel; generic/destructive confirmation/reopen; file selection/removal/save, failed upload, and successful upload followed by failed task saving; toolbar command; Enter/Shift+Enter/Escape and mention selection. APIs and DOM are isolated fakes and no real upload, deletion, notification or external request occurs.
5. Actual bootstrap mock suite and existing eight Home/detail-close scenarios pass.
6. Declared token color pairs meet 4.5:1 (lowest tested metadata-on-canvas pair 5.89:1). Metadata is at least 12px. The new ID-scoped important declarations explicitly override custom.css's important 90% comment width and bubble padding; light/dark rules consider the existing ID-scoped compatibility layer. This is a source-level cascade/contrast check, not computed browser CSS.

Generated local evidence: `tests/fixtures/collaboration-v2/generated-renderers.html`, built from the actual renderer outputs. It sits outside `app`, has only synthetic data and no app scripts/API access, and uses local stylesheet references plus a few fixture-layout primitives. This HTML is not a screenshot, pixel proof or complete Tailwind/browser reproduction. Its typography falls back to locally available fonts. It is not added to production routes.

Result JSON files in the delivery bundle record the source checks, actual callback results, startup and Home-close tests. Historical TC-444/445 whole-file-freeze tests are stage-specific and are not represented as passing after later UI work. The API `npm test` script is only “No tests yet...”, so it is not a backend verification gate.

## Preserved functional gaps / acceptance blockers

| Existing behavior shown by source or fixture | Existing PF boundary |
| --- | --- |
| Rich comment send rejects without local feedback/catch and has no in-flight guard; two rapid clicks still make two requests. | PF-24 / TC-408; PF-58 / TC-442 |
| Rendering the collaboration panel replaces the editor and clears unsent text. This candidate adds a warning, not recovery. No real event-stream scenario was run. | PF-58 / TC-442 |
| Comment edit uses browser `window.prompt`; cancel is preserved. Identity matching, index fallback and authorization are unchanged, not validated. | PF-25 / TC-409; PF-26 / TC-410 |
| Absent author/date display fallback is supported; an explicit null author still fails inside the legacy resolver and invalid dates are not newly validated. Edited history has no separate structured author to display beyond supplied description. | PF-24 / TC-408; PF-26 / TC-410 |
| Mention matching/destination resolution, default image behavior, event-listener lifecycle and popup top/left positioning are unchanged. No roving-arrow-key, viewport-clamping or delivery claim. | PF-27 / TC-411; PF-58 / TC-442 |
| A failed upload is caught/skipped, then task saving can continue without that attachment. Current objects lack per-file pending/uploading/failure state. No distinct visual state can be asserted when unavailable. | PF-28 / TC-412 |
| Removing a referenced file queues its blob for deletion when the form saves. Retention, orphan handling and rollback/recovery are unchanged. | PF-29 / TC-413 |
| Confirmation cloning/timers have no new in-flight lock; caller-provided action/target text is unchanged. Focus containment, restoration and complete keyboard support are not implemented by roles alone. | Relevant functional task; PF-58 / TC-442 |

Browser QA remains blocked by the previously verified local Chromium sandbox and unsupported `file://` path. No browser attempt, alternate workaround or production mutation was made here. Therefore desktop/mobile visual fit, computed cascade, fonts, 200% zoom, actual keyboard focus/selection, scroll, reduced motion, live events, real network/API errors, security and end-to-end upload/delete behavior are **not run**, not passed. Full dark-theme acceptance remains subject to Elmo's visual review.

## Integration and rollback plan

1. Integrate only after TC-446/447/448/449 as instructed. Apply this local patch to the verified parent without overwriting their changes. Expect shared `index.html`/`ui.js` context to require normal reconciliation; never re-copy full baseline files. Load `collaboration-v2.css` after `task-space-v2.css` as well as custom/shell/detail layers.
2. Preserve TC-449's detail/form layout classes, its labels, and the `.glass-separator-v` / `.p-6.mt-auto` selection contract. TC-450's comment/editor/history CSS is scoped to the actual IDs; TC-449 retains ownership of modal shells and surrounding layout.
3. Rerun these focused checks against the verified immediate pre-TC-450 integrated baseline, plus the parent's aggregate regression checks. Re-test the final cascade with a supported browser when available before claiming visual acceptance.
4. Keep this candidate unpublished. Only the parent may transition the registered task and present the delivery for owner/Elmo homologation; this patch does not authorize approval, merge, push, deploy or completion.
5. For local review rollback, reverse only `delivery/tc450-collaboration.patch` after checking it against the current tree. For a future separately authorized release, use an inverse/revert of the exact TC-450 integration commit on the current parent, preserving later unrelated changes, then verify the resulting commit and deployment. The baseline SHA is a comparison point, never a force-reset instruction. No schema/data rollback is needed because this slice changes none.

## Sequential integration and recovery

Integrated after the reviewed task-space parent above, preserving its detail name fallbacks, labels, modal layout, progress copy and all preceding Home/Kanban/List code. Collaboration CSS follows task-space CSS. Release marker: `tc450-collaboration-1`. The contract gate excludes only the release marker from unchanged data attributes; existing machine-valued attributes and rich HTML remain exact. Tests default to this repository, with the optional baseline path/ref flags retained.

Before activation, verify `rollback/ui-v2-collaboration-baseline-20261007` at the exact parent. Use one atomic commit with an expected-head lease, verify Azure for the exact SHA, then execute the available read-only collaboration QA. Recovery is a new revert commit preserving later unrelated work, never reset or force-push. Elmo receives the visual delivery in Homologação with PF-dependent and unexecuted checks listed.

The integrated static gate protects90 existing files and retains all137 prior IDs. The shared shell gate explicitly permits only the three new attachment/confirmation help-label IDs. Existing task form/control and machine data contracts remain exact.
