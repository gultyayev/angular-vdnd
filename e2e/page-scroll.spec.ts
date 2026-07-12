import { expect, test } from '@playwright/test';
import { TaskDemoPage, taskDemoSelectors } from './fixtures/task-demo.page';

test.describe('Page Scroll Demo', () => {
  let taskDemo: TaskDemoPage;
  let consoleErrors: { text: string; url: string }[] = [];

  test.beforeEach(async ({ page }) => {
    taskDemo = new TaskDemoPage(page);
    consoleErrors = [];

    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), url: msg.location().url });
      }
    });

    await taskDemo.goto('/page-scroll');
  });

  test.afterEach(async () => {
    // Filter out known benign errors (like favicon not found)
    const realErrors = consoleErrors.filter(
      ({ text, url }) =>
        !text.includes('favicon') &&
        !text.includes('net::ERR_') &&
        !text.includes('404') &&
        !(
          url.startsWith('https://fonts.gstatic.com/') &&
          text.includes('Failed to load resource: the server responded with a status of 403')
        ),
    );
    expect(realErrors, 'Unexpected console errors detected').toHaveLength(0);
  });

  test('should display tasks', async () => {
    const count = await taskDemo.items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter tasks by category', async () => {
    // Click on "Work" chip
    await taskDemo.categoryFilter('work').click();

    // Wait for filter to apply by checking that only work badges are shown
    await expect(async () => {
      const categories = await taskDemo.getTaskCategoryTexts();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.every((text) => text === 'work')).toBe(true);
    }).toPass({ timeout: 2000 });
  });

  test('should reorder tasks within the list via drag and drop', async ({ page }) => {
    // Get second item text for verification
    const secondItemText = await taskDemo.getTaskTitle(1);

    // Get the first item's bounding box
    const sourceItem = taskDemo.items.first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Drag first item to second position
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag to initiate
    await expect(taskDemo.dragPreview).toBeVisible({ timeout: 2000 });

    // Move to second item position (72px item height)
    const targetX = sourceBox.x + sourceBox.width / 2;
    const targetY = sourceBox.y + 72 + 36; // Move to center of second slot
    await page.mouse.move(targetX, targetY, { steps: 10 });

    // The test asserts exact post-drop order, so the placeholder index must be computed from
    // the exact release coordinates before releasing (a rAF wait alone is racy under load).
    await taskDemo.settleDragPosition(targetX, targetY);

    // Drop
    await page.mouse.up();

    // Verify reorder happened
    await expect(async () => {
      const newFirstItemText = await taskDemo.getTaskTitle(0);
      expect(newFirstItemText).toBe(secondItemText);
    }).toPass({ timeout: 2000 });
  });

  test('should show drag preview while dragging', async ({ page }) => {
    const sourceItem = taskDemo.items.first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    // Move enough to trigger drag (need a larger movement to activate drag)
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag preview to appear
    const dragPreview = taskDemo.dragPreview;
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move more to ensure drag is fully active
    await page.mouse.move(sourceBox.x + 100, sourceBox.y + 100, { steps: 10 });

    // Verify drag preview is still visible
    await expect(dragPreview).toBeVisible();

    await page.mouse.up();
  });

  test('should handle rapid filter changes without errors', async ({ page }) => {
    // Rapidly change filters
    const filters = ['work', 'personal', 'urgent', 'all'] as const;
    for (const filter of filters) {
      await taskDemo.categoryFilter(filter).click();
      // Wait one rAF between filter changes for rendering to process
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }

    // Check no error overlay appeared
    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).not.toBeVisible();
  });

  test('should scroll and drag without errors', async ({ page }) => {
    // Scroll down — wrap write+read in toPass
    await expect(async () => {
      await taskDemo.scrollTo(500);
      const scrollTop = await taskDemo.getScrollTop();
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    // Get a visible item
    const visibleItem = taskDemo.items.first();
    const box = await visibleItem.boundingBox();
    if (!box) throw new Error('Could not get bounding box');

    // Drag the item
    await visibleItem.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 100, { steps: 5 });
    // Wait for drag to start or not — just verify no errors
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();

    // Check no error overlay appeared
    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).not.toBeVisible();
  });

  test('should maintain scroll consistency after scrolling', async () => {
    // Get initial first item text
    const initialFirstItem = await taskDemo.getTaskTitle(0);

    // Get header height to calculate proper scroll offset
    const headerHeight = await taskDemo.getHeaderHeight();

    // Scroll down significantly past header — include first-item check in toPass
    const scrollAmount = headerHeight + 500;
    await expect(async () => {
      await taskDemo.scrollTo(scrollAmount);
      const scrollTop = await taskDemo.getScrollTop();
      expect(scrollTop).toBeGreaterThan(0);
      const afterScrollFirstItem = await taskDemo.getTaskTitle(0);
      expect(afterScrollFirstItem).not.toBe(initialFirstItem);
    }).toPass({ timeout: 3000 });

    // Scroll back up — include item check in toPass (virtual scroll needs a frame to re-render)
    await expect(async () => {
      await taskDemo.scrollTo(0);
      const scrollTop = await taskDemo.getScrollTop();
      expect(scrollTop).toBe(0);
      const restoredFirstItem = await taskDemo.getTaskTitle(0);
      expect(restoredFirstItem).toBe(initialFirstItem);
    }).toPass({ timeout: 3000 });
  });

  test('should not show gray gaps when scrolling up rapidly', async () => {
    // Scroll down significantly
    await expect(async () => {
      await taskDemo.scrollTo(2000);
      const scrollTop = await taskDemo.getScrollTop();
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    // Rapidly scroll up 500px
    await taskDemo.scrollContainer.evaluate((el) => {
      el.scrollTop -= 500;
    });

    // Wait for virtual scroll to cover the visible list area at the new position.
    await expect(async () => {
      const coverage = await taskDemo.getVisibleListCoverage();
      expect(coverage.visibleHeight).toBeGreaterThan(100);
      expect(coverage.renderedItemCount).toBeGreaterThan(0);
      expect(coverage.maxGap, JSON.stringify(coverage)).toBeLessThanOrEqual(4);
    }).toPass({ timeout: 2000 });
  });

  test('should position drag placeholder correctly when scrolled', async ({ page }) => {
    // Scroll using retrying assertion (E2E.md: scroll write+read BOTH inside toPass)
    await expect(async () => {
      await taskDemo.scrollTo(1500);
      const scrollTop = await taskDemo.getScrollTop();
      expect(scrollTop).toBeGreaterThanOrEqual(1400);
    }).toPass({ timeout: 3000 });

    // Wait for virtual scroll to render items at new position
    await expect(taskDemo.items.first()).toBeVisible({ timeout: 2000 });

    // Virtual scroll renders overscan items above the viewport, and a sticky
    // category-chips header (z-index: 100) occludes items near the top.
    // Pick the source item by viewport position (center of scroll container)
    // to guarantee it's fully visible and not behind the sticky header.
    const scrollBox = await taskDemo.scrollContainer.boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    const sourceRect = await taskDemo.getVisibleItemBoxAt(0.4);
    if (!sourceRect) throw new Error('Could not find visible task item near center');

    const sourceX = sourceRect.x + sourceRect.width / 2;
    const sourceY = sourceRect.y + sourceRect.height / 2;

    // Start drag
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    await page.mouse.move(sourceX + 5, sourceY + 5, { steps: 2 });

    const dragPreview = taskDemo.dragPreview;
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move 2 items below source — still well within the visible droppable area.
    const targetY = scrollBox.y + scrollBox.height * 0.65;
    const targetX = sourceX;

    await page.mouse.move(targetX, targetY, { steps: 10 });
    // Firefox: follow up stepped move with direct move (E2E.md Rule #6)
    await page.mouse.move(targetX, targetY);
    // rAF wait for position update (E2E.md: "rAF Wait After Mouse Moves")
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    // Verify placeholder exists and is reasonably aligned with the target slot.
    const placeholder = taskDemo.visiblePlaceholder;
    await expect(placeholder).toBeVisible({ timeout: 3000 });
    await expect(async () => {
      const placeholderBox = await placeholder.boundingBox();
      expect(placeholderBox).not.toBeNull();
      const distance = Math.abs(placeholderBox!.y - targetY);
      expect(distance).toBeLessThan(200);
    }).toPass({ timeout: 2000 });

    await page.mouse.up();
  });

  test('should keep drag preview visible during autoscroll', async ({ page }) => {
    // Get the scroll container and its dimensions
    const scrollContainer = taskDemo.scrollContainer;
    const scrollBox = await scrollContainer.boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    // Get the first visible item
    const sourceItem = taskDemo.items.first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Start drag
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag preview to appear
    const dragPreview = taskDemo.dragPreview;
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move to bottom edge to trigger autoscroll (25px from bottom)
    const edgeOffset = 25;
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    const targetX = scrollBox.x + scrollBox.width / 2;
    await page.mouse.move(targetX, bottomEdgeY, { steps: 15 });
    // Extra move for stability
    await page.mouse.move(targetX, bottomEdgeY);

    // Wait for autoscroll to happen
    await expect(async () => {
      const scrollTop = await taskDemo.getScrollTop();
      expect(scrollTop, `ScrollTop should increase, current: ${scrollTop}`).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    const scrollTop = await taskDemo.getScrollTop();

    // Verify scroll happened (should be > 0 since we started at top)
    expect(scrollTop).toBeGreaterThan(0);

    // CRITICAL: Verify drag preview is STILL visible after autoscroll
    await expect(dragPreview).toBeVisible();

    // Continue autoscroll for longer and verify preview stays visible while scroll advances.
    let previousScrollTop = scrollTop;
    for (let i = 0; i < 5; i++) {
      await expect(async () => {
        await expect(dragPreview).toBeVisible();
        const currentScrollTop = await taskDemo.getScrollTop();
        expect(currentScrollTop).toBeGreaterThan(previousScrollTop);
      }).toPass({ timeout: 5000 });
      previousScrollTop = await taskDemo.getScrollTop();
    }

    // Get final scroll position
    const finalScrollTop = await taskDemo.getScrollTop();

    // Should have scrolled significantly
    expect(finalScrollTop).toBeGreaterThan(scrollTop);

    // Preview still visible after extended autoscroll
    await expect(dragPreview).toBeVisible();

    await page.mouse.up();
  });

  test('should keep drag preview and placeholder visible during long autoscroll', async ({
    page,
  }, testInfo) => {
    const scrollContainer = taskDemo.scrollContainer;
    const scrollBox = await scrollContainer.boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    const sourceItem = taskDemo.items.first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = taskDemo.dragPreview;
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    const edgeOffset = 25; // Use consistent 25px offset for all browsers (well within 50px threshold)
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    const targetX = scrollBox.x + scrollBox.width / 2;

    // Move to bottom edge to trigger autoscroll
    await page.mouse.move(targetX, bottomEdgeY, { steps: 15 });
    // Extra move without steps to ensure Firefox registers the final position correctly
    await page.mouse.move(targetX, bottomEdgeY);

    await expect(async () => {
      const scrollTop = await taskDemo.getScrollTop();
      expect(scrollTop, `Scroll should reach 2000px, current: ${scrollTop}`).toBeGreaterThan(2000);
    }).toPass({ timeout: 25000 });

    const placeholder = taskDemo.placeholder;
    await expect(dragPreview).toBeVisible();
    await expect(placeholder).toBeVisible();

    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const placeholderEdgeAllowance = 80;
    const previewEdgeAllowance = 40;

    // Measure both elements atomically in a single browser evaluation to avoid
    // timing skew between sequential boundingBox() calls during rapid autoscroll
    const measureAlignment = async () => {
      const result = await page.evaluate((selectors) => {
        const preview = document.querySelector(selectors.dragPreview);
        const placeholder = document.querySelector(selectors.placeholder);

        if (!preview || !placeholder) {
          return null;
        }

        const previewRect = preview.getBoundingClientRect();
        const placeholderRect = placeholder.getBoundingClientRect();

        return {
          previewY: previewRect.top,
          previewHeight: previewRect.height,
          placeholderY: placeholderRect.top,
          placeholderHeight: placeholderRect.height,
        };
      }, taskDemoSelectors);

      if (!result) throw new Error('Elements not rendered');

      const { previewY, previewHeight, placeholderY, placeholderHeight } = result;

      expect(previewY).toBeGreaterThanOrEqual(-20);
      expect(previewY + previewHeight).toBeLessThanOrEqual(viewportHeight + previewEdgeAllowance);
      expect(placeholderY).toBeGreaterThanOrEqual(scrollBox.y - 20);
      expect(placeholderY).toBeLessThanOrEqual(
        scrollBox.y + scrollBox.height + placeholderEdgeAllowance,
      );

      const previewCenterY = previewY + previewHeight / 2;
      const placeholderCenterY = placeholderY + placeholderHeight / 2;
      return {
        drift: Math.abs(previewCenterY - placeholderCenterY),
        itemHeight: placeholderHeight,
      };
    };

    const driftSamples: number[] = [];
    const { drift: initialDrift, itemHeight: initialItemHeight } = await measureAlignment();
    driftSamples.push(initialDrift);

    let previousSampleScrollTop = await taskDemo.getScrollTop();
    for (let i = 0; i < 8; i++) {
      await expect(async () => {
        await expect(dragPreview).toBeVisible();
        await expect(placeholder).toBeVisible();
        const currentScrollTop = await taskDemo.getScrollTop();
        expect(currentScrollTop).toBeGreaterThan(previousSampleScrollTop);
      }).toPass({ timeout: 5000 });
      previousSampleScrollTop = await taskDemo.getScrollTop();
      const { drift } = await measureAlignment();
      driftSamples.push(drift);
    }

    const maxDrift = Math.max(...driftSamples);
    // Tolerance: half-item index-snapping (itemHeight/2) + cross-browser sub-pixel factors:
    // contentOffset ResizeObserver rounding (~3px), translateY sub-pixel rendering (~3px),
    // grab offset rounding (~2px). Still catches real regressions (>= 1 item = 72px).
    const alignmentTolerance = initialItemHeight * 0.65 + 4;
    const debugMetrics = await page.evaluate((selectors) => {
      const container = document.querySelector(selectors.scrollContainer) as HTMLElement | null;
      const virtualContent = document.querySelector(selectors.virtualContent) as HTMLElement | null;
      const wrapper = document.querySelector(selectors.contentWrapper) as HTMLElement | null;
      if (!container || !virtualContent || !wrapper) {
        return null;
      }
      const contentOffset = parseFloat(virtualContent.getAttribute('data-content-offset') || '0');
      const itemHeight = parseFloat(virtualContent.getAttribute('data-item-height') || '0');
      const containerRect = container.getBoundingClientRect();
      const preview = document.querySelector(selectors.dragPreview) as HTMLElement | null;
      const placeholder = document.querySelector(selectors.placeholder) as HTMLElement | null;
      const previewRect = preview?.getBoundingClientRect();
      const placeholderRect = placeholder?.getBoundingClientRect();
      const transform = getComputedStyle(wrapper).transform;
      let transformY = 0;
      const translateMatch = transform.match(/translateY\(([-0-9.]+)px\)/);
      if (translateMatch?.[1]) {
        transformY = parseFloat(translateMatch[1]);
      } else if (transform !== 'none') {
        const matrixMatch = transform.match(/matrix\\(([^)]+)\\)/);
        const parts = matrixMatch?.[1]?.split(',').map((val) => parseFloat(val.trim()));
        if (parts && parts.length === 6) {
          transformY = parts[5];
        }
      }
      const startIndex = itemHeight ? Math.round(transformY / itemHeight) : 0;
      const overscan = 3;
      const estimatedScrollTopSignal = (startIndex + overscan) * itemHeight;
      const actualScrollTop = container.scrollTop;
      const adjustedScrollTop = Math.max(0, actualScrollTop - contentOffset);
      const listStartY = containerRect.top + contentOffset - actualScrollTop;
      const previewCenterY = previewRect ? previewRect.top + previewRect.height / 2 : null;
      const placeholderCenterY = placeholderRect
        ? placeholderRect.top + placeholderRect.height / 2
        : null;
      const expectedIndex =
        previewCenterY !== null && itemHeight
          ? Math.floor((previewCenterY - listStartY) / itemHeight)
          : null;
      const actualIndex =
        placeholderCenterY !== null && itemHeight
          ? Math.floor((placeholderCenterY - listStartY) / itemHeight)
          : null;
      return {
        actualScrollTop,
        adjustedScrollTop,
        contentOffset,
        itemHeight,
        transformY,
        startIndex,
        estimatedScrollTopSignal,
        expectedIndex,
        actualIndex,
        previewCenterY,
        placeholderCenterY,
      };
    }, taskDemoSelectors);
    testInfo.attach('alignment-metrics', {
      body: JSON.stringify({ maxDrift, alignmentTolerance, driftSamples, debugMetrics }, null, 2),
      contentType: 'application/json',
    });
    expect(maxDrift).toBeLessThanOrEqual(alignmentTolerance);

    await page.mouse.up();
  });

  test('should not emit ResizeObserver errors', async ({ page }) => {
    let resizeObserverErrors = 0;

    // Listen for page errors (ResizeObserver error is a page error in Safari)
    page.on('pageerror', (error) => {
      if (error.message.includes('ResizeObserver')) {
        resizeObserverErrors++;
      }
    });

    // Also check console for ResizeObserver warnings
    page.on('console', (msg) => {
      if (msg.text().includes('ResizeObserver')) {
        resizeObserverErrors++;
      }
    });

    // Wait for initial render to settle
    await expect(taskDemo.items.first()).toBeVisible();

    // Scroll multiple times to trigger potential ResizeObserver issues
    for (let i = 0; i < 5; i++) {
      await taskDemo.scrollTo(i * 500);
      // Wait one rAF between scrolls for rendering to process
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }

    expect(resizeObserverErrors).toBe(0);
  });
});
