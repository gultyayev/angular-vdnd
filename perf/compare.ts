import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AggregatedMetrics } from './fixtures/statistics.ts';
import { evaluateMetric } from './fixtures/compare-metrics.ts';
import { extractScenarios } from './fixtures/extract-scenarios.ts';

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

function main(): void {
  const args = process.argv.slice(2);
  const threshold = parseFloat(parseArg(args, '--threshold') ?? '25');
  const outputPath = parseArg(args, '--output');
  const failOnVersionMismatch = args.includes('--fail-on-version-mismatch');

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

  if (baseline.size === 0) {
    console.log('Baseline contains no scenario data. Re-run `npm run perf:baseline`.');
    process.exit(0);
  }

  const lines: string[] = [];
  const emit = (line: string) => {
    console.log(line);
    lines.push(line);
  };

  emit(`\n## Performance Comparison (threshold: ${threshold}% on median)\n`);

  // Environment metadata: surface the Playwright version on both sides so
  // browser-build drift isn't silently attributed to code (issue #42, problem 6).
  const baselineVersion = readPlaywrightVersion(baselinePath);
  const currentVersion = readPlaywrightVersion(latestPath);
  emit(`- Baseline Playwright: **${baselineVersion ?? 'unknown'}**`);
  emit(`- Current Playwright: **${currentVersion ?? 'unknown'}**`);

  const versionMismatch =
    !!baselineVersion && !!currentVersion && baselineVersion !== currentVersion;
  if (versionMismatch) {
    emit(
      `\n> ⚠️ **Playwright version mismatch** (baseline ${baselineVersion} vs current ${currentVersion}). ` +
        'Baseline and current numbers come from different browser builds — differences may be ' +
        'environmental, not code. Regenerate the baseline on the current Playwright ' +
        '(`npm run perf:baseline`).',
    );
  }
  emit('');

  emit('| Scenario | Metric | Baseline median | Current median | Change | Status |');
  emit('|----------|--------|-----------------|----------------|--------|--------|');

  let hasRegression = false;

  for (const [name, baselineReport] of baseline) {
    const currentReport = latest.get(name);
    if (!currentReport) {
      emit(`| ${name} | - | - | - | - | MISSING |`);
      continue;
    }

    for (const metric of COMPARISON_METRICS) {
      const bMetric = baselineReport[metric] as AggregatedMetrics | undefined;
      const cMetric = currentReport[metric] as AggregatedMetrics | undefined;

      if (!bMetric || !cMetric) continue;

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
  } else {
    emit('No significant regressions detected.');
  }

  if (outputPath) {
    writeFileSync(outputPath, lines.join('\n') + '\n');
  }

  if (hasRegression || (versionMismatch && failOnVersionMismatch)) {
    process.exit(1);
  }
}

main();
