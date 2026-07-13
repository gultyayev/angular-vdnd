/**
 * Pure regression-gating logic for `compare.ts`.
 *
 * Kept free of I/O and `import.meta`/`process.exit` so it can be unit-tested
 * with `node --test` (see `compare-metrics.test.ts`).
 *
 * All gated metrics are "higher is worse", so only increases are treated as
 * regressions. A change is gated only when it is worse on the **median** by
 * more than the percent threshold AND by more than the noise floor — a
 * per-metric absolute minimum combined with a stddev-aware band. This removes
 * the "p95-of-5 = max", "zero-baseline = +100%", and single-noisy-run failure
 * modes (issue #42, problems 4 & 5).
 */

import type { AggregatedMetrics } from './statistics.ts';

/** Multiplier applied to the baseline stddev to form the per-metric noise band. */
export const REGRESSION_STDDEV_MULTIPLIER = 2;

/**
 * Absolute minimum change (in each metric's own unit) that must be exceeded
 * before a percent regression is gated. Below these, a change is reported as
 * informational only. Values are deliberately conservative; see `perf/README.md`.
 */
export const MIN_ABS_DELTA: Record<string, number> = {
  totalBlockingTime: 20, // ms
  longTaskCount: 2, // tasks
  layoutCount: 25, // count
  recalcStyleCount: 25, // count
  avgFrameTime: 1.5, // ms
  maxFrameGap: 15, // ms
  droppedFrames: 3, // frames
  p99FrameTime: 5, // ms
  jsHeapDelta: 512, // KB
};

export interface MetricEvaluation {
  metric: string;
  /** Baseline median. */
  baseline: number;
  /** Current median. */
  current: number;
  absDelta: number;
  percentChange: number;
  /** Gated as a regression. */
  regression: boolean;
  /** Nominally over the percent threshold but suppressed as noise/below floor. */
  suppressed: boolean;
}

/**
 * Percent change from baseline to current. A zero baseline yields +100% for any
 * nonzero current (and 0% when both are zero); the absolute floor in
 * {@link evaluateMetric} keeps that from gating on its own.
 */
export function percentChange(baseline: number, current: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

/** Evaluate one metric's baseline vs current aggregates against the threshold. */
export function evaluateMetric(
  metric: string,
  baseline: AggregatedMetrics,
  current: AggregatedMetrics,
  threshold: number,
): MetricEvaluation {
  const b = baseline.median;
  const c = current.median;
  const absDelta = c - b;
  const pct = percentChange(b, c);

  const floor = MIN_ABS_DELTA[metric] ?? 0;
  const noiseBand = REGRESSION_STDDEV_MULTIPLIER * baseline.stddev;

  const worse = absDelta > 0;
  const overThreshold = pct > threshold;
  const overFloor = absDelta >= floor;
  const overNoise = absDelta > noiseBand;

  const regression = worse && overThreshold && overFloor && overNoise;
  const suppressed = worse && overThreshold && !regression;

  return {
    metric,
    baseline: b,
    current: c,
    absDelta,
    percentChange: pct,
    regression,
    suppressed,
  };
}
