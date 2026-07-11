# ngx-virtual-dnd 4.0 — Architecture Review & Refactor Plan

> Outcome of a 3-architect review (Performance, DX/API, Tree-shaking/Maintainability)
> benchmarked against Angular CDK, including a cross-challenge round to resolve
> conflicts between the lenses. The user is open to breaking changes for a major
> version to make the library easier to maintain and best-in-class.

## Headline

The **engine is genuinely good** — signal-first state, `runOutsideAngular` on hot
paths, RAF coalescing, prefix-sum + binary-search dynamic heights, per-frame object
reuse in the autoscroll tick, no circular deps, `sideEffects:false`, fully standalone.
Weaknesses are concentrated and consistent across all three lenses:

1. **God-directive + root services wire the whole feature set eagerly** — importing
   the minimum drag pulls in keyboard, autoscroll, both height strategies, and the
   clone/overlay stack.
2. **`elementFromPoint`-driven hit-testing** forces synchronous layout flushes in the
   hottest loop (worse during autoscroll: scroll write → forced read → forced read).
3. **Public API leaks internals** — `unknown` everywhere, 5 overlapping "virtual"
   surfaces, stringly-typed IDs hand-synced across 3–4 call sites, internal services
   exported. The thorough README/SKILL docs largely paper over friction a refactor
   would delete.

## Debates resolved in cross-challenge

| Tension                                                                                                                           | Resolution                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DX: default to dynamic height vs Perf/Size: fixed is the cheap path                                                               | **Fixed stays the default.** Dynamic-by-default forces a ResizeObserver per row + O(N) `#offsets` rebuilds on settle = jank fixed never has. Fix the forgot-to-opt-in footgun with a **dev-mode warning when measured height diverges from declared `itemHeight`**, not by flipping the default. `itemHeight` stays required in fixed mode. |
| DX: auto-mount preview vs Size: preview must stay tree-shakeable vs Perf: clone is a drag-start cliff                             | **`provideVdndDragPreview()` provider that dynamically `import()`s the `/preview` chunk on first drag.** No static edge from the directive graph → stays out of the base bundle. Template-first, `getComputedStyle`-clone as fallback. Forgetting it → loud dev error, not a silent dead drag.                                              |
| DX: "group owns its lists" registry vs Size: no new root god-object vs Perf: I need the candidate set for cached-rect hit-testing | **One shared `VdndGroupRegistry`, provided by the `vdndGroup` _directive_ (element-injector scoped, never `providedIn:'root'`).** Stores `{id, element, dataSignal}`. DX's `transferItem()` and Perf's rect-snapshot hit-testing consume the same registry — same membership, lifecycle, invalidation. Keystone of the whole plan.          |
| Size: `provideVdndAutoScroll()` vs Perf: single always-on drag RAF scheduler                                                      | **Split them.** Every drag needs the scheduler (read→compute→write phase split); only some need autoscroll. `DragSchedulerService` is always-on core; autoscroll becomes a **pluggable tick participant** that registers into the scheduler when `provideVdndAutoScroll()` is called.                                                       |

Nuance to preserve: cached-rect hit-testing must keep a **painter's-order tie-break**
for overlapping droppables (the one thing `elementFromPoint` did for free).

## Consolidated findings

### Performance (internal / non-breaking unless noted)

- **[CRITICAL]** `elementFromPoint` per pointermove forces layout flush →
  cached-rect geometric hit-testing (CDK `DropListRef` model); snapshot droppable
  rects per drag session, re-snapshot on observed scroll/resize.
  `position-calculator.service.ts:38-66`.
- **[HIGH]** Autoscroll callback re-runs the full placeholder pipeline synchronously
  each tick; cursor hasn't moved — only `scrollTop` did → cheap scroll-only recompute
  path. `auto-scroll.service.ts:274-279`.
- **[HIGH]** `#updateViews` does O(n²) `.some()`-in-loop scans + re-queries
  `container.children` every placeholder move → boolean flag + drive placeholder from
  the reconcile pass. `virtual-for.directive.ts:537-583, 778-785`.
- **[HIGH]** `ElementCloneService` deep-walks the subtree with `getComputedStyle` +
  per-node `querySelectorAll('*')` → drag-start cliff → template-first preview,
  precompute kebab keys. `element-clone.service.ts:70-97, 174, 218`.
- **[MED]** Move `placeholderIndex`/`placeholderId`/`activeDroppableId` into their own
  high-frequency signals (like `cursorPosition` already is) so placeholder-only frames
  don't re-fire the whole computed graph. `drag-state.service.ts:177-182`.
- **[MED]** Up to 3 redundant `getBoundingClientRect` per move → read each rect once
  per frame, thread it down. `drag-index-calculator.service.ts:149/158/248`,
  `draggable.directive.ts:491/546`.
- **[LOW]** `getVisibleCount` linear scan ignores the prefix-sum array →
  binary-search end index. `height-cache.ts:172-194`.
- **Big bets:** single coordinated drag RAF scheduler; placeholder as pure
  `transform: translateY` (zero DOM mutation, GPU-composited).

### DX / API

- **[HIGH]** No end-to-end generics — `data` is `unknown` across every event/input.
  `T` realistically anchors at the **component output** (`VirtualSortableListComponent<T>`
  already infers from `[items]`, `virtual-sortable-list.component.ts:100`) and the
  **helper signatures** (`reorderItems(event, items)`), NOT the bare directive (Angular
  can't infer directive generics in templates). Removes the `as Item` cast on the common
  paths.
- **[HIGH]** 5 overlapping virtual surfaces → collapse to **2**: `<vdnd-sortable-list>`
  (90% case) + one page-scroll primitive. `VirtualSortableList` is already a thin wrapper.
- **[HIGH]** Stringly-typed IDs + group spelled 4 ways (`vdndGroup`, `group`,
  `vdndDroppableGroup`, `vdndDraggableGroup`) → shared group registry kills the
  hand-built `Record` and ~half the "Common Mistakes" table; one `group` name; rename
  class to `VdndGroupDirective`.
- **[MED]** Silent failure modes (`moveItem` typo → items vanish with only a
  `console.warn`). **[MED]** Ship `ngx-virtual-dnd/testing` harness on existing data
  attributes. **[LOW]** CSS custom-property theming layer (`--vdnd-*`); move off
  deprecated `aria-grabbed`, offer opt-in live-region announcer.
- **Footguns to unify:** collapse `itemIdFn` + `trackByFn` into one `trackBy`; support
  content projection of draggable children for the simple case.

### Tree-shaking / packaging / maintainability

- **[HIGH]** Single monolithic ~266 KB FESM bundle → secondary entry points (CDK model).
- **[HIGH]** `DraggableDirective` eagerly injects 6 services + statically builds both
  handlers (`draggable.directive.ts:76-83, 178, 200`); all 7 services `providedIn:'root'`
  → lazy-`import()` keyboard (prefetched on `focusin`/`pointerdown`, NEVER gated on the
  activating keystroke), provider-function autoscroll, lazy dynamic strategy.
- **[MED]** `VirtualForDirective` statically imports both height strategies
  (`virtual-for.directive.ts:23-24`) → lazy dynamic, replace `instanceof` with a
  discriminant.
- **[MED]** Internal services exported as public API (`index.ts:16-22`) → demote to
  internal (shrinks the semver contract and hardens tree-shaking).
- **[LOW]** `export *` on models (`index.ts:2`) → explicit named re-exports; drop
  `INITIAL_DRAG_STATE` from public surface.

## Target architecture

### Entry points (reconciled final map)

```
ngx-virtual-dnd            core: DragState, Draggable/Droppable/Group, PointerDragHandler,
                           PositionCalculator/DragIndexCalculator, DragScheduler,
                           drop-helpers, generic events, tokens
ngx-virtual-dnd/virtual    <vdnd-sortable-list> + page-scroll primitive + FixedHeightStrategy
                           + VirtualScrollStrategy iface  (DynamicHeightStrategy lazy import()ed)
ngx-virtual-dnd/keyboard   KeyboardDragHandler/Service  (prefetched, opt-in a11y)
ngx-virtual-dnd/autoscroll AutoScrollService + ScrollableDirective + provideVdndAutoScroll()
ngx-virtual-dnd/preview    DragPreview + Placeholder + OverlayContainer  (drag-start import())
ngx-virtual-dnd/testing    VdndDragHarness — framework-agnostic, no test-runner in prod deps
```

Estimated base "sortable list" footprint after split + deferrals: **~40–50%** of
today's bundle, with keyboard/dynamic/autoscroll/preview pulled only on demand.

### Ideal consumer API (CDK-parity)

```html
<vdnd-sortable-list
  [items]="items"
  [trackBy]="trackById"
  (itemDropped)="reorderItems($event, items)"
>
  <ng-template let-item>
    <div vdndDraggable>{{ item.name }}</div>
  </ng-template>
</vdnd-sortable-list>
```

`$event` is `DropEvent<Item>` — inferred, no cast. Cross-list:

```html
<div vdndGroup="board" (itemDropped)="transferItem($event)">
  <vdnd-sortable-list [items]="todo" [trackBy]="trackById"> … </vdnd-sortable-list>
  <vdnd-sortable-list [items]="done" [trackBy]="trackById"> … </vdnd-sortable-list>
</div>
```

`transferItem(e)` resolves source/dest signals from the group registry — no
hand-built `Record<string, Signal>`.

## Phased plan (single 4.0 — spend the breakage budget once)

### Phase 0 — Internal, non-breaking (ship in 3.x first; de-risks everything)

**Status: LANDED on branch `claude/phase-zero-execution` (2026-06-24), except item 3c
which was reclassified — see "Phase 0 status" below.**

1. ✅ Cached-rect geometric hit-testing → kills the CRITICAL layout-thrash. _(perf)_
2. ✅ `DragSchedulerService` with read→compute→write phase split; fold autoscroll /
   scroll-only fast path into it. _(perf)_
3. Split as landed:
   - ✅ 3a `placeholderIndex`/`placeholderId`/`activeDroppableId` → own signals.
   - ✅ 3b Remove `.some()`-in-loop scans and `container.children` re-queries.
   - ⏸️ 3c **Placeholder via `transform` (zero DOM mutation)** — DEFERRED (see below).
4. ✅ Template-first preview path + precomputed clone keys. _(perf)_

#### Phase 0 status & where to continue (zero-context handoff)

Everything in Phase 0 is done and validated (494 unit, 472 E2E all-browser, lint, build)
**except item 3c**, which was deferred for a concrete architectural reason, not omission:

- **Why 3c is bigger than its one-liner implied.** The placeholder's visual gap is
  created two different ways. In **viewport mode** (`<vdnd-virtual-viewport>` /
  `<vdnd-sortable-list>` — the 90% path) item views render in **normal document flow**
  inside `.vdnd-viewport-content` (a single wrapper `translateY`); the placeholder
  `<div>` opens its gap **by occupying flow space** (`virtual-for.directive.ts`
  `#positionPlaceholder`, `insertBefore`). Items there are deliberately _not_ individually
  positioned. So a pure-`transform`, out-of-flow placeholder **removes the gap** — to keep
  it you must instead shift the rendered items at/after the placeholder index themselves
  (the CDK `transform`-sort model). That's bounded (~15–25 rendered views, not all items)
  but it's a **rewrite of the viewport's flow-based layout**, and every
  `placeholder-behavior` / `placeholder-integrity` assertion (DOM order/position) must be
  re-validated. High risk relative to the rest of Phase 0.
- **Why deferring is safe.** The cheap wins 3c was bundled with (3a/3b) already landed.
  The current placeholder path **already avoids per-frame DOM churn** — `#positionPlaceholder`
  mutates only when the index actually changes; the O(n²) scans and `container.children`
  re-query the plan flagged are gone. The remaining win from "pure transform" is
  compositor-only (no layout on placeholder _move_), not eliminating per-frame work that
  still exists. It is a genuine "big bet," not a hot-path fix.
- **Where 3c goes now.** Reclassified as a **standalone internal/non-breaking follow-up**
  that can ship in any 3.x release independent of the 4.0 sequence (it does NOT depend on
  the Phase 1 group registry). Treat it as its own PR. Starting point: convert viewport-mode
  item layout from flow to a transform-shift of the rendered window; make the placeholder a
  persistent element positioned by `transform: translateY`; re-validate all placeholder E2E
  suites. Begin with failing E2E that asserts no DOM insert/remove of the placeholder across
  a placeholder move (TDD).

### Phase 1 — Foundation for 4.0 (mostly internal)

5. ✅ `VdndGroupRegistry` (directive-scoped, stores `{id, element, data}`); rewire
   hit-testing to consume it. _(shared — perf + DX, keystone)_ **LANDED** — see below.
6. Lazy boundaries: dynamic strategy `import()` at config time; keyboard chunk
   prefetched on `focusin`/`pointerdown`; `provideVdndAutoScroll()` registering into the
   scheduler. _(size)_ Split as landed:
   - ✅ 6a **Dynamic-height strategy lazy `import()` + strategy discriminant.** — LANDED.
   - ✅ 6b **Keyboard handler lazy chunk, prefetched on `focusin`/`pointerdown`.** — LANDED
     (with a known intermittent test flake to revisit — see below).
   - ✅ 6c **`provideVdndAutoScroll()` — autoscroll opt-in provider.** — LANDED (BREAKING).
     All three on branch `claude/v4-migration-next-stage-nj0q4r`. See handoffs below.

#### Phase 1 status & where to continue (zero-context handoff)

Item 5 (the keystone) is **done and validated** on branch
`claude/major-refactoring-next-k0jigw`. Item 6 is the remaining Phase 1 work.

**What landed for item 5 (non-breaking, additive):**

> ⚠️ **Design correction from PR review** (supersedes the plan's "directive-scoped,
> element-injector, never `providedIn:'root'`" cross-challenge resolution). Making the
> `vdndGroup` **element instance** the registry identity was wrong: it (a) let a droppable
> with an explicit `vdndDroppableGroup` different from its wrapper leak into the wrapper's
> candidate set, and (b) silently split two same-named `vdndGroup` wrappers that the old
> `data-droppable-group` DOM query connected. **The identity of a connection set is the
> resolved group _name_, independent of DOM layout** — matching the pre-registry semantics
> and CDK's connected-lists model. The registry is therefore keyed by name at the root.
> The "no root god-object" concern does not apply: this is a passive name→members lookup
> (like CDK's `DragDropRegistry`), with no eager feature wiring.

- **`VdndGroupRegistry`** (`lib/services/vdnd-group-registry.ts`) — `providedIn:'root'`,
  storing `{id, element, data: Signal, group}` in a `Map<groupName, Map<element, member>>`.
  Keyed by **group name** (connection identity) then by **element** (so an unregister only
  ever removes the caller's own entry — an ID reassigned to another droppable can't delete
  the wrong member). Exposes `register`/`unregister(group, element)`/`getMember(group,id)`/
  `size(group)`/`getMembersInDocumentOrder(group)`. Document-order sort
  (`compareDocumentPosition`) reproduces the painter's-order tie-break `querySelectorAll`
  gave for free.
- **`DroppableDirective`** injects the root registry and keeps its membership in sync via an
  effect keyed on `effectiveGroup()` (+ id/data); re-keys on group change; unregisters in
  `ngOnDestroy` by group+element. Both wrapped (`vdndGroup`) and explicit
  (`vdndDroppableGroup`) droppables register uniformly.
- **`PositionCalculatorService`** injects the registry and, in `beginDragSession(group)`,
  snapshots candidates from `getMembersInDocumentOrder(group)` — filtered by name.
  **Fallback preserved**: if nothing is registered under the name (droppables not yet
  initialised / SSR), it uses the original `data-droppable-group` DOM query.
- **`DroppableGroupDirective`** is unchanged except it no longer provides the registry — it
  remains pure name-inheritance sugar via `VDND_GROUP_TOKEN`.

Three PR-review findings drove this and are all now covered by unit tests: explicit-group
isolation, same-name-wrapper merging, and ownership-safe unregister under a one-pass ID swap.

**Deliberately left for later (do NOT treat as missed):**

- Registry stays **internal** (not exported from `public-api`/`index.ts`) — demotion of
  internals and the public surface is Phase 2 item 7.
- `transferItem()` and generic `data` typing (the DX consumers of the registry's `data`
  signal) are Phase 2 items 8–9. The `data` signal is stored now as foundation.
- `findAdjacentDroppable`/`getDroppableParent` (keyboard, non-hot-path) still use DOM
  queries — intentionally not migrated; they can move to the registry opportunistically.

**Validation:** 518 unit tests pass (8 registry specs incl. the three review scenarios).
E2E: 97 chromium tests across every registry-touched path pass (drag-drop, drop-accuracy,
placeholder-behavior/integrity, constrain-to-container, keyboard-navigation, keyboard-drag,
empty-list, disabled-elements).
NOTE: the pinned Playwright (1.61.1) expects Chromium build 1228 but this environment ships
1194; a version-mismatch flake in `dynamic-height.spec.ts` (drag-preview visibility) fails
identically on **clean master**, so it is environmental, not a regression. Full all-browser
(webkit/firefox) run was not possible for the same reason.

**Where item 6 goes next:** dynamic-height strategy `import()`ed at config time (replace the
static import + `instanceof` with a discriminant); keyboard handler/service split into a
chunk prefetched on `focusin`/`pointerdown` (NEVER gated on the activating keystroke —
a11y); `provideVdndAutoScroll()` that registers the autoscroll participant into the
scheduler instead of the always-injected `AutoScrollService`. This overlaps the Phase 2
entry-point split (item 7) and carries real bundling risk, so it is its own stage.

#### Item 6a status & where to continue (zero-context handoff)

The dynamic-height strategy sub-part is **done and validated** on branch
`claude/v4-migration-next-stage-nj0q4r`.

**What landed (non-breaking, additive; runtime seamless):**

- **Strategy discriminant.** `VirtualScrollStrategy` gained `readonly measuresHeight: boolean`
  (`false` fixed / `true` dynamic). This replaces the `instanceof DynamicHeightStrategy` check
  in `virtual-for.directive.ts` so the concrete dynamic class no longer has to be statically
  imported just for a type test.
- **Lazy loader** (`lib/utils/height-strategy-loader.ts`). `createHeightStrategy(height, dynamic)`
  resolves fixed height synchronously; for dynamic height it `import()`s the
  dynamic-height chunk (module-level, fetched at most once across all lists) and stands in with a
  `FixedHeightStrategy` seeded with the same estimate until the chunk resolves — behaviourally
  identical to a freshly-constructed dynamic strategy with no measurements yet, so the swap is
  invisible. A module-level `dynamicReady` signal, read inside each caller's `computed`, drives
  the upgrade re-run.
- **All four construction sites** (`virtual-for.directive.ts`,
  `virtual-viewport.component.ts`, `virtual-content.component.ts`,
  `virtual-scroll-container.component.ts`) now call `createHeightStrategy(...)` and no longer
  statically import `DynamicHeightStrategy`.
- **ResizeObserver setup** in `virtual-for.directive.ts` moved from a one-time `ngOnInit`
  `instanceof` check to a reactive effect keyed on `dynamicItemHeight() || strategy.measuresHeight`,
  registered before the view-update effect, so it wires up correctly once a dynamic strategy is
  inherited/loaded.

**Measured bundling reality (important for item 7):** ng-packagr flattens the single public
entry point into one FESM, and because `DynamicHeightStrategy` is still a **public export**
(`lib/index.ts`), rollup inlines the `import()` (`Promise.resolve().then(() => dynamicHeight_strategy)`)
back into the main chunk — so **no bundle split is realized yet**. The realized size win lands
when Phase 2 item 7 relocates `DynamicHeightStrategy` to a secondary entry point / drops it from
the core public surface; at that point the `import()` is the only reference and the split
materializes with no further code change. 6a is the non-breaking runtime + discriminant foundation
that makes item 7 mechanical.

**Validation:** 522 unit tests pass (incl. 4 new `height-strategy-loader.spec.ts`). Chromium E2E:
dynamic-height (13/14), placeholder-behavior (3/3), drag-drop / drop-accuracy /
placeholder-integrity / container-resize / constrain-to-container / empty-list (42/42). The single
dynamic-height failure (`:215`, drag-preview visibility) fails **identically on clean `v4`** — it is
the environmental Playwright/Chromium version mismatch (env ships Chromium 1194; the pinned
Playwright expects 1228), not a regression. webkit/firefox unavailable for the same reason.

#### Item 6c status — autoscroll opt-in provider (BREAKING)

- **`AutoScrollService`** dropped `providedIn: 'root'` → plain `@Injectable()`. New
  **`provideVdndAutoScroll()`** (`lib/providers/auto-scroll.provider.ts`, exported from
  `public-api`) provides it via `makeEnvironmentProviders`. All five injection sites
  (`DraggableDirective`, `DroppableDirective`, `ScrollableDirective`, `VirtualViewportComponent`,
  `VirtualScrollContainerComponent`) now `inject(AutoScrollService, { optional: true })` and guard
  on `null`. `createAutoScrollRegistration` takes a nullable service and no-ops when absent, with a
  one-time dev-mode "you forgot `provideVdndAutoScroll()`" warning when a container has autoscroll
  enabled but no provider.
- **BREAKING for consumers:** autoscroll is now off unless `provideVdndAutoScroll()` is added. The
  demo app-config adds it; README + SKILL + api-reference updated. Because `AutoScrollService`
  remains a public export, no bundle removal is realized until item 7 demotes internals — but the
  service now genuinely drops out of the injector graph when the provider is absent.

#### Item 6b status — lazy keyboard handler (with a KNOWN ISSUE to revisit)

- **`DraggableDirective`** no longer statically imports `KeyboardDragHandler` or constructs it in
  `ngOnInit`. `#loadKeyboardHandler()` lazy-`import()`s and builds it once; prefetched (fire-and-
  forget) on `focusin` (new host binding) and inside `onPointerDown` — **never gated on the
  activating keystroke** (a11y). `KeyboardDragService` stays eagerly injected (small; public export).
- **Cold-load robustness:** if a key beats the prefetch, `onKeyboardActivate` marks
  `#keyboardActivationPending` and buffers subsequent keyboard-drag keys
  (`#bufferedKeyboardKeys`), replaying them via `handler.handleKey()` once the chunk activates. This
  was required — without it, a fast/first-ever Space→Arrow→Escape sequence stranded the drag and
  broke focus restoration (caught by `keyboard-drag-a11y.spec.ts:100`). `onEscape` now takes
  `$event` so a pending-window cancel is buffered too.
- **⚠️ KNOWN ISSUE (revisit):** `keyboard-drag-virtual.spec.ts:82` ("complete drag after navigating
  through virtual scroll boundary") is **intermittently flaky** on this branch (~3 failures across
  ~24 single-worker runs; **stable on baseline**). The async-activation microtask delay appears to
  occasionally desync the rapid 15-arrow virtual-scroll navigation so the item nets no move. CI
  (`retries: 2`) masks it. The focus-restoration races are fully fixed; this completion flake is
  not. **6b delivers no bundle win yet** (handler chunk inlined in the single-entry FESM until item
  7), so the cleanest resolution is to revalidate/harden 6b when item 7 lands the entry-point split
  — or revert to eager keyboard if the flake proves load-bearing. Shipped now per explicit request,
  documented here to revisit.

**Validation (6b + 6c):** 524 unit tests pass (incl. `auto-scroll.provider.spec.ts`). Chromium
E2E: auto-scroll (4/4), autoscroll-drift (12/12), keyboard-navigation (11/11), full keyboard-drag
suite (44/44 across runs; the `:82` virtual-scroll flake is intermittent, see above). Core pointer
drag re-verified. Environmental `:215` drag-preview mismatch unchanged.

### Phase 2 — 4.0 breaking surface

7. Secondary entry points; stop exporting internal services; explicit named re-exports
   (drop `export *` on models). _(size)_
8. Generic event chain (`DropEvent<T>` + generic component outputs + helper
   signatures). _(DX)_
9. Collapse 5 virtual surfaces → 2; unify `group` naming; collapse `trackBy`/`itemIdFn`
   duplication. _(DX)_
10. `provideVdndDragPreview()` (lazy, loud-error floor); divergence dev-warning for
    fixed-height. _(DX + perf)_

### Phase 3 — DX polish

11. `ngx-virtual-dnd/testing` harness; CSS custom-property theming; live-region
    announcer + drop deprecated ARIA.

**Sequencing rationale:** Phase 0 is pure perf with zero API change — land it now.
Phases 2–3 are the breaking changes; batch them into one 4.0 so consumers migrate once.
The group registry (Phase 1) is the keystone — both the DX ergonomics and the perf
hit-testing depend on it, so it lands before either consumes it.

## Top risks

- Cached-rect hit-testing must preserve painter's-order tie-break for overlapping
  droppables (the one thing `elementFromPoint` did for free).
- Keyboard lazy-load must never gate on the activating keystroke (a11y silent-failure);
  prefetch on `focusin`/`pointerdown`.
- The scheduler must stay in core, separate from the optional autoscroll provider.
- `ngx-virtual-dnd/testing` must not pull a test runner into production peer deps —
  framework-agnostic harness contracts only, runner bindings as the consumer's import.

## What's already good (preserve)

- Split `cursorPosition` signal; reused per-frame objects in autoscroll/position calc;
  `runOutsideAngular` on all hot listeners + RAF; stationary-cursor short-circuit.
- Prefix-sum + binary-search dynamic height with key-based `HeightCache`; lazy rebuild.
- View recycling pool with trim cap; WeakMap for observed elements.
- Data-attribute identification (`data-draggable-id`, `data-droppable-id`) — the right
  foundation, and exactly what makes the proposed testing harness cheap to build.
- Immutability story (`moveItem`/`applyMove`/`isNoOpDrop`/`insertAt`/`removeAt`);
  `DragStateService` as a read-only signal projection; strong keyboard + auto-ARIA model.
- Unusually thorough README + SKILL + api-reference docs.
