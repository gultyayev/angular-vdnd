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
  `fixtures/compare-metrics.ts`),
- more than **3× the baseline MAD** (median absolute deviation), and
- the change is **sustained**: the current run's **minimum** sample is worse
  than the baseline median.

The sustained check targets the remaining CI false-positive mode: intermittent
runner noise (GC, noisy neighbors) can elevate 3 of 5 iterations — shifting the
median — while the clean iterations stay at baseline level. A real code
regression slows down _every_ iteration, so even the best current sample ends up
above the baseline's typical one. Trade-off: a regression that only manifests
intermittently is reported (`noise (not sustained)`) but not gated.

An over-threshold change that fails one of the guards is reported as
informational with the guard that suppressed it: `noise (below floor)`,
`noise (within band)`, or `noise (not sustained)`.

MAD is used instead of standard deviation because, with only five samples, a
single outlier inflates stddev enough to hide a real, sustained regression — a
baseline of `[0,0,0,0,500]` has stddev ≈224 but MAD 0, so a steady jump to 100 ms
is correctly gated rather than swallowed by the band. `3 × MAD ≈ 2σ` for normal
data.

The absolute floor is what keeps a **zero baseline** from auto-failing: a metric
that was `0` and becomes `1` (e.g. a single 51 ms long task) is `+100%` but stays
below its floor, so it is reported as informational ("noise (below floor)")
rather than gating. A floor must guard small baselines **without exceeding the
committed baseline medians themselves** — layout/style-recalc counts are
near-deterministic (MAD ≈ 0), and their original floor of 25 was larger than the
drag-within-list layout baseline (24), which let a full doubling of layout work
slip through as "noise". Current floors:

| Metric            | Floor | Unit   |
| ----------------- | ----- | ------ |
| totalBlockingTime | 20    | ms     |
| longTaskCount     | 2     | tasks  |
| layoutCount       | 10    | count  |
| recalcStyleCount  | 10    | count  |
| avgFrameTime      | 1.5   | ms     |
| maxFrameGap       | 15    | ms     |
| droppedFrames     | 3     | frames |
| p99FrameTime      | 5     | ms     |

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
- **Mixed schemas within one run.** A results file whose scenarios carry more
  than one `metricsSchemaVersion` mixes collector versions (e.g. a stale
  results file) and is rejected outright.

Both versions are printed in the output — along with each run's **git commit and
date** (embedded by Playwright's JSON reporter) so it is always visible what the
baseline was measured from. Mismatches fail the run and tell you to regenerate;
pass `--allow-baseline-mismatch` to compare anyway (unreliable).

The comparison also fails when a scenario or metric present in the baseline is
**missing** from the current run — a renamed, skipped, or crashed benchmark must
not silently disappear behind a green check. The reverse case — a scenario in
the current run with no baseline entry — is a **new benchmark**: it is listed as
`NEW (no baseline)` and stays ungated until the baseline is regenerated.

When the baseline run is more than 60 days older than the current run, the
output includes a non-fatal **stale baseline** warning: perf improvements landed
on master since then leave slack in the old numbers that can hide regressions.

## Regenerating the baseline

Regenerate **on the current Playwright and, ideally, in the CI environment** so
absolute numbers match where PRs are measured:

- In CI: run the `Performance Benchmarks` workflow via `workflow_dispatch`,
  download the `updated-baseline` artifact, and commit it.
- Locally: `npm run perf:baseline` (numbers reflect your machine, so prefer the
  CI path for the committed baseline).

Because the baseline is hardware-sensitive, regenerate it whenever the harness
semantics (schema) or Playwright version changes, or the gate will fail closed.
The CI jobs are pinned to a specific runner image (`ubuntu-24.04`, not
`ubuntu-latest`) for the same reason: a silent runner-image migration would
shift absolute numbers under the committed baseline. When bumping the pin,
bump the `benchmark` and `refresh-baseline` jobs together and regenerate the
baseline on the new image.
