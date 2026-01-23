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
