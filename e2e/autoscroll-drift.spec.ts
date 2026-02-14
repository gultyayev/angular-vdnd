import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Autoscroll Placeholder Drift', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
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

    // Start drag from center of first item
    const startX = itemBox.x + itemBox.width / 2;
    const startY = itemBox.y + itemBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Small initial move to trigger drag detection
    await page.mouse.move(startX + 5, startY + 5, { steps: 2 });

    // Wait for drag preview to confirm drag started
    await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

    // Move to bottom edge to trigger autoscroll
    const nearBottomY = containerBox.y + containerBox.height - 20;
    await page.mouse.move(containerBox.x + 100, nearBottomY, { steps: 10 });

    // Intentional delay: accumulate autoscroll distance (~3s should scroll ~60 items)
    await page.waitForTimeout(3000);

    const scrollTop = await demoPage.getScrollTop('list2');

    // Get the actual placeholderIndex from drag state - this is the authoritative source
    const dragState = await page.evaluate(() => {
      const stateEl = document.querySelector('h3 + pre, .drag-state');
      if (stateEl) return stateEl.textContent;
      return document.body.innerText;
    });

    // Calculate expected placeholder index based on scroll position and cursor
    // Cursor is near bottom of container, so expected index should be near scrollTop/50 + visible items
    const expectedIndex = Math.floor(scrollTop / 50) + 7; // 7 visible items, cursor near bottom

    // Extract actual placeholderIndex from drag state (numeric value, not the string ID)
    const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
    const actualPlaceholderIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

    // Also get placeholderId for logging
    const placeholderMatch = dragState?.match(/"placeholder":\s*"([^"]+)"/);
    const placeholderValue = placeholderMatch ? placeholderMatch[1] : 'unknown';

    const indexDrift = Math.abs(expectedIndex - actualPlaceholderIndex);

    testInfo.attach('list2-extended-drift', {
      body: JSON.stringify(
        {
          placeholder: placeholderValue,
          actualIndex: actualPlaceholderIndex,
          expectedIndex,
          scrollTop,
          indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    // Should scroll through most of the list (WebKit scrolls slightly slower than Chromium)
    expect(scrollTop).toBeGreaterThan(1200);

    // INDEX drift is the real bug - placeholder index should match cursor position
    // After Safari drift fix, allow tight tolerance of 3 items for edge cases
    expect(indexDrift).toBeLessThan(3);

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
    await sourceItem.hover();
    await page.mouse.down();

    // 3. Move to bottom edge to trigger autoscroll
    const nearBottomY = containerBox.y + containerBox.height - 25;
    await page.mouse.move(containerBox.x + 100, nearBottomY);

    // Intentional delay: accumulate autoscroll distance (~3s should scroll 60+ items)
    await page.waitForTimeout(3000);

    const scrollTop = await demoPage.getScrollTop('list1');

    // Get the actual placeholderIndex from drag state
    const dragState = await page.evaluate(() => {
      const stateEl = document.querySelector('h3 + pre, .drag-state');
      if (stateEl) return stateEl.textContent;
      return document.body.innerText;
    });

    // Calculate expected placeholder index based on scroll position and cursor
    const expectedIndex = Math.floor(scrollTop / 50) + 7;

    // Extract actual placeholderIndex from drag state (numeric value)
    const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
    const actualPlaceholderIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

    // Also get placeholderId for logging
    const placeholderMatch = dragState?.match(/"placeholder":\s*"([^"]+)"/);
    const placeholderValue = placeholderMatch ? placeholderMatch[1] : 'unknown';

    const indexDrift = Math.abs(expectedIndex - actualPlaceholderIndex);

    testInfo.attach('list1-down-drift', {
      body: JSON.stringify(
        {
          placeholder: placeholderValue,
          actualIndex: actualPlaceholderIndex,
          expectedIndex,
          scrollTop,
          indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    // Verify we scrolled at least some amount (test validity check)
    expect(scrollTop).toBeGreaterThan(500);

    // Index drift should be minimal - after Safari drift fix, allow tight tolerance
    expect(indexDrift).toBeLessThan(3);

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

    await sourceItem.hover();
    await page.mouse.down();

    const nearBottomY = containerBox.y + containerBox.height - 25;
    await page.mouse.move(containerBox.x + 100, nearBottomY);

    // Intentional delay: 5 seconds of autoscroll to maximize drift potential
    await page.waitForTimeout(5000);

    const scrollTop = await demoPage.getScrollTop('list1');

    // Get the actual placeholderIndex from drag state
    const dragState = await page.evaluate(() => {
      const stateEl = document.querySelector('h3 + pre, .drag-state');
      if (stateEl) return stateEl.textContent;
      return document.body.innerText;
    });

    // Calculate expected placeholder index
    const expectedIndex = Math.floor(scrollTop / 50) + 7;

    // Extract actual placeholderIndex from drag state (numeric value)
    const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
    const actualPlaceholderIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

    // Also get placeholderId for logging
    const placeholderMatch = dragState?.match(/"placeholder":\s*"([^"]+)"/);
    const placeholderValue = placeholderMatch ? placeholderMatch[1] : 'unknown';

    const indexDrift = Math.abs(expectedIndex - actualPlaceholderIndex);

    testInfo.attach('extended-drift', {
      body: JSON.stringify(
        {
          placeholder: placeholderValue,
          actualIndex: actualPlaceholderIndex,
          expectedIndex,
          scrollTop,
          indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    // Same tolerance even after extended scroll - drift should not grow
    expect(indexDrift).toBeLessThan(3);

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

    const sourceItem = demoPage.list1Items.last();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    await sourceItem.hover();
    await page.mouse.down();

    // Move to top edge
    const nearTopY = containerBox.y + 25;
    await page.mouse.move(containerBox.x + 100, nearTopY);

    // Intentional delay: accumulate autoscroll distance upward
    await page.waitForTimeout(3000);

    const scrollTop = await demoPage.getScrollTop('list1');

    // Get the actual placeholderIndex from drag state
    const dragState = await page.evaluate(() => {
      const stateEl = document.querySelector('h3 + pre, .drag-state');
      if (stateEl) return stateEl.textContent;
      return document.body.innerText;
    });

    // Calculate expected placeholder index - cursor at top of viewport
    const expectedIndex = Math.floor(scrollTop / 50);

    // Extract actual placeholderIndex from drag state (numeric value)
    const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
    const actualPlaceholderIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

    // Also get placeholderId for logging
    const placeholderMatch = dragState?.match(/"placeholder":\s*"([^"]+)"/);
    const placeholderValue = placeholderMatch ? placeholderMatch[1] : 'unknown';

    const indexDrift = Math.abs(expectedIndex - actualPlaceholderIndex);

    testInfo.attach('up-drift', {
      body: JSON.stringify(
        {
          placeholder: placeholderValue,
          actualIndex: actualPlaceholderIndex,
          expectedIndex,
          scrollTop,
          indexDrift,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    // Index drift should be minimal - after Safari drift fix, allow tight tolerance
    expect(indexDrift).toBeLessThan(3);

    await page.mouse.up();
  });

  test('placeholder should be accurate at absolute maximum scroll', async ({ page }, testInfo) => {
    // Test boundary condition: scroll to the very end of the list
    const sourceItem = demoPage.list1Items.first();
    const containerBox = await demoPage.list1VirtualScroll.boundingBox();

    if (!containerBox) {
      throw new Error('Could not get container bounding box');
    }

    await sourceItem.hover();
    await page.mouse.down();

    // Move to bottom and wait for autoscroll to reach absolute end
    await page.mouse.move(containerBox.x + 100, containerBox.y + containerBox.height - 20);
    // Intentional delay: long wait for autoscroll to reach the end of the list
    await page.waitForTimeout(8000);

    // Get the drag state
    const dragState = await page.evaluate(() => {
      const stateEl = document.querySelector('h3 + pre, .drag-state');
      return stateEl?.textContent;
    });

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
    await sourceItem.hover();
    await page.mouse.down();
    // Small initial move to trigger drag detection
    await page.mouse.move(itemBox!.x + 5, itemBox!.y + 5, { steps: 2 });
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
      await page.mouse.move(centerX, nearBottomY, { steps: 5 });
      // Intentional delay: accumulate autoscroll distance downward
      await page.waitForTimeout(3000);

      const bottomScrollTop = await demoPage.getScrollTop('list1');
      const bottomItems = await demoPage.list1Items.count();

      // Move to top, wait for autoscroll to reach top
      await page.mouse.move(centerX, nearTopY, { steps: 5 });
      // Intentional delay: accumulate autoscroll distance upward
      await page.waitForTimeout(3000);

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
    const dragState = await page.evaluate(() => {
      const stateEl = document.querySelector('h3 + pre, .drag-state');
      return stateEl?.textContent;
    });

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
      const state = await page.evaluate(() => {
        const stateEl = document.querySelector('h3 + pre');
        const preview = document.querySelector('.vdnd-drag-preview');
        const previewRect = preview?.getBoundingClientRect();
        return {
          dragState: stateEl?.textContent,
          previewTop: previewRect?.top ?? 0,
          previewBottom: previewRect?.bottom ?? 0,
        };
      });
      const indexMatch = state.dragState?.match(/"placeholderIndex":\s*(\d+)/);
      return {
        placeholderIndex: indexMatch ? parseInt(indexMatch[1], 10) : -1,
        previewTop: state.previewTop,
        previewBottom: state.previewBottom,
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
        // Intentional short delay: simulate real user slowly moving the mouse
        await page.waitForTimeout(100);
      }

      // Stay at bottom edge for autoscroll
      await page.mouse.move(startX, bottomEdge - 15, { steps: 3 });
      // Intentional delay: accumulate autoscroll distance downward
      await page.waitForTimeout(4000);

      // Slowly approach top edge
      for (let y = bottomEdge - 15; y > topEdge + 15; y -= 20) {
        await page.mouse.move(startX, y, { steps: 3 });
        // Intentional short delay: simulate real user slowly moving the mouse
        await page.waitForTimeout(100);
      }

      // Stay at top edge for autoscroll
      await page.mouse.move(startX, topEdge + 15, { steps: 3 });
      // Intentional delay: accumulate autoscroll distance upward
      await page.waitForTimeout(4000);

      const topState = await getState();
      const topScroll = await demoPage.getScrollTop('list2');

      // Calculate expected placeholder index based on preview position
      const expectedTopIndex = Math.floor(
        (topState.previewTop - containerTop + topScroll + 25) / 50,
      );
      const topDrift = Math.abs(expectedTopIndex - topState.placeholderIndex);

      testInfo.attach(`cycle-${cycle + 1}-state`, {
        body: JSON.stringify({ topState, topScroll, expectedTopIndex, topDrift }, null, 2),
        contentType: 'application/json',
      });

      // After 2 cycles, drift should still be minimal - after Safari drift fix
      if (cycle === 1) {
        expect(topDrift).toBeLessThan(3);
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

      const webkitItemBox = await sourceItem.boundingBox();
      await sourceItem.hover();
      await page.mouse.down();
      // Small initial move to trigger drag detection
      await page.mouse.move(webkitItemBox!.x + 5, webkitItemBox!.y + 5, { steps: 2 });
      await expect(demoPage.dragPreview).toBeVisible({ timeout: 2000 });

      const nearBottomY = containerBox.y + containerBox.height - 15;
      const nearTopY = containerBox.y + 15;
      const centerX = containerBox.x + containerBox.width / 2;

      // Rapid direction changes - this is where Safari drift is most visible
      for (let i = 0; i < 3; i++) {
        // Quick move to bottom
        await page.mouse.move(centerX, nearBottomY, { steps: 3 });
        // Intentional delay: accumulate some autoscroll before direction change
        await page.waitForTimeout(800);

        // Quick move to top
        await page.mouse.move(centerX, nearTopY, { steps: 3 });
        // Intentional delay: accumulate some autoscroll before direction change
        await page.waitForTimeout(800);
      }

      // Check final drift
      const scrollTop = await demoPage.getScrollTop('list1');
      const dragState = await page.evaluate(() => {
        const stateEl = document.querySelector('h3 + pre');
        return stateEl?.textContent;
      });

      const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
      const actualIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;
      const expectedIndex = Math.floor(scrollTop / 50);

      const drift = Math.abs(expectedIndex - actualIndex);

      testInfo.attach('safari-rapid-direction-drift', {
        body: JSON.stringify({ drift, actualIndex, expectedIndex, scrollTop }, null, 2),
        contentType: 'application/json',
      });

      // After fix, drift should be minimal even with rapid direction changes
      expect(drift).toBeLessThan(3);

      await page.mouse.up();
    });
  });

  test('no gap should remain after drop at maximum scroll', async ({ page }, testInfo) => {
    // Test that dropping an item when scrolled to bottom doesn't leave a gap
    // Scroll list1 to the bottom first — wrap write+read in toPass
    await expect(async () => {
      await demoPage.scrollList('list1', 5000);
      const scrollTop = await demoPage.getScrollTop('list1');
      expect(scrollTop).toBeGreaterThan(1000);
    }).toPass({ timeout: 2000 });

    // Wait for items to stabilize after scroll, then pick a visible item near the bottom
    let itemCoords: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      itemCoords = await page.evaluate(() => {
        const container = document.querySelector(
          '[data-droppable-id="list-1"] vdnd-virtual-scroll',
        );
        if (!container) return null;
        const containerRect = container.getBoundingClientRect();
        const items = container.querySelectorAll('[data-draggable-id]');
        // Pick the last visible item
        let bestItem: { x: number; y: number; width: number; height: number } | null = null;
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          if (
            rect.bottom > containerRect.top &&
            rect.top < containerRect.bottom &&
            rect.height > 0
          ) {
            bestItem = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }
        }
        return bestItem;
      });
      expect(itemCoords).not.toBeNull();
    }).toPass({ timeout: 3000 });
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
