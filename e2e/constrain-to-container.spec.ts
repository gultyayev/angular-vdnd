import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

interface DebugState {
  activeDroppable: string | null;
  placeholder: string | null;
}

test.describe('Constrain to Container', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
    await demoPage.enableConstrainToContainer();
  });

  async function getDebugState(page: Parameters<typeof test>[0]['page']): Promise<DebugState> {
    const raw = await page.locator('.debug-content.drag-state').textContent();
    if (!raw) {
      throw new Error('Debug panel state is missing');
    }
    return JSON.parse(raw) as DebugState;
  }

  test('bottom drag stays in droppable and drop succeeds', async ({ page }) => {
    const initialCount = await demoPage.getItemCount('list1');
    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!sourceBox || !containerBox) {
      throw new Error('Could not get bounding boxes');
    }

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      { steps: 2 },
    );

    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    const belowContainerY = containerBox.y + containerBox.height + 200;
    const targetX = containerBox.x + containerBox.width / 2;
    await page.mouse.move(targetX, belowContainerY, { steps: 20 });
    await page.mouse.move(targetX, belowContainerY);

    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    const debugState = await getDebugState(page);
    expect(debugState.activeDroppable).not.toBeNull();
    expect(debugState.placeholder).not.toBeNull();
    await expect(demoPage.placeholder).toBeVisible();

    await page.mouse.move(
      containerBox.x + containerBox.width / 2,
      containerBox.y + containerBox.height / 2,
    );
    await page.mouse.up();
    await expect(demoPage.dragPreview).not.toBeVisible({ timeout: 2000 });

    const finalCount = await demoPage.getItemCount('list1');
    expect(finalCount).toBe(initialCount);
    expect(await demoPage.getItemText('list1', 0)).toBe('Item 2');
  });

  test('preview stays inside container at top boundary', async ({ page }) => {
    const sourceItem = demoPage.list1Items.nth(2);
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!sourceBox || !containerBox) {
      throw new Error('Could not get bounding boxes');
    }

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      { steps: 2 },
    );

    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    const aboveContainerY = containerBox.y - 200;
    const targetX = containerBox.x + containerBox.width / 2;
    await page.mouse.move(targetX, aboveContainerY, { steps: 20 });
    await page.mouse.move(targetX, aboveContainerY);

    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    const previewBox = await demoPage.dragPreview.boundingBox();
    if (!previewBox) {
      throw new Error('Could not get preview bounding box');
    }

    expect(previewBox.y).toBeGreaterThanOrEqual(containerBox.y + 1);

    await page.mouse.move(
      containerBox.x + containerBox.width / 2,
      containerBox.y + containerBox.height / 2,
    );
    await page.mouse.up();
    await expect(demoPage.dragPreview).not.toBeVisible({ timeout: 2000 });
  });

  test('preview stays inside container at bottom boundary', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!sourceBox || !containerBox) {
      throw new Error('Could not get bounding boxes');
    }

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      { steps: 2 },
    );

    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    const belowContainerY = containerBox.y + containerBox.height + 200;
    const targetX = containerBox.x + containerBox.width / 2;
    await page.mouse.move(targetX, belowContainerY, { steps: 20 });
    await page.mouse.move(targetX, belowContainerY);

    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    const previewBox = await demoPage.dragPreview.boundingBox();
    if (!previewBox) {
      throw new Error('Could not get preview bounding box');
    }

    const previewBottom = previewBox.y + previewBox.height;
    const containerBottom = containerBox.y + containerBox.height;

    expect(previewBottom).toBeLessThanOrEqual(containerBottom - 1);

    await page.mouse.move(
      containerBox.x + containerBox.width / 2,
      containerBox.y + containerBox.height / 2,
    );
    await page.mouse.up();
    await expect(demoPage.dragPreview).not.toBeVisible({ timeout: 2000 });
  });
});
