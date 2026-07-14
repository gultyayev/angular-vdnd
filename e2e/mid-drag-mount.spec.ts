import { expect, test } from '@playwright/test';
import { settleDragPosition, waitForActiveDroppable } from './fixtures/drag-sync';

/**
 * Regression for the frozen candidate snapshot (issue #23): a droppable rendered only while
 * a drag is in progress must still become a valid drop target. The candidate list is
 * captured at drag start; `DroppableDirective` refreshes it from `ngOnInit`, so a
 * conditionally-rendered list that mounts mid-drag joins the session.
 */
test.describe('Droppable mounted mid-drag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mid-drag-mount', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-droppable-id="list-a"]')).toBeVisible();
  });

  test('a droppable that mounts during the drag becomes a valid target', async ({ page }) => {
    const dragPreview = page.getByTestId('vdnd-drag-preview');
    const targetList = page.locator('[data-droppable-id="list-b"]');

    // Target list is not rendered until a drag begins.
    await expect(targetList).toHaveCount(0);
    await expect(page.getByTestId('list-a-count')).toHaveText('5');
    await expect(page.getByTestId('list-b-count')).toHaveText('0');

    // Start the drag from the source list.
    const source = page.locator('[data-draggable-id="item-a-0"]');
    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error('source item has no box');

    const baseX = sourceBox.x + sourceBox.width / 2;
    const baseY = sourceBox.y + sourceBox.height / 2;
    await page.mouse.move(baseX, baseY);
    await page.mouse.down();
    // Move past the drag threshold so the drag actually starts.
    await page.mouse.move(baseX, baseY + 40);
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // The (dragStart) handler flipped the signal, mounting the target droppable. Keep the
    // pointer moving so change detection flushes (drag updates run outside Angular's zone).
    await expect(async () => {
      await page.mouse.move(baseX, baseY + 46);
      await page.mouse.move(baseX, baseY + 40);
      expect(await targetList.count()).toBeGreaterThan(0);
    }).toPass({ timeout: 3000 });
    const targetBox = await targetList.boundingBox();
    if (!targetBox) throw new Error('target list has no box');

    // Move onto the freshly-mounted target and confirm it resolved as the active droppable.
    const dropX = targetBox.x + targetBox.width / 2;
    const dropY = targetBox.y + targetBox.height / 2;
    await page.mouse.move(dropX, dropY, { steps: 10 });
    await settleDragPosition(page, dropX, dropY);
    await waitForActiveDroppable(page, 'list-b');
    await page.mouse.up();

    // The item moved cross-list into the mid-drag-mounted droppable.
    await expect(page.getByTestId('list-a-count')).toHaveText('4');
    await expect(page.getByTestId('list-b-count')).toHaveText('1');
  });
});
