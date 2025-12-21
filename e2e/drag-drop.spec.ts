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

  test('should reorder item within same list', async () => {
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
