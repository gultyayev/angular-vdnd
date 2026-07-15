import { expect, Locator, Page, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

interface DragStartBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function getVisibleDraggableBox(container: Locator): Promise<DragStartBox | null> {
  return container.evaluate((element) => {
    const containerRect = element.getBoundingClientRect();
    const viewportBottom = window.innerHeight;
    const items = element.querySelectorAll('[data-draggable-id]');
    let bestItem: { x: number; y: number; width: number; height: number } | null = null;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, containerRect.top, 0);
      const visibleBottom = Math.min(rect.bottom, containerRect.bottom, viewportBottom);
      const visibleHeight = visibleBottom - visibleTop;
      if (visibleHeight > 10 && rect.width > 0) {
        bestItem = { x: rect.x, y: visibleTop, width: rect.width, height: visibleHeight };
      }
    }
    return bestItem;
  });
}

async function startPointerDragFromBox(
  page: Page,
  dragPreview: Locator,
  box: DragStartBox,
): Promise<void> {
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await expect(async () => {
    await page.mouse.up().catch(() => undefined);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 20, startY + 20, { steps: 5 });
    await expect(dragPreview).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 8000 });
}

test.describe('Auto Scroll', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test('should auto-scroll when dragging near bottom edge', async ({ page }) => {
    // Get initial scroll position
    const initialScrollTop = await demoPage.getScrollTop('list1');

    // Start dragging an item
    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();
    if (!sourceBox || !containerBox) {
      throw new Error('Could not get source/container bounding boxes');
    }

    await startPointerDragFromBox(page, demoPage.dragPreview, sourceBox);

    // Move to near bottom edge (within threshold of 50px)
    const nearBottomX = containerBox.x + 100;
    const nearBottomY = containerBox.y + containerBox.height - 25;
    await page.mouse.move(nearBottomX, nearBottomY, { steps: 10 });
    await page.mouse.move(nearBottomX, nearBottomY);

    // Wait for auto-scroll to accumulate distance
    await expect(async () => {
      await page.mouse.move(nearBottomX, nearBottomY);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(initialScrollTop);
    }).toPass({ timeout: 5000 });

    await page.mouse.up();
  });

  test('should auto-scroll when dragging near top edge', async ({ page }) => {
    // First scroll down — wrap write+read in toPass so scroll re-applies if content isn't ready
    await expect(async () => {
      await demoPage.scrollList('list1', 200);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThanOrEqual(200);
    }).toPass({ timeout: 2000 });

    const initialScrollTop = await demoPage.getScrollTop('list1');
    expect(initialScrollTop).toBeGreaterThanOrEqual(200);

    // Start dragging a visible item
    let sourceBox: DragStartBox | null = null;
    await expect(async () => {
      sourceBox = await getVisibleDraggableBox(demoPage.list1VirtualScroll);
      expect(sourceBox).not.toBeNull();
    }).toPass({ timeout: 3000 });
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();
    if (!sourceBox || !containerBox) {
      throw new Error('Could not get source/container bounding boxes');
    }

    await startPointerDragFromBox(page, demoPage.dragPreview, sourceBox);

    // Move to near top edge
    const nearTopX = containerBox.x + 100;
    const nearTopY = containerBox.y + 25;
    await page.mouse.move(nearTopX, nearTopY, { steps: 10 });
    await page.mouse.move(nearTopX, nearTopY);

    // Wait for auto-scroll to decrease scroll position
    await expect(async () => {
      await page.mouse.move(nearTopX, nearTopY);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeLessThan(initialScrollTop);
    }).toPass({ timeout: 5000 });

    await page.mouse.up();
  });

  test('should stop auto-scrolling when drag ends', async ({ page }) => {
    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source item bounding box');

    await startPointerDragFromBox(page, demoPage.dragPreview, sourceBox);

    // Move near bottom edge
    const activeContainerBox = await demoPage.list1VirtualScroll.boundingBox();
    if (!activeContainerBox) throw new Error('Could not get active container bounding box');
    const nearBottomX = activeContainerBox.x + activeContainerBox.width / 2;
    const nearBottomY = activeContainerBox.y + activeContainerBox.height - 25;
    await page.mouse.move(nearBottomX, nearBottomY);
    await demoPage.settleDragPosition(nearBottomX, nearBottomY);

    // Wait for some autoscroll to happen, re-issuing the edge move so WebKit/Chromium cannot
    // coalesce away the final pointer event under load.
    await expect(async () => {
      await page.mouse.move(nearBottomX, nearBottomY);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    // End drag
    await page.mouse.up();

    // Get scroll position after drop
    const scrollAfterDrop = await demoPage.getScrollTop('list1');

    // Intentional delay: verify no further scrolling occurs after drag ends
    await page.waitForTimeout(300);
    const scrollAfterWait = await demoPage.getScrollTop('list1');

    expect(scrollAfterWait).toBe(scrollAfterDrop);
  });

  test('should not scroll when cursor is not near edge', async ({ page }) => {
    const initialScrollTop = await demoPage.getScrollTop('list1');

    const sourceItem = demoPage.list1Items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();
    if (!sourceBox || !containerBox) {
      throw new Error('Could not get source/container bounding boxes');
    }

    await startPointerDragFromBox(page, demoPage.dragPreview, sourceBox);

    // Move to center of container (not near any edge)
    const centerY = containerBox.y + containerBox.height / 2;
    await page.mouse.move(containerBox.x + 100, centerY, { steps: 10 });
    await page.mouse.move(containerBox.x + 100, centerY);

    // Intentional delay: verify no scrolling occurs when cursor is in center
    await page.waitForTimeout(500);

    const finalScrollTop = await demoPage.getScrollTop('list1');

    // Scroll position should remain unchanged
    expect(finalScrollTop).toBe(initialScrollTop);

    await page.mouse.up();
  });
});
