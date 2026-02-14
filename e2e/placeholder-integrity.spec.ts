import { expect, test } from '@playwright/test';
import { DemoPage } from './fixtures/demo.page';

/**
 * Tests for placeholder rendering integrity.
 * These tests ensure placeholders render correctly and no "ghost" elements appear.
 */
test.describe('Placeholder Rendering Integrity', () => {
  let demoPage: DemoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test.describe('Ghost Element Detection', () => {
    test('should not render ghost elements during same-list drag (verbose API)', async ({
      page,
    }) => {
      // Verbose API is the default mode
      const sourceItem = demoPage.list2Items.first();
      const sourceBox = await sourceItem.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 75, { steps: 5 });
      await expect(demoPage.dragPreview).toBeVisible();

      // Count ghost elements (empty .item divs without text)
      const ghostCount = await demoPage.countGhostElements('list2');
      expect(ghostCount, 'Ghost elements should not exist during drag').toBe(0);

      await page.mouse.up();
    });

    test('should not render ghost elements during cross-list drag (verbose API)', async ({
      page,
    }) => {
      const sourceItem = demoPage.list1Items.first();
      const targetBox = await demoPage.list2VirtualScroll.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + 75, { steps: 10 });
      await expect(demoPage.dragPreview).toBeVisible();

      // Check both lists for ghost elements
      const ghostCountList1 = await demoPage.countGhostElements('list1');
      const ghostCountList2 = await demoPage.countGhostElements('list2');
      expect(ghostCountList1, 'List 1 should have no ghost elements').toBe(0);
      expect(ghostCountList2, 'List 2 should have no ghost elements').toBe(0);

      await page.mouse.up();
    });

    test('should not render ghost elements in simplified API mode', async ({ page }) => {
      await demoPage.enableSimplifiedApi();

      const sourceItem = demoPage.list2Items.first();
      const sourceBox = await sourceItem.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 75, { steps: 5 });
      await expect(demoPage.dragPreview).toBeVisible();

      const ghostCount = await demoPage.countGhostElements('list2');
      expect(ghostCount, 'Ghost elements should not exist in simplified API').toBe(0);

      await page.mouse.up();
    });
  });

  test.describe('Placeholder Element Validation', () => {
    test('placeholder should render as vdnd-drag-placeholder element, not as empty .item', async ({
      page,
    }) => {
      const sourceItem = demoPage.list2Items.first();
      const sourceBox = await sourceItem.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 75, { steps: 5 });
      await expect(demoPage.dragPreview).toBeVisible();

      // Count visible placeholders — wrap in toPass since count() is one-shot and rAF-dependent
      await expect(async () => {
        const properPlaceholders = await demoPage.list2Container
          .locator('.vdnd-drag-placeholder-visible')
          .count();
        expect(properPlaceholders, 'Should have exactly one proper placeholder').toBe(1);
      }).toPass({ timeout: 2000 });

      // Ensure no broken placeholder elements (items without text)
      const items = await demoPage.getRenderedItemsWithContent('list2');
      const brokenPlaceholders = items.filter((item) => !item.isPlaceholder && item.text === '');
      expect(brokenPlaceholders.length, 'Should have no broken placeholder divs').toBe(0);

      await page.mouse.up();
    });

    test('all visible items should have text content during drag', async ({ page }) => {
      const sourceItem = demoPage.list2Items.first();
      const sourceBox = await sourceItem.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 75, { steps: 5 });
      await expect(demoPage.dragPreview).toBeVisible();

      // Get all rendered content
      const items = await demoPage.getRenderedItemsWithContent('list2');

      for (const item of items) {
        if (item.isPlaceholder) {
          // Placeholder elements are allowed to be empty
          continue;
        }
        // Regular items must have text content
        expect(item.text, `Item should have text content, got: ${JSON.stringify(item)}`).not.toBe(
          '',
        );
      }

      await page.mouse.up();
    });
  });

  test.describe('Element Count Consistency', () => {
    test('visible element count should include exactly one placeholder during drag', async ({
      page,
    }) => {
      // During same-list drag, we should have:
      // - Visible items (excluding hidden dragged item)
      // - Exactly 1 placeholder
      // The key assertion: no ghost elements (empty items)
      const sourceItem = demoPage.list2Items.first();
      const sourceBox = await sourceItem.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 75, { steps: 5 });
      await expect(demoPage.dragPreview).toBeVisible();

      // Count visible placeholders — wrap in toPass since count() is one-shot and rAF-dependent
      await expect(async () => {
        const placeholderCount = await demoPage.list2Container
          .locator('.vdnd-drag-placeholder-visible')
          .count();
        expect(placeholderCount, 'Should have exactly one placeholder').toBe(1);
      }).toPass({ timeout: 2000 });

      // Count ghost elements - should be 0
      const ghostCount = await demoPage.countGhostElements('list2');
      expect(ghostCount, 'No ghost elements should exist').toBe(0);

      await page.mouse.up();
    });

    test('should not have duplicate placeholders', async ({ page }) => {
      const sourceItem = demoPage.list1Items.first();
      const targetBox = await demoPage.list2VirtualScroll.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + 100, { steps: 10 });
      await expect(demoPage.dragPreview).toBeVisible();

      // Check for any duplicate visible placeholder situations — wrap in toPass
      await expect(async () => {
        const placeholderCount = await demoPage.list2Container
          .locator('.vdnd-drag-placeholder-visible')
          .count();
        expect(placeholderCount, 'Should have exactly one placeholder').toBe(1);
      }).toPass({ timeout: 2000 });

      // Also check that we don't have placeholder-like elements
      // (elements that take up space but have no visible content)
      const items = await demoPage.getRenderedItemsWithContent('list2');
      const emptyDivs = items.filter((item) => !item.isPlaceholder && !item.text);
      expect(emptyDivs.length, 'Should have no empty item divs acting as placeholders').toBe(0);

      await page.mouse.up();
    });
  });

  test.describe('Cross-API Consistency', () => {
    test('verbose and simplified API should render placeholders identically', async ({ page }) => {
      // Test verbose API first
      const sourceItem = demoPage.list2Items.first();
      const sourceBox = await sourceItem.boundingBox();

      await sourceItem.hover();
      await page.mouse.down();
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 75, { steps: 5 });
      await expect(demoPage.dragPreview).toBeVisible();

      // Wrap in toPass since count() is one-shot
      let verbosePlaceholders = 0;
      await expect(async () => {
        verbosePlaceholders = await demoPage.list2Container
          .locator('.vdnd-drag-placeholder-visible')
          .count();
        expect(verbosePlaceholders).toBe(1);
      }).toPass({ timeout: 2000 });
      const verboseGhosts = await demoPage.countGhostElements('list2');

      await page.mouse.up();
      await expect(demoPage.dragPreview).not.toBeVisible();

      // Switch to simplified API
      await demoPage.enableSimplifiedApi();

      const sourceItemSimplified = demoPage.list2Items.first();
      // Wait for item to be fully rendered and have a bounding box
      await expect(sourceItemSimplified).toBeVisible();
      const sourceBoxSimplified = await sourceItemSimplified.boundingBox();
      if (!sourceBoxSimplified) {
        throw new Error('Could not get bounding box for simplified API item');
      }

      await sourceItemSimplified.hover();
      await page.mouse.down();
      await page.mouse.move(
        sourceBoxSimplified!.x + sourceBoxSimplified!.width / 2,
        sourceBoxSimplified!.y + 75,
        { steps: 5 },
      );
      await expect(demoPage.dragPreview).toBeVisible();

      let simplifiedPlaceholders = 0;
      await expect(async () => {
        simplifiedPlaceholders = await demoPage.list2Container
          .locator('.vdnd-drag-placeholder-visible')
          .count();
        expect(simplifiedPlaceholders).toBe(1);
      }).toPass({ timeout: 2000 });
      const simplifiedGhosts = await demoPage.countGhostElements('list2');

      await page.mouse.up();

      // Both APIs should produce the same result
      expect(verbosePlaceholders).toBe(1);
      expect(simplifiedPlaceholders).toBe(1);
      expect(verboseGhosts).toBe(0);
      expect(simplifiedGhosts).toBe(0);
    });
  });
});
