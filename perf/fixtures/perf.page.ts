import { expect, Page } from '@playwright/test';

export class PerfPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(route = '/'): Promise<void> {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle');
    await this.page.locator('[data-draggable-id]').first().waitFor({ state: 'visible' });
  }

  /**
   * Set the item count on the main demo page and regenerate items.
   * Only works on the `/` route.
   */
  async setItemCount(count: number): Promise<void> {
    const input = this.page.locator('#itemCount');
    await input.fill(String(count));
    await this.page.locator('button', { hasText: 'Regenerate' }).click();
    // Wait for virtual scroll to render with the new item count
    await expect(async () => {
      const badge = this.page.locator('.list-badge').first();
      const text = await badge.textContent();
      expect(parseInt(text?.trim() ?? '0', 10)).toBe(Math.floor(count / 2));
    }).toPass({ timeout: 5000 });
  }

  /**
   * Programmatic smooth scroll using rAF interpolation.
   * Scrolls the element matching `selector` from its current position to `targetScrollTop`
   * over `durationMs` milliseconds.
   */
  async smoothScroll(selector: string, targetScrollTop: number, durationMs: number): Promise<void> {
    await this.page.evaluate(
      ({ selector, target, duration }) => {
        return new Promise<void>((resolve) => {
          const el = document.querySelector(selector) as HTMLElement;
          if (!el) {
            resolve();
            return;
          }
          const start = el.scrollTop;
          const delta = target - start;
          const startTime = performance.now();
          const step = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-in-out for more realistic scroll behavior
            const eased =
              progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
            el.scrollTop = start + delta * eased;
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(step);
        });
      },
      { selector, target: targetScrollTop, duration: durationMs },
    );
  }

  /**
   * Simulate a full drag operation with stepped mouse moves.
   * Mirrors the E2E drag pattern from `demo.page.ts`.
   */
  async simulateDrag(opts: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    steps?: number;
    holdDurationMs?: number;
  }): Promise<void> {
    const { startX, startY, endX, endY, steps = 15, holdDurationMs } = opts;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();

    // Small initial move to pass drag threshold
    await this.page.mouse.move(startX + 5, startY + 5, { steps: 2 });

    // Wait for drag preview
    const dragPreview = this.page.getByTestId('vdnd-drag-preview');
    await expect(dragPreview).toBeVisible({ timeout: 2000 });

    // Move to target
    await this.page.mouse.move(endX, endY, { steps });
    // Firefox finalization move
    await this.page.mouse.move(endX, endY);

    if (holdDurationMs) {
      await this.page.waitForTimeout(holdDurationMs);
    }

    // Wait one rAF for position update
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await this.page.mouse.up();

    // Wait for drag to complete
    await expect(dragPreview).not.toBeVisible({ timeout: 2000 });
  }

  /**
   * Get bounding box of a virtual scroll container.
   */
  async getContainerBox(list: 'list1' | 'list2') {
    const droppableId = list === 'list1' ? 'list-1' : 'list-2';
    const container = this.page.locator(`[data-droppable-id="${droppableId}"] vdnd-virtual-scroll`);
    return container.boundingBox();
  }

  /**
   * Get bounding box of a specific draggable item.
   */
  async getItemBox(list: 'list1' | 'list2', index: number) {
    const droppableId = list === 'list1' ? 'list-1' : 'list-2';
    const items = this.page.locator(`[data-droppable-id="${droppableId}"] [data-draggable-id]`);
    return items.nth(index).boundingBox();
  }

  /** Reset scroll position of both lists to the top. */
  async resetScrollPositions(): Promise<void> {
    for (const id of ['list-1', 'list-2']) {
      await this.page.evaluate((droppableId) => {
        const el = document.querySelector(
          `[data-droppable-id="${droppableId}"] vdnd-virtual-scroll`,
        ) as HTMLElement;
        if (el) el.scrollTop = 0;
      }, id);
    }
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
}
