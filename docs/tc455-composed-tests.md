# TC-455 composed preview regression gate

Run from the repository root:

```sh
node tests/check_fidelity_composed.mjs
```

Baseline: `20c48df793c91dd303abdfb0229701b64a905914`.

## Result

All eight suites pass against the merged preview. The runner is read-only apart from Node's process execution; it does not start a browser, a server, or live API requests.

1. Reviewed shell/card/filter/empty-lane/drag fixture, unchanged.
2. Reviewed Home/List/Archive/People behavior, including default-rendered HTML equality against baseline and all 480 existing List filter/sort combinations.
3. Reviewed modal adapter behavior and strict numeric/string task-ID separation, unchanged.
4. Reviewed preview create/edit/cancel/AI/progress handlers, unchanged. Its underlying baseline task-flow fixture is also byte-frozen.
5. Original startup success/error/session/role recovery scenarios, unchanged.
6. Original 15 profile/photo recovery scenarios, unchanged.
7. Original detail-close/Home-focus/controller scenarios, unchanged.
8. A genuinely composed flow using the actual merged preview body and one synthetic DOM/state context. Actual project/responsible/search handlers and priority/status controls feed the real secondary List; every predicate independently changes the expected result. The flow continues through actual navigation, Kanban, Home personal selection, repeated Home-focus recovery, real detail close, quick List return, clear-filter callbacks, all five empty lane nodes, and stale-drag rejection with no task/order writes.

The runner additionally freezes the default `index.html`, the full startup callback, and the profile/photo-rendering function against baseline. The original shell suite compares default card HTML; the original secondary suite compares default Home/List/Archive/People HTML.

## Auditable reuse, not weakened assertions

`tests/fixtures/tc455-composed-adaptations.json` records all seven original test SHA-256 values, exact transformations, full secondary source hashes before/after, unchanged behavioral-suffix hash, and exact startup/profile slice hashes. The runner checks this audit on every run. `tests/fixtures/tc455-secondary-composed.diff` is the matching human-readable diff.

Only these obsolete secondary-candidate sibling freezes are omitted:

- Whole-file `app/js/main.js` equality, because reviewed shell listener/drag integration now lives there.
- Whole `filterTasks` equality, because the reviewed opt-in priority/status tail now lives there.
- Whole router-to-modal equality, because reviewed shell synchronization, filter badge, and clear integration now live there.

All remaining protected-path/source assertions and every assertion from the first default-render test to the final behavioral summary remain byte-identical. The only fixture dependency addition loads the real `fidelity-v2.js` helper into the existing secondary context. The behavioral-suffix SHA-256 is `7e4c0d9a4a3920af3cf6e9fac2cf1aca6b953370986ba54457c5e6451ae2091c`.

The original secondary summary text is retained with its assertion body. Its broad legacy “protected main” label must be read together with the precise exceptions above: main.js is allowed to contain reviewed integration; its startup/profile slices remain exact. The separate integrated Python source-contract gate owns the complete merged application diff allowlist.

The new composed fixture extends the existing parser with descendant selectors, ownership, event bubbling, hidden-view blur and DOM reparenting. These are fixture mechanics. No replacement filter, task state setter, renderer, navigation callback, clear handler or drag-protection function is supplied.

## Limits

This is synthetic DOM/API regression evidence. It does not establish pixels, computed geometry, native form validity, focus traps, real pointer dragging, responsive screenshots, accessibility-tree behavior, SSO, backend behavior or functional acceptance of existing pending changes. In particular, the inherited Sem data checkbox characterization remains unchanged and does not become a functional acceptance claim. HTTPS browser review remains separate and was not attempted by this gate.
