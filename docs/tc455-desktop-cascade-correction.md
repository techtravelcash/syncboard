# TC455 desktop cascade correction

## Scope and status

This is a narrow presentation correction based on the actual cascade of the
accepted V2 executable, commit `e329c93a8d4dfd043c4f1fe7e06b3949426ea359`, rather
than an inference from the prototype's nominal class tokens. Its starting live
source is `a965230833cde7882e42a30443f4c37f21aeeb1b`. This document and its
technical gate do not publish, approve, or complete TC455. Human validation
remains separate from a passing source/synthetic test or deployment result.

Only four existing files may change:

- `app/css/fidelity-v2.css`: scoped reference cascade/typography, controls,
  lane colors, and explicitly audited breakpoint details.
- `app/css/fidelity-secondary-v2.css`: explicit list line-height inheritance
  and removal of the non-reference 140px progress-bar cap.
- `app/index.html`: exactly 16 `tc455-fidelity-1` to `tc455-fidelity-2`
  release/cache literal substitutions.
- `app/ui-v2-fidelity-preview.html`: exactly 16
  `tc455-fidelity-preview-3` to `tc455-fidelity-preview-4` substitutions.

The complete CSS literal map, expected occurrence counts, old/new SHA-256
values, and active-runner guard adaptations are recorded in
`tests/fixtures/tc455-desktop-cascade-changes.json`. The gate reconstructs each
complete permitted file from a965 and rejects any other byte change. Every
other pre-existing file, including all tests and audits, is frozen to a965.

JavaScript, API/backend, authentication, profile/photo-claims recovery,
configuration, login, brand assets, state transitions, task IDs, real data,
callbacks, and payloads remain byte-identical. Creation/attachment metadata,
responsible names, homologator annotations, the seventh list action column,
and the card action disclosure remain available. Those real-app features can
produce legitimate visual differences from the simpler six-column prototype;
this correction does not hide them or claim that their geometry is identical.

## Why the actual cascade matters

The approved executable places the eyebrow paragraph beneath `.page-title`.
The higher-specificity `.page-title p` rule wins over `.eyebrow`: the rendered
reference is 14px, line-height 1.5, and margin `10px 0 0`, with the eyebrow's
letter spacing and weight retained. Merely copying the nominal 12px eyebrow
class would reproduce the wrong cascade. Its narrow paragraph rule is 13px.

The application's older body primitive contributes a 1.6 line-height and
older board styles contribute additional 1.5 line-height rules. The reference
inherits `normal` in several corresponding boxes. The correction is confined
to the fidelity presentation and explicit affected selectors; it does not
rewrite shared primitives. A fidelity-body inheritance change can still affect
nested menus and forms, so native light/dark, open/close, and reflow checks are
required. Explicit form, title, subtitle, note, and detail rules stay intact.

The reference controls use a zero flex basis for search, select max-width
160px and horizontal padding 11px, a search icon at top 11px, and reference
input/view-switch spacing. These are concrete small control differences. They
are not proof of a drastic wide-desktop wrapping defect. Lane colors are
`#68788F`, `#AA6919`, `#365DCB`, `#8951AF`, and `#327B64` in existing status
order. List progress uses the available cell rather than stopping at 140px.

The five-column desktop board was already fluid at a965: a 212px sidebar,
34px horizontal gutters, five `minmax(214px, 1fr)` tracks, and 14px gaps;
from 1650px, 46px gutters and 20px gaps. The wide grid is preserved. The actual
application loads both fidelity CSS files after the older shell/board/list
styles. The task-detail fidelity stylesheet follows them and does not replace
these shell/control/board rules. Scoped selector precedence, source order,
and the reference's real element ancestry matter more than isolated tokens.

At 1440, 1920, and 2560 CSS-pixel viewport widths, expected board widths before
subtracting the main-scrollbar allocation are 1160, 1616, and 2256px. Expected
lane widths are respectively 220.8, 307.2, and 435.2px, minus one fifth of that
scrollbar allocation. The application's main scrollbar and the prototype's
outer-page scrollbar may consume different widths; measure each separately.
Exclude the prototype-only review ribbon from content-origin comparison.

## Reproducible gate and evidence boundaries

With Node, Python, and `lxml` available, run from the checkout:

```sh
python tests/check_fidelity_desktop_cascade.py
```

The gate separates current evidence from historical evidence:

1. **Current candidate source protection.** Freeze all a965 files except the
   four enumerated files, reject unexpected additions, replay the exact hashed
   CSS/literal map, and prove complete HTML equality after marker normalization.
   Check head/body/imports, all IDs/classes, and actual stylesheet ordering.
   A normalized current index is also byte-identical to the current preview.
2. **Current actual-entry behavioral regression.** The new
   `check_fidelity_desktop_active_entry.mjs` runs an explicitly audited in-memory
   adaptation of the original `check_fidelity_active_entry.mjs`. The older
   runtime freeze is replaced for exactly the four already reconstructed files;
   only the release-marker guard, corresponding pre-behavior BODY assertion,
   and wrapper URL bindings for in-memory execution adapt. Existing entry selection remains `app/index.html`, with real BODY
   attributes loaded from that entry. The original fixture-adaptation audit
   remains intact. The original composed production-function execution and
   complete behavioral assertion body remain byte-identical and hash-checked.
   Five-filter intersection, IDs/order/detail callbacks, navigation, Home
   focus/close, clear, empty lanes, stale-drag prevention, and unrelated-click
   regression are exercised in synthetic fixtures.
3. **Current unchanged copy/progress regression.** Run the original
   `check_fidelity_copy.mjs` directly, with all its CSS assertions unchanged.
   It also executes original real-function card/filter/drag fixtures. Absent
   progress remains truthful, and known zero/other values retain their action.
4. **Historical evidence only.** The original
   `check_fidelity_activation.py` freezes old preview3 CSS/markers by design.
   Run it unmodified only in a temporary a965 snapshot, with all four changed
   files restored to a965 and every other original file identical. A separate
   `GIT_INDEX_FILE`, populated by `git read-tree a965230`, prevents newly staged
   test files from leaking into legacy exact-file assertions. Its nested
   legacy-index snapshots and eight-suite composed pass are also historical.
   None of these historical passes tests corrected CSS or the marker2 entry.
   The candidate files and real index are never replaced.

The gate also syntax-checks application/API JavaScript and the new runner.
There is no new whitespace diagnostic against a965. Against d717, the sole
allowed diagnostic remains the precisely inherited `app/index.html:417` blank
containing exactly 20 spaces; its source bytes are checked. Any additional
diagnostic fails. All new files also receive independent trailing/EOF whitespace
checks. No original test assertion is weakened or silently rewritten. The API
package does not provide a meaningful backend execution suite; syntax/source
protection does not imply backend integration execution.

## Browser review still required

Available cloud-browser width was limited to 1364 CSS pixels. The recorded
live native-browser comparison was 1180px at 100% zoom. Neither establishes
1440/1920/2560 desktop fidelity. A large screenshot bitmap, reduced browser
zoom, or calculated width does not substitute for the actual CSS viewport.
This change makes no high-resolution or 100%-visual-fidelity claim.

An attempted isolated native Chromium fixture capture was blocked by the
execution environment's socket restriction, including one approved elevated
retry. No native 1440/1920/2560 fixture images were generated. On the available
single-environment route, the authorized order is a source-reviewed atomic
rollout, immediate live native-browser review at the available viewport in
light/dark themes, and an authorized atomic rollback if a regression requires
it. This is a rollout with visual review pending, not a prior visual pass.

After exact-commit deployment verification, immediately review the live result
at the currently available viewport, with fonts loaded and zoom/viewport
recorded:

- Board/filter rows, lane colors, counts, search/select alignment and overflow.
- List filters, responsible/reviewer/creation metadata, actions, progress bars,
  long content, empty and filtered results.
- Reflow at the supported breakpoints, including the narrow eyebrow/board rules.
- Account/menu, create/edit form cancel/reopen, loaded title/DevOps alignment,
  detail tabs/editor/files, and Home/archive/people inheritance regressions.
- Read-only interactions and repeated navigation/close/reopen behavior; source
  tests do not replace native form, pointer, SSO, touch, or device validation.

Then obtain paired, loaded-font, 100%-zoom review at **actual** 1440, 1920,
2560 CSS-pixel widths against the accepted executable. Record viewport,
`devicePixelRatio`, zoom, scrollbar widths, theme, screenshots, and computed
geometry. Compare shell, filters, board, and matched short/long-content cases;
report retained functional adaptations separately. High-resolution validation
remains open until that evidence exists. Do not mark TC455 approved/completed
or describe the interface as identical based only on this gate.

## Atomic rollout and rollback

Keep this correction in one normal, atomic commit on the verified live parent.
Before authorized publication, recheck the remote head, preserve legitimate
concurrent changes, record the reviewed commit/parent/tree and a verified
rollback reference, and obtain required independent source review. Do not force-push.
After any authorized deployment, verify Azure for that exact commit, then
ordinary HTTPS `/` and the preview path, their expected markers/cache URLs,
stylesheets, and representative read-only native-browser flows. Continue
through the immediate available-viewport light/dark and interaction review; a
source-only handoff is not completion. Record its verdict and any rollback
needed, while keeping the unperformed high-resolution review explicitly open.

If rollback is required and authorized, normally revert **only this correction
commit** on then-current main, review conflicts, preserve later legitimate
changes, and deploy/verify the exact revert. Both CSS files and both HTML
marker/cache sets must revert together. The reference rollback source is
`a965230833cde7882e42a30443f4c37f21aeeb1b`, which retains the already active
fidelity entry and profile/photo-claims recovery. Do not reset main, revert the
entire fidelity series, or remove recovery code. Technical rollout and rollback
do not grant permission to approve, publish, or complete business tasks.
