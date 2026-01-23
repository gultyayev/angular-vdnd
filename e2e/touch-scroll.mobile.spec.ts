import { expect, type Locator, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

type TouchEventType = 'touchstart' | 'touchmove' | 'touchend';

async function dispatchTouch(
  locator: Locator,
  type: TouchEventType,
  clientX: number,
  clientY: number,
): Promise<boolean> {
  return locator.evaluate(
    (el, payload) => {
      const { type, clientX, clientY } = payload;

      const touch = {
        identifier: 1,
        target: el,
        clientX,
        clientY,
        pageX: clientX,
        pageY: clientY,
        screenX: clientX,
        screenY: clientY,
      };

      const touches = type === 'touchend' ? [] : [touch];
      const changedTouches = [touch];

      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: touches, configurable: true });
      Object.defineProperty(event, 'targetTouches', { value: touches, configurable: true });
      Object.defineProperty(event, 'changedTouches', { value: changedTouches, configurable: true });

      el.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { type, clientX, clientY },
  );
}

test.describe('Touch Scroll with Drag Delay (Mobile)', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should not preventDefault before drag delay expires (allows native scroll gesture)', async ({
    page,
  }) => {
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('500');
    await dragDelayInput.blur();

    const firstItem = demoPage.list1Items.first();
    await firstItem.scrollIntoViewIfNeeded();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    // Critical regression guard: with a delay configured, touchstart must NOT be prevented.
    // Preventing touchstart blocks native scroll on mobile.
    expect(await dispatchTouch(firstItem, 'touchstart', startX, startY)).toBe(false);

    // Move past threshold before delay is satisfied -> cancels drag attempt and must NOT prevent default.
    expect(await dispatchTouch(firstItem, 'touchmove', startX, startY - 120)).toBe(false);
    await dispatchTouch(firstItem, 'touchend', startX, startY - 120);

    await expect(demoPage.dragPreview).not.toBeVisible();
    await expect(firstItem).not.toHaveClass(/vdnd-drag-pending/);
  });

  test('should start drag after holding for delay duration then preventDefault on touchmove', async ({
    page,
  }) => {
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('200');
    await dragDelayInput.blur();

    const firstItem = demoPage.list1Items.first();
    await firstItem.scrollIntoViewIfNeeded();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    expect(await dispatchTouch(firstItem, 'touchstart', startX, startY)).toBe(false);

    // Pending state should appear when the delay passes.
    await expect(firstItem).toHaveClass(/vdnd-drag-pending/);

    // Moving past the threshold after the delay should start drag and prevent native scrolling.
    expect(await dispatchTouch(firstItem, 'touchmove', startX, startY + 120)).toBe(true);

    await expect(firstItem).not.toHaveClass(/vdnd-drag-pending/);
    await expect(demoPage.dragPreview).toBeVisible();

    await dispatchTouch(firstItem, 'touchend', startX, startY + 120);
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should apply pending class when delay passes and clear it on touchend without drag', async ({
    page,
  }) => {
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('200');
    await dragDelayInput.blur();

    const firstItem = demoPage.list1Items.first();
    await firstItem.scrollIntoViewIfNeeded();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    expect(await dispatchTouch(firstItem, 'touchstart', startX, startY)).toBe(false);
    await expect(firstItem).toHaveClass(/vdnd-drag-pending/);

    await dispatchTouch(firstItem, 'touchend', startX, startY);

    await expect(firstItem).not.toHaveClass(/vdnd-drag-pending/);
    await expect(demoPage.dragPreview).not.toBeVisible();
  });
});
