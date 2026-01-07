import { expect, test } from '@playwright/test';
import { DemoPage } from '../fixtures/demo.page';

test.describe('Keyboard Drag - Virtual Scroll Integration', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should auto-scroll when navigating to item below visible range', async ({ page }) => {
    const initialScroll = await demoPage.getScrollTop('list1');

    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    // Navigate down many times (past visible items)
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowDown');
    }

    // Scroll position should have increased
    const newScroll = await demoPage.getScrollTop('list1');
    expect(newScroll).toBeGreaterThan(initialScroll);
  });

  test('should auto-scroll when navigating to item above visible range', async ({ page }) => {
    // First scroll down
    await demoPage.scrollList('list1', 500);
    await page.waitForTimeout(100);

    // Focus a visible item after scrolling
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    // Navigate up many times
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowUp');
    }

    // Scroll should have decreased
    const newScroll = await demoPage.getScrollTop('list1');
    expect(newScroll).toBeLessThan(500);
  });

  test('should handle navigation through large list without performance issues', async ({
    page,
  }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    const startTime = Date.now();

    // Navigate down 50 items
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowDown');
    }

    const elapsedTime = Date.now() - startTime;

    // Should complete in reasonable time (< 5 seconds for 50 moves)
    expect(elapsedTime).toBeLessThan(5000);

    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should keep dragged item visible during keyboard navigation', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    // Navigate down
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Drag preview should still be visible
    await expect(demoPage.dragPreview).toBeVisible();
  });

  test('should complete drag after navigating through virtual scroll boundary', async ({
    page,
  }) => {
    const firstItemText = await demoPage.getItemText('list1', 0);

    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    // Navigate past the visible area
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowDown');
    }

    // Drop the item
    await page.keyboard.press('Space');

    // Drag should be complete
    await expect(demoPage.dragPreview).not.toBeVisible();

    // The item should no longer be at position 0
    const newFirstItemText = await demoPage.getItemText('list1', 0);
    expect(newFirstItemText).not.toBe(firstItemText);
  });

  test('should scroll smoothly without jumps during continuous navigation', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    const scrollPositions: number[] = [];

    // Navigate and track scroll positions
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowDown');
      const scrollTop = await demoPage.getScrollTop('list1');
      scrollPositions.push(scrollTop);
    }

    // Verify scroll positions are monotonically non-decreasing
    // (may stay same if still in visible area, but never decrease)
    for (let i = 1; i < scrollPositions.length; i++) {
      expect(scrollPositions[i]).toBeGreaterThanOrEqual(scrollPositions[i - 1]);
    }

    await page.keyboard.press('Space');
  });

  test('should handle rapid navigation without missing items', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    // Very rapid navigation
    const moves = 10;
    const promises = [];
    for (let i = 0; i < moves; i++) {
      promises.push(page.keyboard.press('ArrowDown'));
    }
    await Promise.all(promises);

    // Give time for state to settle
    await page.waitForTimeout(200);

    // Drop should work
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).not.toBeVisible();
  });
});
