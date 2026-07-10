import { signal } from '@angular/core';
import type { VirtualScrollStrategy } from '../models/virtual-scroll-strategy';
import { FixedHeightStrategy } from '../strategies/fixed-height.strategy';

/** Constructor signature shared by every height strategy. */
type HeightStrategyCtor = new (estimatedHeight: number) => VirtualScrollStrategy;

/**
 * Cached `DynamicHeightStrategy` constructor once its chunk has resolved.
 * Module-level so the chunk is fetched at most once across every virtual list.
 */
let dynamicCtor: HeightStrategyCtor | null = null;
let dynamicLoad: Promise<HeightStrategyCtor> | null = null;

/**
 * Reactive flag flipped to `true` when the dynamic-height chunk finishes
 * loading. Reading it inside a `computed`/`effect` re-runs that consumer once
 * the real strategy is available, so the transient fixed-height stand-in is
 * swapped out automatically.
 */
const dynamicReady = signal(false);

/**
 * Kick off (once) the lazy `import()` of the dynamic-height strategy chunk.
 *
 * The dynamic import keeps `DynamicHeightStrategy` (and its `HeightCache`
 * prefix-sum machinery) out of the eager graph of every draggable list — only
 * lists that opt into `dynamicItemHeight` pay for it, and only on first use.
 */
export function loadDynamicHeightStrategy(): Promise<HeightStrategyCtor> {
  if (dynamicCtor) return Promise.resolve(dynamicCtor);
  dynamicLoad ??= import('../strategies/dynamic-height.strategy').then((m) => {
    dynamicCtor = m.DynamicHeightStrategy;
    dynamicReady.set(true);
    return dynamicCtor;
  });
  return dynamicLoad;
}

/**
 * Create the virtual-scroll height strategy for a list.
 *
 * Fixed height resolves synchronously. Dynamic height is loaded lazily: until
 * its chunk resolves, a {@link FixedHeightStrategy} seeded with the same
 * estimate stands in. That stand-in is behaviourally identical to a
 * freshly-constructed dynamic strategy that has not measured anything yet
 * (both report `estimatedHeight` for every row), so the swap is seamless.
 *
 * Call this inside a `computed`: reading {@link dynamicReady} registers the
 * dependency that upgrades the strategy to `DynamicHeightStrategy` once the
 * chunk loads.
 */
export function createHeightStrategy(
  estimatedHeight: number,
  dynamic: boolean,
): VirtualScrollStrategy {
  if (!dynamic) return new FixedHeightStrategy(estimatedHeight);
  if (dynamicCtor) return new dynamicCtor(estimatedHeight);

  // Subscribe to readiness so the enclosing computed re-runs after the chunk
  // loads, trigger the load, and stand in with the fixed-height estimate.
  dynamicReady();
  void loadDynamicHeightStrategy();
  return new FixedHeightStrategy(estimatedHeight);
}
