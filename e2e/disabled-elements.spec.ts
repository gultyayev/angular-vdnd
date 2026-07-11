import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Disabled Elements', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should have disabled class when drag is disabled', async ({ page }) => {
    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    // Items should have disabled class
    const firstItem = demoPage.list1Items.first();
    await expect(firstItem).toHaveClass(/vdnd-draggable-disabled/);
  });

  test('should not start drag when disabled', async ({ page }) => {
    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    // Try to drag
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    if (sourceBox) {
      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + 200, sourceBox.y);
      // Wait one rAF for any potential drag state processing
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }

    // Drag preview should NOT be visible
    await expect(demoPage.dragPreview).not.toBeVisible();

    await page.mouse.up();

    // Counts should be unchanged
    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count);
    expect(finalList2Count).toBe(initialList2Count);
  });

  test('should not show drag preview when disabled', async ({ page }) => {
    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + 100);

    // Drag preview should NOT be visible
    await expect(demoPage.dragPreview).not.toBeVisible();

    await page.mouse.up();
  });

  test('should not hide original element when disabled drag attempted', async ({ page }) => {
    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + 100);

    // Original element should still be visible (not display:none)
    await expect(sourceItem).not.toHaveCSS('display', 'none');

    await page.mouse.up();
  });

  test('should allow drag after re-enabling', async ({ page }) => {
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');

    // First disable
    await checkbox.uncheck();
    await expect(demoPage.list1Items.first()).toHaveClass(/vdnd-draggable-disabled/);

    // Then re-enable
    await checkbox.check();
    await expect(demoPage.list1Items.first()).not.toHaveClass(/vdnd-draggable-disabled/);

    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    // Now drag should work
    await demoPage.dragItemToList('list1', 0, 'list2', 0);

    const finalList1Count = await demoPage.getItemCount('list1');
    const finalList2Count = await demoPage.getItemCount('list2');

    expect(finalList1Count).toBe(initialList1Count - 1);
    expect(finalList2Count).toBe(initialList2Count + 1);
  });

  test('should maintain disabled state after failed drag attempt', async ({ page }) => {
    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    // Try to drag
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + 100);
    await page.mouse.up();

    // Should still be disabled
    await expect(sourceItem).toHaveClass(/vdnd-draggable-disabled/);
  });

  test('should have vdnd-draggable class on all items regardless of disabled state', async ({
    page,
  }) => {
    // All items should have base class
    const firstItem = demoPage.list1Items.first();
    await expect(firstItem).toHaveClass(/vdnd-draggable/);

    // Disable
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    // Should still have base class
    await expect(firstItem).toHaveClass(/vdnd-draggable/);
  });

  test('should handle drag delay with disabled state correctly', async ({ page }) => {
    // Set a drag delay
    const delayInput = page.locator('[data-testid="drag-delay-input"]');
    await delayInput.fill('200');

    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    // Try to drag with delay
    await sourceItem.hover();
    await page.mouse.down();
    // Intentional delay: must exceed the 200ms drag delay to verify disabled state persists
    await page.waitForTimeout(250);
    await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + 100);

    // Should still not start drag because disabled
    await expect(demoPage.dragPreview).not.toBeVisible();

    await page.mouse.up();
  });

  test('should ignore disabled destinations during pointer hit-testing', async ({ page }) => {
    await demoPage.list1Items.first().scrollIntoViewIfNeeded();
    await demoPage.list2VirtualScroll.scrollIntoViewIfNeeded();
    const sourceBox = await demoPage.list1Items.first().boundingBox();
    const targetBox = await demoPage.list2VirtualScroll.boundingBox();
    if (!sourceBox || !targetBox) {
      throw new Error('Could not get boxes for disabled destination drag');
    }

    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    await demoPage.list2Container.evaluate((el) => {
      el.setAttribute('data-droppable-disabled', 'true');
    });

    await demoPage.list1Items.first().hover();
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
    );
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 25, { steps: 15 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 25);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    await expect(page.getByTestId('drag-state-debug')).toContainText('"activeDroppable": null');
    await page.mouse.up();

    expect(await demoPage.getItemCount('list1')).toBe(initialList1Count);
    expect(await demoPage.getItemCount('list2')).toBe(initialList2Count);
  });

  test('should skip disabled destinations during keyboard cross-list navigation', async ({
    page,
  }) => {
    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    await demoPage.list2Container.evaluate((el) => {
      el.setAttribute('data-droppable-disabled', 'true');
    });

    await demoPage.startKeyboardDrag('list1', 0);
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    await demoPage.keyboardMoveToList('right');

    await expect(
      demoPage.list2Container.locator('.vdnd-drag-placeholder-visible'),
    ).not.toBeVisible();
    await expect(page.getByTestId('drag-state-debug')).toContainText('"activeDroppable": "list-1"');

    await demoPage.keyboardDrop();

    expect(await demoPage.getItemCount('list1')).toBe(initialList1Count);
    expect(await demoPage.getItemCount('list2')).toBe(initialList2Count);
  });
});
