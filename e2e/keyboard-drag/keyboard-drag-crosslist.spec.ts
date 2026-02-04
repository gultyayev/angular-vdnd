import { expect, test } from '@playwright/test';
import { DemoPage } from '../fixtures/demo.page';

test.describe('Keyboard Drag - Cross-List Movement', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should move item to adjacent list with ArrowRight', async ({ page }) => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');
    const itemText = await demoPage.getItemText('list1', 0);

    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(100); // Wait for drag to start
    await page.keyboard.press('ArrowRight'); // Move to list2
    await page.waitForTimeout(100); // Wait for cross-list move
    await page.keyboard.press('Space'); // Drop
    await page.waitForTimeout(200); // Wait for drop to complete

    // Verify item moved
    expect(await demoPage.getItemCount('list1')).toBe(initialList1Count - 1);
    expect(await demoPage.getItemCount('list2')).toBe(initialList2Count + 1);

    // Verify the item is now in list2
    const list2FirstItem = await demoPage.getItemText('list2', 0);
    expect(list2FirstItem).toBe(itemText);
  });

  test('should move item back with ArrowLeft', async ({ page }) => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');
    const itemText = await demoPage.getItemText('list2', 0);

    // Start in list2
    await demoPage.list2Items.first().focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(100); // Wait for drag to start
    await page.keyboard.press('ArrowLeft'); // Move to list1
    await page.waitForTimeout(100); // Wait for cross-list move
    await page.keyboard.press('Space');
    await page.waitForTimeout(200); // Wait for drop to complete

    // Verify moved to list1
    expect(await demoPage.getItemCount('list1')).toBe(initialList1Count + 1);
    expect(await demoPage.getItemCount('list2')).toBe(initialList2Count - 1);

    // Verify the item is now in list1
    const list1FirstItem = await demoPage.getItemText('list1', 0);
    expect(list1FirstItem).toBe(itemText);
  });

  test('should maintain approximate vertical position when changing lists', async ({ page }) => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    const movedItemText = await demoPage.getItemText('list1', 2);
    const list2Item0 = await demoPage.getItemText('list2', 0);
    const list2Item1 = await demoPage.getItemText('list2', 1);
    const list2Item2 = await demoPage.getItemText('list2', 2);

    // Start from 3rd item in list1.
    await demoPage.list1Items.nth(2).focus();
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    // Move to list2 and drop.
    await page.keyboard.press('ArrowRight');
    await expect(demoPage.list2Container.locator('.vdnd-drag-placeholder-visible')).toBeVisible({
      timeout: 2000,
    });
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).not.toBeVisible();

    await expect.poll(() => demoPage.getItemCount('list1')).toBe(initialList1Count - 1);
    await expect.poll(() => demoPage.getItemCount('list2')).toBe(initialList2Count + 1);

    // The moved item should land at the same visual slot (index 2) in list2.
    expect(await demoPage.getItemText('list2', 0)).toBe(list2Item0);
    expect(await demoPage.getItemText('list2', 1)).toBe(list2Item1);
    expect(await demoPage.getItemText('list2', 2)).toBe(movedItemText);
    expect(await demoPage.getItemText('list2', 3)).toBe(list2Item2);
  });

  test('should stay in list when ArrowLeft at leftmost list', async ({ page }) => {
    const initialList1Count = await demoPage.getItemCount('list1');

    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    // Try to move left (list1 is already leftmost)
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');

    await page.keyboard.press('Space');

    // Count should be unchanged (item stayed in list1)
    expect(await demoPage.getItemCount('list1')).toBe(initialList1Count);
  });

  test('should stay in list when ArrowRight at rightmost list', async ({ page }) => {
    const initialList2Count = await demoPage.getItemCount('list2');

    await demoPage.list2Items.first().focus();
    await page.keyboard.press('Space');

    // Try to move right (list2 is already rightmost)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await page.keyboard.press('Space');

    // Count should be unchanged (item stayed in list2)
    expect(await demoPage.getItemCount('list2')).toBe(initialList2Count);
  });

  test('should allow vertical and horizontal movement combination', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(100); // Wait for drag to start

    // Move down 2 positions, then right to list2
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100); // Wait for cross-list move
    await page.keyboard.press('Space');
    await page.waitForTimeout(200); // Wait for drop to complete

    // Item should be in list2 (at some position based on vertical move)
    const list1Count = await demoPage.getItemCount('list1');
    const list2Count = await demoPage.getItemCount('list2');

    expect(list1Count).toBe(49);
    expect(list2Count).toBe(51);
  });

  test('should cancel cross-list move and return to original list', async ({ page }) => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight'); // Move to list2
    await page.keyboard.press('Escape'); // Cancel

    // Counts should be unchanged (item returned to list1)
    expect(await demoPage.getItemCount('list1')).toBe(initialList1Count);
    expect(await demoPage.getItemCount('list2')).toBe(initialList2Count);
  });
});
