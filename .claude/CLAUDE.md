# ngx-virtual-dnd

Angular monorepo containing a drag-and-drop library optimized for virtual scrolling.

## Critical Rules

These rules prevent common mistakes that cause hard-to-debug issues:

1. **Rebuild library after edits:** After editing any file in `/projects/ngx-virtual-dnd/`, run `ng build ngx-virtual-dnd`. Without this, changes won't appear in the demo app.

2. **Never use `allowSignalWrites: true`:** This option is DEPRECATED as of Angular 19. Signal writes are allowed by default in effects.

3. **Run E2E tests before marking work done:** Use `npx playwright test --reporter=dot --max-failures=1` (all browsers, not just Chromium). Without this, broken interactions ship undetected. Exception: Skip for documentation-only or CLAUDE.md-only changes.

4. **Use data attributes for element identification:** Use `data-*` attributes (`data-draggable-id`, `data-droppable-id`) in both library code and E2E tests — not CSS class selectors, tag names, or component queries.

5. **Never throw errors in drag/drop operations:** Use early returns and graceful degradation instead.

6. **TDD for every bug fix — no exceptions:** Every bug fix MUST have a test, and the test MUST be written before the fix. The workflow is: (1) Write a failing test that reproduces the bug, (2) Run it — confirm it fails (this proves the bug exists and the test is valid), (3) Implement the fix, (4) Run it again — confirm it passes. Do not write the fix first and the test second. Do not skip step 2. This applies to all bug fixes regardless of scope.

7. **Run ESLint on changed files:** Before considering a task done, run `npm run lint` or `npx eslint --flag v10_config_lookup_from_file <changed-files>` to catch formatting and style issues. Lefthook pre-commit checks the same rules; running manually catches issues earlier.

8. **Test fails = you broke it:** If a test fails after your changes, you broke it. Fix it. Do not check main. Do not claim "pre-existing." Do not claim "flaky." Do not claim "unrelated to my changes." Fix it.

9. **Keep instructions in sync:** Any change to code documented in this file must include a corresponding update in the same commit. This includes: tables (services, directives, components, data attributes, public API, test files), code examples (if a pattern shown changes, update the example), architecture descriptions (if behavior in Architecture or a lazy doc changes, update it), and lazy docs (`.ai/E2E.md`, `.claude/history/*.md`, `.claude/TROUBLESHOOTING.md`, `.claude/demo/DESIGN_SYSTEM.md`).

10. **Never use `expect(true).toBe(true)` or similar no-op assertions:** Every test assertion must verify actual behavior. Tests that always pass regardless of code behavior provide false confidence and zero coverage. If you can't write a meaningful assertion, the test shouldn't exist.

11. **Keep skills in sync with public API:** Any change to the consumer-facing API (new/changed/removed component, directive, input, output, event, utility, token, CSS class, or keyboard shortcut) must update `skills/ngx-virtual-dnd/SKILL.md` and/or `skills/ngx-virtual-dnd/references/api-reference.md` in the same commit. Internal-only changes (bug fixes, refactoring, performance) do not require skill updates unless they change observable consumer behavior.

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

| Directive               | Selector            | Key Inputs                                                                                      |
| ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| DraggableDirective      | `vdndDraggable`     | ID (required), group, data, disabled, dragHandle, dragThreshold, dragDelay, lockAxis            |
| DroppableDirective      | `vdndDroppable`     | ID (required), group, data, disabled, autoScrollEnabled, autoScrollConfig, constrainToContainer |
| DroppableGroupDirective | `vdndGroup`         | group name (required)                                                                           |
| ScrollableDirective     | `vdndScrollable`    | scrollContainerId, autoScrollEnabled, autoScrollConfig                                          |
| VirtualForDirective     | `*vdndVirtualFor`   | items (required), trackBy (required), itemHeight\*, dynamicItemHeight\*, droppableId\*          |
| ContentHeaderDirective  | `vdndContentHeader` | (marker only — auto-measured via ResizeObserver)                                                |

### Components

| Component                       | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| VirtualScrollContainerComponent | High-level virtual scroll + auto-sticky                   |
| VirtualSortableListComponent    | Combines droppable + virtual scroll + placeholder         |
| VirtualViewportComponent        | Self-contained viewport with GPU-accelerated positioning  |
| VirtualContentComponent         | Virtual content within external scroll container          |
| DragPreviewComponent            | Preview following cursor (auto-teleports to body overlay) |
| PlaceholderComponent            | Drop position indicator                                   |
| DragPlaceholderComponent        | Drag placeholder indicator (visible during drag)          |

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

DragPreviewComponent → DragStateService, OverlayContainerService
DragIndexCalculatorService → PositionCalculatorService
AutoScrollService → DragStateService, PositionCalculatorService
```

### Data Attributes

| Attribute                     | Set By                                                   | Used For                                      |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `data-draggable-id`           | DraggableDirective                                       | Identify draggable elements                   |
| `data-droppable-id`           | DroppableDirective                                       | Identify drop targets                         |
| `data-droppable-group`        | DroppableDirective                                       | Group membership for cross-list drag          |
| `data-constrain-to-container` | DroppableDirective                                       | Clamp drag to container boundaries            |
| `data-item-height`            | VirtualScrollContainerComponent, VirtualContentComponent | Virtual scroll item height                    |
| `data-total-items`            | VirtualScrollContainerComponent, VirtualContentComponent | Total item count for index calculation        |
| `data-content-offset`         | VirtualContentComponent                                  | Content offset for virtual scroll positioning |

### Test Files

| Source Area             | Unit Test                                    | E2E Tests                                                       |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| DraggableDirective      | `draggable.directive.spec.ts`                | `drag-drop.spec.ts`, `keyboard-drag/*.spec.ts`                  |
| KeyboardDragHandler     | `keyboard-drag.handler.spec.ts`              | -                                                               |
| PointerDragHandler      | `pointer-drag.handler.spec.ts`               | -                                                               |
| DroppableDirective      | `droppable.directive.spec.ts`                | `drop-accuracy.spec.ts`                                         |
| DragStateService        | `drag-state.service.spec.ts`                 | -                                                               |
| AutoScrollService       | `auto-scroll.service.spec.ts`                | `auto-scroll.spec.ts`, `autoscroll-drift.spec.ts`               |
| DragIndexCalculator     | `drag-index-calculator.service.spec.ts`      | -                                                               |
| ElementCloneService     | `element-clone.service.spec.ts`              | -                                                               |
| KeyboardDragService     | `keyboard-drag.service.spec.ts`              | -                                                               |
| PositionCalculator      | `position-calculator.service.spec.ts`        | -                                                               |
| DragPreviewComponent    | `drag-preview.component.spec.ts`             | -                                                               |
| PlaceholderComponent    | `placeholder.component.spec.ts`              | -                                                               |
| VirtualScrollContainer  | `virtual-scroll-container.component.spec.ts` | -                                                               |
| VirtualContentComponent | `virtual-content.component.spec.ts`          | -                                                               |
| VirtualForDirective     | `virtual-for.directive.spec.ts`              | -                                                               |
| DynamicHeightStrategy   | `dynamic-height.strategy.spec.ts`            | `dynamic-height.spec.ts`                                        |
| Placeholder logic       | -                                            | `placeholder-behavior.spec.ts`, `placeholder-integrity.spec.ts` |
| Container constraint    | -                                            | `constrain-to-container.spec.ts`                                |
| Container resize        | -                                            | `container-resize.spec.ts`                                      |
| Keyboard drag           | -                                            | `keyboard-drag/*.spec.ts` (6 files)                             |
| Keyboard navigation     | -                                            | `keyboard-navigation.spec.ts`                                   |
| Axis lock               | -                                            | `axis-lock.spec.ts`                                             |
| Disabled elements       | -                                            | `disabled-elements.spec.ts`                                     |
| Drag UX features        | -                                            | `drag-ux-features.spec.ts`                                      |
| Empty list              | -                                            | `empty-list.spec.ts`                                            |
| Page scroll             | -                                            | `page-scroll.spec.ts`                                           |
| Mobile touch            | -                                            | `touch-scroll.mobile.spec.ts`                                   |

### Skills (for library consumers)

| Skill           | Path                      | Purpose                                  |
| --------------- | ------------------------- | ---------------------------------------- |
| ngx-virtual-dnd | `skills/ngx-virtual-dnd/` | Complete integration guide for AI agents |

### Public API (from public-api.ts)

**Events:** `DragStartEvent`, `DragMoveEvent`, `DragEnterEvent`, `DragLeaveEvent`, `DragOverEvent`, `DropEvent`, `DragEndEvent`

**Utilities:** `moveItem()`, `reorderItems()`, `applyMove()`, `isNoOpDrop()`, `insertAt()`, `removeAt()`

**Tokens:** `VDND_SCROLL_CONTAINER`, `VDND_VIRTUAL_VIEWPORT`, `VDND_GROUP_TOKEN`

**Constants:** `INITIAL_DRAG_STATE`, `END_OF_LIST`

**Strategies:** `VirtualScrollStrategy` (interface), `FixedHeightStrategy`, `DynamicHeightStrategy`

**Types:** `AutoScrollConfig`, `DraggedItem`, `CursorPosition`, `GrabOffset`, `DragState`, `DropSource`, `DropDestination`, `VdndGroupContext`, `VdndScrollContainer`, `VdndVirtualViewport`, `VirtualScrollItemContext`, `VisibleRangeChange`, `DragPreviewContext`, `PlaceholderContext`, `VirtualForContext`

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
- Use `runOutsideAngular` for RAF loops, programmatic event listeners, and `ResizeObserver`
- Avoid template/host event bindings (`(event)`, `host: { '(event)' }`) for high-frequency DOM events (`mousemove`, `pointermove`, `touchmove`, `scroll`, `resize`, `dragover`) — Angular marks the view dirty on every emission, even with OnPush. Use programmatic `addEventListener` inside `runOutsideAngular` instead. Low-frequency initiation events (`mousedown`, `touchstart`, `keydown`, `click`) are fine as template/host bindings.
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

Use `update()` or `set()` on signals (not `mutate`). Note: `DragStateService` uses individual `computed()` projections instead of `.asReadonly()` — both patterns are valid.

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
- Guard dev-only logging with `isDevMode()`
- Philosophy: graceful degradation over failure

### Event Listener Cleanup

Use `createBoundListener()` from `lib/utils/event-listener-bindings.ts` to bind/unbind event listeners with automatic cleanup. Call `.bindTo(element)` to attach and `.unbind()` in ngOnDestroy.

### Templates

- Use native control flow (`@if`, `@for`, `@switch`)
- Use the async pipe for observables
- Do not use arrow functions in templates
- Never bind high-frequency DOM events (`scroll`, `mousemove`, `pointermove`, `touchmove`) in templates — use programmatic listeners outside Angular's zone

### Services

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

1. **Placeholder index probe uses capped center + midpoint refinement** for dynamic heights. See `.claude/history/placeholder-algorithm.md` for the detailed algorithm.

2. **Same-list adjustment applied once**: When dragging within the same list, apply +1 adjustment when `visualIndex >= sourceIndex` to compensate for hidden item.

3. **Virtual scroll integration**: During same-list drag, `scrollHeight` reflects N-1 items. The `getTotalItemCount()` method adds 1 back for true logical total.

4. **No scroll compensation layers**: Uses raw `scrollTop` directly. Virtual scroll handles spacer adjustments internally.

5. **Consumer simplicity**: Library handles all complexity. Consumers only provide data and handle drop events.

6. **Gap prevention**: Dragged item hidden with `display: none`. Virtual scroll's `totalHeight` subtracts 1 during drag.

7. **Overlay container for drag preview**: `DragPreviewComponent` teleports its host element into a body-level `<div class="vdnd-overlay-container">` via `afterNextRender`. This escapes ancestor CSS `transform`/`perspective`/`filter` that create new containing blocks for `position: fixed` (e.g. Ionic's `ion-page`). Angular change detection works on the logical component tree, so signals/effects/bindings keep working after the DOM move. Unit tests must use `document.querySelector()` instead of `fixture.debugElement.query()` to find the teleported preview.

### Safari Autoscroll

Use direct `element.scrollTop += delta` (not `scrollBy()`) with synchronous callback — no RAF delay. See `.claude/history/safari-autoscroll.md` for details.

### Keyboard Drag

**Constraints:**

- Hidden elements (`display: none`) can't receive keyboard events or focus
- Solution: Document-level keyboard listeners during drag
- Gotcha: Call `stopPropagation()` when starting to prevent immediate drop
- Focus: Restore with `afterNextRender()` using `EnvironmentInjector`

**Screen Reader Announcements:** Not built-in (i18n complexity). Consumers implement using position data in drag events. See README.md for example.

## Lazy Documentation

Load these ONLY when working on specific areas:

| Doc                                                  | When to Load                                     |
| ---------------------------------------------------- | ------------------------------------------------ |
| `.ai/E2E.md`                                         | Before writing/modifying Playwright tests        |
| `.claude/demo/DESIGN_SYSTEM.md`                      | Before styling demo pages                        |
| `.claude/history/safari-autoscroll.md`               | If debugging Safari scroll drift                 |
| `.claude/history/placeholder-algorithm.md`           | If modifying placeholder index calculation       |
| `.claude/TROUBLESHOOTING.md`                         | If debugging unexpected behavior                 |
| `skills/ngx-virtual-dnd/SKILL.md`                    | When modifying the library's consumer-facing API |
| `skills/ngx-virtual-dnd/references/api-reference.md` | When modifying the library's consumer-facing API |

### When to Create Lazy Documentation

**Lazy-loaded file** (not inline in CLAUDE.md) when ANY of these apply:

1. **Specialized knowledge**: Only relevant when working on a specific subsystem
2. **Debugging/troubleshooting**: Error symptoms, failed approaches, workarounds
3. **Detailed code examples >10 lines**: Long WRONG/CORRECT patterns belong in the relevant lazy doc
4. **Historical context**: Why a decision was made, what alternatives were tried

**Inline in CLAUDE.md** when ALL of these apply:

1. **Broadly relevant**: Needed in >20% of conversations (rules, patterns, structure)
2. **Concise**: Fits in 1-3 lines or a small table row
3. **Actionable**: Directly tells the agent what to do or not do

**When adding a new lazy doc:** Create the file, add an entry to the Lazy Documentation table with a clear "When to Load" trigger, and replace any inline content with a one-line reference. Never duplicate content between CLAUDE.md and lazy docs.

## Troubleshooting

See `.claude/TROUBLESHOOTING.md` for common error symptoms, causes, and fixes.

## Common Tasks

### Adding a new E2E test

1. Read `.ai/E2E.md` first
2. Create in `e2e/` following Page Object Model pattern
3. Use `e2e/fixtures/demo.page.ts` fixture for common operations
4. Test all browsers: `npx playwright test --reporter=dot --max-failures=1`

### Modifying placeholder calculation

1. Read `.claude/history/placeholder-algorithm.md` and `DragIndexCalculatorService` thoroughly
2. Write E2E test first (TDD)
3. Run `placeholder-behavior.spec.ts` and `placeholder-integrity.spec.ts`
4. Run `drag-index-calculator.service.spec.ts` unit tests for index math edge cases

### Updating skills after public API changes

1. Determine if the change affects consumer-facing API (same criteria as README updates)
2. Update `skills/ngx-virtual-dnd/SKILL.md` patterns if usage patterns changed
3. Update `skills/ngx-virtual-dnd/references/api-reference.md` tables for new/changed/removed inputs, outputs, events, utilities, tokens, or CSS classes

### Adding documentation for a new subsystem

1. Decide: inline vs. lazy (see "When to Create Lazy Documentation" criteria above)
2. If lazy: create file, add to Lazy Documentation table, add one-line inline reference
3. If inline: keep it under 3 lines or a single table row
4. Never duplicate content between CLAUDE.md and lazy docs — single source of truth

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

### Unit Test Guidelines

- Every assertion must test actual behavior — never use `expect(true).toBe(true)` or equivalent no-op patterns
- Test behavior, not implementation details
- Include negative tests (verify things DON'T happen when they shouldn't)

### E2E Patterns

See `.ai/E2E.md` for comprehensive E2E testing patterns (timing, browser differences, assertions, gotchas).

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
**Scopes:** `lib`, `demo`, `e2e`, `docs`, `deps`, `release`
**Scope selection:** Match the scope to the files changed, not the feature area the change is "about." E2E-only changes use `e2e`, library-only changes use `lib`, demo-only changes use `demo`. Mixed changes spanning library + tests use `lib` (the primary change).
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
