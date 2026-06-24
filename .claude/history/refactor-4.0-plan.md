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

5. `VdndGroupRegistry` (directive-scoped, stores `{id, element, dataSignal}`); rewire
   hit-testing to consume it. _(shared — perf + DX, keystone)_
6. Lazy boundaries: dynamic strategy `import()` at config time; keyboard chunk
   prefetched on `focusin`/`pointerdown`; `provideVdndAutoScroll()` registering into the
   scheduler. _(size)_

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
