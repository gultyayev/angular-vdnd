import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Axis Lock', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should allow free movement when axis lock is none', async ({ page }) => {
    await demoPage.setLockAxis(null);

    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item bounding box');

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();

    // Get initial preview position (wait for preview to be visible)
    await page.mouse.move(sourceBox.x + 10, sourceBox.y + 10, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    // Wait one frame for rAF-throttled position update to apply the transform
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const initialPreviewBox = await demoPage.dragPreview.boundingBox();
    if (!initialPreviewBox) throw new Error('Could not get initial preview bounding box');

    // Move diagonally by a significant amount
    const deltaX = 100;
    const deltaY = 80;
    await page.mouse.move(sourceBox.x + 10 + deltaX, sourceBox.y + 10 + deltaY, { steps: 5 });

    // Verify preview moved using retrying assertion
    await expect(async () => {
      const finalPreviewBox = await demoPage.dragPreview.boundingBox();
      if (!finalPreviewBox) throw new Error('Could not get final preview bounding box');
      const movedX = finalPreviewBox.x - initialPreviewBox.x;
      const movedY = finalPreviewBox.y - initialPreviewBox.y;
      expect(Math.abs(movedX - deltaX)).toBeLessThan(10);
      expect(Math.abs(movedY - deltaY)).toBeLessThan(10);
    }).toPass({ timeout: 2000 });

    await page.mouse.up();
  });

  test('should lock horizontal movement when axis is set to X', async ({ page }) => {
    await demoPage.setLockAxis('x');

    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item bounding box');

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();

    // Get initial preview position (wait for preview to be visible)
    await page.mouse.move(sourceBox.x + 10, sourceBox.y + 10, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    // Wait one frame for rAF-throttled position update to apply the transform
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const initialPreviewBox = await demoPage.dragPreview.boundingBox();
    if (!initialPreviewBox) throw new Error('Could not get initial preview bounding box');

    // Move diagonally by a significant amount
    const deltaX = 100;
    const deltaY = 80;
    await page.mouse.move(sourceBox.x + 10 + deltaX, sourceBox.y + 10 + deltaY, { steps: 5 });

    // Verify X is locked but Y moves using retrying assertion
    await expect(async () => {
      const finalPreviewBox = await demoPage.dragPreview.boundingBox();
      if (!finalPreviewBox) throw new Error('Could not get final preview bounding box');
      const movedX = finalPreviewBox.x - initialPreviewBox.x;
      const movedY = finalPreviewBox.y - initialPreviewBox.y;
      // X should stay approximately the same (locked)
      expect(Math.abs(movedX)).toBeLessThan(10);
      // Y should have moved with the cursor
      expect(Math.abs(movedY - deltaY)).toBeLessThan(10);
    }).toPass({ timeout: 2000 });

    await page.mouse.up();
  });

  test('should not introduce horizontal offset when X axis is locked and drag starts off-axis', async ({
    page,
  }) => {
    await demoPage.setLockAxis('x');

    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item bounding box');

    const startX = sourceBox.x + sourceBox.width / 2;
    const startY = sourceBox.y + sourceBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Move sideways enough to exceed the default drag threshold (5px) in a single event.
    // The preview should keep its locked axis aligned to the original grab position.
    const sidewaysDelta = 8;
    await page.mouse.move(startX + sidewaysDelta, startY, { steps: 1 });

    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // With X locked, the preview should not shift horizontally from the original element position
    await expect(async () => {
      const previewBox = await demoPage.dragPreview.boundingBox();
      expect(previewBox).not.toBeNull();
      expect(Math.abs(previewBox!.x - sourceBox.x)).toBeLessThan(3);
    }).toPass({ timeout: 2000 });

    await page.mouse.up();
  });

  test('should lock vertical movement when axis is set to Y', async ({ page }) => {
    await demoPage.setLockAxis('y');

    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item bounding box');

    // Start dragging
    await sourceItem.hover();
    await page.mouse.down();

    // Get initial preview position (wait for preview to be visible)
    await page.mouse.move(sourceBox.x + 10, sourceBox.y + 10, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    // Wait one frame for rAF-throttled position update to apply the transform
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const initialPreviewBox = await demoPage.dragPreview.boundingBox();
    if (!initialPreviewBox) throw new Error('Could not get initial preview bounding box');

    // Move diagonally by a significant amount
    const deltaX = 100;
    const deltaY = 80;
    await page.mouse.move(sourceBox.x + 10 + deltaX, sourceBox.y + 10 + deltaY, { steps: 5 });

    // Verify Y is locked but X moves using retrying assertion
    await expect(async () => {
      const finalPreviewBox = await demoPage.dragPreview.boundingBox();
      if (!finalPreviewBox) throw new Error('Could not get final preview bounding box');
      const movedX = finalPreviewBox.x - initialPreviewBox.x;
      const movedY = finalPreviewBox.y - initialPreviewBox.y;
      // X should have moved with the cursor
      expect(Math.abs(movedX - deltaX)).toBeLessThan(10);
      // Y should stay approximately the same (locked)
      expect(Math.abs(movedY)).toBeLessThan(10);
    }).toPass({ timeout: 2000 });

    await page.mouse.up();
  });

  test('should constrain drop detection when X axis is locked', async ({ page }) => {
    await demoPage.setLockAxis('x');

    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    const sourceItem = demoPage.list1Items.first();
    const sourceBox = await sourceItem.boundingBox();
    const list2Box = await demoPage.list2VirtualScroll.boundingBox();
    if (!sourceBox || !list2Box) throw new Error('Could not get bounding boxes');

    // Start dragging from list1
    await sourceItem.hover();
    await page.mouse.down();

    // Try to move to list2 (which is to the right)
    // With X locked, the drop target detection should stay in list1
    await page.mouse.move(list2Box.x + list2Box.width / 2, sourceBox.y + 50, { steps: 10 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });
    await page.mouse.up();
    await expect(demoPage.dragPreview).not.toBeVisible({ timeout: 2000 });

    // Since X is locked, the item should stay in list1 (reordered within it)
    await expect(async () => {
      const finalList1Count = await demoPage.getItemCount('list1');
      const finalList2Count = await demoPage.getItemCount('list2');
      expect(finalList1Count).toBe(initialList1Count);
      expect(finalList2Count).toBe(initialList2Count);
    }).toPass({ timeout: 2000 });
  });

  test('should allow cross-list drag when Y axis is locked but lists are side by side', async ({
    page,
  }) => {
    await demoPage.setLockAxis('y');

    const initialList1Count = await demoPage.getItemCount('list1');
    const initialList2Count = await demoPage.getItemCount('list2');

    await demoPage.list1VirtualScroll.scrollIntoViewIfNeeded();
    await demoPage.list2VirtualScroll.scrollIntoViewIfNeeded();

    const list2Box = await demoPage.list2VirtualScroll.boundingBox();
    if (!list2Box) throw new Error('Could not get list2 bounding box');

    const findSourceItemWithinList2Y = async () => {
      for (let i = 0; i < 8; i++) {
        const candidate = demoPage.list1Items.nth(i);
        await candidate.scrollIntoViewIfNeeded();
        const box = await candidate.boundingBox();
        if (!box) continue;
        const centerY = box.y + box.height / 2;
        const isWithinList2 =
          centerY >= list2Box.y + 10 && centerY <= list2Box.y + list2Box.height - 10;
        if (isWithinList2) {
          return { sourceItem: candidate, sourceBox: box };
        }
      }

      throw new Error('Could not find a list1 source item aligned vertically with list2');
    };

    const { sourceItem, sourceBox } = await findSourceItemWithinList2Y();

    // Start dragging from list1
    await sourceItem.hover();
    await page.mouse.down();
    // Move slightly to ensure WebKit recognizes the drag
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Move to list2 horizontally (Y locked means we can move horizontally freely)
    const targetY = sourceBox.y + sourceBox.height / 2;
    await page.mouse.move(list2Box.x + list2Box.width / 2, targetY, { steps: 10 });
    // Placeholder visibility proves hit-testing resolved to a drop target
    await expect(demoPage.placeholder).toBeVisible({ timeout: 2000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();
    await expect(demoPage.dragPreview).not.toBeVisible({ timeout: 2000 });

    // With Y locked but horizontal movement allowed, item should move to list2
    await expect(async () => {
      const finalList1Count = await demoPage.getItemCount('list1');
      const finalList2Count = await demoPage.getItemCount('list2');
      expect(finalList1Count).toBe(initialList1Count - 1);
      expect(finalList2Count).toBe(initialList2Count + 1);
    }).toPass({ timeout: 5000 });
  });

  test('should update axis lock setting dynamically', async () => {
    // Start with no lock
    await demoPage.setLockAxis(null);
    await expect(demoPage.lockAxisSelect).toHaveValue('');

    // Change to X lock
    await demoPage.setLockAxis('x');
    await expect(demoPage.lockAxisSelect).toHaveValue('x');

    // Change to Y lock
    await demoPage.setLockAxis('y');
    await expect(demoPage.lockAxisSelect).toHaveValue('y');

    // Change back to none
    await demoPage.setLockAxis(null);
    await expect(demoPage.lockAxisSelect).toHaveValue('');
  });
});
