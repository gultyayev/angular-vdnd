# ngx-virtual-dnd

Angular monorepo containing a drag-and-drop library optimized for virtual scrolling.

## Critical Rules

These rules prevent common mistakes that cause hard-to-debug issues:

1. **Rebuild library after edits:** After editing any file in `/projects/ngx-virtual-dnd/`, run `ng build ngx-virtual-dnd`. Without this, changes won't appear in the demo app.

2. **Never use `allowSignalWrites: true`:** This option is DEPRECATED as of Angular 19. Signal writes are allowed by default in effects.

3. **Run E2E tests before marking work done:** Use `npx playwright test --reporter=dot --max-failures=1` (all browsers, not just Chromium).

4. **Use data attributes for element identification:** `data-draggable-id`, `data-droppable-id` - not CSS selectors.

5. **Never throw errors in drag/drop operations:** Use early returns and graceful degradation instead.

6. **TDD for bug fix tests:** When adding tests that verify bug fixes: (1) Write the test first, (2) Run it - it MUST fail (proving the bug exists), (3) Implement the fix, (4) Run again - it should pass. Never skip step 2.

7. **Run ESLint on changed files:** Before considering a task done, run `npm run lint` or `npx eslint --flag v10_config_lookup_from_file <changed-files>` to catch formatting and style issues.

## Project Structure

- **Main app** (`/src`) - Demo application showcasing the library
- **ngx-virtual-dnd** (`/projects/ngx-virtual-dnd`) - Reusable drag-and-drop library

**Prefixes:** `app-` for main app components, `vdnd-` for library components/directives.

**Key files:**

- `DragStateService` - `/projects/ngx-virtual-dnd/src/lib/services/drag-state.service.ts`
- `AutoScrollService` - `/projects/ngx-virtual-dnd/src/lib/services/auto-scroll.service.ts`
- `PositionCalculatorService` - `/projects/ngx-virtual-dnd/src/lib/services/position-calculator.service.ts`

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

1. **Placeholder index uses preview CENTER**: The center of the drag preview determines placeholder position.

2. **Same-list adjustment applied once**: When dragging within the same list, apply +1 adjustment when `visualIndex >= sourceIndex` to compensate for hidden item.

3. **Virtual scroll integration**: During same-list drag, `scrollHeight` reflects N-1 items. The `getTotalItemCount()` method adds 1 back for true logical total.

4. **No scroll compensation layers**: Uses raw `scrollTop` directly. Virtual scroll handles spacer adjustments internally.

5. **Consumer simplicity**: Library handles all complexity. Consumers only provide data and handle drop events.

6. **Gap prevention**: Dragged item hidden with `display: none`. Virtual scroll's `totalHeight` subtracts 1 during drag.

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

## Testing

- **Lazy docs:** `.ai/E2E.md` (load when working on Playwright/E2E tests)
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

Always kill `ng serve` before reporting task fixed:

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

When modifying public API (exports in `public-api.ts`):

**Update docs for:** New directives/components/services, new inputs/outputs, behavior changes, new config options, deprecations.

**No update needed for:** Internal refactoring, performance improvements, bug fixes (unless behavior changes), test changes.

**Locations:**

1. `README.md` (`/README.md`)
2. JSDoc comments on public exports

**Note:** CHANGELOG.md is auto-generated - do NOT manually edit.

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
