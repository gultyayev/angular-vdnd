import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Container Resize', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should display items with CSS-based height', async () => {
    // Verify that items are rendered correctly with CSS-based height
    const list1Count = await demoPage.getItemCount('list1');
    expect(list1Count).toBeGreaterThan(0);

    // Verify the virtual scroll container has the expected height from CSS
    const container = demoPage.list1VirtualScroll;
    const boundingBox = await container.boundingBox();
    expect(boundingBox?.height).toBe(400);
  });

  test('should render correct number of visible items after viewport resize', async ({ page }) => {
    // Get initial visible items count
    const initialVisibleItems = await demoPage.list1Items.count();

    // Resize the viewport to be larger
    await page.setViewportSize({ width: 1280, height: 1200 });

    // Wait for ResizeObserver to process and verify items remain stable
    await expect(async () => {
      const afterResizeItems = await demoPage.list1Items.count();
      expect(afterResizeItems).toBe(initialVisibleItems);
    }).toPass({ timeout: 2000 });
  });

  test('should adapt to container height changes via JavaScript', async () => {
    const container = demoPage.list1VirtualScroll;

    // Get initial state
    const initialVisibleItems = await demoPage.list1Items.count();

    // Change the container height via JavaScript (simulating CSS change)
    await container.evaluate((el) => {
      el.style.height = '600px';
    });

    // Wait for ResizeObserver to process the height change
    await expect(async () => {
      const newBox = await container.boundingBox();
      expect(newBox?.height).toBe(600);
    }).toPass({ timeout: 2000 });

    // More items should now be visible (or at least the same if overscan covers it)
    const newVisibleItems = await demoPage.list1Items.count();
    expect(newVisibleItems).toBeGreaterThanOrEqual(initialVisibleItems);
  });

  test('should maintain scroll position after container resize', async () => {
    // Scroll down in the list
    await demoPage.scrollList('list1', 500);
    const scrollTopBefore = await demoPage.getScrollTop('list1');
    expect(scrollTopBefore).toBe(500);

    // Resize container
    const container = demoPage.list1VirtualScroll;
    await container.evaluate((el) => {
      el.style.height = '300px';
    });

    // Wait for ResizeObserver to process, then verify scroll position preserved
    await expect(async () => {
      const newBox = await container.boundingBox();
      expect(newBox?.height).toBe(300);
    }).toPass({ timeout: 2000 });
    const scrollTopAfter = await demoPage.getScrollTop('list1');
    expect(scrollTopAfter).toBe(500);
  });

  test('should handle drag and drop correctly after resize', async () => {
    // Resize the container first
    const container = demoPage.list1VirtualScroll;
    await container.evaluate((el) => {
      el.style.height = '500px';
    });
    // Wait for ResizeObserver to process the height change
    await expect(async () => {
      const box = await container.boundingBox();
      expect(box?.height).toBe(500);
    }).toPass({ timeout: 2000 });

    // Get initial counts
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    // Perform drag from list1 to list2
    const itemText = await demoPage.getItemText('list1', 0);
    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    // Verify the drop was successful
    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count - 1);
    expect(finalList2Count).toBe(initialList2Count + 1);

    // Verify the item is now in list2
    const newFirstItem = await demoPage.getItemText('list2', 0);
    expect(newFirstItem).toBe(itemText);
  });

  test('should handle very small container heights', async () => {
    const container = demoPage.list1VirtualScroll;

    // Set a very small height (only fits 2 items)
    await container.evaluate((el) => {
      el.style.height = '100px';
    });

    // Wait for ResizeObserver to process, then verify items are still rendered
    await expect(async () => {
      const box = await container.boundingBox();
      expect(box?.height).toBe(100);
    }).toPass({ timeout: 2000 });
    const visibleItems = await demoPage.list1Items.count();
    expect(visibleItems).toBeGreaterThan(0);

    // Verify scrolling still works
    await demoPage.scrollList('list1', 200);
    const scrollTop = await demoPage.getScrollTop('list1');
    expect(scrollTop).toBe(200);
  });

  test('should handle container resizing during drag operation', async ({ page }) => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');
    const draggedItemText = await demoPage.getItemText('list1', 0);

    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    const container = demoPage.list1VirtualScroll;

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 10, sourceBox!.y + 10, {
      steps: 2,
    });

    // Verify drag preview is visible
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Resize the container during drag
    await container.evaluate((el) => {
      el.style.height = '500px';
    });
    await expect(async () => {
      const box = await container.boundingBox();
      expect(box?.height).toBe(500);
    }).toPass({ timeout: 2000 });

    // Continue the drag and drop
    const targetBox = await demoPage.list2VirtualScroll.boundingBox();
    const targetX = targetBox!.x + targetBox!.width / 2;
    const targetY = Math.min(targetBox!.y + 25, targetBox!.y + targetBox!.height - 10);
    await page.mouse.move(targetX, targetY, { steps: 10 });

    // Ensure the drop target has been resolved before releasing the mouse.
    // Drag updates are RAF-throttled; dropping immediately after a move can keep the old droppable.
    await expect(demoPage.list2Container.locator('.vdnd-drag-placeholder-visible')).toBeVisible({
      timeout: 2000,
    });
    await page.mouse.up();

    // Verify the drag completed successfully (item moved to list2)
    await expect.poll(() => demoPage.getItemCount('list1')).toBe(initialList1Count - 1);
    await expect.poll(() => demoPage.getItemCount('list2')).toBe(initialList2Count + 1);
    await expect.poll(() => demoPage.getItemText('list2', 0)).toBe(draggedItemText);
  });

  test('should render correctly after multiple rapid resizes', async ({ page }) => {
    const container = demoPage.list1VirtualScroll;

    // Perform multiple rapid resizes
    for (const height of [300, 500, 200, 600, 400]) {
      await container.evaluate((el, h) => {
        el.style.height = `${h}px`;
      }, height);
      // Wait one rAF between resizes for rendering to process
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }

    // Wait for final resize to settle via ResizeObserver
    await expect(async () => {
      const finalBox = await container.boundingBox();
      expect(finalBox?.height).toBe(400);
    }).toPass({ timeout: 2000 });

    // Verify items are still rendered correctly
    const visibleItems = await demoPage.list1Items.count();
    expect(visibleItems).toBeGreaterThan(0);

    // Verify scrolling works
    await demoPage.scrollList('list1', 300);
    const scrollTop = await demoPage.getScrollTop('list1');
    expect(scrollTop).toBe(300);
  });
});
