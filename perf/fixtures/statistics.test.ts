import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, round } from './statistics.ts';

test('aggregate returns zeros for an empty sample set', () => {
  assert.deepEqual(aggregate([]), {
    mean: 0,
    median: 0,
    p95: 0,
    stddev: 0,
    min: 0,
    max: 0,
    samples: 0,
  });
});

test('aggregate computes mean, median and range for an odd sample count', () => {
  const result = aggregate([10, 2, 6, 4, 8]);
  assert.equal(result.samples, 5);
  assert.equal(result.mean, 6);
  assert.equal(result.median, 6);
  assert.equal(result.min, 2);
  assert.equal(result.max, 10);
});

test('aggregate averages the two middle values for an even sample count', () => {
  const result = aggregate([1, 2, 3, 4]);
  assert.equal(result.median, 2.5);
});

test('median is unaffected by a single noisy outlier (p95-of-5 = max)', () => {
  // Documents issue #42, problem 4: with 5 samples the p95 index selects the max,
  // so one noisy run dominates p95 while the median stays representative.
  const values = [10, 10, 10, 10, 200];
  const result = aggregate(values);
  assert.equal(result.median, 10);
  assert.equal(result.p95, 200);
  assert.equal(result.max, 200);
});

test('stddev uses the sample (n-1) denominator', () => {
  const result = aggregate([2, 4, 6]);
  // variance = ((-2)^2 + 0 + 2^2) / (3-1) = 4 => stddev = 2
  assert.equal(result.stddev, 2);
});

test('round trims to the requested number of decimals', () => {
  assert.equal(round(1.23456, 2), 1.23);
  assert.equal(round(1.005, 2), 1.0);
  assert.equal(round(10, 0), 10);
});
