# ngx-virtual-dnd

Angular monorepo containing a drag-and-drop library optimized for virtual scrolling.

## Critical Rules

These rules prevent common mistakes that cause hard-to-debug issues:

1. **Rebuild library after edits:** After editing any file in `/projects/ngx-virtual-dnd/`, run `ng build ngx-virtual-dnd`. Without this, changes won't appear in the demo app.

2. **Never use `allowSignalWrites: true`:** This option is DEPRECATED as of Angular 19. Signal writes are allowed by default in effects.

3. **Run E2E tests before marking work done:** Use `npx playwright test --reporter=dot --max-failures=1` (all browsers, not just Chromium).

4. **Use data attributes for element identification:** `data-draggable-id`, `data-droppable-id` - not CSS selectors.

5. **Never throw errors in drag/drop operations:** Use early returns and graceful degradation instead.

6. **TDD for every bug fix — no exceptions:** Every bug fix MUST have a test, and the test MUST be written before the fix. The workflow is: (1) Write a failing test that reproduces the bug, (2) Run it — confirm it fails (this proves the bug exists and the test is valid), (3) Implement the fix, (4) Run it again — confirm it passes. Do not write the fix first and the test second. Do not skip step 2. This applies to all bug fixes regardless of scope.

7. **Run ESLint on changed files:** Before considering a task done, run `npm run lint` or `npx eslint --flag v10_config_lookup_from_file <changed-files>` to catch formatting and style issues.

8. **Test fails = you broke it:** If a test fails after your changes, you broke it. Fix it. Do not check main. Do not claim "pre-existing." Do not claim "flaky." Do not claim "unrelated to my changes." Fix it.

9. **Keep this file in sync:** If you add/remove/rename a service, directive, component, data attribute, public API export, or E2E test file, update the corresponding table in this file in the same commit.

## Version Requirements

- **Angular:** 21.0.0+
- **TypeScript:** 5.9+
- **Node:** 20+

## Project Structure

- **Main app** (`/src`) - Demo application showcasing the library
- **ngx-virtual-dnd** (`/projects/ngx-virtual-dnd`) - Reusable drag-and-drop library

**Prefixes:** `app-` for main app components, `vdnd-` for library components/directives.

### Services

| Service                    | Path                                            | Purpose                                    |
| -------------------------- | ----------------------------------------------- | ------------------------------------------ |
| DragStateService           | `lib/services/drag-state.service.ts`            | Central signals-based drag state           |
| PositionCalculatorService  | `lib/services/position-calculator.service.ts`   | DOM hit-testing, drop index calculation    |
| AutoScrollService          | `lib/services/auto-scroll.service.ts`           | RAF-based edge scrolling                   |
| ElementCloneService        | `lib/services/element-clone.service.ts`         | Clone elements for drag preview            |
| KeyboardDragService        | `lib/services/keyboard-drag.service.ts`         | Keyboard drag state management             |
| DragIndexCalculatorService | `lib/services/drag-index-calculator.service.ts` | Placeholder index with virtual scroll math |
| OverlayContainerService    | `lib/services/overlay-container.service.ts`     | Body-level container for overlay elements  |

_All paths relative to `/projects/ngx-virtual-dnd/src/`_

### Handlers

| Handler             | Path                                    | Purpose                                    |
| ------------------- | --------------------------------------- | ------------------------------------------ |
| KeyboardDragHandler | `lib/handlers/keyboard-drag.handler.ts` | Keyboard drag lifecycle + key dispatch     |
| PointerDragHandler  | `lib/handlers/pointer-drag.handler.ts`  | Pointer (mouse/touch) drag lifecycle + RAF |

_Plain classes (non-injectable), instantiated by DraggableDirective._

### Strategies

| Strategy              | Path                                        | Purpose                                         |
| --------------------- | ------------------------------------------- | ----------------------------------------------- |
| FixedHeightStrategy   | `lib/strategies/fixed-height.strategy.ts`   | Fixed `index * itemHeight` math (zero overhead) |
| DynamicHeightStrategy | `lib/strategies/dynamic-height.strategy.ts` | HeightCache + prefix sums + binary search       |

_Plain classes implementing `VirtualScrollStrategy` interface (`lib/models/virtual-scroll-strategy.ts`)._
_`HeightCache` utility: `lib/utils/height-cache.ts`_

### Directives

| Directive               | Selector          | Key Inputs                                                                   |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------- |
| DraggableDirective      | `vdndDraggable`   | ID (required), group, data, disabled                                         |
| DroppableDirective      | `vdndDroppable`   | ID (required), group, data, autoScrollConfig, constrainToContainer, disabled |
| DroppableGroupDirective | `vdndGroup`       | group name (required)                                                        |
| ScrollableDirective     | `vdndScrollable`  | scrollContainerId, autoScrollEnabled, autoScrollConfig                       |
| VirtualForDirective     | `*vdndVirtualFor` | items, itemHeight, trackBy, dynamicItemHeight, droppableId                   |

### Components

| Component                       | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| VirtualScrollContainerComponent | High-level virtual scroll + auto-sticky                   |
| VirtualSortableListComponent    | Combines droppable + virtual scroll + placeholder         |
| VirtualViewportComponent        | Self-contained viewport with GPU-accelerated positioning  |
| VirtualContentComponent         | Virtual content within external scroll container          |
| DragPreviewComponent            | Preview following cursor (auto-teleports to body overlay) |
| PlaceholderComponent            | Drop position indicator                                   |

### Service Dependencies

```
DraggableDirective
├── KeyboardDragHandler (plain class)
│   ├── DragStateService
│   ├── KeyboardDragService
│   ├── PositionCalculatorService
│   ├── DragIndexCalculatorService
│   └── ElementCloneService
├── PointerDragHandler (plain class)
├── DragStateService
├── PositionCalculatorService
├── AutoScrollService
├── ElementCloneService
└── DragIndexCalculatorService

DragPreviewComponent → OverlayContainerService
DragIndexCalculatorService → PositionCalculatorService
AutoScrollService → DragStateService, PositionCalculatorService
```

### Data Attributes

| Attribute                     | Set By              | Used For                             |
| ----------------------------- | ------------------- | ------------------------------------ |
| `data-draggable-id`           | DraggableDirective  | Identify draggable elements          |
| `data-droppable-id`           | DroppableDirective  | Identify drop targets                |
| `data-droppable-group`        | DroppableDirective  | Group membership for cross-list drag |
| `data-constrain-to-container` | DroppableDirective  | Clamp drag to container boundaries   |
| `data-item-height`            | VirtualForDirective | Virtual scroll item height           |

### Test Files

| Source Area          | Unit Test                               | E2E Tests                                                       |
| -------------------- | --------------------------------------- | --------------------------------------------------------------- |
| DraggableDirective   | `draggable.directive.spec.ts`           | `drag-drop.spec.ts`, `keyboard-drag/*.spec.ts`                  |
| KeyboardDragHandler  | `keyboard-drag.handler.spec.ts`         | -                                                               |
| PointerDragHandler   | `pointer-drag.handler.spec.ts`          | -                                                               |
| DroppableDirective   | `droppable.directive.spec.ts`           | `drop-accuracy.spec.ts`                                         |
| DragStateService     | `drag-state.service.spec.ts`            | -                                                               |
| AutoScrollService    | `auto-scroll.service.spec.ts`           | `auto-scroll.spec.ts`, `autoscroll-drift.spec.ts`               |
| DragIndexCalculator  | `drag-index-calculator.service.spec.ts` | -                                                               |
| Placeholder logic    | -                                       | `placeholder-behavior.spec.ts`, `placeholder-integrity.spec.ts` |
| Container constraint | -                                       | `constrain-to-container.spec.ts`                                |
| Keyboard drag        | -                                       | `keyboard-drag/*.spec.ts` (6 files)                             |
| Page scroll          | -                                       | `page-scroll.spec.ts`                                           |
| Mobile touch         | -                                       | `touch-scroll.mobile.spec.ts`                                   |
| Dynamic height       | -                                       | `dynamic-height.spec.ts`                                        |

### Public API (from public-api.ts)

**Events:** `DragStartEvent`, `DragMoveEvent`, `DragEnterEvent`, `DragLeaveEvent`, `DragOverEvent`, `DropEvent`, `DragEndEvent`

**Utilities:** `moveItem()`, `reorderItems()`, `applyMove()`, `isNoOpDrop()`, `insertAt()`, `removeAt()`

**Tokens:** `VDND_SCROLL_CONTAINER`, `VDND_VIRTUAL_VIEWPORT`

**Constants:** `INITIAL_DRAG_STATE`, `END_OF_LIST`

**Strategies:** `VirtualScrollStrategy` (interface), `FixedHeightStrategy`, `DynamicHeightStrategy`

## Code Patterns

### TypeScript

- Use strict type checking; prefer type inference when obvious
- Avoid `any`; use `unknown` when type is uncertain
- Use native ESM private members (`#` syntax) instead of TypeScript's `private`
  - Exception: Angular signal queries (`viewChild`, `viewChildren`, `contentChild`, `contentChildren`) cannot use ES private fields - use TypeScript `private` for these

### Angular

- Always use standalone components (no NgModules)
- Do NOT set `standalone: true` in decorators (default in Angular v21+)
- Use `inject()` function instead of constructor injection
- Put host bindings in `host` object of decorators (not `@HostBinding`/`@HostListener`)
- Use `runOutsideAngular` for RAF loops and event listeners
- Signal updates do NOT need `ngZone.run()` - signals work across zone boundaries
- Never use hand made `ngDevMode`. Use `isDevMode()` instead

### Components

- Set `changeDetection: ChangeDetectionStrategy.OnPush`
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Use `class` bindings instead of `ngClass`; `style` bindings instead of `ngStyle`

### Signal Architecture

```typescript
// Private writable signal
readonly #state = signal<DragState>(INITIAL_STATE);

// Public readonly view
readonly state = this.#state.asReadonly();

// Derived state
readonly isDragging = computed(() => this.state().active);
```

Use `update()` or `set()` on signals (not `mutate`).

### Effects

```typescript
// Correct - no options needed for simple cases
effect(() => {
  this.mySignal.set(newValue); // Signal writes allowed by default
});

// With injector (only when outside constructor)
effect(() => { ... }, { injector: this.#injector });

// WRONG - never use this deprecated option
effect(() => { ... }, { allowSignalWrites: true }); // DO NOT USE
```

### Error Handling

- Never throw errors in drag/drop operations - use early returns
- Use `console.warn()` for recoverable issues (missing attrs, invalid state)
- Check `ngDevMode` for dev-only error logging
- Philosophy: graceful degradation over failure

### Event Listener Cleanup

Bind handlers in ngOnInit, store reference, remove in ngOnDestroy:

```typescript
#boundHandler: ((e: Event) => void) | null = null;

ngOnInit(): void {
  this.#boundHandler = this.#handler.bind(this);
  element.addEventListener('event', this.#boundHandler);
}

ngOnDestroy(): void {
  element.removeEventListener('event', this.#boundHandler!);
}
```

### State Caching in Effects

Cache state snapshots in effects if needed during cleanup (state may be cleared before effect fires):

```typescript
#cachedState: State | null = null;

effect(() => {
  if (this.isActive()) {
    this.#cachedState = this.#service.getStateSnapshot();
  }
});

#handleDrop(): void {
  const state = this.#cachedState; // Use cached, not current state
}
```

### Templates

- Use native control flow (`@if`, `@for`, `@switch`)
- Use the async pipe for observables
- Keep templates simple; avoid complex logic
- Do not use arrow functions in templates

### Services

- Design services around a single responsibility
- Use `providedIn: 'root'` for singleton services

### Timing and Rendering

- **Prefer `afterNextRender()`** when waiting for Angular to complete a render cycle
- Use `requestAnimationFrame` only for:
  - Performance throttling (coalescing frequent events)
  - Animation loops (autoscroll, smooth transitions)
- Use `setTimeout` only for intentional user-facing delays
- **Avoid double RAF patterns** - use `afterNextRender()` instead
- **Never use `queueMicrotask`** to wait for Angular rendering

## Architecture

### Key Architectural Decisions

1. **Placeholder index probe uses two complementary mechanisms for dynamic heights**:
   - **Capped center probe**: `min(center, top + itemHeight/2)` limits how deep the probe reaches. Prevents a tall preview (e.g. 120px among 60px items) from overshooting multiple positions — the center would land 2+ items away, but the cap keeps it within one item of the top edge.
   - **Midpoint refinement** (strategy path only): After `findIndexAtOffset` returns an index, checks whether the preview's top edge has passed the target item's midpoint. Only then advances `visualIndex` by 1. Prevents a short preview (e.g. 60px entering a 150px item) from triggering displacement at ~20% overlap — displacement now requires 50% of the target item's actual height.
   - These solve opposite directions of the height mismatch: the cap pulls the probe **up** (tall preview → short items), midpoint pushes the index **down** (short preview → tall items). Removing either breaks the other's scenario.
   - Fixed-height path uses `Math.floor(relativeY / itemHeight)` directly (no refinement needed since all items are the same height).
   - Constrained mode (`constrainToContainer`) uses preview top edge for index probing so tall items can reach the first slot, and snaps to edges when preview bounds are near container boundaries. Midpoint refinement is skipped in constrained mode.

2. **Same-list adjustment applied once**: When dragging within the same list, apply +1 adjustment when `visualIndex >= sourceIndex` to compensate for hidden item.

3. **Virtual scroll integration**: During same-list drag, `scrollHeight` reflects N-1 items. The `getTotalItemCount()` method adds 1 back for true logical total.

4. **No scroll compensation layers**: Uses raw `scrollTop` directly. Virtual scroll handles spacer adjustments internally.

5. **Consumer simplicity**: Library handles all complexity. Consumers only provide data and handle drop events.

6. **Gap prevention**: Dragged item hidden with `display: none`. Virtual scroll's `totalHeight` subtracts 1 during drag.

7. **Overlay container for drag preview**: `DragPreviewComponent` teleports its host element into a body-level `<div class="vdnd-overlay-container">` via `afterNextRender`. This escapes ancestor CSS `transform`/`perspective`/`filter` that create new containing blocks for `position: fixed` (e.g. Ionic's `ion-page`). Angular change detection works on the logical component tree, so signals/effects/bindings keep working after the DOM move. Unit tests must use `document.querySelector()` instead of `fixture.debugElement.query()` to find the teleported preview.

### Safari Autoscroll

**Problem:** Cumulative drift during autoscroll.
**Solution:** Synchronous callback immediately after scroll (no RAF delay).
**Key:** Use direct `element.scrollTop += delta`, not `scrollBy()`.

```typescript
// In AutoScrollService.#performScroll():
element.scrollTop += scrollY;
void element.offsetHeight; // Force layout flush
this.#onScrollCallback?.(); // Immediate, no RAF
```

See `.claude/history/safari-autoscroll.md` for failed approaches and detailed insights.

### Keyboard Drag

**Constraints:**

- Hidden elements (`display: none`) can't receive keyboard events or focus
- Solution: Document-level keyboard listeners during drag
- Gotcha: Call `stopPropagation()` when starting to prevent immediate drop
- Focus: Restore with `afterNextRender()` using `EnvironmentInjector`

**Screen Reader Announcements:** Not built-in (i18n complexity). Consumers implement using position data in drag events. See README.md for example.

## Lazy Documentation

Load these ONLY when working on specific areas:

| Doc                                    | When to Load                              |
| -------------------------------------- | ----------------------------------------- |
| `.ai/E2E.md`                           | Before writing/modifying Playwright tests |
| `.claude/demo/DESIGN_SYSTEM.md`        | Before styling demo pages                 |
| `.claude/history/safari-autoscroll.md` | If debugging Safari scroll drift          |

## Troubleshooting

| Error/Symptom                                      | Cause                                             | Fix                                                                      |
| -------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `elementFromPoint` returns null                    | Target outside viewport                           | `scrollIntoViewIfNeeded()` first                                         |
| Placeholder not appearing                          | Group mismatch                                    | Check `vdndDroppableGroup` matches                                       |
| Drag preview stuck                                 | Listener cleanup missed                           | Check `ngOnDestroy` removes listeners                                    |
| Safari drift during scroll                         | Using `scrollBy()`                                | Use direct `scrollTop +=`                                                |
| Changes not appearing in demo                      | Library not rebuilt                               | Run `ng build ngx-virtual-dnd`                                           |
| Signal write error in effect                       | Using deprecated option                           | Remove `allowSignalWrites: true`                                         |
| Drag preview offset in Ionic/transformed container | Ancestor CSS `transform` breaks `position: fixed` | Already fixed — `OverlayContainerService` teleports preview to body      |
| Unit test can't find drag preview element          | Preview teleported to overlay container           | Use `document.querySelector()` instead of `fixture.debugElement.query()` |
| Short item displaces tall item too early           | Probe enters tall item's range at ~20% overlap    | Already fixed — midpoint refinement in `DragIndexCalculatorService`      |

## Common Tasks

### Adding a new E2E test

1. Read `.ai/E2E.md` first
2. Create in `e2e/` following Page Object Model pattern
3. Use `demo.page.ts` fixture for common operations
4. Test all browsers: `npx playwright test --reporter=dot --max-failures=1`

### Modifying placeholder calculation

1. Read `DragIndexCalculatorService` thoroughly
2. Understand: capped center probe, midpoint refinement, same-list +1 adjustment, virtual scroll height math
3. Write E2E test first (TDD)
4. Run `placeholder-behavior.spec.ts` and `placeholder-integrity.spec.ts`
5. Run `drag-index-calculator.service.spec.ts` unit tests for index math edge cases

## Testing

- **Unit tests:** Jest with zoneless environment
- **E2E tests:** Playwright - **ALWAYS run after code changes**
- Use Page Object Model pattern for E2E tests

### Commands

```bash
# Unit tests (minimal output)
npm test -- --silent

# E2E - Chromium only (fast iteration)
npx playwright test --reporter=dot --max-failures=1 --project=chromium

# E2E - ALL BROWSERS (required before done)
npx playwright test --reporter=dot --max-failures=1

# Verbose (only when debugging)
npm test -- --verbose
npx playwright test --reporter=list
```

### Testing Decision Tree

- Testing DOM behavior/user interaction → E2E (Playwright)
- Testing pure logic/services → Unit tests (Jest)
- Debugging visual layout → Chrome MCP (last resort)

### E2E Patterns

**Wait for drag to start before checking placeholder:**

```typescript
await page.keyboard.press('Space');
await expect(demoPage.dragPreview).toBeVisible();
await expect(placeholder).toBeVisible();
```

**Use retrying assertions for async state:**

```typescript
await expect(async () => {
  const scrollTop = await demoPage.getScrollTop('list1');
  expect(scrollTop).toBeGreaterThan(500);
}).toPass({ timeout: 3000 });
```

**Browser differences:**

- Firefox: longer timeouts, position mouse closer to edge (10px vs 20px) for autoscroll
- WebKit: may cache hit-testing (force layout flush with `void element.offsetHeight`)

**Atomic measurements during animations:**

When measuring multiple element positions during rapid updates (autoscroll, animations), use a single `page.evaluate()` to capture all measurements atomically. Sequential `boundingBox()` calls have round-trip latency, allowing positions to change between calls.

```typescript
// WRONG - sequential calls introduce timing skew during rapid scroll
const previewBox = await preview.boundingBox(); // Round-trip 1
const placeholderBox = await placeholder.boundingBox(); // Round-trip 2 - position may have changed!
const drift = Math.abs(previewBox.y - placeholderBox.y);

// CORRECT - atomic measurement in single browser evaluation
const { previewY, placeholderY } = await page.evaluate(() => {
  const preview = document.querySelector('.preview');
  const placeholder = document.querySelector('.placeholder');
  return {
    previewY: preview?.getBoundingClientRect().top,
    placeholderY: placeholder?.getBoundingClientRect().top,
  };
});
const drift = Math.abs(previewY - placeholderY);
```

**Viewport boundary gotcha:**

`document.elementFromPoint(x, y)` returns **null** for coordinates outside the viewport. When UI changes (adding header elements, resizing) push content down, target elements may be below the viewport even if their `boundingBox()` is valid.

```typescript
// WRONG - boundingBox() returns document coordinates, but elementFromPoint uses viewport
const box = await element.boundingBox();
const targetY = box.y + someOffset; // May be > viewport height!
document.elementFromPoint(x, targetY); // Returns null!

// FIX - Ensure element is in viewport first
await element.scrollIntoViewIfNeeded();
const box = await element.boundingBox(); // Now viewport-relative and valid
```

**Debug tip:** Log `window.innerHeight` and target Y coordinate when hit-testing fails.

### Chrome MCP (Visual Debugging Only)

Use ONLY for understanding visual layout, not as primary verification.

1. Start dev server: `npm start`
2. Use `mcp__chrome-devtools__new_page` to open pages
3. **ALWAYS close pages with `mcp__chrome-devtools__close_page` when done**

### Cleanup

Always kill `ng serve` before reporting task fixed. Skip if did not use any Chrome MCP tools.

```bash
pkill -f "ng serve"
```

## Accessibility

- Must pass all AXE checks
- Follow WCAG AA requirements (focus management, color contrast, ARIA)
- Support keyboard navigation (space to activate, escape to cancel)

## Tooling

- **Prettier:** single quotes, 100 char width
- **ESLint:** @epam/eslint-config-angular
- **Stylelint:** stylelint-config-sass-guidelines
- **Git hooks:** Lefthook (lint on pre-commit, test on pre-push, commitlint on commit-msg)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description
```

**Types:** `feat`, `fix`, `perf`, `docs`, `refactor`, `test`, `chore`
**Scopes:** `lib`, `demo`, `docs`, `deps`, `release`
**Breaking changes:** Add `!` after type (e.g., `feat!:`) or `BREAKING CHANGE:` in footer

## Documentation Updates

### README.md (`/README.md`)

**Audience:** Library consumers — developers who `npm install ngx-virtual-dnd` and use it in their apps. They care about what the library does, how to use it, and what options they have. They do not care about internal algorithms, service architecture, or implementation mechanics.

**Public API** is everything consumers interact with: component selectors, directive selectors, inputs, outputs, utility functions, CSS classes, keyboard shortcuts, injection tokens, events, configuration options, and exported TypeScript types/interfaces.

**Update README when a change affects what consumers can do, use, or configure:**

- New or removed component, directive, service, utility, or token
- New, changed, or removed input, output, or configuration option
- New or changed CSS class, keyboard shortcut, or event
- New usage pattern made possible (e.g. page-level scroll support)
- Changed default behavior that consumers will observe and may need to adapt to

**Do NOT update README for:**

- Bug fixes (consumers don't configure the fix)
- Internal algorithm changes (displacement thresholds, probe logic, scroll math)
- Performance improvements (unless they introduce new configuration)
- Refactoring, test changes, build/tooling changes
- Anything a consumer cannot control, configure, or opt into

**Content style:** Show what to do, not how it works internally. Use code examples. Describe capabilities and options, not mechanisms.

### JSDoc Comments

Update JSDoc on the actual class, function, and interface definitions (not barrel files) when their signature, behavior, or usage contract changes.

### CHANGELOG.md

Auto-generated — do NOT manually edit.

## Releasing

Run `npm run release [patch|minor|major]` to release. Use `npm run release:dry-run` to test.

## Quick Reference

| Command                                                                  | Description                             |
| ------------------------------------------------------------------------ | --------------------------------------- |
| `npm start`                                                              | Dev server (port 4200)                  |
| `npm test -- --silent`                                                   | Unit tests (minimal output)             |
| `npx playwright test --reporter=dot --max-failures=1 --project=chromium` | E2E Chromium only (fast iteration)      |
| `npx playwright test --reporter=dot --max-failures=1`                    | E2E all browsers (required before done) |
| `npm run lint`                                                           | Run ESLint                              |
| `ng build ngx-virtual-dnd`                                               | Build library (required after edits)    |
| `npm run release`                                                        | Release new version                     |

## Design System

When working on demo pages, refer to `.claude/demo/DESIGN_SYSTEM.md` for consistent styling guidelines.
