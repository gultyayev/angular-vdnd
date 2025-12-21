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

    // Wait for auto-scroll to occur
    await page.waitForTimeout(500);

    const finalScrollTop = await demoPage.getScrollTop('list1');

    // Scroll position should have increased
    expect(finalScrollTop).toBeGreaterThan(initialScrollTop);

    await page.mouse.up();
  });

  test('should auto-scroll when dragging near top edge', async ({ page }) => {
    // First scroll down
    await demoPage.scrollList('list1', 200);
    await page.waitForTimeout(100);

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

    // Wait for auto-scroll
    await page.waitForTimeout(500);

    const finalScrollTop = await demoPage.getScrollTop('list1');

    // Scroll position should have decreased
    expect(finalScrollTop).toBeLessThan(initialScrollTop);

    await page.mouse.up();
  });

  test('should stop auto-scrolling when drag ends', async ({ page }) => {
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    const sourceItem = demoPage.list1Items.first();
    await sourceItem.hover();
    await page.mouse.down();

    // Move near bottom edge
    await page.mouse.move(
      containerBox!.x + 100,
      containerBox!.y + containerBox!.height - 25
    );
    await page.waitForTimeout(200);

    // End drag
    await page.mouse.up();

    // Get scroll position after drop
    const scrollAfterDrop = await demoPage.getScrollTop('list1');

    // Wait and verify no further scrolling
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

    // Wait to see if any scrolling occurs
    await page.waitForTimeout(500);

    const finalScrollTop = await demoPage.getScrollTop('list1');

    // Scroll position should remain unchanged
    expect(finalScrollTop).toBe(initialScrollTop);

    await page.mouse.up();
  });
});
