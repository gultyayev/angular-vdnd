import { devices, expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

// Use Pixel 5 device for Chromium with touch support
test.use({ ...devices['Pixel 5'] });

test.describe('Touch Scroll with Drag Delay', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should allow scroll when swiping before drag delay expires', async ({ page }) => {
    // Set drag delay to 500ms - enough time to swipe without triggering drag
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('500');
    await page.waitForTimeout(100);

    // Get initial scroll position
    const initialScrollTop = await demoPage.getScrollTop('list1');
    expect(initialScrollTop).toBe(0);

    // Get the virtual scroll container and first item
    const virtualScroll = demoPage.list1VirtualScroll;
    const firstItem = demoPage.list1Items.first();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    // Starting point - center of first item
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    // Use CDP for touch events (works in all Chromium-based browsers)
    const client = await page.context().newCDPSession(page);

    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });

    // Quick swipe up - happens within 100ms, well before 500ms delay
    for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(20);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY - i * 30 }],
      });
    }

    // Touch end
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    // Wait for scroll to settle
    await page.waitForTimeout(300);

    // The scroll should have happened because we swiped before delay expired
    const finalScrollTop = await demoPage.getScrollTop('list1');

    // EXPECTED: scroll position should have changed (scroll happened)
    // BUG: scroll position stays at 0 because preventDefault() blocks scrolling
    expect(finalScrollTop).toBeGreaterThan(0);
  });

  test('should start drag when holding for delay duration then moving', async ({ page }) => {
    // Set drag delay to 200ms
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('200');
    await page.waitForTimeout(100);

    // Get first item
    const firstItem = demoPage.list1Items.first();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    // Use CDP for touch events
    const client = await page.context().newCDPSession(page);

    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });

    // Wait longer than delay (250ms > 200ms)
    await page.waitForTimeout(250);

    // Move to trigger drag
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: startY + 100 }],
    });

    // Drag preview should be visible
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 1000 });

    // Clean up - end the drag
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await page.waitForTimeout(100);
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should cancel drag attempt when moving before delay expires', async ({ page }) => {
    // Set drag delay to 500ms
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('500');
    await page.waitForTimeout(100);

    // Get first item
    const firstItem = demoPage.list1Items.first();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    // Use CDP for touch events
    const client = await page.context().newCDPSession(page);

    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });

    // Move quickly (50ms < 500ms delay)
    await page.waitForTimeout(50);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: startY + 100 }],
    });

    // End touch
    await page.waitForTimeout(50);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    // Drag preview should NOT be visible (drag was cancelled)
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should apply vdnd-drag-pending class when delay passes', async ({ page }) => {
    // Set drag delay to 200ms
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('200');
    await page.waitForTimeout(100);

    // Get first item
    const firstItem = demoPage.list1Items.first();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    // Item should not have pending class initially
    await expect(firstItem).not.toHaveClass(/vdnd-drag-pending/);

    // Use CDP for touch events
    const client = await page.context().newCDPSession(page);

    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });

    // Wait longer than delay (250ms > 200ms)
    await page.waitForTimeout(250);

    // Item should have pending class
    await expect(firstItem).toHaveClass(/vdnd-drag-pending/);

    // Clean up - end touch without moving (should clear pending)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    // Pending class should be removed
    await page.waitForTimeout(100);
    await expect(firstItem).not.toHaveClass(/vdnd-drag-pending/);
  });

  test('should remove pending class when drag starts', async ({ page }) => {
    // Set drag delay to 200ms
    const dragDelayInput = page.locator('[data-testid="drag-delay-input"]');
    await dragDelayInput.fill('200');
    await page.waitForTimeout(100);

    // Get first item
    const firstItem = demoPage.list1Items.first();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    const client = await page.context().newCDPSession(page);

    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });

    // Wait for delay
    await page.waitForTimeout(250);

    // Should have pending class
    await expect(firstItem).toHaveClass(/vdnd-drag-pending/);

    // Move to start drag
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: startY + 100 }],
    });

    // Wait for drag to start
    await page.waitForTimeout(100);

    // Pending class should be removed when dragging
    await expect(firstItem).not.toHaveClass(/vdnd-drag-pending/);

    // Drag preview should be visible
    await expect(demoPage.dragPreview).toBeVisible();

    // Clean up
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  });
});
