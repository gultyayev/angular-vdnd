/**
 * Pure metric-derivation helpers shared by the in-browser collector and unit tests.
 *
 * Kept free of any Playwright imports so it can be exercised directly with
 * `node --test` (see `metric-math.test.ts`).
 */

export interface LongTask {
  startTime: number;
  duration: number;
}

/**
 * Version of the metric *semantics* produced by the collector. Bump this whenever
 * a change alters what a number means (long-task attribution window, dropped-frame
 * threshold, aggregation, …). `compare.ts` fails closed when a baseline was
 * produced by a different schema, because old and new numbers are then not
 * comparable — the pre-#42 harness (leaking observer, `buffered: true`, >16.7ms
 * dropped frames) is schema 1; this collector is schema 2.
 */
export const METRICS_SCHEMA_VERSION = 2;

/**
 * Frame intervals below this are treated as ordinary 60Hz scheduling jitter.
 * ~1.5x the 16.67ms vsync interval, so a 16.8ms frame is no longer classified
 * the same as a real ~50ms stall (issue #42, problem 3).
 */
export const DROPPED_FRAME_THRESHOLD_MS = 25;

/**
 * Keep only long tasks that started at/after the scenario window began.
 * Guards against buffered/stale-observer entries from page load or warmup
 * leaking into the measured window (issue #42, problems 1 & 2).
 */
export function filterLongTasksSince(longTasks: LongTask[], sinceMs: number): LongTask[] {
  return longTasks.filter((task) => task.startTime >= sinceMs);
}

/** Total Blocking Time: sum of each long task's duration beyond the 50ms budget. */
export function computeTotalBlockingTime(longTasks: LongTask[]): number {
  return longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
}

/** Count frame intervals that exceed the dropped-frame hysteresis threshold. */
export function countDroppedFrames(
  frameTimes: number[],
  threshold: number = DROPPED_FRAME_THRESHOLD_MS,
): number {
  return frameTimes.filter((t) => t > threshold).length;
}

/** Nearest-rank percentile (0-1) matching the aggregation used elsewhere. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}
