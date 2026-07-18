import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from './statistics.ts';
import { percentChange, evaluateMetric, MIN_ABS_DELTA } from './compare-metrics.ts';

test('percentChange handles a zero baseline without dividing by zero', () => {
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(0, 1), 100);
  assert.equal(percentChange(10, 15), 50);
  assert.equal(percentChange(10, 5), -50);
});

test('zero-baseline metric is not gated on a below-floor absolute change', () => {
  // Issue #42, problem 5: longTaskCount 0 -> 1 is +100% but must not trip the gate.
  const result = evaluateMetric(
    'longTaskCount',
    aggregate([0, 0, 0, 0, 0]),
    aggregate([1, 1, 0, 0, 1]),
    25,
  );
  assert.equal(result.percentChange, 100);
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, true);
  assert.equal(result.suppressedReason, 'below-floor');
});

test('zero-baseline metric IS gated once it clears the absolute floor', () => {
  // longTaskCount floor is 2, so 0 -> 3 is a real regression.
  assert.equal(MIN_ABS_DELTA.longTaskCount, 2);
  const result = evaluateMetric(
    'longTaskCount',
    aggregate([0, 0, 0, 0, 0]),
    aggregate([3, 3, 3, 3, 3]),
    25,
  );
  assert.equal(result.regression, true);
  assert.equal(result.suppressed, false);
});

test('a lone baseline outlier does NOT suppress a sustained regression (MAD, not stddev)', () => {
  // Reviewer's case: with stddev (≈224) the +100 shift was suppressed; with MAD
  // (0, since 4 of 5 deviations are 0) the sustained regression is correctly gated.
  const baseline = aggregate([0, 0, 0, 0, 500]);
  const current = aggregate([100, 100, 100, 100, 100]);
  assert.equal(baseline.median, 0);
  assert.equal(baseline.mad, 0);
  assert.ok(baseline.stddev > 200, 'stddev is inflated by the outlier');
  const result = evaluateMetric('totalBlockingTime', baseline, current, 25);
  assert.equal(result.regression, true);
  assert.equal(result.suppressed, false);
});

test('a change within the MAD noise band is not gated', () => {
  // Genuinely noisy baseline: median 100, MAD 10 -> band = 3*10 = 30.
  const baseline = aggregate([80, 100, 90, 110, 100]);
  const current = aggregate([130, 130, 130, 130, 130]);
  assert.equal(baseline.median, 100);
  assert.equal(baseline.mad, 10);
  const result = evaluateMetric('totalBlockingTime', baseline, current, 25);
  assert.equal(result.absDelta, 30); // exactly on the band edge -> not "> band"
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, true);
  assert.equal(result.suppressedReason, 'within-noise-band');
});

test('a median shift caused by majority noise is not gated (sustained check)', () => {
  // A noisy runner elevates 3 of 5 iterations: the median doubles, but the two
  // clean iterations prove the code itself did not get slower — the current
  // MIN is still at baseline level, so the change must not gate.
  const baseline = aggregate([100, 100, 100, 100, 100]); // median 100, MAD 0
  const current = aggregate([210, 200, 205, 100, 95]); // median 200, min 95
  const result = evaluateMetric('totalBlockingTime', baseline, current, 25);
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, true);
  assert.equal(result.suppressedReason, 'not-sustained');
});

test('a sustained regression (every iteration worse than baseline median) is gated', () => {
  const baseline = aggregate([100, 100, 100, 100, 100]);
  const current = aggregate([210, 200, 205, 195, 190]); // min 190 > baseline median
  const result = evaluateMetric('totalBlockingTime', baseline, current, 25);
  assert.equal(result.regression, true);
  assert.equal(result.suppressed, false);
});

test('layout/style-recalc floors sit below the smallest committed baseline medians', () => {
  // With a floor of 25 a drag-within-list layoutCount doubling (24 -> 48,
  // delta 24) was suppressed as noise. These counts are near-deterministic, so
  // the floor only needs to guard tiny baselines.
  assert.equal(MIN_ABS_DELTA.layoutCount, 10);
  assert.equal(MIN_ABS_DELTA.recalcStyleCount, 10);
  const result = evaluateMetric(
    'layoutCount',
    aggregate([24, 24, 24, 24, 24]),
    aggregate([48, 48, 48, 48, 48]),
    25,
  );
  assert.equal(result.regression, true);
});

test('a change beyond threshold, floor, and MAD band is gated', () => {
  const baseline = aggregate([80, 100, 90, 110, 100]); // median 100, MAD 10, band 30
  const current = aggregate([145, 145, 145, 145, 145]); // +45 > 30
  const result = evaluateMetric('totalBlockingTime', baseline, current, 25);
  assert.equal(result.regression, true);
});

test('improvements (lower is better) are never flagged as regressions', () => {
  const result = evaluateMetric(
    'droppedFrames',
    aggregate([60, 61, 59, 60, 60]),
    aggregate([10, 9, 11, 10, 10]),
    25,
  );
  assert.ok(result.percentChange < 0);
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, false);
});

test('a small percent change under the threshold is neither regression nor suppressed', () => {
  const result = evaluateMetric(
    'p99FrameTime',
    aggregate([20, 20, 20, 20, 20]),
    aggregate([22, 22, 22, 22, 22]),
    25,
  );
  assert.equal(result.regression, false);
  assert.equal(result.suppressed, false);
});
