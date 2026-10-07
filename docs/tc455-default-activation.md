# TC455 default activation candidate

## Status and release boundary

This is the isolated default-entry activation of the independently reviewed
preview3. The independent technical/visual gate was accepted on 2026-10-07
before preparation of the activation commit. Owner-authorized online UI correction
and direct check-ins cover this technical rollout. Exact-commit Azure and live
default-entry verification must still be recorded after publication. A technical
deployment does not approve or complete TC455 or replace human homologation.

The pinned preview is commit `d717428ecba55f7fd9752d30a13390462e725a0b`,
`app/ui-v2-fidelity-preview.html`, SHA-256
`9231073c8d4bd8aa54504f7e4e950b6ca09a7708cfe120571fc0c35f3cb89897`.

The only application change is `app/index.html`: it is byte-identical to that
preview after replacing the exact literal `tc455-fidelity-preview-3` with
`tc455-fidelity-1` in its 16 release-marker/cache occurrences. The resulting
index SHA-256 is
`715617be6ff1c746eb053856e10273c5e5f60565e9404493b0bbfb290c8d6bdf`.

All other application, runtime, backend, auth, configuration, login, model,
fragment, stylesheet and asset files remain byte-identical to pinned preview3.
The preview path remains available unchanged. Existing tests and their locked
assertion bodies/audits remain unchanged. This candidate adds only this document,
two test runners and their explicit fixture-adaptation audit.

The preceding `UI-V2-FIDELITY-RELEASE.md` describes the historical opt-in preview
release. Its statements that the default entry is unchanged apply to that
release, not to this separate activation.

## Reproducible technical gate

From the candidate checkout, with Node, Python and `lxml` available:

```sh
python tests/check_fidelity_activation.py
```

The aggregate gate distinguishes three kinds of evidence:

1. **Actual active-entry source contract.** Every approved file except index
   is frozen to d717428; no additional app/API files are allowed. The gate checks
   exact normalized index bytes, release markers, head, body, script/link order
   and inline configuration, all IDs and classes, and unchanged runtime/backend/
   auth/assets. The 20c optional-profile/photo-claims recovery stays intact.
2. **Actual active-entry composed regression.**
   `node tests/check_fidelity_active_entry.mjs` executes the existing composed
   scenario directly against `app/index.html`. It loads that entry's real BODY
   attributes before production rendering/listener installation. All original
   composed production-function execution and behavioral assertions remain
   byte-identical. The audited changes are only entry selection, actual BODY
   root mechanics, and replacing the obsolete historical index freeze with the
   stronger pinned-preview active-entry contract. Existing audited sibling
   composition adaptations remain explicit. The scenario covers real five-filter
   intersections, IDs/order/detail callbacks, navigation, Home focus/detail close,
   clear, empty lanes, stale-drag protection and unrelated-click/BODY regression.
   It uses synthetic DOM/events/API fixtures; it is not a native browser test.
3. **Separate legacy/default-preservation evidence.** The original
   `check_fidelity_integrated.py` and `check_fidelity_composed.mjs` are run
   unmodified in an isolated temporary snapshot with only index restored to
   `20c48df793c91dd303abdfb0229701b64a905914`. Every other file is the candidate's
   unchanged preview3 bytes. This runs all eight inherited suites and their
   original assertion bodies. These passes explicitly do **not** test the final
   active index. The snapshot is removed; the candidate index is never replaced.

The gate also runs the unchanged copy/progress regression, syntax-checks app/API
JavaScript and the new runner, and checks tracked diff whitespace. The exact
approved preview contains a 20-space blank at index line 417: raw `git diff
--check` exits 2 for that inherited line. The aggregate gate permits exactly that
source-proven diagnostic, checks every added file for trailing/EOF whitespace,
and rejects any other diagnostic. It does not change repository whitespace
settings or rewrite approved HTML. The backend
package has no real `npm test` suite, so this does not claim backend execution.
The audit is `tests/fixtures/tc455-active-entry-adaptations.json`; its exact bytes
and original/adapted fixture hashes are checked by the active-entry runner.
Inherited fixture output still uses the word “preview”; the enclosing output
identifies the actual entry tested and preserves the inherited assertion text.

## Before any authorized activation

- Obtain the independent live visual/interaction verdict for exact preview3:
  correct theme and release marker, recorded viewport/zoom, inspected screenshots,
  all views, account/menu and form cancel/reopen, loaded title and DevOps alignment,
  detail tabs/editor/files, filters/sorts, light/dark and responsive reflow.
- Do not infer pixel acceptance, native form validation, SSO, physical-device,
  touch or real pointer-write coverage from source/synthetic tests. TC453's
  outstanding physical-device coverage remains outstanding.
- Verify the actual remote head still matches the reviewed preview before an
  authorized activation commit. If it changed, reconcile legitimate changes and
  obtain a new review; do not force-push or silently change the pinned source.
- Keep activation in its own normal commit. Record its actual SHA and parent;
  keep a verified rollback ref. The only application diff must be index.
- After authorized publication, verify the exact commit's Azure result and
  ordinary HTTPS `/` marker, imports and representative read-only flows. Do not
  mark the task approved/completed or claim user validation from CI success.

## Rollback without discarding recovery

For a regression after an authorized activation, use a **normal revert of only
that activation commit** on the then-current main, review conflicts, preserve any
subsequent legitimate edits and deploy/verify the exact revert through the same
workflow. Never reset or force-push main. Reverting the activation restores the
previous recovered default entry while keeping the opt-in preview and its shared
runtime exactly as before activation.

The reference prior default is 20c48df793c91dd303abdfb0229701b64a905914. Its
optional-profile/photo-claims recovery is in the unchanged runtime and must be
retained. Do not revert that recovery or indiscriminately revert the entire
preview series as a substitute for reverting the separate activation.

The verified historical backup ref is
`rollback/ui-v2-before-fidelity-preview-20261007` at 20c48df, tree
`c187a315a4572a2d74a2b66322e90854947be445`. Reverify it and the current parent when
preparing any actual publication. Before this activation, the dedicated rollback ref
`rollback/ui-v2-before-fidelity-activation-20261007` was created and verified at
`d717428ecba55f7fd9752d30a13390462e725a0b`, tree
`68d2041512d9965b97fa5e9fcdd9e64330c16503`. The earlier preview backup remains
unchanged. Task approval and workflow publication are not performed by this
technical activation.
