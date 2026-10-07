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
