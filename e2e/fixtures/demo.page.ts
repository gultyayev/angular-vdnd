import { Locator, Page } from '@playwright/test';

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
    this.dragPreview = page.locator('.vdnd-drag-preview');
    // List cards contain the headings and badges with actual item counts
    this.list1Wrapper = page.locator('.list-card').nth(0);
    this.list2Wrapper = page.locator('.list-card').nth(1);
    this.lockAxisSelect = page.locator('[data-testid="lock-axis-select"]');
    this.keyboardInstructions = page.locator('#vdnd-keyboard-instructions');
    this.placeholder = page.locator('.vdnd-drag-placeholder-visible');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    // Wait for items to be rendered
    await this.list1Items.first().waitFor({ state: 'visible' });
    // Scroll lists into view (in case header/settings push them below viewport)
    await this.list1Container.scrollIntoViewIfNeeded();
    // Ensure lists are scrolled to top (WebKit may preserve scroll across navigations)
    await this.scrollList('list1', 0);
    await this.scrollList('list2', 0);
    await this.page.waitForTimeout(50);
  }

  async enableSimplifiedApi(): Promise<void> {
    await this.page.locator('[data-testid="simplified-api-checkbox"]').click();
    // Wait for the list to re-render with new API
    await this.list1Items.first().waitFor({ state: 'visible' });
    // Additional wait for Angular to fully stabilize after checkbox toggle
    await this.page.waitForTimeout(100);
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
    const targetContainer =
      targetList === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;

    const sourceItem = sourceItems.nth(itemIndex);
    const sourceBox = await sourceItem.boundingBox();
    const targetBox = await targetContainer.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag operation');
    }

    // Calculate target position accounting for current scroll position
    // Target the center of the slot
    const itemHeight = 50; // Known from component config
    const targetY = Math.min(
      targetBox.y + targetIndex * itemHeight + itemHeight / 2,
      targetBox.y + targetBox.height - 10,
    );
    const targetX = targetBox.x + targetBox.width / 2;

    // Perform drag with steps for smooth movement
    await sourceItem.hover();
    await this.page.mouse.down();

    // Move slightly to initiate drag (critical for WebKit - triggers drag detection)
    await this.page.mouse.move(sourceBox.x + 5, sourceBox.y + 5, { steps: 2 });

    // Wait for drag preview to appear (critical for WebKit timing)
    await this.dragPreview.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
    await this.page.waitForTimeout(50); // Allow preview to be positioned

    // Move to target with more steps for smoother movement
    await this.page.mouse.move(targetX, targetY, { steps: 15 });
    // Longer wait for placeholder calculation - WebKit needs more time especially for same-list drags
    await this.page.waitForTimeout(150);
    await this.page.mouse.up();
    await this.page.waitForTimeout(200); // Wait for state updates
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

  async keyboardMoveDown(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
  }

  async keyboardMoveUp(steps: number = 1): Promise<void> {
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
   */
  async countGhostElements(list: 'list1' | 'list2'): Promise<number> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    // Get all visible .item elements (excluding hidden dragged items)
    const items = container.locator('.item:not([style*="display: none"])');
    const count = await items.count();
    let ghostCount = 0;

    for (let i = 0; i < count; i++) {
      const itemText = items.nth(i).locator('.item-text');
      const text = (await itemText.textContent())?.trim() ?? '';
      if (text === '') {
        ghostCount++;
      }
    }

    return ghostCount;
  }

  /**
   * Get all rendered items with their content for inspection.
   */
  async getRenderedItemsWithContent(
    list: 'list1' | 'list2',
  ): Promise<{ text: string; tagName: string; isPlaceholder: boolean }[]> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    const elements = container.locator(
      '.item:not([style*="display: none"]), vdnd-drag-placeholder',
    );
    const count = await elements.count();
    const result: { text: string; tagName: string; isPlaceholder: boolean }[] = [];

    for (let i = 0; i < count; i++) {
      const el = elements.nth(i);
      const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
      const isPlaceholder = tagName === 'vdnd-drag-placeholder';
      const text = isPlaceholder
        ? ''
        : ((await el.locator('.item-text').textContent())?.trim() ?? '');

      result.push({ text, tagName, isPlaceholder });
    }

    return result;
  }

  /**
   * Get total visible element count during drag (items + placeholders, excludes hidden).
   */
  async getVisibleElementCount(list: 'list1' | 'list2'): Promise<number> {
    const container = list === 'list1' ? this.list1VirtualScroll : this.list2VirtualScroll;
    return container.locator('.item:not([style*="display: none"]), vdnd-drag-placeholder').count();
  }
}
