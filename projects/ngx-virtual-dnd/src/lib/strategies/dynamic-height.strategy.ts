import { signal, type Signal, type WritableSignal } from '@angular/core';
import type { VirtualScrollStrategy } from '../models/virtual-scroll-strategy';
import { HeightCache } from '../utils/height-cache';

/**
 * Dynamic-height virtual scroll strategy.
 *
 * Uses a `HeightCache` with prefix-sum offsets and binary search for O(log N)
 * scroll-to-index lookups. Heights are tracked by trackBy key (survive
 * reordering) and auto-measured via ResizeObserver by the directive.
 *
 * The `version` signal bumps whenever heights change, causing dependent
 * computeds to re-evaluate.
 */
export class DynamicHeightStrategy implements VirtualScrollStrategy {
  readonly #cache: HeightCache;
  readonly #version: WritableSignal<number> = signal(0);

  readonly version: Signal<number> = this.#version.asReadonly();

  constructor(estimatedHeight: number) {
    this.#cache = new HeightCache(estimatedHeight);
  }

  getTotalHeight(itemCount: number): number {
    // Read version to subscribe to changes
    this.#version();
    return this.#cache.getTotalHeight(itemCount);
  }

  getFirstVisibleIndex(scrollTop: number): number {
    this.#version();
    return this.#cache.findFirstVisibleIndex(scrollTop);
  }

  getVisibleCount(startIndex: number, containerHeight: number): number {
    this.#version();
    return this.#cache.getVisibleCount(startIndex, containerHeight);
  }

  getOffsetForIndex(index: number): number {
    this.#version();
    return this.#cache.getOffset(index);
  }

  getItemHeight(index: number): number {
    this.#version();
    return this.#cache.getHeight(index);
  }

  setMeasuredHeight(key: unknown, height: number): void {
    const changed = this.#cache.setHeight(key, height);
    if (changed) {
      this.#version.update((v) => v + 1);
    }
  }

  setItemKeys(keys: unknown[]): void {
    const changed = this.#cache.setKeys(keys);
    if (changed) {
      this.#version.update((v) => v + 1);
    }
  }

  setExcludedIndex(index: number | null): void {
    const changed = this.#cache.setExcludedIndex(index);
    if (changed) {
      this.#version.update((v) => v + 1);
    }
  }

  findIndexAtOffset(offset: number): number {
    this.#version();
    return this.#cache.findIndexAtOffset(offset);
  }

  getItemCount(): number {
    this.#version();
    return this.#cache.itemCount;
  }
}
