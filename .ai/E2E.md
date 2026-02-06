# E2E (Playwright) Best Practices — ngx-virtual-dnd

This repo’s E2E suite exists to catch regressions in hard-to-test behavior:

- Virtual scrolling (DOM is _not_ the source of truth for list contents)
- Drag-and-drop (precise hit-testing + placeholder math)
- Autoscroll (RAF loops, edge thresholds, Safari/WebKit quirks)
- Keyboard drag (document-level key handling + focus restoration)
- Mobile/touch (drag-delay vs native scroll; touch listeners must not block scroll)

The goal is **high-signal, low-flake** tests that run reliably across browsers.

---

## Golden Rules (Repo-Specific)

### 1) Assert on _state_, not _time_

Avoid `page.waitForTimeout()` as a synchronization mechanism. Prefer:

- `await expect(locator).toBeVisible()` / `toBeHidden()` for UI state
- `await expect.poll(() => demoPage.getScrollTop('list1')).toBeGreaterThan(...)`
- `await expect(async () => { ... }).toPass()` for multi-assert waits

Use fixed waits only as a last resort and keep them short (≤ 50ms).

### 2) Virtual scroll: DOM counts lie

Only visible items are rendered. For logical list sizes:

- Use the list badge (`DemoPage.getItemCount`) rather than `locator.count()`.
- When verifying insertion at a specific logical index, **scroll to it** and then assert the visible item text/id.

### 3) Always scroll targets into viewport before hit-testing

`elementFromPoint(x, y)` uses viewport coordinates; `boundingBox()` can be valid even when the element is offscreen.

Best practice:

- `await locator.scrollIntoViewIfNeeded()` before `boundingBox()`
- Keep drop coordinates within the viewport bounds

### 4) Prefer stable identifiers

Use repo conventions:

- Draggable: `data-draggable-id`
- Droppable: `data-droppable-id`

Avoid coupling to CSS structure (e.g. `.list-card:nth(0)`) unless no test id exists.

### 5) A drag is not “started” until the preview exists

Always synchronize on a **drag-start signal**:

- `await expect(demoPage.dragPreview).toBeVisible()` (mouse/touch/keyboard)
- (Optional) `await expect(demoPage.placeholder).toBeVisible()` when placeholder is expected

If a helper cannot start the drag (no preview), it should **fail** (don’t swallow errors).

### 6) Autoscroll assertions must be retrying

Autoscroll is time-based; assertions must tolerate variability:

- Move pointer near the edge, then `expect.poll(scrollTop).toBeGreaterThan(...)`
- Prefer “scroll changed” and “preview + placeholder stayed aligned” over pixel-perfect checks

### 7) Long-running “stress” tests should be isolated

If a test needs multi-second waits or >60s timeouts, tag/segment it so you can run:

- Fast PR suite (high-signal, short)
- Nightly stress suite (drift, long autoscroll cycles)

---

## Recommended Test Structure (v2)

### Split by capability (desktop vs mobile)

- Desktop cross-browser: `*.spec.ts` (runs on Desktop Chrome/Safari/Firefox)
- Mobile suite: `*.mobile.spec.ts` (runs on mobile projects only)

Mobile tests should avoid Chromium-only mechanisms unless explicitly scoped.

### Prefer Page Object + small helpers

Keep raw pointer math in one place (`e2e/fixtures/demo.page.ts`) so fixes apply everywhere.

Helpers should:

- Scroll both source and target into view
- Start drag reliably (small move, then wait for preview)
- Avoid hard-coded sleeps; rely on visible state

---

## Patterns That Catch Real Regressions

### Cross-list drop correctness

Validate both:

1. **Counts** changed correctly (authoritative, not DOM count)
2. The dragged item’s **identity** moved (text or `data-draggable-id`)

Use `expect.poll` for counts because Angular updates are async.

### Same-list reorder

Capture the first few item texts/ids, perform reorder, then assert the new order.

### “No gaps / no ghosts” placeholder integrity

During drag, assert:

- Exactly one `.vdnd-drag-placeholder-visible`
- No empty `.item` “ghosts” (`DemoPage.countGhostElements`)
- Dragged element is `display: none` (gap prevention)

### Drag-delay touch correctness (mobile)

The primary regression is **calling `preventDefault()` too early** (blocks native scroll).

Preferred assertions:

- Before delay: touchmove events should not be `defaultPrevented`, and drag preview should not appear
- After delay: pending class appears; moving starts drag and touchmove becomes `defaultPrevented`

This directly targets `DraggableDirective` touch-delay logic.

---

## Timing & Synchronization Patterns

This library uses `requestAnimationFrame` to throttle drag position updates
(`draggable.directive.ts`). This creates specific synchronization requirements
that differ from typical Playwright tests.

### rAF Wait After Mouse Moves

After any `page.mouse.move()` during a drag, the position hasn't been processed
until the next animation frame. Always wait one frame before asserting position
or dropping:

```typescript
await page.mouse.move(targetX, targetY, { steps: 10 });
// Position update is rAF-throttled — wait one frame
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
await page.mouse.up();
```

For inline drag code where you know the target list has items, combine
placeholder visibility (proves hit-testing resolved) with rAF wait (ensures
final position):

```typescript
await page.mouse.move(targetX, targetY, { steps: 10 });
await expect(demoPage.placeholder).toBeVisible({ timeout: 2000 });
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
await page.mouse.up();
```

### Initial Position Capture

When capturing a baseline `boundingBox()` for position comparison, the
rAF-throttled transform may not have been applied yet. Wait one frame between
`toBeVisible()` and the capture:

```typescript
await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
// Wait for rAF to apply the initial transform
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
const initialBox = await demoPage.dragPreview.boundingBox();
```

### One-Shot vs Retrying Assertions

`locator.count()` is a **one-shot** call — it returns immediately without
retrying. For state that depends on rAF-throttled updates, wrap in `toPass`:

```typescript
// WRONG — count() may return 0 if rAF hasn't fired yet
const count = await page.locator('.vdnd-drag-placeholder-visible').count();
expect(count).toBe(1);

// CORRECT — retries until rAF-dependent state settles
await expect(async () => {
  const count = await page.locator('.vdnd-drag-placeholder-visible').count();
  expect(count).toBe(1);
}).toPass({ timeout: 2000 });
```

### Empty List Drops

Generic drag helpers (like `dragItemToList`) must NOT wait for placeholder
visibility — empty list targets don't produce placeholders. Use rAF wait
instead. Only wait for placeholder in inline test code where you know the
target list has items.

---

## Component Gotchas

### Two Placeholder Components

The library has **two different** placeholder-related components:

| Component                  | Selector                | Key Class                        |
| -------------------------- | ----------------------- | -------------------------------- |
| `DragPlaceholderComponent` | `vdnd-drag-placeholder` | `.vdnd-drag-placeholder-visible` |
| `PlaceholderComponent`     | `vdnd-placeholder`      | _(none relevant for tests)_      |

Tests should use `.vdnd-drag-placeholder-visible` (documented public API) to
locate the visible placeholder. Never mix selectors between these components.

### Angular `@if` Component Tree Swaps

When `@if` destroys and recreates entire component trees (e.g., toggling
simplified API mode), items can be **visible** before the virtual scroll
container computes its content height. `toBeVisible()` alone is insufficient.

Verify functional readiness by checking `scrollHeight`:

```typescript
await expect(this.list1Items.first()).toBeVisible();
// Items visible but virtual scroll may not have computed content height yet
await expect(async () => {
  const h1 = await list1VirtualScroll.evaluate((el) => el.scrollHeight);
  const h2 = await list2VirtualScroll.evaluate((el) => el.scrollHeight);
  expect(h1).toBeGreaterThan(400);
  expect(h2).toBeGreaterThan(400);
}).toPass({ timeout: 2000 });
```

### Scroll Commands Before Content Height Is Ready

If `scrollTop` is set when `scrollHeight` is still 0 (content not rendered),
the value clips to 0 permanently — a later retry of the **read** alone won't
help. Put both the scroll **write** and **read** inside `toPass`:

```typescript
// WRONG — scroll clips to 0, then toPass only re-reads the clipped value
await scrollList('list2', 1000);
await expect(async () => {
  expect(await getScrollTop('list2')).toBe(1000);
}).toPass({ timeout: 2000 });

// CORRECT — re-applies the scroll on each retry
await expect(async () => {
  await scrollList('list2', 1000);
  expect(await getScrollTop('list2')).toBe(1000);
}).toPass({ timeout: 2000 });
```

---

## Debugging & Diagnostics

- Prefer `testInfo.attach()` for structured debug output over `console.log`.
- When drift/hit-testing fails, capture:
  - viewport size (`window.innerHeight`)
  - pointer coordinates
  - placeholder/preview bounding boxes
  - container scrollTop + content offset attributes (if present)

---

## Commands

```bash
# Fast iteration
npx playwright test --reporter=dot --max-failures=1 --project=chromium

# All browsers (required before done)
npx playwright test --reporter=dot --max-failures=1
```
