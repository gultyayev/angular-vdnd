import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AggregatedMetrics } from './statistics.ts';
import { percentChange, evaluateMetric, MIN_ABS_DELTA } from './compare-metrics.ts';

/** Build an AggregatedMetrics with the fields the gate reads (median, stddev). */
function agg(median: number, stddev = 0): AggregatedMetrics {
  return { mean: median, median, p95: median, stddev, min: median, max: median, samples: 5 };
}

test('percentChange handles a zero baseline without dividing by zero', () => {
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(0, 1), 100);
  assert.equal(percentChange(10, 15), 50);
  assert.equal(percentChange(10, 5), -50);
});

test('zero-baseline metric is not gated on a below-floor absolute change', () => {
  // Issue #42, problem 5: longTaskCount 0 -> 1 is +100% but must not trip the gate.
  const result = evaluateMetric('longTaskCount', agg(0), agg(1), 25);
  assert.equal(result.percentChange, 100);
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, true);
});

test('zero-baseline metric IS gated once it clears the absolute floor', () => {
  // longTaskCount floor is 2, so 0 -> 3 is a real regression.
  assert.equal(MIN_ABS_DELTA.longTaskCount, 2);
  const result = evaluateMetric('longTaskCount', agg(0), agg(3), 25);
  assert.equal(result.regression, true);
  assert.equal(result.suppressed, false);
});

test('a change within the stddev noise band is not gated', () => {
  // Issue #42, problem 4: baseline is noisy (stddev 20), so a +30 change on a
  // median of 100 is over the 25% threshold and the absolute floor, but still
  // within 2x the baseline stddev (=40) and must not gate.
  const result = evaluateMetric('totalBlockingTime', agg(100, 20), agg(130, 20), 25);
  assert.equal(result.percentChange, 30);
  assert.ok(result.absDelta >= MIN_ABS_DELTA.totalBlockingTime);
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, true);
});

test('a change beyond threshold, floor, and noise band is gated', () => {
  const result = evaluateMetric('totalBlockingTime', agg(100, 5), agg(200, 5), 25);
  assert.equal(result.regression, true);
});

test('improvements (lower is better) are never flagged as regressions', () => {
  const result = evaluateMetric('droppedFrames', agg(60, 1), agg(10, 1), 25);
  assert.ok(result.percentChange < 0);
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, false);
});

test('a small percent change under the threshold is neither regression nor suppressed', () => {
  const result = evaluateMetric('p99FrameTime', agg(20, 1), agg(22, 1), 25);
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, false);
});
