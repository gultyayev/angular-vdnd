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
    await page.waitForTimeout(100);

    const badges = page.locator('.task-item ion-badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).textContent();
      expect(text?.trim()).toBe('work');
    }
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
    await page.evaluate((amount) => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = amount;
    }, scrollAmount);
    await page.waitForTimeout(200);

    const afterScrollFirstItem = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();
    expect(afterScrollFirstItem?.trim()).not.toBe(initialFirstItem?.trim());

    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    const restoredFirstItem = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();
    expect(restoredFirstItem?.trim()).toBe(initialFirstItem?.trim());
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

    // Wait one rAF before drop
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(200);

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
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    await page.mouse.move(sourceBox.x + 100, sourceBox.y + 100, { steps: 10 });
    await page.waitForTimeout(100);

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
    await page.waitForTimeout(50);

    const placeholder = page.locator('.vdnd-drag-placeholder-visible');
    await expect(placeholder).toBeVisible({ timeout: 2000 });

    await page.mouse.up();
  });

  test('should not show gray gaps during rapid scroll', async ({ page }) => {
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 2000;
    });
    await page.waitForTimeout(200);

    const countBefore = await page.locator('.task-item').count();

    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop -= 500;
    });
    await page.waitForTimeout(100);

    const countAfter = await page.locator('.task-item').count();
    expect(countAfter).toBeGreaterThan(countBefore - 3);
  });

  test('should keep drag preview visible during autoscroll', async ({ page }, testInfo) => {
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

    const edgeOffset = testInfo.project.name === 'firefox' ? 10 : 20;
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, bottomEdgeY, { steps: 10 });

    await expect(async () => {
      const scrollTop = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        return container?.scrollTop ?? 0;
      });
      expect(scrollTop).toBeGreaterThan(200);
    }).toPass({ timeout: 5000 });

    await expect(dragPreview).toBeVisible();
    await page.mouse.up();
  });

  test('should correctly reorder after scrolling and maintain virtual scroll', async ({ page }) => {
    // Scroll down so visible items are past the first few
    const scrollAmount = 800;
    await page.evaluate((amount) => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = amount;
    }, scrollAmount);
    await page.waitForTimeout(300);

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
    const targetBox = await targetItem.boundingBox();
    if (!sourceBox || !targetBox) throw new Error('Could not get bounding boxes');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    const dragPreview = page.locator('.vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move to center of third visible item
    const targetY = targetBox.y + targetBox.height / 2;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetY, { steps: 10 });

    // Wait one rAF before drop
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Get the new visible items after drop
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

    // Virtual scroll integrity: scroll to top and verify items render
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    const topItems = await page.locator('[data-draggable-id]').count();
    expect(topItems).toBeGreaterThan(0);

    const topTitle = await page.locator('.task-item').first().locator('.task-title').textContent();
    expect(topTitle?.trim()).toBeTruthy();
  });

  test('should correctly reorder via autoscroll drag', async ({ page }, testInfo) => {
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
    const edgeOffset = testInfo.project.name === 'firefox' ? 10 : 20;
    const bottomEdgeY = scrollBox.y + scrollBox.height - edgeOffset;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, bottomEdgeY, { steps: 10 });

    // Wait for autoscroll to engage
    await expect(async () => {
      const scrollTop = await page.evaluate(() => {
        const container = document.querySelector('.scroll-container');
        return container?.scrollTop ?? 0;
      });
      expect(scrollTop).toBeGreaterThan(300);
    }).toPass({ timeout: 5000 });

    // Wait one rAF before drop
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Scroll back to top to verify reorder happened
    await page.evaluate(() => {
      const container = document.querySelector('.scroll-container');
      if (container) container.scrollTop = 0;
    });
    await page.waitForTimeout(300);

    // The first item should have moved — it should no longer be at index 0
    const newFirstItemText = await page
      .locator('.task-item')
      .first()
      .locator('.task-title')
      .textContent();
    expect(newFirstItemText?.trim()).not.toBe(firstItemText?.trim());

    // Virtual scroll integrity: items should still render
    const itemCount = await page.locator('.task-item').count();
    expect(itemCount).toBeGreaterThan(0);
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

    await page.waitForTimeout(200);

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
