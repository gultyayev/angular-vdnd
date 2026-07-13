# Performance Benchmarks

Playwright-driven micro-benchmarks that gate pull requests against a committed
baseline. This document records the **methodology** behind the numbers so the
regression gate stays trustworthy in both directions (no false alarms, no missed
regressions).

## Layout

| Path                            | Purpose                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `scenarios/*.perf.ts`           | One benchmark per interaction (scroll, drag, autoscroll, dynamic). |
| `fixtures/metrics-collector.ts` | In-page long-task / frame collection over CDP.                     |
| `fixtures/metric-math.ts`       | Pure metric derivation (TBT, dropped frames, percentiles, window). |
| `fixtures/statistics.ts`        | Pure aggregation (mean, median, p95, stddev).                      |
| `fixtures/compare-metrics.ts`   | Pure regression-gating decision.                                   |
| `compare.ts`                    | Baseline vs current comparison + Markdown output (CLI).            |
| `report.ts`                     | Human-readable benchmark report (CLI).                             |
| `baselines/baseline.json`       | Committed reference run (a full Playwright JSON report).           |

## Commands

```bash
npm run perf            # run the benchmark scenarios (writes perf/results/latest.json)
npm run perf:report     # render the latest run as a Markdown table
npm run perf:compare    # compare latest run against the committed baseline
npm run perf:test       # unit-test the pure statistics / gating logic (node --test)
npm run perf:baseline   # run perf and promote the result to the committed baseline
```

`perf:compare` flags: `--threshold <pct>` (default 25), `--baseline <file>`,
`--current <file>`, `--output <file>`, `--fail-on-version-mismatch`.

## Measurement methodology

Each scenario runs `1` warmup + `5` measured iterations under `4x` CPU
throttling. For every iteration the collector:

1. **Creates a single long-task `PerformanceObserver` per iteration and
   disconnects it** in `collectObserverResults`. A leftover observer from an
   earlier iteration would otherwise keep firing into the current iteration's
   array and over-count long tasks.
2. **Omits `buffered: true`** and **filters entries to the scenario window** via
   a `performance.now()` start bound (`filterLongTasksSince`). Long tasks from
   page load and warmup are never attributed to the measured scenario.
3. Classifies a frame as **dropped only when the interval exceeds ~25 ms**
   (`DROPPED_FRAME_THRESHOLD_MS`, ≈1.5× the 16.67 ms vsync interval). Ordinary
   60 Hz scheduling jitter (16.8 ms) is not counted the same as a real stall.

## Regression gating

The gate compares the **median** of the 5 samples, not p95. With only 5 samples
the p95 index resolves to the maximum, so p95 gated on the single noisiest run.
The median is the representative central value.

A metric (all gated metrics are "higher is worse") is flagged as a **REGRESSION**
only when the current median is worse than the baseline median by **all** of:

- more than the percent `--threshold` (default 25%),
- more than a per-metric **absolute floor** (`MIN_ABS_DELTA` in
  `fixtures/compare-metrics.ts`), and
- more than **2× the baseline standard deviation** (a stddev-aware noise band).

The absolute floor is what keeps a **zero baseline** from auto-failing: a metric
that was `0` and becomes `1` (e.g. a single 51 ms long task) is `+100%` but stays
below its floor, so it is reported as informational ("noise (below floor)")
rather than gating. The floors are deliberately conservative:

| Metric            | Floor | Unit   |
| ----------------- | ----- | ------ |
| totalBlockingTime | 20    | ms     |
| longTaskCount     | 2     | tasks  |
| layoutCount       | 25    | count  |
| recalcStyleCount  | 25    | count  |
| avgFrameTime      | 1.5   | ms     |
| maxFrameGap       | 15    | ms     |
| droppedFrames     | 3     | frames |
| p99FrameTime      | 5     | ms     |
| jsHeapDelta       | 512   | KB     |

## Baseline hygiene

The baseline is a full Playwright JSON report and embeds the **Playwright
version** it was produced with. `perf:compare` prints the Playwright version of
both sides and warns when they differ, because baseline and current numbers then
come from different browser builds and drift is environmental, not code. Pass
`--fail-on-version-mismatch` to turn that warning into a hard failure.

Regenerate the baseline **on the current Playwright and in the CI environment**
(so absolute numbers match where PRs are measured):

- Manually: run the `Performance Benchmarks` workflow via `workflow_dispatch`,
  download the `updated-baseline` artifact, and commit it.
- Or locally: `npm run perf:baseline` (numbers will reflect your machine, so
  prefer the CI path for the committed baseline).
