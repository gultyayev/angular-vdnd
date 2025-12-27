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

  constructor(page: Page) {
    this.page = page;
    this.list1Container = page.locator('[data-droppable-id="list-1"]');
    this.list2Container = page.locator('[data-droppable-id="list-2"]');
    this.list1VirtualScroll = this.list1Container.locator('vdnd-virtual-scroll');
    this.list2VirtualScroll = this.list2Container.locator('vdnd-virtual-scroll');
    this.list1Items = this.list1Container.locator('[data-draggable-id]');
    this.list2Items = this.list2Container.locator('[data-draggable-id]');
    this.dragPreview = page.locator('.vdnd-drag-preview');
    // List wrappers contain the headings with actual item counts
    this.list1Wrapper = page.locator('.list-wrapper').nth(0);
    this.list2Wrapper = page.locator('.list-wrapper').nth(1);
    this.lockAxisSelect = page.locator('[data-testid="lock-axis-select"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    // Wait for items to be rendered
    await this.list1Items.first().waitFor({ state: 'visible' });
    // Ensure lists are scrolled to top (WebKit may preserve scroll across navigations)
    await this.scrollList('list1', 0);
    await this.scrollList('list2', 0);
    await this.page.waitForTimeout(50);
  }

  async getItemCount(list: 'list1' | 'list2'): Promise<number> {
    // Get the actual item count from the heading, not from DOM elements
    // This is more reliable with virtual scroll where only visible items are rendered
    const wrapper = list === 'list1' ? this.list1Wrapper : this.list2Wrapper;
    const heading = wrapper.locator('h2');
    const text = await heading.textContent();
    // Parse "List X (N items)" to get N
    const match = text?.match(/\((\d+) items?\)/);
    if (match) {
      return parseInt(match[1], 10);
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
}
