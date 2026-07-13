import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DROPPED_FRAME_THRESHOLD_MS,
  computeTotalBlockingTime,
  countDroppedFrames,
  filterLongTasksSince,
  percentile,
  type LongTask,
} from './metric-math.ts';

test('filterLongTasksSince drops tasks that started before the scenario window', () => {
  // Issue #42, problems 1 & 2: buffered history / stale-observer entries from
  // before the measured window must not be attributed to the scenario.
  const tasks: LongTask[] = [
    { startTime: 10, duration: 80 }, // page load
    { startTime: 40, duration: 60 }, // warmup
    { startTime: 120, duration: 51 }, // in-window
    { startTime: 200, duration: 70 }, // in-window
  ];
  const inWindow = filterLongTasksSince(tasks, 100);
  assert.equal(inWindow.length, 2);
  assert.deepEqual(
    inWindow.map((t) => t.startTime),
    [120, 200],
  );
});

test('filterLongTasksSince keeps tasks that start exactly at the boundary', () => {
  const tasks: LongTask[] = [{ startTime: 100, duration: 55 }];
  assert.equal(filterLongTasksSince(tasks, 100).length, 1);
});

test('computeTotalBlockingTime sums only the blocking time beyond 50ms', () => {
  const tasks: LongTask[] = [
    { startTime: 0, duration: 51 }, // 1ms blocking
    { startTime: 0, duration: 90 }, // 40ms blocking
    { startTime: 0, duration: 30 }, // not a long task, 0 blocking
  ];
  assert.equal(computeTotalBlockingTime(tasks), 41);
});

test('countDroppedFrames uses a ~25ms hysteresis threshold, ignoring 60Hz jitter', () => {
  // Issue #42, problem 3: 16.8ms jitter must not count the same as a real stall.
  const frames = [16.6, 16.8, 17.2, 24.9, 25.1, 50];
  assert.equal(DROPPED_FRAME_THRESHOLD_MS, 25);
  assert.equal(countDroppedFrames(frames), 2); // only 25.1 and 50
});

test('countDroppedFrames accepts an explicit threshold', () => {
  const frames = [16.6, 16.8, 17.2, 50];
  assert.equal(countDroppedFrames(frames, 16.7), 3);
});

test('percentile matches nearest-rank indexing and clamps edge cases', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(values, 0.99), 10);
  assert.equal(percentile(values, 0.5), 5);
  assert.equal(percentile([], 0.99), 0);
  assert.equal(percentile([42], 0.99), 42);
});
