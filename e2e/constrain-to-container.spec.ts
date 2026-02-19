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

  test('autoscroll works at both edges with constrainToContainer', async ({ page }) => {
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();
    if (!containerBox) throw new Error('Could not get container box');

    // Grab the first item near its bottom edge (non-trivial grabOffset.y)
    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item box');

    const grabX = sourceBox.x + sourceBox.width / 2;
    const grabY = sourceBox.y + sourceBox.height - 5;

    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + 10, grabY + 10, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Move to the container's bottom edge to trigger downward autoscroll
    const bottomEdgeY = containerBox.y + containerBox.height - 25;
    await page.mouse.move(grabX, bottomEdgeY, { steps: 15 });
    await page.mouse.move(grabX, bottomEdgeY);

    // Wait for scrollTop to increase substantially (proves downward autoscroll works)
    await expect(async () => {
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(100);
    }).toPass({ timeout: 10000 });

    // Now move to the container's top edge — autoscroll should reverse upward
    const topEdgeY = containerBox.y + 25;
    await page.mouse.move(grabX, topEdgeY, { steps: 15 });
    await page.mouse.move(grabX, topEdgeY);

    // Capture scrollTop after reaching top edge, then assert it decreases
    // (use toPass to wait for the RAF loop to detect the new cursor position)
    await expect(async () => {
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    const scrollTopAtTopEdge = await demoPage.getScrollTop('list1');
    await expect(async () => {
      const scrollTopNow = await demoPage.getScrollTop('list1');
      expect(scrollTopNow).toBeLessThan(scrollTopAtTopEdge);
    }).toPass({
      timeout: 5000,
      message: 'Autoscroll up should trigger at top edge with non-trivial grabOffset',
    });

    // Clean up: drop inside the container
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
