import { expect, test } from '@playwright/test';
import { DemoPage } from '../fixtures/demo.page';

test.describe('Keyboard Drag - Basic Operations', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should start keyboard drag with Space key', async ({ page }) => {
    // Focus first draggable item and capture its ID
    const firstItem = demoPage.list1Items.first();
    const itemId = await firstItem.getAttribute('data-draggable-id');
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle

    // Press Space to start drag
    await page.keyboard.press('Space');

    // Verify drag state - find item by its ID since display:none shifts DOM order
    const sourceItem = page.locator(`[data-draggable-id="${itemId}"]`);
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'true');
    await expect(demoPage.dragPreview).toBeVisible();
  });

  test('should drop item with Space key during keyboard drag', async ({ page }) => {
    const initialCount = await demoPage.getItemCount('list1');

    // Start keyboard drag
    await demoPage.list1Items.first().focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    // Move down one position
    await page.keyboard.press('ArrowDown');

    // Drop with Space
    await page.keyboard.press('Space');

    // Verify item dropped (count unchanged for same-list)
    expect(await demoPage.getItemCount('list1')).toBe(initialCount);
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should drop item with Enter key during keyboard drag', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should cancel keyboard drag with Escape key', async ({ page }) => {
    const originalText = await demoPage.getItemText('list1', 0);

    await demoPage.list1Items.first().focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');

    // Wait for drag to be fully cancelled (preview hidden, item restored)
    await expect(demoPage.dragPreview).not.toBeVisible();

    // Item should be back at original position
    expect(await demoPage.getItemText('list1', 0)).toBe(originalText);
  });

  test('should not start drag on disabled item', async ({ page }) => {
    // Disable dragging
    await page.locator('[data-testid="drag-enabled-checkbox"]').uncheck();
    // Wait for Angular to apply disabled state to items
    await page.waitForTimeout(100);

    await demoPage.list1Items.first().focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');

    // Should NOT start drag
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  // Note: Focus cannot be maintained on the dragged element during keyboard drag
  // because the element is hidden with display:none. Keyboard events are captured
  // via a document-level listener instead. See CLAUDE.md "Keyboard Drag Accessibility"

  test('should toggle drag state with repeated Space presses', async ({ page }) => {
    const firstItem = demoPage.list1Items.first();
    const itemId = await firstItem.getAttribute('data-draggable-id');
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle

    // First Space starts drag
    await page.keyboard.press('Space');
    const sourceItem = page.locator(`[data-draggable-id="${itemId}"]`);
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'true');
    await expect(demoPage.dragPreview).toBeVisible();

    // Second Space drops
    await page.keyboard.press('Space');
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'false');
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should show placeholder during keyboard drag', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    // Placeholder should be visible
    await expect(demoPage.placeholder).toBeVisible();
  });
});
