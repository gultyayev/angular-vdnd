import { expect, test } from '@playwright/test';
import { DemoPage } from '../fixtures/demo.page';

test.describe('Keyboard Drag - Arrow Navigation', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
    // Use simplified API for better built-in placeholder support
    await demoPage.enableSimplifiedApi();
  });

  test('should move placeholder down with ArrowDown', async ({ page }) => {
    const firstItem = demoPage.list1Items.first();
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    // Get initial placeholder position
    const placeholder = demoPage.placeholder;
    await expect(placeholder).toBeVisible();
    const initialY = (await placeholder.boundingBox())!.y;

    await page.keyboard.press('ArrowDown');

    // Wait for placeholder to move (should be at a new Y position)
    await expect(async () => {
      const newY = (await placeholder.boundingBox())!.y;
      expect(newY).toBeGreaterThan(initialY);
    }).toPass({ timeout: 2000 });
  });

  test('should move placeholder up with ArrowUp', async ({ page }) => {
    // Start from second item
    const secondItem = demoPage.list1Items.nth(1);
    await secondItem.focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    const placeholder = demoPage.placeholder;
    await expect(placeholder).toBeVisible();
    const initialY = (await placeholder.boundingBox())!.y;

    await page.keyboard.press('ArrowUp');

    // Wait for placeholder position to update (uses afterNextRender internally)
    await expect(async () => {
      const newY = (await placeholder.boundingBox())!.y;
      expect(newY).toBeLessThan(initialY);
    }).toPass({ timeout: 2000 });
  });

  test('should not move past first item with ArrowUp', async ({ page }) => {
    const firstItemText = await demoPage.getItemText('list1', 0);

    const firstItem = demoPage.list1Items.first();
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    // Press ArrowUp multiple times
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');

    // Drop and verify item is still at position 0
    await page.keyboard.press('Space');

    // First item should still be at position 0
    const newFirstItemText = await demoPage.getItemText('list1', 0);
    expect(newFirstItemText).toBe(firstItemText);
  });

  test('should not move past last item with ArrowDown', async ({ page }) => {
    // Start from first item
    const firstItem = demoPage.list1Items.first();
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    const itemCount = await demoPage.getItemCount('list1');

    // Press ArrowDown many times (more than items in list)
    for (let i = 0; i < itemCount + 10; i++) {
      await page.keyboard.press('ArrowDown');
    }

    await page.keyboard.press('Space');

    // Verify item is at last position (not beyond)
    const newCount = await demoPage.getItemCount('list1');
    expect(newCount).toBe(itemCount); // Count unchanged for same-list
  });

  test('should handle rapid arrow key presses', async ({ page }) => {
    const firstItem = demoPage.list1Items.first();
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();

    // Rapid fire arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Should have moved 5 positions without errors
    await page.keyboard.press('Space');

    // Verify drop completed successfully
    await expect(demoPage.dragPreview).not.toBeVisible();
  });

  test('should reorder item when moved down and dropped', async ({ page }) => {
    const firstItemText = await demoPage.getItemText('list1', 0);
    const secondItemText = await demoPage.getItemText('list1', 1);

    const firstItem = demoPage.list1Items.first();
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();
    await page.waitForTimeout(50); // Let drag state fully initialize
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50); // Let Angular process the move
    await page.keyboard.press('Space');

    // Wait for reordering to complete (poll until items are reordered)
    await expect(async () => {
      const newFirst = await demoPage.getItemText('list1', 0);
      expect(newFirst).toBe(secondItemText);
    }).toPass({ timeout: 2000 });

    expect(await demoPage.getItemText('list1', 1)).toBe(firstItemText);
  });

  test('should reorder item when moved up and dropped', async ({ page }) => {
    const firstItemText = await demoPage.getItemText('list1', 0);
    const secondItemText = await demoPage.getItemText('list1', 1);

    // Start with second item
    const secondItem = demoPage.list1Items.nth(1);
    await secondItem.focus();
    await page.waitForTimeout(50); // Let focus settle
    await page.keyboard.press('Space');
    await expect(demoPage.dragPreview).toBeVisible();
    await page.waitForTimeout(50); // Let drag state fully initialize
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(50); // Let Angular process the move
    await page.keyboard.press('Space');

    // Wait for reordering to complete (poll until items are reordered)
    await expect(async () => {
      const newFirst = await demoPage.getItemText('list1', 0);
      expect(newFirst).toBe(secondItemText);
    }).toPass({ timeout: 2000 });

    expect(await demoPage.getItemText('list1', 1)).toBe(firstItemText);
  });

  test('should ignore arrow keys when not in drag mode', async ({ page }) => {
    const placeholder = demoPage.placeholder;

    // Focus item but don't start drag
    const firstItem = demoPage.list1Items.first();
    await firstItem.focus();
    await page.waitForTimeout(50); // Let focus settle

    // Arrow keys should not show placeholder
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');

    await expect(placeholder).not.toBeVisible();
    await expect(demoPage.dragPreview).not.toBeVisible();
  });
});
