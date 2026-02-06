# E2E Best Practices Review

> Review date: 2026-02-04
> Based on: [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Summary

The E2E test suite **follows most Playwright best practices** with a well-structured Page Object Model, proper test isolation, and good multi-browser coverage. The main improvement opportunity is reducing hardcoded `waitForTimeout` calls.

## Compliance Matrix

| Best Practice | Status | Notes |
|--------------|--------|-------|
| Page Object Model | ✅ | `demo.page.ts` abstracts all page interactions |
| Test Isolation | ✅ | Fresh navigation in `beforeEach` |
| Data Attributes | ✅ | Uses `data-testid`, `data-draggable-id`, etc. |
| Web-First Assertions | ✅ | Uses `toBeVisible()`, `toHaveCSS()`, etc. |
| Parallel Execution | ✅ | `fullyParallel: true` configured |
| Retries | ✅ | `retries: 2` for flaky test handling |
| Tracing | ✅ | `trace: 'on-first-retry'` enabled |
| Multi-browser | ✅ | Chromium, Firefox, WebKit + mobile |
| No Test Dependencies | ✅ | Each test is independent |
| Semantic Locators | ⚠️ | Could use more `getByRole()`, `getByTestId()` |
| Auto-waiting | ⚠️ | 50+ `waitForTimeout` calls could be reduced |

## Recommendations

### 1. Replace `waitForTimeout` with Auto-Waiting (High Priority)

**Current pattern:**
```typescript
await page.waitForTimeout(100);
await expect(demoPage.dragPreview).toBeVisible();
```

**Recommended:**
```typescript
await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
```

For non-assertion waits, use polling assertions:
```typescript
await expect(async () => {
  const scrollTop = await demoPage.getScrollTop('list1');
  expect(scrollTop).toBeGreaterThan(500);
}).toPass({ timeout: 3000 });
```

**Files with most timeouts:**
- `demo.page.ts` - 6 instances in navigation/drag helpers
- `drag-drop.spec.ts` - 12 instances
- `autoscroll-drift.spec.ts` - 15+ instances (some justified for scroll timing)

### 2. Add Data Attributes for CSS-only Selectors (Medium Priority)

**Current:**
```typescript
this.dragPreview = page.locator('.vdnd-drag-preview');
this.placeholder = page.locator('.vdnd-drag-placeholder-visible');
```

**Recommended - add to library components:**
```html
<div class="vdnd-drag-preview" data-testid="vdnd-drag-preview">
<div class="vdnd-drag-placeholder" data-testid="vdnd-placeholder">
```

Then in tests:
```typescript
this.dragPreview = page.getByTestId('vdnd-drag-preview');
```

### 3. Consistent Null Handling (Low Priority)

Some files handle null bounding boxes well, others use `!`:

**Inconsistent:**
```typescript
const box = await item.boundingBox();
await page.mouse.move(box!.x, box!.y);  // May crash with unclear error
```

**Consistent (used in drop-accuracy.spec.ts, axis-lock.spec.ts):**
```typescript
const box = await item.boundingBox();
if (!box) throw new Error('Could not get bounding box for item');
await page.mouse.move(box.x, box.y);
```

## Justified Exceptions

Some `waitForTimeout` usage is intentional and justified:

1. **Autoscroll tests** - Need real time passage to trigger scroll behavior
2. **Touch event tests** - Testing delay thresholds requires actual delays
3. **Animation settling** - Some tests need brief waits for CSS transitions

These should be documented with comments explaining why the wait is necessary.

## Testing Commands

```bash
# Fast iteration (Chromium only)
npx playwright test --reporter=dot --max-failures=1 --project=chromium

# Full browser matrix (required before done)
npx playwright test --reporter=dot --max-failures=1
```
