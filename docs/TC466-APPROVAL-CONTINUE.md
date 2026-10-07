# TC-466 — Close task detail on approval Continue

Based on production main `df4fdb47f48d3772ae042ec64be505f44ab033fc`.

The success dialog accepts a one-shot Continue callback. The detail approval listener captures its task ID and closes only that still-open detail. It restores focus to an available task element in the active board, or the board container if filtering removed the task. A delayed API response no longer reopens a dismissed detail or replaces a newer one. An already-running close animation is left alone. Escape/native dismissal keeps the previous feedback-only behavior.

No approval API, status transition, publishing, permission, or TC-462 changes. Tests use mocked API responses, never real task approval.

## Checks

- `node tests/check_approval_continue.mjs`: actual approval, dialog Continue and detail-close handlers composed together; pending/double click, delayed server response, newer-task races before and after success feedback, dismissed detail, close-in-progress, unchanged native dismissal, focus/fallback, exactly one mocked write.
- `node tests/check_approval_success.mjs`
- `node tests/check_approval_feedback_callbacks.mjs`
- `node tests/check_task_fidelity_flows.mjs`
- `node tests/check_task_space_flows.mjs`
- `node tests/check_home_focus_v2.mjs`
- `python tests/check_detail_compat.py`
- Module syntax checks for modified JS.

These are source-backed fixtures, not native browser keyboard/layout or production end-to-end approval. Native Enter/Space activation uses the existing button semantics; physical keyboard/focus behavior still needs browser validation. Existing task-form fixture limitations remain unchanged.
