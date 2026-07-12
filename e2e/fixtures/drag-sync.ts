import { expect, Page } from '@playwright/test';

/**
 * Ensure the drag scheduler has processed the pointer at exactly (x, y) before releasing.
 *
 * The drop outcome of a drag is computed from the last PROCESSED drag state — DragStateService
 * commits cursorPosition, activeDroppable and placeholderIndex together in one scheduler tick —
 * so once the processed cursor matches the release point, the drop destination is fully
 * determined regardless of event-loop timing.
 *
 * A single rAF wait cannot provide this guarantee: pointer event delivery is a browser task
 * while rAF is a rendering step, so under parallel/WebKit load the frame can fire before the
 * final move is seen and the drop then uses a stale placeholder index. This helper re-issues
 * the move on every retry, which also heals the "browser coalesced/dropped the final stepped
 * move" failure mode (E2E.md rule #6).
 *
 * Reads the `drag-state-debug` element, present on every demo page (visible debug panel on the
 * main demo, hidden DragStateDebugComponent on the task demos).
 *
 * The processed cursor is the EFFECTIVE position: do not use with axis locking, and with
 * constrain-to-container it only matches when (x, y) lies inside the constraint bounds.
 */
export async function settleDragPosition(page: Page, x: number, y: number): Promise<void> {
  await expect(async () => {
    await page.mouse.move(x, y);
    const raw = await page.getByTestId('drag-state-debug').textContent();
    const debugState = JSON.parse(raw ?? '{}') as {
      cursorPosition?: { x?: number; y?: number } | null;
    };
    const cursor = debugState.cursorPosition;
    // ±1px tolerance: browsers round fractional client coordinates differently
    expect(Math.abs((cursor?.x ?? Number.NaN) - x)).toBeLessThanOrEqual(1);
    expect(Math.abs((cursor?.y ?? Number.NaN) - y)).toBeLessThanOrEqual(1);
  }).toPass({ timeout: 5000 });
}
