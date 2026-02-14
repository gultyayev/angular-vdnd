import { expect, Locator, Page } from '@playwright/test';

export class DemoPage {
  readonly page: Page;
  readonly list1Container: Locator;
  readonly list2Container: Locator;
  readonly list1Items: Locator;
  readonly list2Items: Locator;
  readonly dragPreview: Locator;
  readonly list1VirtualScroll: Locator;
  readonly list2VirtualScroll: Locator;
  readonly list1Wrapper: Locator;
  readonly list2Wrapper: Locator;
  readonly lockAxisSelect: Locator;
  readonly keyboardInstructions: Locator;
  readonly placeholder: Locator;

  constructor(page: Page) {
    this.page = page;
    this.list1Container = page.locator('[data-droppable-id="list-1"]');
    this.list2Container = page.locator('[data-droppable-id="list-2"]');
    this.list1VirtualScroll = this.list1Container.locator('vdnd-virtual-scroll');
    this.list2VirtualScroll = this.list2Container.locator('vdnd-virtual-scroll');
    this.list1Items = this.list1Container.locator('[data-draggable-id]');
    this.list2Items = this.list2Container.locator('[data-draggable-id]');
    // Use data-testid for library components (stable selectors)
    this.dragPreview = page.getByTestId('vdnd-drag-preview');
    // List cards contain the headings and badges with actual item counts
    this.list1Wrapper = page.locator('.list-card').nth(0);
    this.list2Wrapper = page.locator('.list-card').nth(1);
    this.lockAxisSelect = page.getByTestId('lock-axis-select');
    this.keyboardInstructions = page.locator('#vdnd-keyboard-instructions');
    // Placeholder visible class is a documented public API for styling, making it a stable selector
    this.placeholder = page.locator('.vdnd-drag-placeholder-visible');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    // Wait for items to be rendered using auto-waiting assertion
    await expect(this.list1Items.first()).toBeVisible();
    // Scroll lists into view (in case header/settings push them below viewport)
    await this.list1Container.scrollIntoViewIfNeeded();
    // Ensure lists are scrolled to top (WebKit may preserve scroll across navigations)
    await this.scrollList('list1', 0);
    await this.scrollList('list2', 0);
    // Wait for scroll to be applied
    await expect(async () => {
      const scrollTop = await this.getScrollTop('list1');
      expect(scrollTop).toBe(0);
    }).toPass({ timeout: 1000 });
  }

  async enableSimplifiedApi(): Promise<void> {
    await this.page.getByTestId('simplified-api-checkbox').click();
    // Wait for items to render in the new component tree
    await expect(this.list1Items.first()).toBeVisible();
    // The @if template swap destroys and recreates scroll containers.
    // Items can be visible before the virtual scroll computes its content height.
    // Verify BOTH scroll areas are ready (scrollHeight > containerHeight of 400px).
    await expect(async () => {
      const h1 = await this.list1VirtualScroll.evaluate((el) => el.scrollHeight);
      const h2 = await this.list2VirtualScroll.evaluate((el) => el.scrollHeight);
      expect(h1).toBeGreaterThan(400);
      expect(h2).toBeGreaterThan(400);
    }).toPass({ timeout: 2000 });
  }

  async getItemCount(list: 'list1' | 'list2'): Promise<number> {
    // Get the actual item count from the badge, not from DOM elements
    // This is more reliable with virtual scroll where only visible items are rendered
    const wrapper = list === 'list1' ? this.list1Wrapper : this.list2Wrapper;
    const badge = wrapper.locator('.list-badge');
    const text = await badge.textContent();
    if (text) {
      return parseInt(text.trim(), 10);
    }
    // Fallback to counting visible items
    const items = list === 'list1' ? this.list1Items : this.list2Items;
    return items.count();
  }

  async getItemText(list: 'list1' | 'list2', index: number): Promise<string> {
    const items = list === 'list1' ? this.list1Items : this.list2Items;
    const text = await items.nth(index).textContent();
    return text?.trim() ?? '';
  }

  async dragItemToList(
    sourceList: 'list1' | 'list2',
    itemIndex: number,
    targetList: 'list1' | 'list2',
    targetIndex: number,
  ): Promise<void> {
    const sourceItems = sourceList === 'list1' ? this.list1Items : this.list2Items;
    const targetItems = targetList === 'list1' ? this.list1Items : this.list2Items;
    const targetContainer =
      targetList === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;

    const sourceItem = sourceItems.nth(itemIndex);
    await sourceItem.scrollIntoViewIfNeeded();
    await targetContainer.scrollIntoViewIfNeeded();
    const sourceBox = await sourceItem.boundingBox();
    const targetBox = await targetContainer.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag operation');
    }

    const targetItem = targetItems.nth(targetIndex);
    const hasTargetItem = (await targetItem.count()) > 0;
    let targetX = targetBox.x + targetBox.width / 2;
    let targetY = Math.min(targetBox.y + 25, targetBox.y + targetBox.height - 10);

    if (hasTargetItem) {
      await targetItem.scrollIntoViewIfNeeded();
      const targetItemBox = await targetItem.boundingBox();
      if (!targetItemBox) {
        throw new Error('Could not get target item bounding box for drag operation');
      }
      targetX = targetItemBox.x + targetItemBox.width / 2;
      targetY = targetItemBox.y + targetItemBox.height / 2;
    } else {
      // Out-of-range index indicates "drop at end of list"; empty target uses a top-safe drop zone.
      targetY =
        targetIndex > 0
          ? targetBox.y + targetBox.height - 10
          : Math.min(targetBox.y + 50, targetBox.y + targetBox.height - 10);
    }

    // Perform drag with steps for smooth movement
    await sourceItem.hover();
    await this.page.mouse.down();

    // Move slightly to initiate drag (critical for WebKit - triggers drag detection)
    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2 + 10,
      { steps: 2 },
    );

    // Wait for drag preview to appear using auto-waiting assertion
    await expect(this.dragPreview).toBeVisible({ timeout: 2000 });

    // Move to target with more steps for smoother movement
    await this.page.mouse.move(targetX, targetY, { steps: 15 });
    // Firefox/WebKit can miss the final stepped position occasionally.
    await this.page.mouse.move(targetX, targetY);
    // Drag position updates are rAF-throttled; wait one frame for the final position to process
    await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await this.page.mouse.up();
    // Wait for drag to complete (preview should disappear)
    await expect(this.dragPreview).not.toBeVisible({ timeout: 2000 });
  }

  async scrollList(list: 'list1' | 'list2', scrollTop: number): Promise<void> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    await container.evaluate((el, top) => {
      el.scrollTop = top;
    }, scrollTop);
  }

  async getScrollTop(list: 'list1' | 'list2'): Promise<number> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    return container.evaluate((el) => el.scrollTop);
  }

  async setLockAxis(axis: 'x' | 'y' | null): Promise<void> {
    await this.lockAxisSelect.selectOption(axis ?? '');
  }

  // Keyboard drag helper methods

  async startKeyboardDrag(list: 'list1' | 'list2', itemIndex: number): Promise<void> {
    const items = list === 'list1' ? this.list1Items : this.list2Items;
    await items.nth(itemIndex).focus();
    await this.page.keyboard.press('Space');
  }

  async keyboardMoveDown(steps = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
  }

  async keyboardMoveUp(steps = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('ArrowUp');
    }
  }

  async keyboardMoveToList(direction: 'left' | 'right'): Promise<void> {
    const key = direction === 'left' ? 'ArrowLeft' : 'ArrowRight';
    await this.page.keyboard.press(key);
  }

  async keyboardDrop(): Promise<void> {
    await this.page.keyboard.press('Space');
  }

  async keyboardCancel(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  async focusFirstDraggable(list: 'list1' | 'list2'): Promise<void> {
    const items = list === 'list1' ? this.list1Items : this.list2Items;
    await items.first().focus();
  }

  /**
   * Count ghost elements - empty .item divs without text content.
   * These indicate broken placeholder rendering.
   * Uses atomic page.evaluate() to avoid TOCTOU races with virtual scroll re-renders.
   */
  async countGhostElements(list: 'list1' | 'list2'): Promise<number> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    return container.evaluate((el) => {
      const items = el.querySelectorAll('.item:not([style*="display: none"])');
      return Array.from(items).filter((item) => {
        const text = item.querySelector('.item-text')?.textContent?.trim() ?? '';
        return text === '';
      }).length;
    });
  }

  /**
   * Get all rendered items with their content for inspection.
   * Uses atomic page.evaluate() to avoid TOCTOU races with virtual scroll re-renders.
   */
  async getRenderedItemsWithContent(
    list: 'list1' | 'list2',
  ): Promise<{ text: string; tagName: string; isPlaceholder: boolean }[]> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    return container.evaluate((el) => {
      const elements = el.querySelectorAll(
        '.item:not([style*="display: none"]), vdnd-drag-placeholder',
      );
      return Array.from(elements).map((element) => {
        const tagName = element.tagName.toLowerCase();
        const isPlaceholder = tagName === 'vdnd-drag-placeholder';
        const text = isPlaceholder
          ? ''
          : (element.querySelector('.item-text')?.textContent?.trim() ?? '');
        return { text, tagName, isPlaceholder };
      });
    });
  }

  /**
   * Get total visible element count during drag (items + placeholders, excludes hidden).
   */
  async getVisibleElementCount(list: 'list1' | 'list2'): Promise<number> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    return container.locator('.item:not([style*="display: none"]), vdnd-drag-placeholder').count();
  }

  /**
   * Enable constrain to container setting.
   */
  async enableConstrainToContainer(): Promise<void> {
    await this.page.getByTestId('constrain-to-container-checkbox').click();
  }
}
