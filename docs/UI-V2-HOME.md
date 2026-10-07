# TC-446 / Personal Home

Baseline: `7ba90c52e3221554c6bf1ec8bc82a72701913814`. This slice changes Home presentation only. Existing API, state, realtime, task actions, shell/login and every non-Home renderer remain unchanged.

The personal-membership predicate is copied from the prior implementation: an active loaded task belongs here when the current user matches a responsible person's name/email or is the pending homologator for a task in Homologação. Publication does not qualify a former homologator unless they remain responsible. No identity, role, pagination or server-query rule is introduced.

The UI shows Fila, Parado, Andamento, Homologação, Publicação and Atrasadas over that exact loaded personal set. Counts are explicitly labelled as a loaded subset, not global totals. Deadline ordering and the existing overdue predicate are preserved. Publicação stays active; Parado does not imply a technical blocker. Missing deadlines/priority are labelled. No sample tasks or progress values are inserted.

Native buttons make metrics and task rows keyboard-operable. Selection has `aria-pressed` and visible text. The selected local Home category survives a presentation re-render, and a focused metric button is restored to its replacement. This is not a general draft/focus recovery implementation; SignalR/modal draft-loss issues remain PF-58. Pending validation uses a stable labelled action rather than pulse animation. Project colors are retained on a marker beside readable project text, without changing stored colors.

Validation:

- `node tests/check_home_v2.mjs`: twelve isolated model fixtures; legacy membership parity across four identity forms; mixed/co-responsible and homologator cases; stopped/publication100/missing dates and empty sets; unchanged task/order/progress data; text escaping.
- `python tests/check_home_contracts.py`: protected files, exact non-Home renderer parity, static IDs, task-opening hooks, no API/storage, resources and syntax.
- Existing startup, login, foundation, shell and detail checks remain applicable to their own scopes. The earlier broad shell handler comparison intentionally binds to its stage and is not a replacement for the Home-specific gate.
- Deployment must be one atomic commit with an expected-head lease, then exact-commit CI and real read-only Home QA. Verify all six counts against loaded IDs, category switching, Enter/Space, task opening, long titles, theme and browser-zoom reflow. No production mutation tests.

Known boundaries: whole-dataset pagination/summaries (PF-07/PF-23), canonical identity changes (PF-30), live reconciliation guarantees (PF-37), and full cross-modal draft/focus continuity (PF-58) are not implemented by this presentation slice. Physical mobile/touch and network/failure injection require a suitable test environment; report them separately from performed checks.

Rollback uses a new revert commit returning this slice to the identified baseline while preserving subsequent unrelated work. Never reset or force-push main. TC-446 is handed to Elmo in Homologação after delivery and available QA; no automatic approval/publication/completion.
