import { expect, test } from '@playwright/test';

test.describe('Page Scroll Demo', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/page-scroll');
    // Wait for initial render
    await page.locator('.task-item').first().waitFor({ state: 'visible' });
  });

  test.afterEach(async () => {
    // Filter out known benign errors (like favicon not found)
    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('net::ERR_') && !err.includes('404'),
    );
    expect(realErrors, 'Unexpected console errors detected').toHaveLength(0);
  });

  test('should display tasks', async ({ page }) => {
    const taskItems = page.locator('.task-item');
    const count = await taskItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter tasks by category', async ({ page }) => {
    // Click on "Work" chip
    await page.locator('ion-chip').filter({ hasText: 'Work' }).click();

    // Wait for filter to apply by checking that only work badges are shown
    await expect(async () => {
      const badges = page.locator('.task-item ion-badge');
      const count = await badges.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const text = await badges.nth(i).textContent();
        expect(text?.trim()).toBe('work');
      }
    }).toPass({ timeout: 2000 });
  });

  test('should reorder tasks within the list via drag and drop', async ({ page }) => {
    // Get second item text for verification
    const secondItemText = await page
      .locator('.task-item')
      .nth(1)
      .locator('.task-title')
      .textContent();

    // Get the first item's bounding box
    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Drag first item to second position
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag to initiate
    await expect(page.locator('.vdnd-drag-preview')).toBeVisible({ timeout: 2000 });

    // Move to second item position (72px item height)
    const targetY = sourceBox.y + 72 + 36; // Move to center of second slot
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });
    // Wait one rAF for position update
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    // Drop
    await page.mouse.up();

    // Verify reorder happened
    await expect(async () => {
      const newFirstItemText = await page
        .locator('.task-item')
        .nth(0)
        .locator('.task-title')
        .textContent();
      expect(newFirstItemText?.trim()).toBe(secondItemText?.trim());
    }).toPass({ timeout: 2000 });
  });

  test('should show drag preview while dragging', async ({ page }) => {
    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    // Move enough to trigger drag (need a larger movement to activate drag)
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag preview to appear
    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move more to ensure drag is fully active
    await page.mouse.move(sourceBox.x + 100, sourceBox.y + 100, { steps: 10 });

    // Verify drag preview is still visible
    await expect(dragPreview).toBeVisible();

    await page.mouse.up();
  });

  test('should handle rapid filter changes without errors', async ({ page }) => {
    // Rapidly change filters
    const chips = ['Work', 'Personal', 'Urgent', 'All'];
    for (const chip of chips) {
      await page.locator('ion-chip').filter({ hasText: chip }).click();
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
      await page.evaluate(() => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = 500;
      });
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    // Get a visible item
    const visibleItem = page.locator('.task-item').first();
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

  test('should maintain scroll consistency after scrolling', async ({ page }) => {
    // Get initial first item text
    const initialFirstItem = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();

    // Get header height to calculate proper scroll offset
    const headerHeight = await page.evaluate(() => {
      const header = document.querySelector('.page-header');
      return header ? header.getBoundingClientRect().height : 0;
    });

    // Scroll down significantly past header — include first-item check in toPass
    const scrollAmount = headerHeight + 500;
    await expect(async () => {
      await page.evaluate((amount) => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = amount;
      }, scrollAmount);
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBeGreaterThan(0);
      const afterScrollFirstItem = await page
        .locator('.task-item')
        .first()
        .locator('.task-title')
        .textContent();
      expect(afterScrollFirstItem?.trim()).not.toBe(initialFirstItem?.trim());
    }).toPass({ timeout: 3000 });

    // Scroll back up — include item check in toPass (virtual scroll needs a frame to re-render)
    await expect(async () => {
      await page.evaluate(() => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = 0;
      });
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBe(0);
      const restoredFirstItem = await page
        .locator('.task-item')
        .first()
        .locator('.task-title')
        .textContent();
      expect(restoredFirstItem?.trim()).toBe(initialFirstItem?.trim());
    }).toPass({ timeout: 3000 });
  });

  test('should not show gray gaps when scrolling up rapidly', async ({ page }) => {
    // Scroll down significantly
    await expect(async () => {
      await page.evaluate(() => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = 2000;
      });
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    // Count visible items before rapid scroll
    const countBefore = await page.locator('.task-item').count();

    // Rapidly scroll up 500px
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop -= 500;
    });

    // Wait for virtual scroll to render items at new position
    await expect(async () => {
      const countAfter = await page.locator('.task-item').count();
      expect(countAfter).toBeGreaterThan(countBefore - 3);
    }).toPass({ timeout: 2000 });
  });

  test('should position drag placeholder correctly when scrolled', async ({ page }) => {
    // Scroll using retrying assertion (E2E.md: scroll write+read BOTH inside toPass)
    await expect(async () => {
      await page.evaluate(() => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = 1500;
      });
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBeGreaterThanOrEqual(1400);
    }).toPass({ timeout: 3000 });

    // Wait for virtual scroll to render items at new position
    await expect(page.locator('.task-item').first()).toBeVisible({ timeout: 2000 });

    // Virtual scroll renders overscan items above the viewport, and a sticky
    // category-chips header (z-index: 100) occludes items near the top.
    // Pick the source item by viewport position (center of scroll container)
    // to guarantee it's fully visible and not behind the sticky header.
    const scrollBox = await page.locator('.scroll-container').boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    const sourceRect = await page.evaluate(
      (centerY: number) => {
        const items = document.querySelectorAll<HTMLElement>('.task-item');
        for (const item of items) {
          if (item.offsetParent === null) continue; // skip hidden
          const rect = item.getBoundingClientRect();
          if (rect.top < centerY && rect.bottom > centerY) {
            return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
          }
        }
        return null;
      },
      scrollBox.y + scrollBox.height * 0.4,
    );
    if (!sourceRect) throw new Error('Could not find visible task item at center');

    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;

    // Start drag
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    await page.mouse.move(sourceX + 5, sourceY + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
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
    const placeholder = page.locator('.vdnd-drag-placeholder-visible');
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
    const scrollContainer = page.locator('.scroll-container');
    const scrollBox = await scrollContainer.boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    // Get the first visible item
    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Start drag
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag preview to appear
    const dragPreview = page.locator('.vdnd-drag-preview');
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
      const scrollTop = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        return container?.scrollTop ?? 0;
      });
      expect(scrollTop, `ScrollTop should increase, current: ${scrollTop}`).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    const scrollTop = await page.evaluate(() => {
      const container = document.querySelector('.scroll-container');
      return container?.scrollTop ?? 0;
    });

    // Verify scroll happened (should be > 0 since we started at top)
    expect(scrollTop).toBeGreaterThan(0);

    // CRITICAL: Verify drag preview is STILL visible after autoscroll
    await expect(dragPreview).toBeVisible();

    // Continue autoscroll for longer to test extended scrolling — verify preview stays visible
    // Intentional delay: let autoscroll accumulate more distance while checking preview
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(300);
      // Verify drag preview is STILL visible
      await expect(dragPreview).toBeVisible();
    }

    // Get final scroll position
    const finalScrollTop = await page.evaluate(() => {
      const container = document.querySelector('.scroll-container');
      return container?.scrollTop ?? 0;
    });

    // Should have scrolled significantly
    expect(finalScrollTop).toBeGreaterThan(scrollTop);

    // Preview still visible after extended autoscroll
    await expect(dragPreview).toBeVisible();

    await page.mouse.up();
  });

  test('should keep drag preview and placeholder visible during long autoscroll', async ({
    page,
  }, testInfo) => {
    const scrollContainer = page.locator('.scroll-container');
    const scrollBox = await scrollContainer.boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    const sourceItem = page.locator('.task-item').first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    const edgeOffset = 25; // Use consistent 25px offset for all browsers (well within 50px threshold)
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    const targetX = scrollBox.x + scrollBox.width / 2;

    // Move to bottom edge to trigger autoscroll
    await page.mouse.move(targetX, bottomEdgeY, { steps: 15 });
    // Extra move without steps to ensure Firefox registers the final position correctly
    await page.mouse.move(targetX, bottomEdgeY);

    await expect(async () => {
      const scrollTop = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        return container?.scrollTop ?? 0;
      });
      expect(scrollTop, `Scroll should reach 2000px, current: ${scrollTop}`).toBeGreaterThan(2000);
    }).toPass({ timeout: 15000 });

    const placeholder = page.locator('.vdnd-drag-placeholder');
    await expect(dragPreview).toBeVisible();
    await expect(placeholder).toBeVisible();

    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const placeholderEdgeAllowance = 80;
    const previewEdgeAllowance = 40;

    // Measure both elements atomically in a single browser evaluation to avoid
    // timing skew between sequential boundingBox() calls during rapid autoscroll
    const measureAlignment = async () => {
      const result = await page.evaluate(() => {
        const preview = document.querySelector('.vdnd-drag-preview');
        const placeholder = document.querySelector('.vdnd-drag-placeholder');

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
      });

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

    for (let i = 0; i < 8; i++) {
      // Intentional delay: let autoscroll continue between drift samples
      await page.waitForTimeout(400);
      await expect(dragPreview).toBeVisible();
      await expect(placeholder).toBeVisible();
      const { drift } = await measureAlignment();
      driftSamples.push(drift);
    }

    const maxDrift = Math.max(...driftSamples);
    // Tolerance: half-item index-snapping (itemHeight/2) + cross-browser sub-pixel factors:
    // contentOffset ResizeObserver rounding (~3px), translateY sub-pixel rendering (~3px),
    // grab offset rounding (~2px). Still catches real regressions (>= 1 item = 72px).
    const alignmentTolerance = initialItemHeight * 0.65 + 4;
    const debugMetrics = await page.evaluate(() => {
      const container = document.querySelector('.scroll-container') as HTMLElement | null;
      const virtualContent = document.querySelector('vdnd-virtual-content') as HTMLElement | null;
      const wrapper = document.querySelector('.vdnd-content-wrapper') as HTMLElement | null;
      if (!container || !virtualContent || !wrapper) {
        return null;
      }
      const contentOffset = parseFloat(virtualContent.getAttribute('data-content-offset') || '0');
      const itemHeight = parseFloat(virtualContent.getAttribute('data-item-height') || '0');
      const containerRect = container.getBoundingClientRect();
      const preview = document.querySelector('.vdnd-drag-preview') as HTMLElement | null;
      const placeholder = document.querySelector('.vdnd-drag-placeholder') as HTMLElement | null;
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
    });
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
    await expect(page.locator('.task-item').first()).toBeVisible();

    // Scroll multiple times to trigger potential ResizeObserver issues
    for (let i = 0; i < 5; i++) {
      await page.evaluate((scrollAmount) => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = scrollAmount;
      }, i * 500);
      // Wait one rAF between scrolls for rendering to process
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }

    expect(resizeObserverErrors).toBe(0);
  });
});
