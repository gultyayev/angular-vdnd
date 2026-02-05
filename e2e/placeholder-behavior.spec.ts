import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Placeholder Behavior During Drag', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should show only one placeholder when dragging within same list', async ({ page }) => {
    const sourceItem = demoPage.list2Items.first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item bounding box');

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();

    // Move down ~75px to trigger drag and be within the list
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 75, { steps: 5 });

    // Wait for drag preview to appear (indicates drag state is active)
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Count visible placeholders in the DOM - there should be exactly 1
    const placeholders = await demoPage.list2Container
      .locator('.vdnd-drag-placeholder-visible')
      .count();
    expect(placeholders).toBe(1);

    // Verify no ghost elements exist (empty .item divs without text)
    const ghostCount = await demoPage.countGhostElements('list2');
    expect(ghostCount, 'Ghost elements should not exist during drag').toBe(0);

    // Also verify the dragged item has display: none (no double space)
    const draggedItemId = await sourceItem.getAttribute('data-draggable-id');
    const originalElement = page.locator(`[data-draggable-id="${draggedItemId}"]`);
    await expect(originalElement).toHaveCSS('display', 'none');

    await page.mouse.up();
  });

  test('should show only one placeholder when dragging to different list', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();
    const targetBox = await demoPage.list2VirtualScroll.boundingBox();
    if (!targetBox) throw new Error('Could not get target container bounding box');

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();

    // Move to list2
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 75, { steps: 10 });

    // Wait for drag preview to appear
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Count visible placeholders in list2 - there should be exactly 1
    const list2Placeholders = await demoPage.list2Container
      .locator('.vdnd-drag-placeholder-visible')
      .count();
    expect(list2Placeholders).toBe(1);

    // List1 should have no visible placeholders
    const list1Placeholders = await demoPage.list1Container
      .locator('.vdnd-drag-placeholder-visible')
      .count();
    expect(list1Placeholders).toBe(0);

    // Verify no ghost elements exist in either list
    const ghostCountList1 = await demoPage.countGhostElements('list1');
    const ghostCountList2 = await demoPage.countGhostElements('list2');
    expect(ghostCountList1, 'List 1 should have no ghost elements').toBe(0);
    expect(ghostCountList2, 'List 2 should have no ghost elements').toBe(0);

    // Original element should be hidden
    const draggedItemId = await sourceItem.getAttribute('data-draggable-id');
    const originalElement = page.locator(`[data-draggable-id="${draggedItemId}"]`);
    await expect(originalElement).toHaveCSS('display', 'none');

    await page.mouse.up();
  });

  test('dragged item should not take up space in the list', async ({ page }) => {
    // Get the initial positions
    const firstItem = demoPage.list2Items.first();
    const secondItem = demoPage.list2Items.nth(1);
    const firstItemBoxBefore = await firstItem.boundingBox();
    const secondItemBoxBefore = await secondItem.boundingBox();
    if (!firstItemBoxBefore || !secondItemBoxBefore) {
      throw new Error('Could not get item bounding boxes');
    }
    const secondItemId = await secondItem.getAttribute('data-draggable-id');

    // Start dragging the first item
    await firstItem.hover();
    await page.mouse.down();
    await page.mouse.move(
      firstItemBoxBefore.x + firstItemBoxBefore.width / 2,
      firstItemBoxBefore.y + 75,
      { steps: 5 },
    );

    // Wait for drag preview to appear
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // The second item should now be at or near the position of the first item
    // because the dragged item's space is collapsed (display: none)
    const secondItemNow = page.locator(`[data-draggable-id="${secondItemId}"]`);
    const secondItemBoxAfter = await secondItemNow.boundingBox();
    if (!secondItemBoxAfter) throw new Error('Could not get second item bounding box after drag');

    // The second item should have moved up to approximately the first item's position
    // Allow some tolerance for the placeholder
    const itemHeight = secondItemBoxBefore.height;
    expect(secondItemBoxAfter.y).toBeLessThan(secondItemBoxBefore.y + itemHeight / 2);

    await page.mouse.up();
  });
});
