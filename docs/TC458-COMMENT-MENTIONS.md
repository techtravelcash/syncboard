# TC-458: comment mention selection

Baseline: 20895cf4a9d44a2e37d5e39cee5a9d0543a55703.

The comment editor uses white-space: pre-wrap. Its multiline mention HTML template
inserted literal indentation and line breaks around the chip, moving both the chip
and the following cursor away from the surrounding text. The insertion is now a
compact span followed by one nonbreaking space, with the selection collapsed inside
that trailing text node. Prefix, suffix, user email, picture fallback and send API
are unchanged. Escape/Enter keyup closes suggestions rather than reopening them;
this also dismisses stale suggestions after Shift+Enter.

Only app/js/ui.js behavior and the two HTML main-entry cache markers change.
All ui.js imports retain the same URL to avoid multiple module instances.
The existing global Cache-Control: no-cache header is unchanged.

## Verification

- python tests/check_comment_mentions.py: pinned whole-baseline blob scope,
  all frontend syntax, current editor/startup/profile/drag tests.
- The mention regression test fails on the baseline's leading whitespace.
- Independent source review completed; Shift+Enter and module-identity findings
  were addressed before publication.
- Existing source-frozen historical aggregates intentionally reject the changed
  editor source; their baseline passes are historical evidence only.
- Synthetic DOM checks do not establish native browser geometry/focus, delivery,
  notifications or human acceptance. Live draft-only browser validation is separate.

Rollback: restore the baseline tree from rollback/before-tc458-comment-mentions-20261007
as a new forward commit; do not force main or discard unrelated changes.
