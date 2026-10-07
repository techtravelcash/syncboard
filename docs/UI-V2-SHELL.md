# TC-445 / Fluxo v2 access and navigation

## Gate and requested adjustment

The TC-444 pilot was verified live in Publicação, marked “Homologado por Elmo”. Elmo Fagundes Nunes requested the usable interface with red buttons for destructive actions and blue buttons for ordinary confirmations. This stage follows that distinction by explicit action intent; it does not globally recolor buttons or infer meaning from text.

## Stage A: isolated same-environment preview

`/ui-v2-shell-preview.html` is an explicitly labelled navigation preview. It loads no task data or APIs, changes no stored preference and performs no logout. Profile/admin controls only demonstrate the layout; they do not grant roles. The real application remains unchanged during this stage.

The shared shell provides a visible navy navigation rail, active-view state, New Task placement, profile/tools, filter/sort entry points and a compact drawer below 768 CSS pixels. Mobile drawer controls use native buttons, Escape, close/focus return, Tab containment, inert background and no scroll locks that can survive dismissal. Desktop panels close on Escape/outside interaction. Existing view IDs and `data-view` names are retained for integration.

The previous component pilot now distinguishes blue ordinary confirmation from an explicitly labelled red destructive example. Both examples remain local-only. No production task is created or deleted.

Baseline for TC-445: `ffb117cf04b3df386001f20a0c02a2ff3ecbba26`. Verified backup branch: `rollback/ui-v2-shell-baseline-20261007` at that exact commit. Original pre-v2 baseline remains `92159b05e81ad9ef6841e2a8efd0d9462e9f6da0` on `rollback/ui-v2-baseline-20261006`.

## Stage B: real integration, after preview QA

Integrate the approved shell into `index.html`, update `login.html` and present startup/loading/session/failure states without changing the backend, route config, role requirements, login/logout targets or task payloads. Existing five destructive shared-modal call sites must explicitly keep danger intent; ordinary confirmation defaults to blue.

Filters and sorting keep their current values, identities and callbacks. Full filter/list redesign remains TC-448. Task views and task data remain their own later stages. A preview cannot prove the real renderer interaction, so integration requires a separate exact-commit live regression check.

## Validation boundaries

`python tests/check_shell_v2.py` covers the preview's isolation, assets, IDs, control relationships, default-hidden administrator entry, explicit modal intents and JS syntax. `python tests/check_ui_v2.py` remains the foundation asset/contract gate at this stage.

Pre-deploy headless rendering remains unavailable because the local OS denies Chromium socket creation; the cloud browser does not accept file URLs. No bypass was attempted. Review deployed HTTPS renders before activating the shell in the actual application.

Live preview checks: desktop and available browser-zoom reflow; drawer open/close/Escape/Tab focus; repeated view switching; account menu and theme; labelled non-mutating action feedback; ordinary-blue versus destructive-red confirmation; no route/API/storage writes. Browser zoom is reflow coverage, not physical mobile/touch coverage.

Publish each stage as one atomic commit with a fresh expected-head lease. Verify that exact commit's Azure CI run and live marker. Roll back via a new inverse/revert commit, never by force-resetting main. Task status must reflect real execution; owner-appointed human validation remains required before later gates are considered satisfied.


## Reviewed preview revisions and integration candidate

- Preview 1: `1975e137ebd9d91617a1b0225d3b6801a86a6436`, Azure run `37550209346` succeeded. Live navigation/menu/focus and explicit confirmation colors passed. Browser-zoom reflow found a vertical header overlap; no task data was involved.
- Preview 2 correction: `3e1a038c5fa354490557e2b895fccff34be5eabc` changes only shared shell CSS and preview marker. Main is explicitly fixed beneath the header, and filter normal/hover/selected colors are scoped to readable pairs. This is the pre-activation rollback target.
- Integration marker: `tc445-shell-1`. The integration tree must use the preview-2 commit as its parent/base, retaining the tested correction.

Integration validation commands:

```
python tests/check_shell_integration.py
node tests/check_startup_v2.mjs
python tests/check_shell_v2.py --isolation-only
python tests/check_ui_v2.py --foundation-only
git diff --check
```

The historical full preview/foundation checks intentionally enforce their former unchanged-application boundaries; use the indicated focused modes after activating later authorized UI slices. The integration check now owns the application contracts: 63 protected API/workflow/route/state/realtime/CSS files, all 113 original IDs, every task/modal field/data contract, all original API call and payload lines, existing task/filter/theme handlers, role checks, exact login/logout targets, and all five explicit destructive callers. It also calculates new filter text pairs and parses all scripts. These are static checks, not a claim of full runtime coverage.

Existing SSO remains unchanged. A missing session, access denial or startup error is presented as a clearly labelled loading-area state with retry/access links instead of an unlabeled alert or empty view. The application chrome remains inert while the loading/error area is active; retry and access links remain available outside it. No role, endpoint, payload, token, permission or storage schema is added.

The visible navigation consumes the same five view values and role-controlled user button. Header filter/sort panels preserve the original renderers and callbacks; keyboard activation restores focus to the matching replaced option. New Task and Notifications close shell panels before the original modal action. Common confirmation intent is explicit: the named destructive wrapper retains red for all task/comment/access-removal callers; ordinary confirmation, recipient signaling and homologator selection are blue. Status-specific workflow buttons are not globally recolored.

The login theme preference keeps the existing light/dark/system-default behavior. Its icon is resolved anew after rendering so repeated theme changes do not update a stale SVG reference. App theme preference retains its current default and storage key.

At delivery, record the exact integration commit and its successful deploy, the live marker and available browser QA, limitations, and Elmo’s pending human validation. Never mark the task approved or completed automatically.

The startup regression test runs the real bootstrap callback in isolated DOM/API mocks. It covers success, late listener failure, late alert failure, shell failure, missing session and denied role. Loader dismissal occurs only after all synchronous setup succeeds, so a scheduled fade cannot hide a later retry/error card. This mock coverage does not replace browser/network/SSO tests.
