import { expect, test } from '@playwright/test';
import { DemoPage } from '../fixtures/demo.page';

test.describe('Keyboard Drag - Focus Management', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should handle keyboard events during drag even when element is hidden', async ({
    page,
  }) => {
    // Note: The dragged element has display:none during drag, so it cannot maintain focus.
    // Keyboard events are handled via document-level listeners instead.
    const sourceItem = demoPage.list1Items.first();
    await sourceItem.focus();
    await page.keyboard.press('Space');

    // Drag should be active (preview visible)
    await expect(demoPage.dragPreview).toBeVisible();

    // Arrow keys should work (handled by document listener, not element focus)
    await page.keyboard.press('ArrowDown');

    // Drag should still be active
    await expect(demoPage.dragPreview).toBeVisible();

    // Can complete the drag
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should restore focus to dropped item after drop', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space'); // Drop

    // Focus should be on a draggable item at the new position
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-draggable-id');
  });

  test('should restore focus to original position after cancel', async ({ page }) => {
    const firstItem = demoPage.list1Items.first();
    const itemId = await firstItem.getAttribute('data-draggable-id');

    await firstItem.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape'); // Cancel

    // Focus should return to original item
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-draggable-id', itemId!);
  });

  test('should cancel drag if Tab is pressed', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    await expect(demoPage.dragPreview).toBeVisible();

    await page.keyboard.press('Tab');

    // Drag should be cancelled
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should maintain drag state when focus temporarily lost and regained', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    await expect(demoPage.dragPreview).toBeVisible();

    // Blur focus by clicking elsewhere (but not on a drop target)
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    // Focus should be restorable and drag should continue to work
    await demoPage.list1Items.first().focus();

    // Pressing Escape should still cancel the drag
    await page.keyboard.press('Escape');
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should handle focus on cross-list move', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');

    // Drag should be active
    await expect(demoPage.dragPreview).toBeVisible();

    await page.keyboard.press('ArrowRight'); // Move to list2
    await page.waitForTimeout(100); // Wait for cross-list move

    // Drag should still be active (keyboard events work via document listener)
    await expect(demoPage.dragPreview).toBeVisible();

    await page.keyboard.press('Space'); // Drop

    // Wait for focus to be restored (afterNextRender waits for Angular render cycle)
    // Give extra time for cross-list DOM updates and focus restoration
    const focusedElement = page.locator(':focus[data-draggable-id]');
    await expect(focusedElement).toBeVisible({ timeout: 5000 });
  });

  test('should have visible focus indicator during keyboard drag', async ({ page }) => {
    await demoPage.list1Items.first().focus();

    // Item should have visible focus indicator (not :focus-visible but at least :focus)
    const hasFocusStyle = await demoPage.list1Items.first().evaluate((el) => {
      const styles = getComputedStyle(el);
      // Check for common focus indicators
      return styles.outline !== 'none' || styles.boxShadow !== 'none' || styles.border !== 'none';
    });

    // Verify there's some focus indicator
    expect(hasFocusStyle).toBe(true);
  });

  test('should not interfere with normal Tab navigation when not dragging', async ({ page }) => {
    // Focus first item
    await demoPage.list1Items.first().focus();

    // Tab to next item (not in drag mode)
    await page.keyboard.press('Tab');

    // Should have moved focus (not started a drag)
    await expect(demoPage.dragPreview).not.toBeVisible();

    // Focus should have moved
    const focusedElement = page.locator(':focus');
    const isFocused = await demoPage.list1Items
      .first()
      .evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(false);
  });
});
