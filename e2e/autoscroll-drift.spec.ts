import { expect, Locator, Page, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

interface DriftSnapshot {
  placeholder: string;
  actualIndex: number;
  expectedIndex: number;
  scrollTop: number;
  indexDrift: number;
}

interface DragDebugState {
  placeholder?: string | null;
  placeholderIndex?: number | null;
  draggedItemHeight?: number | null;
  sourceDroppable?: string | null;
  sourceIndex?: number | null;
  activeDroppable?: string | null;
  cursorPosition?: { x: number; y: number } | null;
  grabOffset?: { x: number; y: number } | null;
}

async function getDriftSnapshot(
  page: Page,
  demoPage: DemoPage,
  list: 'list1' | 'list2',
): Promise<DriftSnapshot> {
  const container = list === 'list1' ? demoPage.list1VirtualScroll : demoPage.list2VirtualScroll;
  const metrics = await container.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const itemHeight = parseFloat(el.getAttribute('data-item-height') ?? '50');
    const totalItems = parseInt(el.getAttribute('data-total-items') ?? '0', 10);
    return {
      rectTop: rect.top,
      rectBottom: rect.bottom,
      scrollTop: el.scrollTop,
      itemHeight: Number.isFinite(itemHeight) && itemHeight > 0 ? itemHeight : 50,
      totalItems: Number.isFinite(totalItems) && totalItems > 0 ? totalItems : 0,
    };
  });

  const rawDragState = await page.getByTestId('drag-state-debug').textContent();
  const dragState = JSON.parse(rawDragState ?? '{}') as DragDebugState;
  const actualIndex = dragState.placeholderIndex ?? -1;
  const placeholder = dragState.placeholder ?? 'unknown';
  const expectedIndex = getExpectedPlaceholderIndex(dragState, metrics);

  return {
    placeholder,
    actualIndex,
    expectedIndex,
    scrollTop: metrics.scrollTop,
    indexDrift: Math.abs(expectedIndex - actualIndex),
  };
}

function getExpectedPlaceholderIndex(
  dragState: DragDebugState,
  metrics: {
    rectTop: number;
    rectBottom: number;
    scrollTop: number;
    itemHeight: number;
    totalItems: number;
  },
): number {
  const cursor = dragState.cursorPosition;
  const grabOffset = dragState.grabOffset;
  if (!cursor || !grabOffset) {
    return -1;
  }

  const previewHeight =
    dragState.draggedItemHeight && dragState.draggedItemHeight > 0
      ? dragState.draggedItemHeight
      : metrics.itemHeight;
  const previewTopY = cursor.y - grabOffset.y;
  const previewCenterY = previewTopY + previewHeight / 2;
  const indexProbeY = Math.min(previewCenterY, previewTopY + metrics.itemHeight / 2);
  const relativeY = indexProbeY - metrics.rectTop + metrics.scrollTop;
  let placeholderIndex = Math.floor(relativeY / metrics.itemHeight);

  const sourceIndex = dragState.sourceIndex ?? -1;
  const isSameList =
    dragState.sourceDroppable !== null &&
    dragState.sourceDroppable !== undefined &&
    dragState.sourceDroppable === dragState.activeDroppable;
  if (isSameList && sourceIndex >= 0 && placeholderIndex >= sourceIndex) {
    placeholderIndex += 1;
  }

  const cursorRelativeToBottom = metrics.rectBottom - previewCenterY;
  if (cursorRelativeToBottom < metrics.itemHeight && placeholderIndex >= metrics.totalItems - 1) {
    placeholderIndex = metrics.totalItems;
  }

  return Math.max(0, Math.min(placeholderIndex, metrics.totalItems));
}

async function waitForDriftSnapshot(
  page: Page,
  demoPage: DemoPage,
  list: 'list1' | 'list2',
  assertSnapshot: (snapshot: DriftSnapshot) => void,
  timeout: number,
): Promise<DriftSnapshot> {
  let matchingSnapshot: DriftSnapshot | null = null;

  await expect(async () => {
    const snapshot = await getDriftSnapshot(page, demoPage, list);
    assertSnapshot(snapshot);
    matchingSnapshot = snapshot;
  }).toPass({ timeout });

  if (!matchingSnapshot) {
    throw new Error('No drift snapshot matched the expected state');
  }

  return matchingSnapshot;
}

interface DragStartBox {
  x: number;
  y: number;
  width: number;
  height: number;
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
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });
    await expect(dragPreview).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 5000 });
}

test.describe('Autoscroll Placeholder Drift', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
    await demoPage.list1VirtualScroll.evaluate((el) =>
      el.scrollIntoView({ block: 'center', inline: 'nearest' }),
    );
    // Item count defaults to 100 in the demo
  });

  test('placeholder should stay aligned in List 2 during extended autoscroll', async ({
    page,
  }, testInfo) => {
    // This test matches user's scenario: dragging first item in List 2 and autoscrolling down
    const sourceItem = demoPage.list2Items.first();
    const containerBox = await demoPage.list2VirtualScroll.boundingBox();
    const itemBox = await sourceItem.boundingBox();

    if (!containerBox || !itemBox) {
      throw new Error('Could not get bounding boxes');
    }

    // Start drag from center of first item and verify the preview mounted before autoscroll.
    await startPointerDragFromBox(page, demoPage.dragPreview, itemBox);

    // Move to bottom edge to trigger autoscroll
    const nearBottomY = containerBox.y + containerBox.height - 15;
    await page.mouse.move(containerBox.x + 100, nearBottomY, { steps: 10 });
    await page.mouse.move(containerBox.x + 100, nearBottomY);

    const snapshot = await waitForDriftSnapshot(
      page,
      demoPage,
      'list2',
      (driftSnapshot) => {
        expect(
          driftSnapshot.scrollTop,
          `ScrollTop should exceed 1200, current: ${driftSnapshot.scrollTop}`,
        ).toBeGreaterThan(1200);
        expect(driftSnapshot.indexDrift).toBe(0);
      },
      10000,
    );

    testInfo.attach('list2-extended-drift', {
      body: JSON.stringify(
        {
          placeholder: snapshot.placeholder,
          actualIndex: snapshot.actualIndex,
          expectedIndex: snapshot.expectedIndex,
          scrollTop: snapshot.scrollTop,
          indexDrift: snapshot.indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    await page.mouse.up();
  });

  test('placeholder should stay aligned with drag preview during autoscroll down', async ({
    page,
  }, testInfo) => {
    // 1. Get first item and container bounds
    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    // 2. Start drag from center of first item
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) {
      throw new Error('Could not get source item bounding box');
    }
    await startPointerDragFromBox(page, demoPage.dragPreview, sourceBox);

    // 3. Move to bottom edge to trigger autoscroll
    const nearBottomY = containerBox.y + containerBox.height - 25;
    await page.mouse.move(containerBox.x + 100, nearBottomY, { steps: 10 });
    await page.mouse.move(containerBox.x + 100, nearBottomY);

    const snapshot = await waitForDriftSnapshot(
      page,
      demoPage,
      'list1',
      (driftSnapshot) => {
        expect(
          driftSnapshot.scrollTop,
          `ScrollTop should exceed 500, current: ${driftSnapshot.scrollTop}`,
        ).toBeGreaterThan(500);
        expect(driftSnapshot.indexDrift).toBe(0);
      },
      10000,
    );

    testInfo.attach('list1-down-drift', {
      body: JSON.stringify(
        {
          placeholder: snapshot.placeholder,
          actualIndex: snapshot.actualIndex,
          expectedIndex: snapshot.expectedIndex,
          scrollTop: snapshot.scrollTop,
          indexDrift: snapshot.indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    await page.mouse.up();
  });

  test('placeholder drift should not accumulate during extended autoscroll', async ({
    page,
  }, testInfo) => {
    // Extended autoscroll to catch cumulative drift bugs
    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) {
      throw new Error('Could not get source item bounding box');
    }
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      {
        steps: 2,
      },
    );
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    const nearBottomY = containerBox.y + containerBox.height - 25;
    await page.mouse.move(containerBox.x + 100, nearBottomY, { steps: 10 });
    await page.mouse.move(containerBox.x + 100, nearBottomY);

    const snapshot = await waitForDriftSnapshot(
      page,
      demoPage,
      'list1',
      (driftSnapshot) => {
        expect(
          driftSnapshot.scrollTop,
          `ScrollTop should exceed 1500, current: ${driftSnapshot.scrollTop}`,
        ).toBeGreaterThan(1500);
        expect(driftSnapshot.indexDrift).toBe(0);
      },
      15000,
    );

    testInfo.attach('extended-drift', {
      body: JSON.stringify(
        {
          placeholder: snapshot.placeholder,
          actualIndex: snapshot.actualIndex,
          expectedIndex: snapshot.expectedIndex,
          scrollTop: snapshot.scrollTop,
          indexDrift: snapshot.indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    await page.mouse.up();
  });

  test('placeholder should stay aligned during autoscroll up', async ({ page }, testInfo) => {
    // Scroll to bottom first — wrap write+read in toPass
    // List is ~2500px total (50 items * 50px), so scroll to ~2000 and verify > 1500
    await expect(async () => {
      await demoPage.scrollList('list1', 2000);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(1500);
    }).toPass({ timeout: 2000 });

    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    const sourceBox = await demoPage.list1VirtualScroll.evaluate((container) => {
      const containerRect = container.getBoundingClientRect();
      const viewportBottom = window.innerHeight;
      const items = container.querySelectorAll('[data-draggable-id]');
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
    if (!sourceBox) {
      throw new Error('Could not get visible source item bounding box');
    }
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      {
        steps: 2,
      },
    );
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Move to top edge
    const nearTopY = containerBox.y + 15;
    await page.mouse.move(containerBox.x + 100, nearTopY, { steps: 10 });
    await page.mouse.move(containerBox.x + 100, nearTopY);

    const snapshot = await waitForDriftSnapshot(
      page,
      demoPage,
      'list1',
      (driftSnapshot) => {
        expect(
          driftSnapshot.scrollTop,
          `ScrollTop should drop below 1000, current: ${driftSnapshot.scrollTop}`,
        ).toBeLessThan(1000);
        expect(driftSnapshot.indexDrift).toBe(0);
      },
      10000,
    );

    testInfo.attach('up-drift', {
      body: JSON.stringify(
        {
          placeholder: snapshot.placeholder,
          actualIndex: snapshot.actualIndex,
          expectedIndex: snapshot.expectedIndex,
          scrollTop: snapshot.scrollTop,
          indexDrift: snapshot.indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    await page.mouse.up();
  });

  test('placeholder should be accurate at absolute maximum scroll', async ({ page }, testInfo) => {
    // Test boundary condition: scroll to the very end of the list
    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) {
      throw new Error('Could not get source item bounding box');
    }
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      {
        steps: 2,
      },
    );
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Move to bottom and wait for autoscroll to reach absolute end
    await page.mouse.move(containerBox.x + 100, containerBox.y + containerBox.height - 20, {
      steps: 10,
    });
    await page.mouse.move(containerBox.x + 100, containerBox.y + containerBox.height - 20);
    await expect(async () => {
      const scrollInfo = await demoPage.list1VirtualScroll.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(scrollInfo.scrollTop + scrollInfo.clientHeight).toBeGreaterThanOrEqual(
        scrollInfo.scrollHeight - 2,
      );
    }).toPass({ timeout: 15000 });

    // Get the drag state
    const dragState = await page.getByTestId('drag-state-debug').textContent();

    const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
    const placeholderIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

    testInfo.attach('max-scroll-state', {
      body: JSON.stringify({ placeholderIndex }, null, 2),
      contentType: 'application/json',
    });

    // Placeholder index should not exceed list length (50 items per list)
    expect(placeholderIndex).toBeGreaterThan(0);
    expect(placeholderIndex).toBeLessThanOrEqual(50);

    await page.mouse.up();
  });

  test('cumulative drift should not occur during repeated up-down autoscroll cycles', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000); // 2 minute timeout for this long test
    // User-reported scenario: drag item to bottom, then to top, repeat several times
    // Drift should not accumulate with each cycle
    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    // Start drag
    const itemBox = await sourceItem.boundingBox();
    if (!itemBox) {
      throw new Error('Could not get source item bounding box');
    }
    await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
    await page.mouse.down();
    // Small initial move to trigger drag detection
    await page.mouse.move(itemBox.x + itemBox.width / 2 + 10, itemBox.y + itemBox.height / 2 + 10, {
      steps: 2,
    });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    const nearBottomY = containerBox.y + containerBox.height - 20;
    const nearTopY = containerBox.y + 20;
    const centerX = containerBox.x + containerBox.width / 2;

    const cycleData: {
      cycle: number;
      bottomScroll: number;
      bottomItems: number;
      topScroll: number;
      topItems: number;
    }[] = [];

    // Perform 5 up-down cycles (more aggressive test)
    for (let cycle = 0; cycle < 5; cycle++) {
      // Move to bottom, wait for autoscroll to reach bottom
      const bottomStartScrollTop = await demoPage.getScrollTop('list1');
      await page.mouse.move(centerX, nearBottomY, { steps: 5 });
      await expect(async () => {
        const currentScrollTop = await demoPage.getScrollTop('list1');
        expect(currentScrollTop).toBeGreaterThan(Math.max(bottomStartScrollTop + 300, 1000));
      }).toPass({ timeout: 10000 });

      const bottomScrollTop = await demoPage.getScrollTop('list1');
      const bottomItems = await demoPage.list1Items.count();

      // Move to top, wait for autoscroll to reach top
      await page.mouse.move(centerX, nearTopY, { steps: 5 });
      await expect(async () => {
        const currentScrollTop = await demoPage.getScrollTop('list1');
        expect(currentScrollTop).toBeLessThan(bottomScrollTop - 300);
      }).toPass({ timeout: 10000 });

      const topScrollTop = await demoPage.getScrollTop('list1');
      const topItems = await demoPage.list1Items.count();

      cycleData.push({
        cycle: cycle + 1,
        bottomScroll: bottomScrollTop,
        bottomItems,
        topScroll: topScrollTop,
        topItems,
      });

      // After each cycle, verify container still has visible items
      expect(topItems).toBeGreaterThan(0);
    }

    // After all cycles, move cursor to middle and check state
    const middleY = containerBox.y + containerBox.height / 2;
    await page.mouse.move(centerX, middleY, { steps: 5 });
    // Wait one rAF for position update
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    // Get scroll info to see if container state is corrupted
    const scrollInfo = await demoPage.list1VirtualScroll.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    // The container should still have valid scroll dimensions
    expect(scrollInfo.scrollHeight).toBeGreaterThan(0);
    // scrollHeight should be approximately 2500px (50 items * 50px)
    expect(scrollInfo.scrollHeight).toBeLessThan(3000);

    // Should be able to render items - check if we have any visible items
    const visibleItems = await demoPage.list1Items.count();
    expect(visibleItems).toBeGreaterThan(0);

    // Get drag state
    const dragState = await page.getByTestId('drag-state-debug').textContent();

    // Verify placeholder index is reasonable (within list bounds)
    const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
    const placeholderIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;
    expect(placeholderIndex).toBeGreaterThanOrEqual(0);
    expect(placeholderIndex).toBeLessThanOrEqual(50);

    testInfo.attach('cycle-data', {
      body: JSON.stringify(
        { cycleData, scrollInfo, visibleItems, placeholderIndex, dragState },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    await page.mouse.up();
  });

  test('placeholder should track preview position accurately with slow mouse movement', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000); // 3 minute timeout

    // More realistic test: slowly approach edges like a real user
    const sourceItem = demoPage.list2Items.first();
    const containerBox = await demoPage.list2VirtualScroll.boundingBox();
    const itemBox = await sourceItem.boundingBox();

    if (!containerBox || !itemBox) {
      throw new Error('Could not get bounding boxes');
    }

    // Start drag from center of first item
    const startX = itemBox.x + itemBox.width / 2;
    const startY = itemBox.y + itemBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Small initial move to trigger drag detection
    await page.mouse.move(startX + 5, startY + 5, { steps: 2 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Helper to get current placeholder index and preview position
    const getState = async () => {
      const dragState = await page.getByTestId('drag-state-debug').textContent();
      const preview = await demoPage.dragPreview.evaluate((el) => {
        const previewRect = el.getBoundingClientRect();
        return {
          previewTop: previewRect?.top ?? 0,
          previewBottom: previewRect?.bottom ?? 0,
        };
      });
      const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
      return {
        placeholderIndex: indexMatch ? parseInt(indexMatch[1], 10) : -1,
        previewTop: preview.previewTop,
        previewBottom: preview.previewBottom,
      };
    };

    const containerTop = containerBox.y;
    const bottomEdge = containerTop + containerBox.height;
    const topEdge = containerTop;

    // Perform 2 slow up-down cycles (matching user's reproduction)
    for (let cycle = 0; cycle < 2; cycle++) {
      // Slowly approach bottom edge (many small steps)
      const currentY = cycle === 0 ? startY : topEdge + 30;
      for (let y = currentY; y < bottomEdge - 15; y += 20) {
        await page.mouse.move(startX, y, { steps: 3 });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      }

      // Stay at bottom edge for autoscroll
      const bottomStartScroll = await demoPage.getScrollTop('list2');
      await page.mouse.move(startX, bottomEdge - 15, { steps: 3 });
      await expect(async () => {
        const currentScrollTop = await demoPage.getScrollTop('list2');
        expect(currentScrollTop).toBeGreaterThan(bottomStartScroll + 500);
      }).toPass({ timeout: 10000 });

      // Slowly approach top edge
      for (let y = bottomEdge - 15; y > topEdge + 15; y -= 20) {
        await page.mouse.move(startX, y, { steps: 3 });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      }

      // Stay at top edge for autoscroll
      const topStartScroll = await demoPage.getScrollTop('list2');
      await page.mouse.move(startX, topEdge + 15, { steps: 3 });
      const driftSnapshot = await waitForDriftSnapshot(
        page,
        demoPage,
        'list2',
        (snapshot) => {
          expect(snapshot.scrollTop).toBeLessThan(topStartScroll - 300);
          expect(snapshot.indexDrift).toBe(0);
        },
        10000,
      );

      const topState = await getState();

      testInfo.attach(`cycle-${cycle + 1}-state`, {
        body: JSON.stringify({ topState, driftSnapshot }, null, 2),
        contentType: 'application/json',
      });

      // After 2 cycles, there should still be no accumulated index drift.
      if (cycle === 1) {
        expect(driftSnapshot.indexDrift).toBe(0);
      }
    }

    await page.mouse.up();
  });

  test.describe('WebKit-specific drift tests', () => {
    test.skip(({ browserName }) => browserName !== 'webkit', 'WebKit only');

    test('Safari should not drift during rapid up-down autoscroll direction changes', async ({
      page,
    }, testInfo) => {
      // This test specifically catches Safari's hit-test caching issue
      // Safari caches elementFromPoint results and only invalidates on user scroll
      const sourceItem = demoPage.list1Items.first();
      const containerBox = await demoPage.list1VirtualScroll.boundingBox();

      if (!containerBox) {
        throw new Error('Could not get container bounding box');
      }

      await expect(async () => {
        await page.mouse.up().catch(() => undefined);
        const webkitItemBox = await sourceItem.boundingBox();
        if (!webkitItemBox) {
          throw new Error('Could not get source item bounding box');
        }
        await page.mouse.move(
          webkitItemBox.x + webkitItemBox.width / 2,
          webkitItemBox.y + webkitItemBox.height / 2,
        );
        await page.mouse.down();
        // Small initial move to trigger drag detection
        await page.mouse.move(
          webkitItemBox.x + webkitItemBox.width / 2 + 10,
          webkitItemBox.y + webkitItemBox.height / 2 + 10,
          { steps: 2 },
        );
        await expect(demoPage.dragPreview).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 5000 });

      const nearBottomY = containerBox.y + containerBox.height - 15;
      const nearTopY = containerBox.y + 15;
      const centerX = containerBox.x + containerBox.width / 2;

      // Rapid direction changes - this is where Safari drift is most visible
      for (let i = 0; i < 3; i++) {
        // Quick move to bottom
        const bottomStartScroll = await demoPage.getScrollTop('list1');
        await page.mouse.move(centerX, nearBottomY, { steps: 3 });
        await expect(async () => {
          const currentScrollTop = await demoPage.getScrollTop('list1');
          expect(currentScrollTop).toBeGreaterThan(bottomStartScroll + 50);
        }).toPass({ timeout: 5000 });

        // Quick move to top
        const topStartScroll = await demoPage.getScrollTop('list1');
        await page.mouse.move(centerX, nearTopY, { steps: 3 });
        await expect(async () => {
          const currentScrollTop = await demoPage.getScrollTop('list1');
          expect(currentScrollTop).toBeLessThan(topStartScroll - 50);
        }).toPass({ timeout: 5000 });
      }

      const snapshot = await waitForDriftSnapshot(
        page,
        demoPage,
        'list1',
        (driftSnapshot) => {
          expect(driftSnapshot.indexDrift).toBe(0);
        },
        5000,
      );

      testInfo.attach('safari-rapid-direction-drift', {
        body: JSON.stringify(
          {
            drift: snapshot.indexDrift,
            actualIndex: snapshot.actualIndex,
            expectedIndex: snapshot.expectedIndex,
            scrollTop: snapshot.scrollTop,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });

      await page.mouse.up();
    });
  });

  test('no gap should remain after drop at maximum scroll', async ({ page }, testInfo) => {
    // Test that dropping an item when scrolled to bottom doesn't leave a gap.
    // Scroll list1 to the bottom first — wrap write+read in toPass
    await expect(async () => {
      await demoPage.scrollList('list1', 5000);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(1000);
    }).toPass({ timeout: 2000 });

    const getVisibleBottomItem = async () =>
      demoPage.list1VirtualScroll.evaluate((container) => {
        const containerRect = container.getBoundingClientRect();
        const viewportBottom = window.innerHeight;
        const items = container.querySelectorAll('[data-draggable-id]');
        // Pick the last item with a safe grab point inside both the scroll container and viewport.
        let bestItem: { x: number; y: number; width: number; height: number } | null = null;
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          const visibleTop = Math.max(rect.top, containerRect.top, 0);
          const visibleBottom = Math.min(rect.bottom, containerRect.bottom, viewportBottom);
          const visibleHeight = visibleBottom - visibleTop;
          if (visibleHeight > 10 && rect.width > 0) {
            bestItem = {
              x: rect.x,
              y: visibleTop,
              width: rect.width,
              height: visibleHeight,
            };
          }
        }
        return bestItem;
      });

    // Wait for items to stabilize after scroll, then pick a visible item near the bottom
    await expect(async () => {
      const itemCoords = await getVisibleBottomItem();
      expect(itemCoords).not.toBeNull();
    }).toPass({ timeout: 3000 });

    const itemCoords = await getVisibleBottomItem();
    if (!itemCoords) throw new Error('Could not find visible item near bottom');

    await page.mouse.move(
      itemCoords.x + itemCoords.width / 2,
      itemCoords.y + itemCoords.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(itemCoords.x + 10, itemCoords.y + 30, { steps: 5 });
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Drop the item (same-list reorder at same position = no-op, but tests scroll state)
    await page.mouse.up();
    await expect(demoPage.dragPreview).not.toBeVisible();

    // Verify no gap at bottom - scrollTop should be at or near maxScroll
    const { scrollTop, scrollHeight, clientHeight } = await demoPage.list1VirtualScroll.evaluate(
      (el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }),
    );

    const maxScroll = scrollHeight - clientHeight;
    const gap = maxScroll - scrollTop;

    testInfo.attach('drop-gap-metrics', {
      body: JSON.stringify({ scrollTop, maxScroll, gap, scrollHeight }, null, 2),
      contentType: 'application/json',
    });

    // Gap should be less than 1 item height (50px)
    expect(gap).toBeLessThan(60);
  });
});
