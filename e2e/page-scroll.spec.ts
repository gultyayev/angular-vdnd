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

    // Wait for filter to apply
    await page.waitForTimeout(100);

    // Check that only work tasks are shown
    const badges = page.locator('.task-item ion-badge');
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).textContent();
      expect(text?.trim()).toBe('work');
    }
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
    await page.waitForTimeout(50);

    // Move to second item position (72px item height)
    const targetY = sourceBox.y + 72 + 36; // Move to center of second slot
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });
    await page.waitForTimeout(100);

    // Drop
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Verify reorder happened - first item should now be what was second
    const newFirstItemText = await page
      .locator('.task-item')
      .nth(0)
      .locator('.task-title')
      .textContent();
    expect(newFirstItemText?.trim()).toBe(secondItemText?.trim());
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
    await page.waitForTimeout(100);

    // Verify drag preview appears
    await expect(dragPreview).toBeVisible();

    await page.mouse.up();
  });

  test('should handle rapid filter changes without errors', async ({ page }) => {
    // Rapidly change filters
    const chips = ['Work', 'Personal', 'Urgent', 'All'];
    for (const chip of chips) {
      await page.locator('ion-chip').filter({ hasText: chip }).click();
      await page.waitForTimeout(50);
    }

    // Check no error overlay appeared
    const errorOverlay = page.locator('vite-error-overlay');
    await expect(errorOverlay).not.toBeVisible();
  });

  test('should scroll and drag without errors', async ({ page }) => {
    // Scroll down
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 500;
    });

    await page.waitForTimeout(100);

    // Get a visible item
    const visibleItem = page.locator('.task-item').first();
    const box = await visibleItem.boundingBox();
    if (!box) throw new Error('Could not get bounding box');

    // Drag the item
    await visibleItem.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 100, { steps: 5 });
    await page.waitForTimeout(100);
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

    // Scroll down significantly past header (header + 5 items = header + 360px)
    const scrollAmount = headerHeight + 500;
    await page.evaluate((amount) => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = amount;
    }, scrollAmount);
    await page.waitForTimeout(200);

    // Verify first visible item changed
    const afterScrollFirstItem = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();
    expect(afterScrollFirstItem?.trim()).not.toBe(initialFirstItem?.trim());

    // Scroll back up
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Verify original first item returns
    const restoredFirstItem = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();
    expect(restoredFirstItem?.trim()).toBe(initialFirstItem?.trim());
  });

  test('should not show gray gaps when scrolling up rapidly', async ({ page }) => {
    // Scroll down significantly (2000px)
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 2000;
    });
    await page.waitForTimeout(200);

    // Count visible items before rapid scroll
    const countBefore = await page.locator('.task-item').count();

    // Rapidly scroll up 500px
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop -= 500;
    });
    await page.waitForTimeout(100);

    // Count visible items after rapid scroll - should be similar (no gaps)
    const countAfter = await page.locator('.task-item').count();

    // Items should be rendered (count should be similar, within tolerance)
    expect(countAfter).toBeGreaterThan(countBefore - 3);
  });

  test('should position drag placeholder correctly when scrolled', async ({ page }) => {
    // Scroll to middle of list (1500px to stay within bounds)
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 1500;
    });
    await page.waitForTimeout(300);

    // Get the first visible item and ensure it's in viewport
    const sourceItem = page.locator('.task-item').first();
    await sourceItem.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Start drag
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag preview to appear
    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move down 2 items (144px)
    const targetY = sourceBox.y + 144;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });
    await page.waitForTimeout(200);

    // Verify placeholder exists and is reasonably aligned with the target slot.
    // (The placeholder element is the authoritative representation of the computed drop position.)
    const placeholder = page.locator('.vdnd-drag-placeholder-visible');
    await expect(placeholder).toBeVisible({ timeout: 2000 });
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

    // Move to bottom edge to trigger autoscroll (20px from bottom)
    const bottomEdgeY = scrollBox.y + scrollBox.height - 20;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, bottomEdgeY, { steps: 10 });

    // Wait for autoscroll to happen
    await page.waitForTimeout(500);

    // Get scroll position to verify autoscroll happened
    const scrollTop = await page.evaluate(() => {
      const container = document.querySelector('.scroll-container');
      return container?.scrollTop ?? 0;
    });

    // Verify scroll happened (should be > 0 since we started at top)
    expect(scrollTop).toBeGreaterThan(0);

    // CRITICAL: Verify drag preview is STILL visible after autoscroll
    await expect(dragPreview).toBeVisible();

    // Continue autoscroll for longer to test extended scrolling
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

    const edgeOffset = testInfo.project.name === 'firefox' ? 10 : 20;
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    const targetX = scrollBox.x + scrollBox.width / 2;
    await page.mouse.move(targetX, bottomEdgeY, { steps: 10 });

    await expect(async () => {
      const scrollTop = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        return container?.scrollTop ?? 0;
      });
      expect(scrollTop).toBeGreaterThan(2000);
    }).toPass({ timeout: 8000 });

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
      await page.waitForTimeout(400);
      await expect(dragPreview).toBeVisible();
      await expect(placeholder).toBeVisible();
      const { drift } = await measureAlignment();
      driftSamples.push(drift);
    }

    const maxDrift = Math.max(...driftSamples);
    const alignmentTolerance = initialItemHeight * 0.5;
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
      body: JSON.stringify({ maxDrift, alignmentTolerance, debugMetrics }, null, 2),
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

    // Dismiss banner and scroll around to trigger resize events
    await page.waitForTimeout(200);

    // Scroll multiple times to trigger potential ResizeObserver issues
    for (let i = 0; i < 5; i++) {
      await page.evaluate((scrollAmount) => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = scrollAmount;
      }, i * 500);
      await page.waitForTimeout(50);
    }

    expect(resizeObserverErrors).toBe(0);
  });
});
