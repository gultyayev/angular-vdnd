import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Drag and Drop', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should display both lists with items', async () => {
    const list1Count = await demoPage.getItemCount('list1');
    const list2Count = await demoPage.getItemCount('list2');

    expect(list1Count).toBeGreaterThan(0);
    expect(list2Count).toBeGreaterThan(0);
  });

  test('should drag item from list1 to list2', async () => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    // Get first item text for verification
    const itemText = await demoPage.getItemText('list1', 0);

    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count - 1);
    expect(finalList2Count).toBe(initialList2Count + 1);

    // Verify the item is now in list2
    const newFirstItem = await demoPage.getItemText('list2', 0);
    expect(newFirstItem).toBe(itemText);
  });

  test('should show drag preview while dragging', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + 100);

    // Verify drag preview is visible
    await expect(demoPage.dragPreview).toBeVisible();

    await page.mouse.up();
  });

  test('should visually hide the original element during drag', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    const itemId = await sourceItem.getAttribute('data-draggable-id');

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + 100);

    // The original element should be hidden via CSS (display: none)
    const originalElement = page.locator(`[data-draggable-id="${itemId}"]`);
    await expect(originalElement).toHaveCSS('display', 'none');

    await page.mouse.up();

    // After dropping, the element should be visible again
    await expect(originalElement).not.toHaveCSS('display', 'none');
  });

  // Previously skipped on WebKit, testing fix
  test('should reorder item within same list', async ({ page }) => {
    const firstItemText = await demoPage.getItemText('list1', 0);
    const secondItemText = await demoPage.getItemText('list1', 1);

    // Drag first item to second position
    await demoPage.dragItemToList('list1', 0, 'list1', 2);

    // First item should now be what was second
    const newFirstItemText = await demoPage.getItemText('list1', 0);
    expect(newFirstItemText).toBe(secondItemText);
  });

  test('should drag item from list2 to list1', async () => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    const itemText = await demoPage.getItemText('list2', 0);

    await demoPage.dragItemToList('list2', 0, 'list1', 0);

    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count + 1);
    expect(finalList2Count).toBe(initialList2Count - 1);

    const newFirstItem = await demoPage.getItemText('list1', 0);
    expect(newFirstItem).toBe(itemText);
  });
});

test.describe('Drag and Drop - Simplified API Mode', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
    await demoPage.enableSimplifiedApi();
  });

  test('should drag item from list1 to list2 in simplified mode', async () => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    // Get first item text for verification
    const itemText = await demoPage.getItemText('list1', 0);

    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count - 1);
    expect(finalList2Count).toBe(initialList2Count + 1);

    // Verify the item is now in list2
    const newFirstItem = await demoPage.getItemText('list2', 0);
    expect(newFirstItem).toBe(itemText);
  });

  test('should drag item from list2 to list1 in simplified mode', async () => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    const itemText = await demoPage.getItemText('list2', 0);

    await demoPage.dragItemToList('list2', 0, 'list1', 0);

    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count + 1);
    expect(finalList2Count).toBe(initialList2Count - 1);

    const newFirstItem = await demoPage.getItemText('list1', 0);
    expect(newFirstItem).toBe(itemText);
  });

  // Previously skipped on WebKit, testing fix
  test('should reorder item within same list in simplified mode', async ({ page }) => {
    const firstItemText = await demoPage.getItemText('list1', 0);
    const secondItemText = await demoPage.getItemText('list1', 1);

    // Drag first item to second position
    await demoPage.dragItemToList('list1', 0, 'list1', 2);

    // First item should now be what was second
    const newFirstItemText = await demoPage.getItemText('list1', 0);
    expect(newFirstItemText).toBe(secondItemText);
  });

  test('should drop at exact preview position during cross-list drag', async ({ page }) => {
    // This test verifies that the drop position matches where the preview was shown
    // Bug: In simplified mode, the drop position was off by 1 (item dropped earlier than preview)

    // Get texts of first few items in both lists for verification
    const list1Items = [
      await demoPage.getItemText('list1', 0),
      await demoPage.getItemText('list1', 1),
      await demoPage.getItemText('list1', 2),
    ];
    const list2Items = [
      await demoPage.getItemText('list2', 0),
      await demoPage.getItemText('list2', 1),
      await demoPage.getItemText('list2', 2),
      await demoPage.getItemText('list2', 3),
    ];

    // Drag first item from list1 to position 2 in list2 (between item 1 and item 2)
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    const targetContainer = demoPage.list2VirtualScroll;
    const targetBox = await targetContainer.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes');
    }

    const itemHeight = 50;
    // Target position 2: drop at index 2, which means AFTER index 1 (second item)
    // The preview should appear between item at index 1 and item at index 2
    const targetIndex = 2;
    const targetY = targetBox.y + targetIndex * itemHeight + itemHeight / 2;
    const targetX = targetBox.x + targetBox.width / 2;

    // Perform drag
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    await page.waitForTimeout(50);

    // Move to target position
    await page.mouse.move(targetX, targetY, { steps: 10 });
    await page.waitForTimeout(100);

    // Drop
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Verify the item ended up at the correct position
    // List 2 should now be: [original item 0, original item 1, DROPPED ITEM, original item 2, ...]
    const newList2Item0 = await demoPage.getItemText('list2', 0);
    const newList2Item1 = await demoPage.getItemText('list2', 1);
    const newList2Item2 = await demoPage.getItemText('list2', 2);
    const newList2Item3 = await demoPage.getItemText('list2', 3);

    expect(newList2Item0).toBe(list2Items[0]); // Original first item unchanged
    expect(newList2Item1).toBe(list2Items[1]); // Original second item unchanged
    expect(newList2Item2).toBe(list1Items[0]); // Dropped item at position 2
    expect(newList2Item3).toBe(list2Items[2]); // Original third item pushed down
  });

  test('should drop at exact preview position when target list is scrolled', async ({ page }) => {
    // This test reproduces the bug where drop position is off by 1 when target list is scrolled
    // We verify by scrolling back to top and checking the item appeared at the expected index

    const itemHeight = 50;
    const scrollAmount = 20 * itemHeight; // Scroll down 20 items (1000px)
    const targetVisibleSlot = 3; // Target the 4th visible slot (0-indexed)

    // Expected array index after drop:
    // - scrollTop=1000 means first visible is at index 20
    // - visual slot 3 from top of viewport = array index 23
    const expectedDropIndex = Math.floor(scrollAmount / itemHeight) + targetVisibleSlot;

    // Get the text of the source item
    const sourceItemText = await demoPage.getItemText('list1', 0);

    // Scroll list2 down before dragging
    await demoPage.scrollList('list2', scrollAmount);
    await page.waitForTimeout(100);

    // Ensure list2 is fully in viewport (header may push it down)
    await demoPage.list2VirtualScroll.scrollIntoViewIfNeeded();
    await page.waitForTimeout(50);

    // Get container bounds
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    const targetContainer = demoPage.list2VirtualScroll;
    const targetBox = await targetContainer.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes');
    }

    // Target visual slot 3 (center of the slot)
    const targetY = targetBox.y + targetVisibleSlot * itemHeight + itemHeight / 2;
    const targetX = targetBox.x + targetBox.width / 2;

    // Perform drag
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    await page.waitForTimeout(50);

    // Move to target position
    await page.mouse.move(targetX, targetY, { steps: 10 });
    await page.waitForTimeout(100);

    // Drop
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Scroll back to top to verify the item was inserted at the correct array index
    await demoPage.scrollList('list2', 0);
    await page.waitForTimeout(100);

    // The dropped item should be at array index expectedDropIndex
    // Scroll to bring that index into view
    const scrollToIndex = Math.max(0, expectedDropIndex - 3); // Show a few items before
    await demoPage.scrollList('list2', scrollToIndex * itemHeight);
    await page.waitForTimeout(100);

    // Check the item at the expected position (accounting for overscan)
    // With overscan, items at indices (scrollToIndex - overscan) are in DOM
    const domOffset = Math.min(3, scrollToIndex); // overscan or items before scroll position
    const expectedDomPosition = expectedDropIndex - scrollToIndex + domOffset;

    // Get items around the expected position
    const itemAtExpectedPos = await demoPage.getItemText('list2', expectedDomPosition);
    expect(itemAtExpectedPos).toBe(sourceItemText);
  });

  // Test autoscroll in simplified API mode
  // Skip on Firefox due to Playwright-specific mouse event handling issue
  // Note: Autoscroll works correctly in Firefox when tested manually and in verbose mode
  // (see autoscroll-drift.spec.ts which passes on all browsers including Firefox)
  test('should reorder item with autoscroll in simplified mode', async ({
    page,
    browserName,
  }, testInfo) => {
    testInfo.skip(
      browserName === 'firefox',
      'Playwright mouse events not properly triggering autoscroll in simplified mode on Firefox',
    );

    // Get the first item text - we'll drag this to the bottom
    const firstItemText = await demoPage.getItemText('list2', 0);
    const secondItemText = await demoPage.getItemText('list2', 1);

    // Get container bounds for edge detection
    const containerBox = await demoPage.list2VirtualScroll.boundingBox();
    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    // Use hover() to position on item (matches working autoscroll-drift pattern)
    const sourceItem = demoPage.list2Items.first();
    await sourceItem.hover();
    await page.mouse.down();

    // Move to bottom edge to trigger autoscroll
    const nearBottomY = containerBox.y + containerBox.height - 25;
    await page.mouse.move(containerBox.x + 100, nearBottomY);

    // Wait for autoscroll (3 seconds should scroll significantly)
    await page.waitForTimeout(3000);

    const scrollTop = await demoPage.getScrollTop('list2');
    expect(scrollTop).toBeGreaterThan(200);

    // Drop the item
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Scroll back to top to verify reorder happened
    await demoPage.scrollList('list2', 0);
    await page.waitForTimeout(100);

    // First item should now be what was second (Item 1 was moved somewhere else)
    const newFirstItemText = await demoPage.getItemText('list2', 0);
    expect(newFirstItemText).toBe(secondItemText);
  });
});
