import { expect, type Page, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Empty List Edge Cases', () => {
  let demoPage: DemoPage;

  const regenerateWithItemCount = async (
    page: Page,
    totalItemCount: number,
    expectedPerList: number,
  ): Promise<void> => {
    const itemCountInput = page.locator('input[type="number"]').first();
    await itemCountInput.fill(String(totalItemCount));
    await page.locator('button:has-text("Regenerate")').click();

    await expect(async () => {
      const list1Count = await demoPage.getItemCount('list1');
      const list2Count = await demoPage.getItemCount('list2');
      expect(list1Count).toBe(expectedPerList);
      expect(list2Count).toBe(expectedPerList);
    }).toPass({ timeout: 2000 });
  };

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should handle dragging last item from list (results in empty source)', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    await regenerateWithItemCount(page, 2, 1);

    // Drag the only item from list1 to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    // List1 should now be empty
    await expect(async () => {
      const finalList1Count = await demoPage.getItemCount('list1');
      const finalList2Count = await demoPage.getItemCount('list2');
      expect(finalList1Count).toBe(0);
      expect(finalList2Count).toBe(2);
    }).toPass({ timeout: 2000 });
  });

  test('should display empty list correctly with no items', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    await regenerateWithItemCount(page, 2, 1);

    // Drag the only item from list1 to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    await expect(async () => {
      const list1Count = await demoPage.getItemCount('list1');
      expect(list1Count).toBe(0);
    }).toPass({ timeout: 2000 });

    // Verify list1 container still exists but is empty
    await expect(demoPage.list1Container).toBeVisible();

    // No items should be in list1
    const list1Items = demoPage.list1Items;
    await expect(list1Items).toHaveCount(0);
  });

  test('should drop into previously empty list', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    await regenerateWithItemCount(page, 2, 1);

    // First, empty list1 by moving its item to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);
    await expect(async () => {
      expect(await demoPage.getItemCount('list1')).toBe(0);
    }).toPass({ timeout: 2000 });

    // Now drag an item back into the empty list1
    await demoPage.dragItemToList('list2', 0, 'list1', 0);

    // List1 should now have 1 item
    await expect(async () => {
      const finalList1Count = await demoPage.getItemCount('list1');
      expect(finalList1Count).toBe(1);
    }).toPass({ timeout: 2000 });
  });

  test('should update item counts correctly during empty list operations', async ({ page }) => {
    // Set item count to 4 (2 items per list)
    await regenerateWithItemCount(page, 4, 2);

    const initialList1 = await demoPage.getItemCount('list1');
    const initialList2 = await demoPage.getItemCount('list2');

    expect(initialList1).toBe(2);
    expect(initialList2).toBe(2);

    // Move both items from list1 to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);
    await expect(async () => {
      expect(await demoPage.getItemCount('list1')).toBe(1);
      expect(await demoPage.getItemCount('list2')).toBe(3);
    }).toPass({ timeout: 2000 });

    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    // List1 should be empty, list2 should have all items
    await expect(async () => {
      expect(await demoPage.getItemCount('list1')).toBe(0);
      expect(await demoPage.getItemCount('list2')).toBe(4);
    }).toPass({ timeout: 2000 });
  });

  test('should handle single-item list reordering gracefully', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    await regenerateWithItemCount(page, 2, 1);

    const list1Count = await demoPage.getItemCount('list1');
    expect(list1Count).toBe(1);

    // Try to "reorder" within the single-item list (drag to same position)
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    if (sourceBox) {
      await sourceItem.hover();
      await page.mouse.down();
      // Move within the same list
      await page.mouse.move(sourceBox.x + 10, sourceBox.y + 30, { steps: 5 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      await page.mouse.up();
    }

    // List should still have 1 item
    await expect(async () => {
      const finalCount = await demoPage.getItemCount('list1');
      expect(finalCount).toBe(1);
    }).toPass({ timeout: 2000 });
  });
});
