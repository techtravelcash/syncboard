# TC457: restore board drag and drop

Baseline: a191109659d5448cf734b1ea372be9e2d6b680e1.

## Diagnosis

TC455 introduced both a blanket button exclusion (the new card title is a button)
and disabling Sortable whenever any board filter was active. Production pointer QA
reproduced title failure while unfiltered ID drag succeeded, and filtered ID drag
failed. The latter restriction protected against submitting a partial board order.

## Minimal correction

- Let title buttons start drag; retain their click/keyboard detail action. Progress,
  menu, approve, publish, delete and other interactive controls stay excluded.
- Keep filtered boards connected for cross-column status changes using the existing
  task update API and transition rules. Do not collect or submit partial order data.
- Same-column sorting remains disabled with filters. A filtered status move retains
  the task's existing order; clear filters to place it at a specific position.
- Refresh the filtered view after saving. Reject stale/destroyed Sortable callbacks.
- Keep homologator confirmation, progress-on-publication, API and backend unchanged.
- Change the explanatory filter note and main-module cache key in both entries.

## Verification

Run `python tests/check_drag_restore.py`. It freezes every baseline file except the
three reviewed runtime files, runs syntax checks, focused filtered movement/hidden
order/stale callback tests, an explicitly adapted original active-entry composed
fixture, original card action tests, and unchanged legacy drag/modal/startup tests.
Old TC455 source-freeze gates intentionally target historical releases. They were
run successfully on the unmodified a191109 baseline before this patch. Their old
zero-Sortable-under-filters assertions are not current acceptance criteria; the
new runner explicitly changes those assertions while retaining original files.

Native pointer/title-click, persistence after reload and deployment verification
are separate live QA gates. No human approval or completion is implied.

## Deployment and rollback

One atomic expected-head main update, no pull request or second environment.
Create a rollback ref at the baseline before advancing main. A rollback is a new
commit using baseline tree 263e09205a19b0736df6999333e49a13da2254f6 and the deployed
commit as parent, followed by a leased main update. This restores the exact prior
source without force-pushing. Verify CI for the exact deployment/rollback SHA.
