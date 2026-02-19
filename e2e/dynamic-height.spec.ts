import { expect, test } from '@playwright/test';

test.describe('Dynamic Height Demo', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/dynamic-height');
    await page.locator('.task-item').first().waitFor({ state: 'visible' });
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('net::ERR_') && !err.includes('404'),
    );
    expect(realErrors, 'Unexpected console errors detected').toHaveLength(0);
  });

  test('should display items with varying heights', async ({ page }) => {
    const heights = await page.evaluate(() => {
      const items = document.querySelectorAll('.task-item');
      const result: number[] = [];
      for (let i = 0; i < Math.min(5, items.length); i++) {
        result.push(items[i].getBoundingClientRect().height);
      }
      return result;
    });

    expect(heights.length).toBe(5);
    const uniqueHeights = new Set(heights);
    expect(uniqueHeights.size).toBeGreaterThan(1);
  });

  test('should filter tasks by category', async ({ page }) => {
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

  test('should scroll and render items correctly', async ({ page }) => {
    const initialFirstItem = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();

    const headerHeight = await page.evaluate(() => {
      const header = document.querySelector('.page-header');
      return header ? header.getBoundingClientRect().height : 0;
    });

    const scrollAmount = headerHeight + 500;

    // Scroll down — wrap write+read+assertion in toPass (virtual scroll needs a frame to re-render)
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

    // Scroll back to top — include item check in toPass (virtual scroll needs a frame to re-render)
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

  test('should reorder tasks via drag-drop', async ({ page }) => {
    const secondItemText = await page
      .locator('.task-item')
      .nth(1)
      .locator('.task-title')
      .textContent();

    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Get the second item's actual position (no fixed-height math)
    const targetItem = page.locator('.task-item').nth(1);
    const targetBox = await targetItem.boundingBox();
    if (!targetBox) throw new Error('Could not get target bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move to center of second item
    const targetY = targetBox.y + targetBox.height / 2;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });

    // Wait one rAF before drop (position update is rAF-throttled)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();

    // Wait for drop to complete by verifying DOM update
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
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    await page.mouse.move(sourceBox.x + 100, sourceBox.y + 100, { steps: 10 });

    // Verify drag preview is still visible after moving
    await expect(dragPreview).toBeVisible();
    await page.mouse.up();
  });

  test('should show placeholder during drag', async ({ page }) => {
    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    const targetItem = page.locator('.task-item').nth(1);
    const targetBox = await targetItem.boundingBox();
    if (!targetBox) throw new Error('Could not get target bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    const targetY = targetBox.y + targetBox.height / 2;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });

    // Wait one rAF for position update, then check placeholder
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    const placeholder = page.locator('.vdnd-drag-placeholder-visible');
    await expect(placeholder).toBeVisible({ timeout: 2000 });

    await page.mouse.up();
  });

  test('should not show gray gaps during rapid scroll', async ({ page }) => {
    // Scroll down
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

    const countBefore = await page.locator('.task-item').count();

    // Rapidly scroll up
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

  test('should keep drag preview visible during autoscroll', async ({ page }) => {
    const scrollContainer = page.locator('.scroll-container');
    const scrollBox = await scrollContainer.boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    const edgeOffset = 25; // Consistent 25px offset
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    const targetX = sourceBox.x + sourceBox.width / 2;
    await page.mouse.move(targetX, bottomEdgeY, { steps: 15 });
    // Extra move for stability
    await page.mouse.move(targetX, bottomEdgeY);

    await expect(async () => {
      const scrollTop = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        return container?.scrollTop ?? 0;
      });
      expect(scrollTop, `ScrollTop should reach 200, current: ${scrollTop}`).toBeGreaterThan(200);
    }).toPass({ timeout: 10000 });

    await expect(dragPreview).toBeVisible();
    await page.mouse.up();
  });

  test('should correctly reorder after scrolling and maintain virtual scroll', async ({ page }) => {
    // Scroll down so visible items are past the first few
    const scrollAmount = 800;
    await expect(async () => {
      await page.evaluate((amount) => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = amount;
      }, scrollAmount);
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    // Get items actually visible in the viewport (not overscan items)
    const visibleInfo = await page.evaluate(() => {
      const container = document.querySelector('.scroll-container');
      if (!container) return { items: [] as { id: string; top: number; height: number }[] };
      const containerRect = container.getBoundingClientRect();
      const items = document.querySelectorAll('[data-draggable-id]');
      const visible: { id: string; top: number; height: number }[] = [];
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        // Item is visible if it overlaps with the container viewport
        if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
          visible.push({
            id: item.getAttribute('data-draggable-id') ?? '',
            top: rect.top,
            height: rect.height,
          });
        }
      }
      // Sort by visual position
      visible.sort((a, b) => a.top - b.top);
      return { items: visible };
    });

    expect(visibleInfo.items.length).toBeGreaterThanOrEqual(3);
    const sourceId = visibleInfo.items[0].id;
    const targetId = visibleInfo.items[2].id;
    expect(sourceId).not.toBe(targetId);

    // Drag first visible item to third visible item
    const sourceItem = page.locator(`[data-draggable-id="${sourceId}"]`);
    const targetItem = page.locator(`[data-draggable-id="${targetId}"]`);
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Get FRESH target coordinates after drag starts (source item is now hidden,
    // items have shifted). Per E2E.md: "After drag starts, get fresh boundingBox()
    // of target items — positions shift when the dragged item hides."
    const freshTargetBox = await targetItem.boundingBox();
    if (!freshTargetBox) throw new Error('Could not get fresh target bounding box');
    const targetY = freshTargetBox.y + freshTargetBox.height / 2;

    // Move to center of third visible item
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });
    // Direct move ensures the final position registers (E2E.md rule #6)
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY);

    // Wait one rAF before drop
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();

    // Wait for drop to complete — verify source item moved
    await expect(async () => {
      const afterInfo = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        if (!container) return { items: [] as { id: string; top: number }[] };
        const containerRect = container.getBoundingClientRect();
        const items = document.querySelectorAll('[data-draggable-id]');
        const visible: { id: string; top: number }[] = [];
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
            visible.push({ id: item.getAttribute('data-draggable-id') ?? '', top: rect.top });
          }
        }
        visible.sort((a, b) => a.top - b.top);
        return { items: visible };
      });

      // The source item should have moved — it should no longer be the first visible
      const afterIds = afterInfo.items.map((i) => i.id);
      expect(afterIds[0]).not.toBe(sourceId);
    }).toPass({ timeout: 2000 });

    // Virtual scroll integrity: scroll to top and verify items render
    await expect(async () => {
      await page.evaluate(() => {
        const scrollContainer = document.querySelector('.scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = 0;
      });
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBe(0);
    }).toPass({ timeout: 2000 });

    const topItems = await page.locator('[data-draggable-id]').count();
    expect(topItems).toBeGreaterThan(0);

    const topTitle = await page.locator('.task-item').first().locator('.task-title').textContent();
    expect(topTitle?.trim()).toBeTruthy();
  });

  test('should correctly reorder via autoscroll drag', async ({ page }) => {
    const firstItemText = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();

    const scrollContainer = page.locator('.scroll-container');
    const scrollBox = await scrollContainer.boundingBox();
    if (!scrollBox) throw new Error('Could not get scroll container bounding box');

    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Pick up the first item
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move to bottom edge to trigger autoscroll
    const edgeOffset = 25; // Consistent 25px offset
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    const targetX = sourceBox.x + sourceBox.width / 2;
    await page.mouse.move(targetX, bottomEdgeY, { steps: 15 });
    // Extra move for stability
    await page.mouse.move(targetX, bottomEdgeY);

    // Wait for autoscroll to engage
    await expect(async () => {
      const scrollTop = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        return container?.scrollTop ?? 0;
      });
      expect(scrollTop, `ScrollTop should reach 300, current: ${scrollTop}`).toBeGreaterThan(300);
    }).toPass({ timeout: 10000 });

    // Wait one rAF before drop
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();

    // Scroll back to top to verify reorder happened — include item check in toPass
    await expect(async () => {
      await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        if (container) container.scrollTop = 0;
      });
      const scrollTop = await page.evaluate(
        () => document.querySelector('.scroll-container')?.scrollTop ?? 0,
      );
      expect(scrollTop).toBe(0);
      // The first item should have moved — it should no longer be at index 0
      const newFirstItemText = await page
        .locator('.task-item')
        .first()
        .locator('.task-title')
        .textContent();
      expect(newFirstItemText?.trim()).not.toBe(firstItemText?.trim());
    }).toPass({ timeout: 3000 });

    // Virtual scroll integrity: items should still render
    const itemCount = await page.locator('.task-item').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('should not shrink container height during same-list drag', async ({ page }) => {
    const scrollContainer = page.locator('.scroll-container');

    // Scroll to bottom so the footer is visible and shift would be noticeable
    await expect(async () => {
      await scrollContainer.evaluate((el) => (el.scrollTop = el.scrollHeight));
      const { scrollTop, scrollHeight, clientHeight } = await scrollContainer.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(scrollTop).toBeGreaterThan(0);
      expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 2);
    }).toPass({ timeout: 3000 });

    // Measure the virtual-content host height and footer position before drag
    const beforeDrag = await page.evaluate(() => {
      const virtualContent = document.querySelector('vdnd-virtual-content') as HTMLElement | null;
      const footer = document.querySelector('.add-task-footer') as HTMLElement | null;
      return {
        contentHeight: virtualContent?.offsetHeight ?? 0,
        footerTop: footer?.getBoundingClientRect().top ?? 0,
      };
    });
    expect(beforeDrag.contentHeight).toBeGreaterThan(0);

    let sourceBox: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      // Capture a viewport-visible draggable/task item box atomically inside the browser.
      sourceBox = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container') as HTMLElement | null;
        if (!container) return null;

        const containerRect = container.getBoundingClientRect();
        const targetY = containerRect.top + containerRect.height * 0.65;
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>('[data-draggable-id], .task-item'),
        )
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              centerY: rect.top + rect.height / 2,
              visible:
                rect.bottom > containerRect.top + 12 &&
                rect.top < containerRect.bottom - 12 &&
                rect.height > 0 &&
                rect.width > 0,
              box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            };
          })
          .filter((item) => item.visible)
          .sort((a, b) => Math.abs(a.centerY - targetY) - Math.abs(b.centerY - targetY));

        return candidates[0]?.box ?? null;
      });

      expect(sourceBox).not.toBeNull();
    }).toPass({ timeout: 3000 });
    if (!sourceBox) throw new Error('Could not get source bounding box');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + 5, { steps: 3 });
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + 5);

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Wait one rAF for position update
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const allowedShrinkPx = 8;
    await expect(async () => {
      // Measure during drag — atomic measurement
      const duringDrag = await page.evaluate(() => {
        const virtualContent = document.querySelector('vdnd-virtual-content') as HTMLElement | null;
        const footer = document.querySelector('.add-task-footer') as HTMLElement | null;
        return {
          contentHeight: virtualContent?.offsetHeight ?? 0,
          footerTop: footer?.getBoundingClientRect().top ?? 0,
        };
      });

      // Allow minor cross-browser rounding differences while still catching real shrink regressions.
      expect(duringDrag.contentHeight).toBeGreaterThanOrEqual(
        beforeDrag.contentHeight - allowedShrinkPx,
      );

      // The footer should NOT shift up during drag (positive shift = moved up = bad).
      const footerShift = beforeDrag.footerTop - duringDrag.footerTop;
      expect(footerShift).toBeLessThan(10);
    }).toPass({ timeout: 2000 });

    // Clean up
    await page.mouse.up();
  });

  test('should clamp to scroll container when cursor escapes above with constrainToContainer', async ({
    page,
  }) => {
    // Enable constrain-to-container on the droppable element
    await page.evaluate(() => {
      const droppable = document.querySelector('[data-droppable-id="tasks"]');
      if (droppable) {
        droppable.setAttribute('data-constrain-to-container', '');
      }
    });

    // Get the scroll container's bounding box (the constraint boundary)
    const scrollContainerBox = await page.locator('.scroll-container').boundingBox();
    if (!scrollContainerBox) throw new Error('Could not get scroll container bounding box');

    // Pick a visible item using atomic source selection (avoids overscan issues)
    let sourceBox: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      sourceBox = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container') as HTMLElement | null;
        if (!container) return null;
        const containerRect = container.getBoundingClientRect();
        const targetY = containerRect.top + containerRect.height * 0.35;
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-draggable-id]'))
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              centerY: rect.top + rect.height / 2,
              visible:
                rect.bottom > containerRect.top + 12 &&
                rect.top < containerRect.bottom - 12 &&
                rect.height > 0 &&
                rect.width > 0,
              box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            };
          })
          .filter((item) => item.visible)
          .sort((a, b) => Math.abs(a.centerY - targetY) - Math.abs(b.centerY - targetY));
        return candidates[0]?.box ?? null;
      });
      expect(sourceBox).not.toBeNull();
    }).toPass({ timeout: 3000 });
    if (!sourceBox) throw new Error('Could not get source bounding box');

    // Start drag
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move cursor far above the scroll container (into the header area)
    const aboveContainerY = scrollContainerBox.y - 100;
    const targetX = sourceBox.x + sourceBox.width / 2;
    await page.mouse.move(targetX, aboveContainerY, { steps: 10 });
    await page.mouse.move(targetX, aboveContainerY);

    // Wait one rAF for position update
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    // Verify preview is clamped within the scroll container bounds
    const previewBox = await dragPreview.boundingBox();
    if (!previewBox) throw new Error('Could not get preview bounding box');
    expect(previewBox.y).toBeGreaterThanOrEqual(scrollContainerBox.y);

    // Move back inside and drop — should succeed (droppable remained active because cursor was clamped)
    await page.mouse.move(targetX, scrollContainerBox.y + scrollContainerBox.height / 2, {
      steps: 5,
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();
    await expect(dragPreview).not.toBeVisible({ timeout: 2000 });

    // Verify items still render (no broken state)
    const itemCount = await page.locator('.task-item').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('should reorder correctly with constrainToContainer enabled', async ({ page }) => {
    // Enable constrain-to-container on the droppable element
    await page.evaluate(() => {
      const droppable = document.querySelector('[data-droppable-id="tasks"]');
      if (droppable) {
        droppable.setAttribute('data-constrain-to-container', '');
      }
    });

    // Capture item texts before drag
    const firstItemText = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();
    const secondItemText = await page
      .locator('.task-item')
      .nth(1)
      .locator('.task-title')
      .textContent();

    // Get source (item 0) and target (item 1) positions
    const sourceItem = page.locator('.task-item').first();
    const sourceBox = await sourceItem.boundingBox();
    if (!sourceBox) throw new Error('Could not get source bounding box');

    const targetItem = page.locator('.task-item').nth(1);
    const targetBox = await targetItem.boundingBox();
    if (!targetBox) throw new Error('Could not get target bounding box');

    // Start drag
    await sourceItem.hover();
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move to center of second item — with the bug (top-edge probe + no midpoint
    // refinement), the placeholder index would lag behind the preview position.
    const targetY = targetBox.y + targetBox.height / 2;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });

    // Wait one rAF before drop
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();

    // Wait for drop to complete — verify reorder happened
    await expect(async () => {
      const newFirstItemText = await page
        .locator('.task-item')
        .nth(0)
        .locator('.task-title')
        .textContent();
      expect(newFirstItemText?.trim()).toBe(secondItemText?.trim());
    }).toPass({ timeout: 2000 });

    // Original first item should now be at index 1
    const newSecondItemText = await page
      .locator('.task-item')
      .nth(1)
      .locator('.task-title')
      .textContent();
    expect(newSecondItemText?.trim()).toBe(firstItemText?.trim());
  });

  test('should not emit ResizeObserver errors', async ({ page }) => {
    let resizeObserverErrors = 0;

    page.on('pageerror', (error) => {
      if (error.message.includes('ResizeObserver')) {
        resizeObserverErrors++;
      }
    });

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
