import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface AggregatedMetrics {
  mean: number;
  median: number;
  p95: number;
  stddev: number;
  min: number;
  max: number;
  samples: number;
}

interface ScenarioReport {
  scenario: string;
  [metric: string]: AggregatedMetrics | string | number;
}

interface Attachment {
  name: string;
  body?: string;
  contentType: string;
}

interface TestResult {
  attachments?: Attachment[];
}

interface TestCase {
  results?: TestResult[];
}

interface Spec {
  tests?: TestCase[];
}

interface Suite {
  suites?: Suite[];
  specs?: Spec[];
}

interface ResultsFile {
  suites: Suite[];
}

const COMPARISON_METRICS = [
  'totalBlockingTime',
  'longTaskCount',
  'layoutCount',
  'recalcStyleCount',
  'avgFrameTime',
  'maxFrameGap',
  'jsHeapDelta',
];

function extractScenarios(filePath: string): Map<string, ScenarioReport> {
  const data: ResultsFile = JSON.parse(readFileSync(filePath, 'utf-8'));
  const scenarios = new Map<string, ScenarioReport>();

  function traverseSuite(suite: Suite): void {
    for (const child of suite.suites ?? []) {
      traverseSuite(child);
    }
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          for (const attachment of result.attachments ?? []) {
            if (attachment.contentType === 'application/json' && attachment.body) {
              const report = JSON.parse(
                Buffer.from(attachment.body, 'base64').toString('utf-8'),
              ) as ScenarioReport;
              if (report.scenario) {
                scenarios.set(report.scenario, report);
              }
            }
          }
        }
      }
    }
  }

  for (const suite of data.suites ?? []) {
    traverseSuite(suite);
  }

  return scenarios;
}

function percentChange(baseline: number, current: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function main(): void {
  const args = process.argv.slice(2);
  let threshold = 25;

  const thresholdIdx = args.indexOf('--threshold');
  if (thresholdIdx !== -1 && args[thresholdIdx + 1]) {
    threshold = parseFloat(args[thresholdIdx + 1]);
  }

  const baselinePath = resolve(import.meta.dirname, 'baselines/baseline.json');
  const latestPath = resolve(import.meta.dirname, 'results/latest.json');

  if (!existsSync(baselinePath)) {
    console.log('No baseline found. Run `npm run perf:baseline` to create one.');
    process.exit(0);
  }

  if (!existsSync(latestPath)) {
    console.error('No latest results found. Run `npm run perf` first.');
    process.exit(1);
  }

  const baseline = extractScenarios(baselinePath);
  const latest = extractScenarios(latestPath);

  if (baseline.size === 0) {
    console.log('Baseline contains no scenario data. Re-run `npm run perf:baseline`.');
    process.exit(0);
  }

  console.log(`\n## Performance Comparison (threshold: ${threshold}%)\n`);
  console.log('| Scenario | Metric | Baseline p95 | Current p95 | Change |');
  console.log('|----------|--------|-------------|------------|--------|');

  let hasRegression = false;

  for (const [name, baselineReport] of baseline) {
    const currentReport = latest.get(name);
    if (!currentReport) {
      console.log(`| ${name} | - | - | - | MISSING |`);
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

      console.log(
        `| ${name} | ${metric} | ${bMetric.p95.toFixed(1)} | ${cMetric.p95.toFixed(1)} | ${changeStr}${flag} |`,
      );
    }
  }

  console.log('');

  if (hasRegression) {
    console.error(`Performance regression detected (>${threshold}% on p95 values).`);
    process.exit(1);
  } else {
    console.log('No significant regressions detected.');
  }
}

main();
