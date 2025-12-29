# ngx-virtual-dnd

Angular monorepo containing a drag-and-drop library optimized for virtual scrolling.

## Project Structure

- **Main app** (`/src`) - Demo application showcasing the library
- **ngx-virtual-dnd** (`/projects/ngx-virtual-dnd`) - Reusable drag-and-drop library

**Prefixes:** `app-` for main app components, `vdnd-` for library components/directives.

## TypeScript

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid `any`; use `unknown` when type is uncertain
- Use native ESM private members (`#` syntax) instead of TypeScript's `private` keyword
  - Exception: Angular signal queries (`viewChild`, `viewChildren`, `contentChild`, `contentChildren`) cannot use ES private fields due to Angular compiler limitations - use TypeScript `private` for these

## Angular

- Always use standalone components (no NgModules)
- Do NOT set `standalone: true` in decorators (it's the default in Angular v21+)
- Use signals for state management
- Use `inject()` function instead of constructor injection
- Put host bindings in the `host` object of `@Component`/`@Directive` decorators (not `@HostBinding`/`@HostListener`)
- Use `runOutsideAngular` for performance-critical operations (animations, scroll handlers)

## Components

- Keep components small and focused
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush`
- Prefer inline templates for small components
- Use `class` bindings instead of `ngClass`
- Use `style` bindings instead of `ngStyle`

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Use `effect()` for reacting to state changes
- Use `update()` or `set()` on signals (not `mutate`)

## Templates

- Use native control flow (`@if`, `@for`, `@switch`)
- Use the async pipe for observables
- Keep templates simple; avoid complex logic
- Do not use arrow functions in templates

## Services

- Design services around a single responsibility
- Use `providedIn: 'root'` for singleton services

## Library Conventions (ngx-virtual-dnd)

- Use `vdnd-` prefix for all library components/directives
- Use data attributes for element identification: `data-draggable-id`, `data-droppable-id`
- `DragStateService` is the single source of truth for drag state

### Key Architectural Decisions

1. **Placeholder index uses preview CENTER**: The center of the drag preview determines placeholder position, providing intuitive UX where the placeholder appears where the preview visually is.

2. **Same-list adjustment applied once**: When dragging within the same list, the hidden item shifts all items below it up visually. We apply a single +1 adjustment when `visualIndex >= sourceIndex` to compensate.

3. **Virtual scroll integration**: During same-list drag, `scrollHeight` reflects N-1 items (the hidden one). The `getTotalItemCount()` method adds 1 back to get the true logical total.

4. **No scroll compensation layers**: Uses raw `scrollTop` directly. The virtual scroll container handles spacer adjustments internally - no additional compensation needed in drag calculations.

5. **Consumer simplicity**: The library handles all complexity. Consumers only provide data and handle drop events - no leaky abstractions requiring consumer-side compensation.

6. **Gap prevention**: The dragged item is hidden with `display: none`. Virtual scroll's `totalHeight` computation subtracts 1 during drag, and spacers adjust automatically - no empty space remains.

### Safari Autoscroll Drift - Fix History

**Issue:** During autoscroll in Safari, the placeholder position drifts from where it should be. The drift is cumulative - it gets worse with each scroll direction change. Eventually the placeholder reaches the list boundary before the scroll does, causing autoscroll to stop prematurely.

**Root Cause (final):** The placeholder calculation must happen synchronously within the same animation frame as the scroll. Any delay (RAF, double RAF, etc.) causes the calculation to use a scrollTop value that reflects additional scrolls that happened during the delay.

#### Failed Attempts

**When adding new fix attempts, document: (1) the hypothesis, (2) the implementation, (3) why it failed.**

1. **Double RAF with layout flush** (Dec 2024)
   - _Hypothesis:_ Safari caches hit-testing results and only invalidates on user-initiated scroll. Double RAF gives Safari time to process the scroll, layout flush forces reflow.
   - _Implementation:_ After `scrollBy()`, schedule callback via `requestAnimationFrame(() => { void element.offsetHeight; requestAnimationFrame(() => callback()) })`
   - _Why it failed:_ During the 2-frame delay, the autoscroll loop continues scrolling. By the time the callback runs, scrollTop reflects 2+ additional scrolls. This creates cumulative drift that compounds with each frame.

2. **Cumulative scroll delta tracking** (Dec 2024 - not implemented, rejected during planning)
   - _Hypothesis:_ Track total scroll delta since drag start and apply as correction to grabOffset.
   - _Why rejected:_ Risk of accumulation errors over time. Also, cumulative tracking would need to handle scroll direction changes correctly, adding complexity.

3. **Initial scroll position comparison** (Dec 2024 - implemented then reverted)
   - _Hypothesis:_ Store initial scrollTop when entering a container, compute delta as `currentScrollTop - initialScrollTop`, adjust grabOffset by this delta.
   - _Implementation:_ Added `#initialScrollPositions` Map to DragStateService, recorded initial scroll on container entry, applied correction in `#calculatePlaceholderIndex`.
   - _Why it failed:_ The placeholder calculation formula `relativeY = previewCenterY - rect.top + currentScrollTop` already correctly accounts for scroll position. Adding scroll delta correction was double-counting, causing the placeholder to be completely wrong (e.g., showing index 50 when preview was at index 5).

#### Working Solution

**Synchronous callback in AutoScrollService** (Dec 2024)

- Use direct property assignment (`element.scrollTop += delta`) instead of `scrollBy()` for guaranteed synchronous behavior
- Force layout flush immediately (`void element.offsetHeight`)
- Call the placeholder recalculation callback immediately in the same frame (no RAF delay)
- No `ngZone.run()` wrapper needed - the callback already enters the zone when updating drag state

```typescript
// In AutoScrollService.#performScroll():
element.scrollTop += scrollY;
void element.offsetHeight; // Force layout flush
this.#onScrollCallback?.(); // Immediate, no RAF
```

#### Key Insights

1. **The placeholder formula is correct as-is.** `relativeY = previewCenterY - rect.top + currentScrollTop` properly converts viewport coordinates to logical list position. Don't add "corrections" to it.

2. **Timing is everything.** The callback must run in the same frame as the scroll, before the next scroll happens. Any async delay (even 1 RAF) causes drift.

3. **Safari's `scrollBy()` may have async behavior** even with `behavior: 'instant'`. Direct property assignment is more reliable.

4. **Angular signals don't need `ngZone.run()`.** Signals work outside zone.js. Wrapping signal updates in `ngZone.run()` is unnecessary overhead.

### Library Development Workflow

The demo app imports from `dist/ngx-virtual-dnd` (see `tsconfig.json` paths), NOT from source files.

**After editing any file in `/projects/ngx-virtual-dnd/`:**

1. Rebuild the library: `ng build ngx-virtual-dnd`
2. Restart the dev server if running

Without rebuilding, changes to library files will NOT appear in the demo app.

## Testing

- **Unit tests:** Jest with zoneless environment (`npm test`)
- **E2E tests:** Playwright (`npm run e2e`) - **ALWAYS run after code changes**
- Use Page Object Model pattern for E2E tests
- Prefer data attributes (`[data-testid]`, `[data-draggable-id]`) over CSS selectors

### Testing Workflow

**IMPORTANT: Use E2E tests (Playwright) as the PRIMARY verification method.**

E2E tests run headless by default and provide reliable, reproducible results.

1. Write E2E tests FIRST to reproduce bugs before fixing
2. Run `npm run e2e` to verify fixes work
3. Only use Chrome MCP for visual debugging when E2E tests are insufficient

### Chrome MCP for Visual Debugging (Secondary)

Chrome MCP connects to an existing browser via DevTools protocol. Use it ONLY for:

- Understanding visual layout issues
- Debugging specific interactions
- Taking screenshots for documentation

**DO NOT use Chrome MCP as the primary verification method for bug fixes.**

When using Chrome MCP:

1. Start dev server: `npm start`
2. Use `mcp__chrome-devtools__new_page` to open pages
3. Use `mcp__chrome-devtools__take_screenshot` for visual checks
4. **ALWAYS close pages with `mcp__chrome-devtools__close_page` when done**

Available tools:

- `take_snapshot` - Get accessibility tree of the page
- `take_screenshot` - Capture visual state
- `navigate_page`, `click`, `fill` - Interact with the app
- `list_console_messages` - Check for errors

### Cleanup Requirements

Always kill the `ng serve` process before reporting a task fixed:

```bash
pkill -f "ng serve"
```

There should be no hanging processes in the background.

## Accessibility

- Must pass all AXE checks
- Follow WCAG AA requirements (focus management, color contrast, ARIA)
- Support keyboard navigation (space to activate, escape to cancel)

## Tooling

- **Prettier:** single quotes, 100 char width
- **ESLint:** @epam/eslint-config-angular
- **Stylelint:** stylelint-config-sass-guidelines
- **Git hooks:** Lefthook (lint on pre-commit, test on pre-push)

## Quick Reference

| Command                    | Description                          |
| -------------------------- | ------------------------------------ |
| `npm start`                | Dev server (port 4200)               |
| `npm test`                 | Run unit tests (Jest)                |
| `npm run e2e`              | Run E2E tests (Playwright)           |
| `npm run lint`             | Run ESLint                           |
| `npm run storybook`        | Start Storybook (port 6006)          |
| `npm run build`            | Production build                     |
| `ng build ngx-virtual-dnd` | Build library (required after edits) |
