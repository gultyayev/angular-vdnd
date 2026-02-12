/**
 * Cache for measured item heights in dynamic virtual scrolling.
 *
 * Tracks heights by trackBy key (survives reordering). Maintains a cumulative
 * offset prefix-sum array, lazily rebuilt on height change. Binary search
 * O(log N) for scroll-to-index lookups.
 *
 * This is a plain class (not a service) — one instance per virtual scroll.
 */
export class HeightCache {
  /** Estimated height used for unmeasured items */
  readonly #estimatedHeight: number;

  /** Map from trackBy key to measured height */
  readonly #heightsByKey = new Map<unknown, number>();

  /** Current ordered list of trackBy keys (index-aligned with item array) */
  #keys: unknown[] = [];

  /** Prefix sums: offsets[i] = cumulative height of items 0..i-1 */
  #offsets: number[] = [];

  /** Whether offsets need to be rebuilt */
  #dirty = true;

  /** Index excluded during same-list drag (-1 = none) */
  #excludedIndex = -1;

  constructor(estimatedHeight: number) {
    this.#estimatedHeight = estimatedHeight;
  }

  /** Number of measured items */
  get measuredCount(): number {
    return this.#heightsByKey.size;
  }

  /**
   * Update the ordered list of trackBy keys.
   * This must be called whenever items change order or the array changes.
   */
  setKeys(keys: unknown[]): void {
    this.#keys = keys;
    this.#dirty = true;
  }

  /**
   * Record a measured height for a trackBy key.
   * @returns true if the height actually changed (triggers version bump)
   */
  setHeight(key: unknown, height: number): boolean {
    const existing = this.#heightsByKey.get(key);
    if (existing === height) return false;
    this.#heightsByKey.set(key, height);
    this.#dirty = true;
    return true;
  }

  /**
   * Get the height for a specific index.
   * Returns measured height if available, otherwise the estimated height.
   */
  getHeight(index: number): number {
    if (index < 0 || index >= this.#keys.length) return this.#estimatedHeight;
    const key = this.#keys[index];
    return this.#heightsByKey.get(key) ?? this.#estimatedHeight;
  }

  /**
   * Get the pixel offset (top position) for a given item index.
   * Accounts for the excluded index during same-list drag.
   */
  getOffset(index: number): number {
    this.#rebuildIfDirty();

    if (this.#excludedIndex < 0) {
      // No exclusion — direct lookup
      return index < this.#offsets.length ? this.#offsets[index] : this.#getTotalHeightRaw();
    }

    // With exclusion: subtract the excluded item's height from offsets
    // at or after the excluded index
    if (index <= this.#excludedIndex) {
      return this.#offsets[index] ?? 0;
    }

    // index > excludedIndex: offset = raw offset for (index) minus excluded item's height
    const rawOffset =
      index < this.#offsets.length ? this.#offsets[index] : this.#getTotalHeightRaw();
    const excludedHeight = this.getHeight(this.#excludedIndex);
    return rawOffset - excludedHeight;
  }

  /**
   * Get total content height for all items.
   * Does NOT exclude the dragged item — the spacer must maintain full height
   * during same-list drag so sibling content (footers etc.) doesn't shift.
   * Uses O(1) prefix-sum lookup when possible.
   */
  getTotalHeight(itemCount: number): number {
    this.#rebuildIfDirty();

    if (itemCount <= 0) return 0;

    const keyCount = this.#keys.length;
    if (keyCount === 0) return itemCount * this.#estimatedHeight;

    if (itemCount >= keyCount) {
      // All known items + estimated for any extras
      return this.#getTotalHeightRaw() + (itemCount - keyCount) * this.#estimatedHeight;
    }

    // Partial: prefix sum up to itemCount
    return this.#offsets[itemCount - 1] + this.getHeight(itemCount - 1);
  }

  /**
   * Find the first visible index for a given scrollTop.
   * Uses binary search on the prefix-sum offsets (excluding the excluded item).
   */
  findFirstVisibleIndex(scrollTop: number): number {
    this.#rebuildIfDirty();

    const count = this.#keys.length;
    if (count === 0) return 0;

    // Binary search for the first item whose bottom edge is past scrollTop
    let lo = 0;
    let hi = count - 1;
    let result = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const offset = this.getOffset(mid);
      if (offset <= scrollTop) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result;
  }

  /**
   * Count visible items from startIndex within containerHeight.
   */
  getVisibleCount(startIndex: number, containerHeight: number): number {
    if (containerHeight <= 0) return 0;

    const count = this.#keys.length;
    let accumulated = 0;
    let visible = 0;

    for (let i = startIndex; i < count; i++) {
      if (i === this.#excludedIndex) continue;
      accumulated += this.getHeight(i);
      visible++;
      if (accumulated >= containerHeight) break;
    }

    // Add 1 for partially visible items
    return visible > 0 ? visible + 1 : 0;
  }

  /**
   * Find the item index at a given pixel offset.
   * Used for drag index calculations with variable heights.
   */
  findIndexAtOffset(offset: number): number {
    this.#rebuildIfDirty();

    const count = this.#keys.length;
    if (count === 0) return 0;

    let accumulated = 0;
    for (let i = 0; i < count; i++) {
      if (i === this.#excludedIndex) continue;
      const h = this.getHeight(i);
      if (accumulated + h > offset) return i;
      accumulated += h;
    }

    return count;
  }

  /**
   * Set the excluded index for same-list drag.
   */
  setExcludedIndex(index: number | null): void {
    this.#excludedIndex = index ?? -1;
  }

  /** Raw total height without exclusion */
  #getTotalHeightRaw(): number {
    this.#rebuildIfDirty();
    const len = this.#offsets.length;
    if (len === 0) return 0;
    return this.#offsets[len - 1] + this.getHeight(len - 1);
  }

  /** Rebuild prefix-sum array if dirty */
  #rebuildIfDirty(): void {
    if (!this.#dirty) return;
    this.#dirty = false;

    const count = this.#keys.length;
    if (this.#offsets.length !== count) {
      this.#offsets = new Array<number>(count);
    }

    let cumulative = 0;
    for (let i = 0; i < count; i++) {
      this.#offsets[i] = cumulative;
      cumulative += this.getHeight(i);
    }
  }
}
