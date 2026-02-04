import { expect, test } from '@playwright/test';
import { DemoPage } from '../fixtures/demo.page';

test.describe('Keyboard Drag - Accessibility', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should have correct aria-grabbed during keyboard drag', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();

    // Before drag - should have aria-grabbed="false"
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'false');

    await sourceItem.focus();
    await page.keyboard.press('Space');

    // During drag - should have aria-grabbed="true"
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'true');

    await page.keyboard.press('Space');

    // After drag - should return to aria-grabbed="false"
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'false');
  });

  test('should have aria-dropeffect on droppable areas', async () => {
    // Droppable containers should have aria-dropeffect="move"
    await expect(demoPage.list1Container).toHaveAttribute('aria-dropeffect', 'move');
    await expect(demoPage.list2Container).toHaveAttribute('aria-dropeffect', 'move');
  });

  test('should restore aria-grabbed to false when drag is cancelled', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();

    await sourceItem.focus();
    await page.keyboard.press('Space');

    // During drag
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'true');

    // Cancel with Escape
    await page.keyboard.press('Escape');

    // After cancel - should be false
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'false');
  });

  test('should update aria-grabbed when crossing lists', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();

    await sourceItem.focus();
    await page.keyboard.press('Space');

    // During drag in original list
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'true');

    // Move to other list
    await page.keyboard.press('ArrowRight');

    // Still grabbed during cross-list movement
    await expect(sourceItem).toHaveAttribute('aria-grabbed', 'true');

    // Drop - need small wait for cross-list drop event to propagate
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    // Item should now be in list2, find it there
    const movedItem = demoPage.list2Items.first();
    await expect(movedItem).toHaveAttribute('aria-grabbed', 'false');
  });

  test('should maintain focusability on draggable items', async () => {
    const firstItem = demoPage.list1Items.first();

    // Draggable items should be focusable
    await expect(firstItem).toHaveAttribute('tabindex', '0');

    // Focus should work
    await firstItem.focus();
    await expect(firstItem).toBeFocused();
  });

  test('should restore focus to item after keyboard drag completes', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    // Focus restoration uses double RAF, need small wait
    await page.waitForTimeout(50);

    // Focus should be on the moved item
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-draggable-id');
  });

  test('should restore focus to item after keyboard drag is cancelled', async ({ page }) => {
    await demoPage.list1Items.first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    // Focus restoration uses double RAF, need small wait
    await page.waitForTimeout(50);

    // Focus should be restored to the original item
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-draggable-id');
  });
});
