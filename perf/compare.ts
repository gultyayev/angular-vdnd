import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AggregatedMetrics } from './fixtures/statistics.ts';
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

function percentChange(baseline: number, current: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function parseArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const threshold = parseFloat(parseArg(args, '--threshold') ?? '25');
  const outputPath = parseArg(args, '--output');

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

  emit(`\n## Performance Comparison (threshold: ${threshold}%)\n`);
  emit('| Scenario | Metric | Baseline p95 | Current p95 | Change |');
  emit('|----------|--------|-------------|------------|--------|');

  let hasRegression = false;

  for (const [name, baselineReport] of baseline) {
    const currentReport = latest.get(name);
    if (!currentReport) {
      emit(`| ${name} | - | - | - | MISSING |`);
      continue;
    }

    for (const metric of COMPARISON_METRICS) {
      const bMetric = baselineReport[metric] as AggregatedMetrics | undefined;
      const cMetric = currentReport[metric] as AggregatedMetrics | undefined;

      if (!bMetric || !cMetric) continue;

      const change = percentChange(bMetric.p95, cMetric.p95);
      const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
      const flag = change > threshold ? ' REGRESSION' : '';

      if (change > threshold) {
        hasRegression = true;
      }

      emit(
        `| ${name} | ${metric} | ${bMetric.p95.toFixed(1)} | ${cMetric.p95.toFixed(1)} | ${changeStr}${flag} |`,
      );
    }
  }

  emit('');

  if (hasRegression) {
    emit(`**Performance regression detected** (>${threshold}% on p95 values).`);
  } else {
    emit('No significant regressions detected.');
  }

  if (outputPath) {
    writeFileSync(outputPath, lines.join('\n') + '\n');
  }

  if (hasRegression) {
    process.exit(1);
  }
}

main();
