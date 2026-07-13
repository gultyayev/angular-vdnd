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
`--current <file>`, `--output <file>`, `--allow-baseline-mismatch` (downgrade an
incompatible-baseline failure to a warning). It exits non-zero — failing CI — on
a detected regression, a missing scenario/metric, or an incompatible baseline.

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
- more than **3× the baseline MAD** (median absolute deviation).

MAD is used instead of standard deviation because, with only five samples, a
single outlier inflates stddev enough to hide a real, sustained regression — a
baseline of `[0,0,0,0,500]` has stddev ≈224 but MAD 0, so a steady jump to 100 ms
is correctly gated rather than swallowed by the band. `3 × MAD ≈ 2σ` for normal
data.

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

## Baseline compatibility (fail closed)

A comparison is only meaningful when both sides were produced by the **same
harness**. `perf:compare` fails closed — before comparing any numbers — when the
baseline is not comparable to the current run:

- **Metrics schema.** Each scenario report records `metricsSchemaVersion`
  (`fixtures/metric-math.ts`). Bump it whenever a change alters what a number
  _means_ (long-task window, dropped-frame threshold, aggregation). The pre-#42
  harness — leaking observer, `buffered: true`, `>16.7ms` dropped frames — is
  schema 1; this collector is schema 2. Comparing across schemas would attribute
  a **semantics** change (e.g. dropped frames 60 → 0) to the library.
- **Playwright version.** Embedded in the baseline's JSON report; different
  browser builds produce different numbers.

Both versions are printed in the output. Mismatches fail the run and tell you to
regenerate; pass `--allow-baseline-mismatch` to compare anyway (unreliable).

The comparison also fails when a scenario or metric present in the baseline is
**missing** from the current run — a renamed, skipped, or crashed benchmark must
not silently disappear behind a green check.

## Regenerating the baseline

Regenerate **on the current Playwright and, ideally, in the CI environment** so
absolute numbers match where PRs are measured:

- In CI: run the `Performance Benchmarks` workflow via `workflow_dispatch`,
  download the `updated-baseline` artifact, and commit it.
- Locally: `npm run perf:baseline` (numbers reflect your machine, so prefer the
  CI path for the committed baseline).

Because the baseline is hardware-sensitive, regenerate it whenever the harness
semantics (schema) or Playwright version changes, or the gate will fail closed.
