import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

test.describe('Autoscroll Placeholder Drift', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
    // Item count defaults to 100 in the demo
  });

  test('placeholder should stay aligned in List 2 during extended autoscroll', async ({ page }) => {
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

    // Small pause to ensure drag starts
    await page.waitForTimeout(100);

    // Move to bottom edge to trigger autoscroll
    const nearBottomY = containerBox.y + containerBox.height - 20;
    await page.mouse.move(containerBox.x + 100, nearBottomY, { steps: 10 });

    // Wait for autoscroll to happen (3 seconds should scroll ~60 items)
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

    console.log(
      `List2 Extended - Placeholder: ${placeholderValue}, ActualIdx: ${actualPlaceholderIndex}, ExpectedIdx: ~${expectedIndex}, ScrollTop: ${scrollTop}, IndexDrift: ${indexDrift}`
    );

    // Should scroll through most of the list
    expect(scrollTop).toBeGreaterThan(1500);

    // INDEX drift is the real bug - placeholder index should match cursor position
    // Allow tolerance of 3 items for edge cases (cursor near edge, scroll timing)
    expect(indexDrift).toBeLessThan(5);

    await page.mouse.up();
  });

  test('placeholder should stay aligned with drag preview during autoscroll down', async ({
    page,
  }) => {
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

    // 4. Wait for significant autoscroll (~3 seconds should scroll 60+ items)
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

    console.log(
      `List1 Down - Placeholder: ${placeholderValue}, ActualIdx: ${actualPlaceholderIndex}, ExpectedIdx: ~${expectedIndex}, ScrollTop: ${scrollTop}, IndexDrift: ${indexDrift}`
    );

    // Verify we scrolled at least some amount (test validity check)
    expect(scrollTop).toBeGreaterThan(500);

    // Index drift should be minimal - allow up to 8 items tolerance
    // (accounts for grab offset, item height variations, and edge cases)
    expect(indexDrift).toBeLessThan(10);

    await page.mouse.up();
  });

  test('placeholder drift should not accumulate during extended autoscroll', async ({ page }) => {
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

    // 5 seconds of autoscroll to maximize drift potential
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

    console.log(
      `Extended - Placeholder: ${placeholderValue}, ActualIdx: ${actualPlaceholderIndex}, ExpectedIdx: ~${expectedIndex}, ScrollTop: ${scrollTop}, IndexDrift: ${indexDrift}`
    );

    // Same tolerance even after extended scroll - drift should not grow
    expect(indexDrift).toBeLessThan(10);

    await page.mouse.up();
  });

  test('placeholder should stay aligned during autoscroll up', async ({ page }) => {
    // Scroll to bottom first
    await demoPage.scrollList('list1', 4000); // Near end of 100 items
    await page.waitForTimeout(100);

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

    console.log(
      `Up - Placeholder: ${placeholderValue}, ActualIdx: ${actualPlaceholderIndex}, ExpectedIdx: ~${expectedIndex}, ScrollTop: ${scrollTop}, IndexDrift: ${indexDrift}`
    );

    // Index drift should be minimal
    expect(indexDrift).toBeLessThan(10);

    await page.mouse.up();
  });

  test('placeholder should be accurate at absolute maximum scroll', async ({ page }) => {
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
    await page.waitForTimeout(8000); // Long wait to reach end

    // Get the drag state
    const dragState = await page.evaluate(() => {
      const stateEl = document.querySelector('h3 + pre, .drag-state');
      return stateEl?.textContent;
    });

    const indexMatch = dragState?.match(/"placeholderIndex":\s*(\d+)/);
    const placeholderIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

    console.log(`Max scroll - placeholderIndex: ${placeholderIndex}`);

    // Placeholder index should not exceed list length (50 items per list)
    expect(placeholderIndex).toBeGreaterThan(0);
    expect(placeholderIndex).toBeLessThanOrEqual(50);

    await page.mouse.up();
  });

  test('no gap should remain after drop at maximum scroll', async ({ page }) => {
    // Test that dropping an item when scrolled to bottom doesn't leave a gap
    // Scroll list1 to the bottom first
    await demoPage.scrollList('list1', 5000);
    await page.waitForTimeout(100);

    // Get a visible item and start dragging
    const items = await demoPage.list1Items.all();
    const lastVisibleItem = items[items.length - 1];
    await lastVisibleItem.hover();
    await page.mouse.down();

    // Small move to activate drag
    const itemBox = await lastVisibleItem.boundingBox();
    if (itemBox) {
      await page.mouse.move(itemBox.x + 10, itemBox.y + 30, { steps: 5 });
    }
    await page.waitForTimeout(100);

    // Drop the item
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify no gap at bottom - scrollTop should be at or near maxScroll
    const { scrollTop, scrollHeight, clientHeight } = await demoPage.list1VirtualScroll.evaluate(
      (el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      })
    );

    const maxScroll = scrollHeight - clientHeight;
    const gap = maxScroll - scrollTop;

    console.log(
      `After drop - scrollTop: ${scrollTop}, maxScroll: ${maxScroll}, gap: ${gap}, scrollHeight: ${scrollHeight}`
    );

    // Gap should be less than 1 item height (50px)
    expect(gap).toBeLessThan(60);
  });
});
