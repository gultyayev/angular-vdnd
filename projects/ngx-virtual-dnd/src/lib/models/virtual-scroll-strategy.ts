import { Signal } from '@angular/core';

/**
 * Strategy interface for virtual scroll height and positioning calculations.
 *
 * Two implementations exist:
 * - `FixedHeightStrategy` — all items have the same height (zero overhead, no cache)
 * - `DynamicHeightStrategy` — items have variable heights, auto-measured via ResizeObserver
 *
 * Strategy selection is automatic based on which input is provided:
 * - `[itemHeight]="50"` → `FixedHeightStrategy`
 * - `[itemHeight]="50" [dynamicItemHeight]="true"` → `DynamicHeightStrategy`
 */
export interface VirtualScrollStrategy {
  /** Reactivity hook — bumps when internal state changes */
  readonly version: Signal<number>;

  /** Total content height for spacer */
  getTotalHeight(itemCount: number): number;

  /** First visible index for a given scrollTop */
  getFirstVisibleIndex(scrollTop: number): number;

  /** Number of visible items from startIndex given containerHeight */
  getVisibleCount(startIndex: number, containerHeight: number): number;

  /** Pixel offset for a given item index */
  getOffsetForIndex(index: number): number;

  /** Height of a specific item */
  getItemHeight(index: number): number;

  /** Record measured height for a trackBy key */
  setMeasuredHeight(key: unknown, height: number): void;

  /** Update item order (trackBy keys in index order) */
  setItemKeys(keys: unknown[]): void;

  /** Set excluded index for same-list drag */
  setExcludedIndex(index: number | null): void;

  /** Find index at a given pixel offset (for drag calculations) */
  findIndexAtOffset(offset: number): number;

  /** Logical item count from setItemKeys */
  getItemCount(): number;
}
