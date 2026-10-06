# Fluxo v2 / TC-444 component pilot

## Scope

This first slice implements the TC-444 (UI-V2-01) foundation. The review page is `/ui-v2.html`. It is an explicitly labelled component demonstration, not production task data, and makes no API requests or task writes. The page inherits the existing Static Web Apps catch-all role requirement; authentication/routing is unchanged.

On the workboard, only the title, favicon, header cube/name and loading mark/message are integrated. `fluxo-v2.css` contains opt-in `sb-*` primitives with `.sb-scope` behavior. Legacy views, controls, layouts, JS handlers, role visibility, API calls, project colors and workflows are unchanged. Login and navigation are part of TC-445 after human validation of the pilot.

The component review covers buttons, text fields, textarea, select, chips, status badges, avatar fallback, card/panel, modal, toast, empty/loading/error/disabled states. The demo theme toggle does not persist a preference or alter the workboard theme. Dark compatibility colors require human validation. The primary palette remains the approved v2.

## Approved assets and type

Source: `SyncboardNT-Kit-Visual-TC443-v2.zip`, SHA-256 `15de4adc74dadb15730b5b1bec2eb1daecfb9aa11f7a2ab49a9cd713814b9a72`. Each imported byte-for-byte original asset is listed in `app/assets/brand-v2/manifest.json`. The original kit README and tokens are retained there.

No v3 marks, Space Mono, Caveat or Hello Baby are used. The approved outlined wordmark (Liberation Sans Bold plus custom NT) is not redrawn or recased. Textual labels use “SyncBoard NT”. Interface type reuses the exact Plus Jakarta Sans Google Fonts source already in the application; system-ui is the fallback. No new font provider or font binary is introduced.

The full cube is used at 32 px and larger; the simplified cube at 16/24 px; signatures at 176 px and larger. The original SVG geometry is preserved. No project color is remapped to brand colors.

## Legacy-to-v2 mapping for later slices

| Current presentation | Opt-in v2 replacement | Boundary |
| --- | --- | --- |
| Slate/blue brand values and hard-coded styles | `--sb-*` semantic tokens | Do not replace user `projectColor` data |
| Mixed Tailwind button classes | `.sb-button` and secondary/accent/danger variants | Retain original button IDs, type, handlers and permissions |
| `.glass-input` and inline field utilities | `.sb-field`, `.sb-label`, `.sb-input`, `.sb-select`, `.sb-textarea` | Keep names, values, required state, payloads |
| Project/responsible filter chips | `.sb-chip` with visible `aria-pressed` | Keep filter identity and selection logic |
| Status-specific utilities | `.sb-badge[data-status]` | Preserve todo/stopped/inprogress/homologation/publication/done meaning |
| Rounded/glass card and panel styles | `.sb-card`, `.sb-panel` | Keep task IDs, project strips and data |
| Avatar fallback | `.sb-avatar` | Display source initials; no identity inference |
| Modal surface and toast style | `.sb-modal`, `.sb-toast` | Existing modal functionality migrated in later tasks |
| Empty/loading/failure copy | `.sb-empty`, `.sb-notice`, `.sb-spinner` | Never equate known errors with empty results |

The gallery uses native `dialog` for isolated keyboard/focus review; the existing application modals are not replaced in this slice.

## Validation

Run `python tests/check_ui_v2.py` from a complete repository checkout with Node.js available. It verifies original frontend JS, API, workflow, routing, CSS and login byte identity; existing element and field/data contracts; local asset links; v2 hashes; status/text contrast; script isolation; and frontend JS syntax. This is a focused pilot gate, not a full end-to-end or security test suite. The repository's existing API test script only prints “No tests yet...”.

Browser review must cover 320, 375, 768, 1024 and 1440 px; light/dark; keyboard focus and repeated modal open/cancel/Escape/confirm; toast and chips; long accented text; font/fallback; reduced motion; 200% zoom. Do not execute mutation tests against live tasks. Record passed/failed/blocked/not-run separately. Do not declare conformance or full regression coverage from static checks.

Static checks passed for the candidate: 66 protected files unchanged, 113 original IDs/contracts preserved, 15 asset hashes matched, six status text/background pairs at 5.79–6.36:1, and all frontend JavaScript parsed successfully.

Local headless Chromium launch was attempted with installed Python Playwright and `/usr/bin/chromium`, both default and permitted elevated shell. The OS prevented a socket used during launch. This is a render-verification limit until a supported browser review succeeds; no screenshot or render pass is implied by the static checks.

## Single-environment release and rollback

Baseline: `92159b05e81ad9ef6841e2a8efd0d9462e9f6da0`.
Verified remote backup: `rollback/ui-v2-baseline-20261006` at that exact SHA.
Baseline CI: https://github.com/techtravelcash/syncboard/actions/runs/23745810207 (success).

The unchanged `.github/workflows/azure-static-web-apps-purple-forest-04967e110.yml` deploys `app` and `api` on push to `main`. Do not change deployment credentials, infrastructure or workflow in this visual slice.

Release procedure:
1. Finish independent review and run the focused checks against the final candidate.
2. Inspect current `main` immediately before writing. If it moved from the reviewed parent, stop and reconcile; never overwrite a concurrent commit.
3. Create one atomic Git tree and commit based on the verified parent. Move `main` via fast-forward with `expected_sha` equal to that parent; never force-push. Do not publish individual file commits that deploy incomplete asset sets.
4. Verify remote `main` equals the candidate. Read GitHub Actions runs filtered by that exact `head_sha` (the pull-request-only wrapper is not sufficient for push runs). Wait for terminal deploy status.
5. Verify `/ui-v2.html` and the workboard in the existing cloud browser. The visible review marker is `tc444-v2-pilot-2`; index meta `syncboard-ui-release` carries the same marker. Reload and confirm the marker before QA. Existing global `Cache-Control: no-cache` remains unchanged.
6. On confirmed render/functional regression introduced by this slice, roll back with a new revert commit based on current `main`, retaining subsequent unrelated changes. For an unchanged candidate head use `git revert <pilot-commit>` and push normally, or create an equivalent inverse tree commit through the authorized connector. Use the same expected-head lease, verify its deploy, and repeat read-only QA. The baseline branch is a reference, not a force-reset target.
7. Do not assume a redeploy repairs data; this slice has no schema/data migration or task writes. If a deployment fails before replacing the prior release, inspect the run rather than claiming it rolled back.

Once online and verified, TC-444 goes to Homologação for owner/Felipe validation. Do not move it to Publicação or conclude it on their behalf. TC-445–453 stay in Fila until the explicit pilot gate is satisfied. This release does not assert delivery of the separate PF backend work.
