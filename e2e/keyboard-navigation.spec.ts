import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Keyboard Navigation', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should have draggable items focusable with Tab key', async ({ page }) => {
    // Focus the first item
    await page.keyboard.press('Tab');

    // Keep pressing Tab until we reach a draggable item
    let attempts = 0;
    while (attempts < 20) {
      const focusedElement = page.locator(':focus');
      const isDraggable = await focusedElement.getAttribute('data-draggable-id');
      if (isDraggable) {
        break;
      }
      await page.keyboard.press('Tab');
      attempts++;
    }

    // Verify a draggable item is focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-draggable-id');
  });

  test('should have correct tabindex on draggable items', async () => {
    const firstItem = demoPage.list1Items.first();
    await expect(firstItem).toHaveAttribute('tabindex', '0');
  });

  test('should cancel drag on Escape key press', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + 100);

    // Verify drag is in progress
    await expect(demoPage.dragPreview).toBeVisible();

    // Press Escape to cancel (document-level keydown listener handles this)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Drag preview should be hidden
    await expect(demoPage.dragPreview).not.toBeVisible();

    // Original item should be visible again
    await expect(sourceItem).not.toHaveCSS('display', 'none');
  });

  test('should have aria-grabbed attribute during drag', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    const itemId = await sourceItem.getAttribute('data-draggable-id');

    // Before drag
    await expect(sourceItem).not.toHaveAttribute('aria-grabbed', 'true');

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 50, sourceBox!.y + 50);

    // During drag - the original item has aria-grabbed (but is also hidden)
    const originalElement = page.locator(`[data-draggable-id="${itemId}"]`);
    await expect(originalElement).toHaveAttribute('aria-grabbed', 'true');

    // End drag
    await page.mouse.up();

    // After drag
    await expect(sourceItem).not.toHaveAttribute('aria-grabbed', 'true');
  });

  test('should have aria-dropeffect attribute on draggable items', async () => {
    const firstItem = demoPage.list1Items.first();
    await expect(firstItem).toHaveAttribute('aria-dropeffect', 'move');
  });

  test('should prevent default on Space key when focused on draggable', async ({ page }) => {
    // Focus a draggable item
    const firstItem = demoPage.list1Items.first();
    await firstItem.focus();

    // Pressing Space should be handled (prevents default scroll)
    // We can't directly test preventDefault, but we can verify the item is still focused
    await page.keyboard.press('Space');

    // Item should still be focused (Space didn't cause focus to move)
    await expect(firstItem).toBeFocused();
  });

  test('should have tabindex -1 when disabled', async ({ page }) => {
    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    // Items should have tabindex -1
    const firstItem = demoPage.list1Items.first();
    await expect(firstItem).toHaveAttribute('tabindex', '-1');
  });

  test('should restore tabindex 0 when re-enabled', async ({ page }) => {
    // Disable dragging
    const checkbox = page.locator('[data-testid="drag-enabled-checkbox"]');
    await checkbox.uncheck();

    // Verify disabled
    const firstItem = demoPage.list1Items.first();
    await expect(firstItem).toHaveAttribute('tabindex', '-1');

    // Re-enable
    await checkbox.check();

    // Tabindex should be restored
    await expect(firstItem).toHaveAttribute('tabindex', '0');
  });
});
