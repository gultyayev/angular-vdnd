import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Auto Scroll', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should auto-scroll when dragging near bottom edge', async ({ page }) => {
    // Get initial scroll position
    const initialScrollTop = await demoPage.getScrollTop('list1');

    // Start dragging an item
    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    await sourceItem.hover();
    await page.mouse.down();

    // Move to near bottom edge (within threshold of 50px)
    const nearBottomY = containerBox!.y + containerBox!.height - 25;
    await page.mouse.move(containerBox!.x + 100, nearBottomY);

    // Wait for auto-scroll to accumulate distance
    await expect(async () => {
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(initialScrollTop);
    }).toPass({ timeout: 3000 });

    await page.mouse.up();
  });

  test('should auto-scroll when dragging near top edge', async ({ page }) => {
    // First scroll down — wrap write+read in toPass so scroll re-applies if content isn't ready
    await expect(async () => {
      await demoPage.scrollList('list1', 200);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThanOrEqual(200);
    }).toPass({ timeout: 2000 });

    const initialScrollTop = await demoPage.getScrollTop('list1');
    expect(initialScrollTop).toBeGreaterThanOrEqual(200);

    // Start dragging a visible item
    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    await sourceItem.hover();
    await page.mouse.down();

    // Move to near top edge
    const nearTopY = containerBox!.y + 25;
    await page.mouse.move(containerBox!.x + 100, nearTopY);

    // Wait for auto-scroll to decrease scroll position
    await expect(async () => {
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeLessThan(initialScrollTop);
    }).toPass({ timeout: 3000 });

    await page.mouse.up();
  });

  test('should stop auto-scrolling when drag ends', async ({ page }) => {
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    const sourceItem = demoPage.list1Items.first();
    await sourceItem.hover();
    await page.mouse.down();

    // Move near bottom edge
    await page.mouse.move(containerBox!.x + 100, containerBox!.y + containerBox!.height - 25);

    // Wait for some autoscroll to happen
    await expect(async () => {
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 3000 });

    // End drag
    await page.mouse.up();

    // Get scroll position after drop
    const scrollAfterDrop = await demoPage.getScrollTop('list1');

    // Intentional delay: verify no further scrolling occurs after drag ends
    await page.waitForTimeout(300);
    const scrollAfterWait = await demoPage.getScrollTop('list1');

    expect(scrollAfterWait).toBe(scrollAfterDrop);
  });

  test('should not scroll when cursor is not near edge', async ({ page }) => {
    const initialScrollTop = await demoPage.getScrollTop('list1');

    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    await sourceItem.hover();
    await page.mouse.down();

    // Move to center of container (not near any edge)
    const centerY = containerBox!.y + containerBox!.height / 2;
    await page.mouse.move(containerBox!.x + 100, centerY);

    // Intentional delay: verify no scrolling occurs when cursor is in center
    await page.waitForTimeout(500);

    const finalScrollTop = await demoPage.getScrollTop('list1');

    // Scroll position should remain unchanged
    expect(finalScrollTop).toBe(initialScrollTop);

    await page.mouse.up();
  });
});
