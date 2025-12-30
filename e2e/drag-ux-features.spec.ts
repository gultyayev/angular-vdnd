import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Drag UX Features - Cursor Management', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should add vdnd-dragging class to body during drag', async ({ page }) => {
    // Get first item
    const firstItem = demoPage.list1Items.first();

    // Body should not have dragging class initially
    await expect(page.locator('body')).not.toHaveClass(/vdnd-dragging/);

    // Start drag
    await firstItem.hover();
    await page.mouse.down();
    const box = await firstItem.boundingBox();
    await page.mouse.move(box!.x + 50, box!.y + 50, { steps: 5 });

    // Wait for drag to start
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 1000 });

    // Body should have dragging class
    await expect(page.locator('body')).toHaveClass(/vdnd-dragging/);

    // End drag
    await page.mouse.up();

    // Body should no longer have dragging class
    await expect(page.locator('body')).not.toHaveClass(/vdnd-dragging/);
  });

  test('should inject cursor styles for grabbing cursor', async ({ page }) => {
    // Check that the cursor styles are injected
    const styleElement = page.locator('#vdnd-cursor-styles');
    await expect(styleElement).toBeAttached();

    // Verify the content includes grabbing cursor
    const styleContent = await styleElement.textContent();
    expect(styleContent).toContain('cursor: grabbing');
  });
});

test.describe('Drag UX Features - Drag Handle', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should only start drag when clicking on handle when enabled', async ({ page }) => {
    // Enable drag handle mode
    const handleCheckbox = page.locator('[data-testid="drag-handle-checkbox"]');
    await handleCheckbox.check();
    await page.waitForTimeout(100);

    // Get first item and its handle
    const firstItem = demoPage.list1Items.first();
    const handle = firstItem.locator('.item-handle');

    // Try to drag by clicking on the item text (not the handle)
    const itemText = firstItem.locator('.item-text');
    const textBox = await itemText.boundingBox();
    await page.mouse.move(textBox!.x + textBox!.width / 2, textBox!.y + textBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(textBox!.x + 100, textBox!.y + 100, { steps: 5 });

    // Drag preview should NOT be visible (clicked outside handle)
    await expect(demoPage.dragPreview).not.toBeVisible();
    await page.mouse.up();

    // Now try dragging by clicking on the handle
    const handleBox = await handle.boundingBox();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 100, handleBox!.y + 100, { steps: 5 });

    // Drag preview SHOULD be visible (clicked on handle)
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 1000 });

    // Clean up
    await page.mouse.up();
  });

  test('should allow dragging from anywhere when handle mode is disabled', async ({ page }) => {
    // Ensure drag handle mode is disabled (default)
    const handleCheckbox = page.locator('[data-testid="drag-handle-checkbox"]');
    await expect(handleCheckbox).not.toBeChecked();

    // Get first item text area
    const firstItem = demoPage.list1Items.first();
    const itemText = firstItem.locator('.item-text');
    const textBox = await itemText.boundingBox();

    // Drag by clicking on the item text
    await page.mouse.move(textBox!.x + textBox!.width / 2, textBox!.y + textBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(textBox!.x + 100, textBox!.y + 100, { steps: 5 });

    // Drag preview should be visible
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 1000 });

    await page.mouse.up();
  });

  test('should apply use-handle class to items when handle mode is enabled', async ({ page }) => {
    // Enable drag handle mode
    const handleCheckbox = page.locator('[data-testid="drag-handle-checkbox"]');
    await handleCheckbox.check();
    await page.waitForTimeout(100);

    // Items should have use-handle class
    const firstItem = demoPage.list1Items.first();
    await expect(firstItem).toHaveClass(/use-handle/);

    // Disable drag handle mode
    await handleCheckbox.uncheck();
    await page.waitForTimeout(100);

    // Items should not have use-handle class
    await expect(firstItem).not.toHaveClass(/use-handle/);
  });
});
