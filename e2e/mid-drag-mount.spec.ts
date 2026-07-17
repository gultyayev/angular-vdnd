import { expect, test } from '@playwright/test';
import { settleDragPosition, waitForActiveDroppable } from './fixtures/drag-sync';

/**
 * Issue #23: a droppable that mounts DURING a drag (candidate snapshot is frozen at drag
 * start) must still become a valid drop target. The mid-drag-mount demo renders the
 * "Target" list only while a drag is active.
 */
test.describe('Mid-drag mounted droppable', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mid-drag-mount', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-droppable-id="source"]')).toBeVisible();
  });

  test('a droppable mounted mid-drag becomes a valid drop target', async ({ page }) => {
    const preview = page.getByTestId('vdnd-drag-preview');
    const targetDroppable = page.locator('[data-droppable-id="target"]');

    // The target droppable must not exist before the drag starts.
    await expect(targetDroppable).toHaveCount(0);
    await expect(page.getByTestId('source-count')).toHaveText('4');
    await expect(page.getByTestId('target-count')).toHaveText('0');

    // Grab the first source item and start dragging.
    const sourceItem = page.locator('[data-droppable-id="source"] [data-draggable-id]').first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    // Small move to initiate the drag (critical for WebKit drag detection).
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      { steps: 2 },
    );
    await expect(preview).toBeVisible({ timeout: 2000 });

    // The target list now mounts because a drag is active.
    await expect(targetDroppable).toBeVisible();

    // Move the pointer over the freshly mounted target droppable and drop.
    const targetBox = await targetDroppable.boundingBox();
    if (!targetBox) throw new Error('Could not get target droppable bounding box');
    const targetX = targetBox.x + targetBox.width / 2;
    const targetY = targetBox.y + Math.min(60, targetBox.height - 20);

    await page.mouse.move(targetX, targetY, { steps: 15 });
    // Guarantee the release resolves to the mid-drag-mounted target.
    await settleDragPosition(page, targetX, targetY);
    await waitForActiveDroppable(page, 'target');
    await page.mouse.up();

    await expect(preview).not.toBeVisible({ timeout: 2000 });

    // The item moved into the target list.
    await expect(page.getByTestId('target-count')).toHaveText('1');
    await expect(page.getByTestId('source-count')).toHaveText('3');
    await expect(targetDroppable.locator('[data-draggable-id]')).toHaveCount(1);
  });
});
