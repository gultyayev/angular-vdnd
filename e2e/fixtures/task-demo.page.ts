import { expect, Locator, Page } from '@playwright/test';

export const taskDemoSelectors = {
  scrollContainer: '[data-testid="task-scroll-container"]',
  virtualContent: '[data-testid="task-virtual-content"]',
  header: '[data-testid="task-page-header"]',
  footer: '[data-testid="add-task-footer"]',
  item: '[data-draggable-id]',
  title: '[data-testid="task-title"]',
  category: '[data-testid="task-category"]',
  dragPreview: '[data-testid="vdnd-drag-preview"]',
  placeholder: '.vdnd-drag-placeholder',
  visiblePlaceholder: '.vdnd-drag-placeholder-visible',
  contentWrapper: '.vdnd-content-wrapper',
} as const;

export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisibleTask {
  id: string;
  top: number;
  height: number;
}

export class TaskDemoPage {
  readonly scrollContainer: Locator;
  readonly virtualContent: Locator;
  readonly header: Locator;
  readonly footer: Locator;
  readonly items: Locator;
  readonly dragPreview: Locator;
  readonly placeholder: Locator;
  readonly visiblePlaceholder: Locator;

  constructor(readonly page: Page) {
    this.scrollContainer = page.getByTestId('task-scroll-container');
    this.virtualContent = page.getByTestId('task-virtual-content');
    this.header = page.getByTestId('task-page-header');
    this.footer = page.getByTestId('add-task-footer');
    this.items = page.locator(taskDemoSelectors.item);
    this.dragPreview = page.getByTestId('vdnd-drag-preview');
    this.placeholder = page.locator(taskDemoSelectors.placeholder);
    this.visiblePlaceholder = page.locator(taskDemoSelectors.visiblePlaceholder);
  }

  async goto(path: '/page-scroll' | '/dynamic-height'): Promise<void> {
    await this.page.goto(path);
    await this.waitUntilReady();
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.items.first()).toBeVisible();
  }

  categoryFilter(category: 'all' | 'work' | 'personal' | 'urgent'): Locator {
    return this.page.locator(`[data-category-filter="${category}"]`);
  }

  taskTitle(item: Locator): Locator {
    return item.locator(taskDemoSelectors.title);
  }

  taskCategory(item: Locator): Locator {
    return item.locator(taskDemoSelectors.category);
  }

  async getTaskTitle(index: number): Promise<string> {
    const text = await this.taskTitle(this.items.nth(index)).textContent();
    return text?.trim() ?? '';
  }

  async getTaskCategoryTexts(): Promise<string[]> {
    return this.page
      .locator(taskDemoSelectors.category)
      .evaluateAll((categories) =>
        categories.map((category) => category.textContent?.trim() ?? ''),
      );
  }

  async scrollTo(scrollTop: number): Promise<void> {
    await this.scrollContainer.evaluate((el, top) => {
      el.scrollTop = top;
    }, scrollTop);
  }

  async getScrollTop(): Promise<number> {
    return this.scrollContainer.evaluate((el) => el.scrollTop);
  }

  async getHeaderHeight(): Promise<number> {
    return this.header.evaluate((el) => el.getBoundingClientRect().height);
  }

  async getVisibleTasks(): Promise<VisibleTask[]> {
    return this.page.evaluate((selectors) => {
      const container = document.querySelector(selectors.scrollContainer);
      if (!container) {
        return [];
      }

      const containerRect = container.getBoundingClientRect();
      const visible: VisibleTask[] = [];

      for (const item of document.querySelectorAll(selectors.item)) {
        const rect = item.getBoundingClientRect();
        if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
          visible.push({
            id: item.getAttribute('data-draggable-id') ?? '',
            top: rect.top,
            height: rect.height,
          });
        }
      }

      visible.sort((a, b) => a.top - b.top);
      return visible;
    }, taskDemoSelectors);
  }

  async getVisibleItemBoxAt(containerRatio: number): Promise<ElementBox | null> {
    return this.page.evaluate(
      ({ selectors, ratio }) => {
        const container = document.querySelector(selectors.scrollContainer);
        if (!container) {
          return null;
        }

        const containerRect = container.getBoundingClientRect();
        const targetY = containerRect.top + containerRect.height * ratio;
        const candidates = Array.from(document.querySelectorAll<HTMLElement>(selectors.item))
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
      },
      { selectors: taskDemoSelectors, ratio: containerRatio },
    );
  }

  async getItemBoxContainingY(y: number): Promise<ElementBox | null> {
    return this.page.evaluate(
      ({ selectors, targetY }) => {
        for (const item of document.querySelectorAll<HTMLElement>(selectors.item)) {
          if (item.offsetParent === null) {
            continue;
          }

          const rect = item.getBoundingClientRect();
          if (rect.top < targetY && rect.bottom > targetY) {
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }
        }

        return null;
      },
      { selectors: taskDemoSelectors, targetY: y },
    );
  }
}
