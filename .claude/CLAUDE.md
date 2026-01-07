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

### Effects - Critical Rules

**NEVER use `allowSignalWrites: true`** - This option is DEPRECATED as of Angular 19. Signal writes are allowed by default in effects.

```typescript
// ✅ CORRECT - No allowSignalWrites needed
effect(() => {
  this.mySignal.set(newValue); // Signal writes are allowed by default
});

// ❌ WRONG - Never include this deprecated option
effect(
  () => {
    this.mySignal.set(newValue);
  },
  { allowSignalWrites: true },
); // DEPRECATED - DO NOT USE
```

**When creating effects:**

- Use `effect()` without any options for simple cases
- Use `effect(() => {}, { injector })` only when creating effects outside constructor
- NEVER include `allowSignalWrites` - it's deprecated and triggers warnings

## Timing and Rendering

- **Prefer `afterNextRender()`** when waiting for Angular to complete a render cycle (e.g., after state changes that affect DOM bindings)
- Use `requestAnimationFrame` only for:
  - Performance throttling (coalescing frequent events like pointer moves or scroll)
  - Animation loops (autoscroll, smooth transitions)
- Use `setTimeout` only for intentional user-facing delays (e.g., drag activation delay)
- **Avoid double RAF patterns** - use `afterNextRender()` instead when waiting for Angular DOM updates
- **Never use `queueMicrotask`** to wait for Angular rendering - microtasks run before Angular's change detection completes

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

### Keyboard Drag Accessibility - Implementation Notes

**Challenge:** The dragged item is hidden with `display: none` during drag operations. This creates two issues:

1. **Hidden elements cannot receive keyboard events.** Host bindings like `(keydown.arrowup)` on the hidden element will never fire.

2. **Hidden elements cannot be focused.** Even with `tabindex="0"`, elements with `display: none` cannot receive or maintain focus.

#### Solution: Document-Level Keyboard Listeners

When starting a keyboard drag:

1. Attach a keyboard event listener to `document` that handles navigation keys (Arrow keys, Space, Enter, Escape, Tab)
2. Store a reference to the listener for cleanup
3. Remove the listener when drag ends (drop, cancel, or disabled)

```typescript
// In DraggableDirective:
#keyboardDragListener: ((event: KeyboardEvent) => void) | null = null;

#startKeyboardDrag(): void {
  // Create and attach document listener
  this.#keyboardDragListener = (event: KeyboardEvent) => {
    this.#onKeyboardDragKeyDown(event);
  };
  document.addEventListener('keydown', this.#keyboardDragListener);
}

#cleanupKeyboardDrag(): void {
  if (this.#keyboardDragListener) {
    document.removeEventListener('keydown', this.#keyboardDragListener);
    this.#keyboardDragListener = null;
  }
}
```

#### Event Propagation Issue

When the user presses Space to start the drag, the host binding fires first, then the event propagates to the newly-added document listener. This causes the drag to immediately complete.

**Fix:** Call `event.stopPropagation()` in the host binding handler:

```typescript
onKeyboardActivate(event: Event): void {
  if (this.#keyboardDrag.isActive()) {
    // Already dragging - this will be handled by document listener
    return;
  }
  event.preventDefault();
  event.stopPropagation(); // Prevent event from reaching document listener
  this.#startKeyboardDrag();
}
```

#### Focus Management

Since the dragged element cannot maintain focus (due to `display: none`), the document-level listener captures keyboard events during drag. When the drag ends, focus is restored to the dropped item using `afterNextRender()` to ensure Angular has finished updating the DOM. If the element isn't found (e.g., virtual scroll removed it), focus falls back to the droppable container.

#### Screen Reader Announcements

The library does NOT provide built-in screen reader announcements due to i18n complexity. Consumers should implement their own announcements using the position data provided in drag events (`sourceIndex`, `targetIndex`, `destinationIndex`). See README.md for an example implementation.

### Library Development Workflow

The demo app imports from `dist/ngx-virtual-dnd` (see `tsconfig.json` paths), NOT from source files.

**After editing any file in `/projects/ngx-virtual-dnd/`:**

1. Rebuild the library: `ng build ngx-virtual-dnd`
2. Restart the dev server if running

Without rebuilding, changes to library files will NOT appear in the demo app.

## Testing

- **Unit tests:** Jest with zoneless environment
- **E2E tests:** Playwright - **ALWAYS run after code changes**
- Use Page Object Model pattern for E2E tests

### Token-Efficient Test Commands

**Default commands (minimal output):**

```bash
# Unit tests - silent mode (shows PASS/FAIL per file, not per test)
npm test -- --silent

# E2E tests - Chromium only (for fast iteration during development)
npx playwright test --reporter=dot --max-failures=1 --project=chromium

# E2E tests - ALL BROWSERS (required before considering work "done")
npx playwright test --reporter=dot --max-failures=1

# Single test file
npm test -- --silent path/to/file.spec.ts
npx playwright test e2e/file.spec.ts --reporter=dot --project=chromium
```

**E2E Workflow:**

1. Use `--project=chromium` for fast iteration while developing/debugging
2. Before marking a task complete, run without `--project` to verify all browsers pass
3. Cross-browser issues (especially WebKit/Safari) can be subtle - always verify

**Verbose commands (only when debugging):**

```bash
# Unit tests with full output
npm test -- --verbose

# E2E tests with list output (shows each test name)
npx playwright test --reporter=list
```

**Coverage (only when explicitly requested):**

```bash
npm test -- --coverage
```

**Note:** Some tests contain `console.log` debug statements. These appear in output regardless of reporter settings.

### Output Philosophy

- **Passing tests produce minimal output** - dots or nothing
- **Only failures show details** - stack traces, context
- **No verbose summaries** - skip "X tests passed" unless all pass
- **Stack traces are concise** - not full verbose traces
- **Stop early on failure** - use `--max-failures=1` for faster feedback

- Prefer data attributes (`[data-testid]`, `[data-draggable-id]`) over CSS selectors

### E2E Test Timing

**Keyboard drag tests must wait for drag to start:**
When testing keyboard drag (Space keypress), always wait for `dragPreview` to be visible before checking placeholder:

```typescript
await page.keyboard.press('Space');
await expect(demoPage.dragPreview).toBeVisible(); // Wait for drag to start
await expect(placeholder).toBeVisible(); // Then check placeholder
```

**Use retrying assertions for async state:**
When checking state that depends on Angular rendering or autoscroll, use Playwright's retrying assertions:

```typescript
// Bad - fixed wait is unreliable
await page.waitForTimeout(2000);
expect(scrollTop).toBeGreaterThan(500);

// Good - retrying assertion
await expect(async () => {
  const scrollTop = await demoPage.getScrollTop('list1');
  expect(scrollTop).toBeGreaterThan(500);
}).toPass({ timeout: 3000 });
```

**Browser differences:**

- Firefox may need longer timeouts for autoscroll detection
- Position mouse closer to edge (10px vs 20px) for autoscroll triggers in Firefox
- WebKit may cache hit-testing results (force layout flush with `void element.offsetHeight`)

### Testing Workflow

**IMPORTANT: Use E2E tests (Playwright) as the PRIMARY verification method.**

E2E tests run headless by default and provide reliable, reproducible results.

1. Write E2E tests FIRST to reproduce bugs before fixing
2. Run `npx playwright test --reporter=dot --max-failures=1` to verify fixes
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
- **Git hooks:** Lefthook (lint on pre-commit, test on pre-push, commitlint on commit-msg)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]
```

**Types:**

- `feat` - New feature (MINOR version bump)
- `fix` - Bug fix (PATCH version bump)
- `perf` - Performance improvement
- `docs` - Documentation only
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding/updating tests
- `chore` - Maintenance tasks

**Scopes:** `lib`, `demo`, `docs`, `deps`, `release`

**Breaking changes:** Add `!` after type (e.g., `feat!:`) or `BREAKING CHANGE:` in footer → MAJOR bump

## Documentation Updates

When modifying the library's public API (exports in `public-api.ts`), update documentation:

**Triggers (requires doc update):**

- Adding new directives, components, or services
- Adding new inputs/outputs to existing directives
- Changing behavior of public methods
- Adding new configuration options
- Deprecating functionality

**No update needed:**

- Internal refactoring that doesn't change API
- Performance improvements without API changes
- Bug fixes (unless they change expected behavior)
- Test changes

**Documentation locations:**

1. **README.md** (`/projects/ngx-virtual-dnd/README.md`) - Main library docs
2. **API docs** - JSDoc comments on public exports

**Note:** CHANGELOG.md is auto-generated by `commit-and-tag-version` - do NOT read or manually edit it.

## Releasing

Run `npm run release [patch|minor|major]` to release. The script:

1. Validates git state (clean, on master)
2. Runs lint, unit tests, e2e tests
3. Builds the library
4. Bumps version, updates CHANGELOG, commits, tags (via commit-and-tag-version)
5. Pushes to origin
6. Publishes to npm

Use `npm run release:dry-run` to test without pushing/publishing.

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
