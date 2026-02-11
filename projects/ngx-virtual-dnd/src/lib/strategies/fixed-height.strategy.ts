import { signal, type Signal } from '@angular/core';
import type { VirtualScrollStrategy } from '../models/virtual-scroll-strategy';

/**
 * Fixed-height virtual scroll strategy.
 *
 * Wraps the existing `index * itemHeight` math with zero overhead — no cache,
 * no measurement. This is the default strategy used when `dynamicItemHeight`
 * is not enabled.
 */
export class FixedHeightStrategy implements VirtualScrollStrategy {
  readonly #itemHeight: number;

  /** Excluded index during same-list drag (-1 = none) */
  #excludedIndex = -1;

  /** Version signal — fixed strategy never changes, so it's always 0 */
  readonly version: Signal<number> = signal(0);

  constructor(itemHeight: number) {
    this.#itemHeight = itemHeight;
  }

  getTotalHeight(itemCount: number): number {
    const effectiveCount = this.#excludedIndex >= 0 ? itemCount - 1 : itemCount;
    return effectiveCount * this.#itemHeight;
  }

  getFirstVisibleIndex(scrollTop: number): number {
    if (this.#itemHeight <= 0) return 0;
    return Math.floor(scrollTop / this.#itemHeight);
  }

  getVisibleCount(_startIndex: number, containerHeight: number): number {
    if (containerHeight <= 0 || this.#itemHeight <= 0) return 0;
    return Math.ceil(containerHeight / this.#itemHeight);
  }

  getOffsetForIndex(index: number): number {
    if (this.#excludedIndex >= 0 && index > this.#excludedIndex) {
      return (index - 1) * this.#itemHeight;
    }
    return index * this.#itemHeight;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getItemHeight(index: number): number {
    return this.#itemHeight;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setMeasuredHeight(key: unknown, height: number): void {
    // No-op for fixed height strategy
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setItemKeys(keys: unknown[]): void {
    // No-op for fixed height strategy
  }

  setExcludedIndex(index: number | null): void {
    this.#excludedIndex = index ?? -1;
  }

  findIndexAtOffset(offset: number): number {
    if (this.#itemHeight <= 0) return 0;
    const visualIndex = Math.floor(offset / this.#itemHeight);
    // When an item is excluded (same-list drag), visual indices at or past
    // the excluded position map to logical index + 1
    if (this.#excludedIndex >= 0 && visualIndex >= this.#excludedIndex) {
      return visualIndex + 1;
    }
    return visualIndex;
  }
}
