import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Empty List Edge Cases', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should handle dragging last item from list (results in empty source)', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    const itemCountInput = page.locator('input[type="number"]').first();
    await itemCountInput.fill('2');
    await page.locator('button:has-text("Regenerate Items")').click();
    await page.waitForTimeout(100);

    const initialList1Count = await demoPage.getItemCount('list1');
    expect(initialList1Count).toBe(1);

    // Drag the only item from list1 to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    // List1 should now be empty
    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(0);
    expect(finalList2Count).toBe(2);
  });

  test('should display empty list correctly with no items', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    const itemCountInput = page.locator('input[type="number"]').first();
    await itemCountInput.fill('2');
    await page.locator('button:has-text("Regenerate Items")').click();
    await page.waitForTimeout(100);

    // Drag the only item from list1 to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    // Verify list1 container still exists but is empty
    await expect(demoPage.list1Container).toBeVisible();

    // No items should be in list1
    const list1Items = demoPage.list1Items;
    await expect(list1Items).toHaveCount(0);
  });

  test('should drop into previously empty list', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    const itemCountInput = page.locator('input[type="number"]').first();
    await itemCountInput.fill('2');
    await page.locator('button:has-text("Regenerate Items")').click();
    await page.waitForTimeout(100);

    // First, empty list1 by moving its item to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);
    await page.waitForTimeout(100);

    expect(await demoPage.getItemCount('list1')).toBe(0);

    // Now drag an item back into the empty list1
    await demoPage.dragItemToList('list2', 0, 'list1', 0);
    await page.waitForTimeout(100);

    // List1 should now have 1 item
    const finalList1Count = await demoPage.getItemCount('list1');
    expect(finalList1Count).toBe(1);
  });

  test('should update item counts correctly during empty list operations', async ({ page }) => {
    // Set item count to 4 (2 items per list)
    const itemCountInput = page.locator('input[type="number"]').first();
    await itemCountInput.fill('4');
    await page.locator('button:has-text("Regenerate Items")').click();
    await page.waitForTimeout(100);

    const initialList1 = await demoPage.getItemCount('list1');
    const initialList2 = await demoPage.getItemCount('list2');

    expect(initialList1).toBe(2);
    expect(initialList2).toBe(2);

    // Move both items from list1 to list2
    await demoPage.dragItemToList('list1', 0, 'list2', 0);
    await page.waitForTimeout(100);

    expect(await demoPage.getItemCount('list1')).toBe(1);
    expect(await demoPage.getItemCount('list2')).toBe(3);

    await demoPage.dragItemToList('list1', 0, 'list2', 0);
    await page.waitForTimeout(100);

    // List1 should be empty, list2 should have all items
    expect(await demoPage.getItemCount('list1')).toBe(0);
    expect(await demoPage.getItemCount('list2')).toBe(4);
  });

  test('should handle single-item list reordering gracefully', async ({ page }) => {
    // Set item count to 2 (1 item per list)
    const itemCountInput = page.locator('input[type="number"]').first();
    await itemCountInput.fill('2');
    await page.locator('button:has-text("Regenerate Items")').click();
    await page.waitForTimeout(100);

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
      await page.waitForTimeout(50);
      await page.mouse.up();
      await page.waitForTimeout(100);
    }

    // List should still have 1 item
    const finalCount = await demoPage.getItemCount('list1');
    expect(finalCount).toBe(1);
  });
});
