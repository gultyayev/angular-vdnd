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

### Chrome MCP for Visual Testing

Use `mcp__chrome-devtools` tools for visual debugging and testing:

- `take_snapshot` - Get accessibility tree of the page
- `take_screenshot` - Capture visual state for verification
- `navigate_page`, `click`, `fill` - Interact with the running app
- `list_console_messages` - Check for errors during testing

Always kill the `ng serve` process before reporting a task fixed. There should be
no hanging process in the background left.

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
