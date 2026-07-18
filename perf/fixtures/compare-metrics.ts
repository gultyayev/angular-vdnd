/**
 * Pure regression-gating logic for `compare.ts`.
 *
 * Kept free of I/O and `import.meta`/`process.exit` so it can be unit-tested
 * with `node --test` (see `compare-metrics.test.ts`).
 *
 * All gated metrics are "higher is worse", so only increases are treated as
 * regressions. A change is gated only when it is worse on the **median** by
 * more than the percent threshold AND by more than the noise floor — a
 * per-metric absolute minimum combined with a robust MAD-based band — AND is
 * **sustained** (even the current run's best iteration is worse than the
 * baseline median). This removes the "p95-of-5 = max", "zero-baseline = +100%",
 * single-noisy-run, and majority-noise failure modes (issue #42, problems 4 & 5).
 */

import type { AggregatedMetrics } from './statistics.ts';

/**
 * Multiplier applied to the baseline **MAD** (median absolute deviation) to form
 * the per-metric noise band. MAD is used instead of stddev because a single
 * outlier in only five samples inflates stddev enough to mask a real, sustained
 * regression (e.g. a baseline of `[0,0,0,0,500]` has stddev ≈224 but MAD 0).
 * `3 × MAD` ≈ `2σ` for normally distributed data (σ̂ = 1.4826 × MAD).
 */
export const REGRESSION_MAD_MULTIPLIER = 3;

/**
 * Absolute minimum change (in each metric's own unit) that must be exceeded
 * before a percent regression is gated. Below these, a change is reported as
 * informational only. Values are deliberately conservative; see `perf/README.md`.
 */
export const MIN_ABS_DELTA: Record<string, number> = {
  totalBlockingTime: 20, // ms
  longTaskCount: 2, // tasks
  // Layout/style-recalc counts are near-deterministic (baseline MAD ≈ 0), so the
  // floor only needs to guard genuinely small baselines. 25 was larger than the
  // drag-within-list baseline median (24) — a full doubling of layout work slipped
  // under it as "noise".
  layoutCount: 10, // count
  recalcStyleCount: 10, // count
  avgFrameTime: 1.5, // ms
  maxFrameGap: 15, // ms
  droppedFrames: 3, // frames
  p99FrameTime: 5, // ms
};

/** Why an over-threshold change was suppressed instead of gated. */
export type SuppressedReason = 'below-floor' | 'within-noise-band' | 'not-sustained';

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
  /** Set when `suppressed` is true: which guard kept the change from gating. */
  suppressedReason?: SuppressedReason;
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
  const noiseBand = REGRESSION_MAD_MULTIPLIER * (baseline.mad ?? 0);

  const worse = absDelta > 0;
  const overThreshold = pct > threshold;
  const overFloor = absDelta >= floor;
  const overNoise = absDelta > noiseBand;
  // A real code regression slows down *every* iteration, so even the current
  // run's best sample should be worse than the baseline's typical one. Runner
  // noise (GC, noisy CI neighbors) is intermittent: it can elevate a majority
  // of the 5 samples — shifting the median — while the clean iterations stay at
  // baseline level. Requiring the current MIN to exceed the baseline median
  // filters exactly that case. Trade-off: a regression that only manifests
  // intermittently (e.g. a probabilistic stall) is reported but not gated.
  const sustained = (current.min ?? c) > b;

  const regression = worse && overThreshold && overFloor && overNoise && sustained;
  const suppressed = worse && overThreshold && !regression;

  let suppressedReason: SuppressedReason | undefined;
  if (suppressed) {
    if (!overFloor) suppressedReason = 'below-floor';
    else if (!overNoise) suppressedReason = 'within-noise-band';
    else suppressedReason = 'not-sustained';
  }

  return {
    metric,
    baseline: b,
    current: c,
    absDelta,
    percentChange: pct,
    regression,
    suppressed,
    suppressedReason,
  };
}
