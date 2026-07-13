import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AggregatedMetrics } from './fixtures/statistics.ts';
import { evaluateMetric } from './fixtures/compare-metrics.ts';
import { extractScenarios, type ScenarioReport } from './fixtures/extract-scenarios.ts';

const COMPARISON_METRICS = [
  'totalBlockingTime',
  'longTaskCount',
  'layoutCount',
  'recalcStyleCount',
  'avgFrameTime',
  'maxFrameGap',
  'droppedFrames',
  'p99FrameTime',
  'jsHeapDelta',
];

function parseArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

/** Read the Playwright version embedded in a JSON reporter output file. */
function readPlaywrightVersion(filePath: string): string | undefined {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as { config?: { version?: string } };
    return data.config?.version;
  } catch {
    return undefined;
  }
}

/** Read the metrics schema version recorded on the scenario reports. */
function readSchemaVersion(scenarios: ScenarioReport[]): number | undefined {
  for (const s of scenarios) {
    if (typeof s.metricsSchemaVersion === 'number') return s.metricsSchemaVersion;
  }
  return undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const threshold = parseFloat(parseArg(args, '--threshold') ?? '25');
  const outputPath = parseArg(args, '--output');
  // By default an incompatible baseline (different Playwright build or metrics
  // schema) fails closed — the numbers are not comparable. This escape hatch
  // downgrades that to a warning for local experimentation.
  const allowMismatch = args.includes('--allow-baseline-mismatch');

  const baselinePath = resolve(
    parseArg(args, '--baseline') ?? resolve(import.meta.dirname, 'baselines/baseline.json'),
  );
  const latestPath = resolve(
    parseArg(args, '--current') ?? resolve(import.meta.dirname, 'results/latest.json'),
  );

  if (!existsSync(baselinePath)) {
    console.log('No baseline found. Run `npm run perf:baseline` to create one.');
    process.exit(0);
  }

  if (!existsSync(latestPath)) {
    console.error('No latest results found. Run `npm run perf` first.');
    process.exit(1);
  }

  const baselineArr = extractScenarios(baselinePath);
  const latestArr = extractScenarios(latestPath);
  const baseline = new Map(baselineArr.map((s) => [s.scenario, s]));
  const latest = new Map(latestArr.map((s) => [s.scenario, s]));

  const lines: string[] = [];
  const emit = (line: string) => {
    console.log(line);
    lines.push(line);
  };
  const finish = (exitCode: number) => {
    if (outputPath) writeFileSync(outputPath, lines.join('\n') + '\n');
    process.exit(exitCode);
  };

  if (baseline.size === 0) {
    emit('Baseline contains no scenario data. Re-run `npm run perf:baseline`.');
    finish(allowMismatch ? 0 : 1);
    return;
  }

  emit(`\n## Performance Comparison (threshold: ${threshold}% on median)\n`);

  // Environment / harness metadata: surface the Playwright build and the metrics
  // schema on both sides so browser-build or semantics drift isn't silently
  // attributed to code (issue #42, problem 6).
  const baselineVersion = readPlaywrightVersion(baselinePath);
  const currentVersion = readPlaywrightVersion(latestPath);
  const baselineSchema = readSchemaVersion(baselineArr);
  const currentSchema = readSchemaVersion(latestArr);
  emit(
    `- Baseline Playwright: **${baselineVersion ?? 'unknown'}** · metrics schema: **${baselineSchema ?? 'unknown (pre-#42)'}**`,
  );
  emit(
    `- Current Playwright: **${currentVersion ?? 'unknown'}** · metrics schema: **${currentSchema ?? 'unknown'}**`,
  );

  const versionMismatch =
    !!baselineVersion && !!currentVersion && baselineVersion !== currentVersion;
  const schemaMismatch = baselineSchema !== currentSchema;
  const incompatible = versionMismatch || schemaMismatch;

  if (incompatible) {
    const reasons: string[] = [];
    if (schemaMismatch) {
      reasons.push(
        `metrics schema differs (baseline ${baselineSchema ?? 'pre-#42'} vs current ${currentSchema ?? 'unknown'}) — the numbers measure different things`,
      );
    }
    if (versionMismatch) {
      reasons.push(
        `Playwright differs (baseline ${baselineVersion} vs current ${currentVersion}) — different browser builds`,
      );
    }
    emit(`\n> ⚠️ **Incompatible baseline:** ${reasons.join('; ')}.`);
    emit('> Regenerate the baseline on the current harness (`npm run perf:baseline`).');

    if (!allowMismatch) {
      emit('');
      emit(
        '**Comparison gated: baseline is not comparable to the current run.** ' +
          'Pass `--allow-baseline-mismatch` to compare anyway (results will be unreliable).',
      );
      finish(1);
      return;
    }
    emit('> Proceeding anyway because `--allow-baseline-mismatch` was set.');
  }
  emit('');

  emit('| Scenario | Metric | Baseline median | Current median | Change | Status |');
  emit('|----------|--------|-----------------|----------------|--------|--------|');

  let hasRegression = false;
  let hasMissing = false;

  for (const [name, baselineReport] of baseline) {
    const currentReport = latest.get(name);
    if (!currentReport) {
      // A benchmark that exists in the baseline but not the current run has
      // silently vanished (renamed / skipped / crashed) — fail, don't ignore.
      emit(`| ${name} | * | - | - | - | MISSING SCENARIO |`);
      hasMissing = true;
      continue;
    }

    for (const metric of COMPARISON_METRICS) {
      const bMetric = baselineReport[metric] as AggregatedMetrics | undefined;
      if (!bMetric) continue;

      const cMetric = currentReport[metric] as AggregatedMetrics | undefined;
      if (!cMetric) {
        emit(`| ${name} | ${metric} | ${bMetric.median.toFixed(1)} | - | - | MISSING METRIC |`);
        hasMissing = true;
        continue;
      }

      const evaluation = evaluateMetric(metric, bMetric, cMetric, threshold);
      const changeStr = `${evaluation.percentChange >= 0 ? '+' : ''}${evaluation.percentChange.toFixed(1)}%`;
      let status = 'ok';
      if (evaluation.regression) {
        status = 'REGRESSION';
        hasRegression = true;
      } else if (evaluation.suppressed) {
        status = 'noise (below floor)';
      }

      emit(
        `| ${name} | ${metric} | ${evaluation.baseline.toFixed(1)} | ${evaluation.current.toFixed(1)} | ${changeStr} | ${status} |`,
      );
    }
  }

  emit('');

  if (hasRegression) {
    emit(`**Performance regression detected** (>${threshold}% on median, above the noise floor).`);
  }
  if (hasMissing) {
    emit(
      '**Missing benchmark data** — a baseline scenario or metric was absent from the current run.',
    );
  }
  if (!hasRegression && !hasMissing) {
    emit('No significant regressions detected.');
  }

  finish(hasRegression || hasMissing ? 1 : 0);
}

main();
