# TC-465 — User filter includes reviewers

The shared Kanban/list predicate now matches a selected user as a responsible person **or** homologador. Both roles on one task still produce one result. Name/email values are trimmed and case-insensitive; the loaded user directory connects a selected display name to its email. Missing/null identities are safe. Project, text, priority and status remain AND filters.

Both the visible selector and underlying chips include reviewer-only people and email-only records. Their label is now “Usuário”. Existing APIs, stored assignments and role permissions are unchanged.

## Verification

- `node tests/check_user_reviewer_filter.mjs`: synthetic role/identity matrix and actual Kanban/list renderers, selection callbacks, AND filters, task/column counts, empty results and clearing from both views; immutable task fixtures.
- JavaScript syntax and `git diff --check` passed.
- All 49 existing check scripts were compared against main `df4fdb47f48d3772ae042ec64be505f44ab033fc`: the same 20 pass and 29 fail on both revisions. Many historical suites freeze older full source snapshots and are not a current aggregate release gate. No previously passing script regressed. Existing failing suites were not weakened.
- No database migration or production task mutation is required. Native browser/live-session validation is separate from these synthetic results.

Rollback: revert the isolated TC-465 commit, preserving subsequent independent changes. The two feature commits may be published in one fast-forward after review, with an expected-head lease.
