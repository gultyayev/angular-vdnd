import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Drop Position Accuracy', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should drop at correct position (beginning of list)', async () => {
    const itemText = await demoPage.getItemText('list1', 0);

    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    // Verify item is at the beginning of list2
    const newFirstItem = await demoPage.getItemText('list2', 0);
    expect(newFirstItem).toBe(itemText);
  });

  test('should drop at correct position (middle of list)', async () => {
    // Get third item from list1
    const itemText = await demoPage.getItemText('list1', 2);
    const list2SecondItemText = await demoPage.getItemText('list2', 1);

    // Drag to position 2 in list2 (after first two items)
    await demoPage.dragItemToList('list1', 2, 'list2', 2);

    // The original second item should still be at position 1
    const newSecondItem = await demoPage.getItemText('list2', 1);
    expect(newSecondItem).toBe(list2SecondItemText);

    // The dragged item should be at position 2
    const newThirdItem = await demoPage.getItemText('list2', 2);
    expect(newThirdItem).toBe(itemText);
  });

  test('should drop at end of list when dragging past last item', async () => {
    const itemText = await demoPage.getItemText('list1', 0);
    const initialList2Count = await demoPage.getItemCount('list2');

    // First scroll list2 to the end so we can drop at the actual end
    // Wrap write+read in toPass so scroll re-applies if content isn't ready
    await expect(async () => {
      await demoPage.scrollList('list2', (initialList2Count - 1) * 50);
      const scrollTop = await demoPage.getScrollTop('list2');
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    // Now drag to the end of the visible area (which is now the actual end)
    await demoPage.dragItemToList('list1', 0, 'list2', 999);

    // Verify the new count is correct
    const newCount = await demoPage.getItemCount('list2');
    expect(newCount).toBe(initialList2Count + 1);

    // Scroll to the very end to see the last item
    await expect(async () => {
      await demoPage.scrollList('list2', (newCount - 1) * 50);
      const scrollTop = await demoPage.getScrollTop('list2');
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    // Verify item is at the end of list2 (last visible item after scrolling)
    const lastVisibleItem = await demoPage.list2Items.last().textContent();
    expect(lastVisibleItem?.trim()).toBe(itemText);
  });

  test('should handle cancel (escape key) without dropping', async ({ page }) => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    const sourceItem = demoPage.list1Items.first();
    const targetBox = await demoPage.list2Container.boundingBox();

    // Start drag
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(targetBox!.x + 100, targetBox!.y + 100);

    // Verify drag is in progress before canceling
    await expect(demoPage.dragPreview).toBeVisible();

    // Press escape to cancel
    await page.keyboard.press('Escape');

    // Wait for drag to be canceled (preview disappears)
    await expect(demoPage.dragPreview).not.toBeVisible();

    // Release mouse (drag was canceled, so this should have no effect)
    await page.mouse.up();

    // Counts should remain unchanged
    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count);
    expect(finalList2Count).toBe(initialList2Count);
  });

  // Previously skipped on WebKit, testing fix
  test('should maintain item order after multiple drags', async () => {
    // Get original order of first 3 items in list1
    const item0 = await demoPage.getItemText('list1', 0);
    const item1 = await demoPage.getItemText('list1', 1);
    const item2 = await demoPage.getItemText('list1', 2);

    // Move first item to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    // Verify the first drag worked
    const list2First = await demoPage.getItemText('list2', 0);
    expect(list2First).toBe(item0); // Should be "List 1 - Item 1"

    // Move it back to list1 at position 2
    await demoPage.dragItemToList('list2', 0, 'list1', 2);

    // Verify the order: item1, item2, item0
    expect(await demoPage.getItemText('list1', 0)).toBe(item1);
    expect(await demoPage.getItemText('list1', 1)).toBe(item2);
    expect(await demoPage.getItemText('list1', 2)).toBe(item0);
  });
});
