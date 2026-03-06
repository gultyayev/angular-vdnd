import { readFileSync, appendFileSync, existsSync } from 'node:fs';
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
  cpuThrottle?: number;
  iterations?: number;
  [metric: string]: AggregatedMetrics | string | number | undefined;
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

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  totalBlockingTime: { label: 'Total Blocking Time', unit: 'ms' },
  longTaskCount: { label: 'Long Tasks (>50ms)', unit: '' },
  layoutCount: { label: 'Layouts', unit: '' },
  recalcStyleCount: { label: 'Style Recalcs', unit: '' },
  avgFrameTime: { label: 'Avg Frame Time', unit: 'ms' },
  maxFrameGap: { label: 'Max Frame Gap', unit: 'ms' },
  jsHeapDelta: { label: 'Heap Delta', unit: 'KB' },
};

function extractScenarios(filePath: string): ScenarioReport[] {
  const data: ResultsFile = JSON.parse(readFileSync(filePath, 'utf-8'));
  const scenarios: ScenarioReport[] = [];

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
                scenarios.push(report);
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

function formatValue(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return unit ? `${rounded} ${unit}` : `${rounded}`;
}

function generateReport(scenarios: ScenarioReport[]): string {
  const lines: string[] = [];

  lines.push('## Performance Benchmark Results');
  lines.push('');
  lines.push(`> CPU throttling: **4x** · Iterations: **5** (1 warmup discarded)`);
  lines.push('');

  for (const scenario of scenarios) {
    lines.push(`### ${scenario.scenario}`);
    lines.push('');
    lines.push('| Metric | p95 | Mean | Stddev |');
    lines.push('|--------|-----|------|--------|');

    for (const [key, meta] of Object.entries(METRIC_LABELS)) {
      const m = scenario[key] as AggregatedMetrics | undefined;
      if (!m) continue;

      lines.push(
        `| ${meta.label} | **${formatValue(m.p95, meta.unit)}** | ${formatValue(m.mean, meta.unit)} | ±${formatValue(m.stddev, meta.unit)} |`,
      );
    }

    lines.push('');
  }

  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const inputPath =
    inputIdx !== -1 && args[inputIdx + 1]
      ? resolve(args[inputIdx + 1])
      : resolve(import.meta.dirname, 'results/latest.json');

  const outputIdx = args.indexOf('--output');
  const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : undefined;

  if (!existsSync(inputPath)) {
    console.error(`Results file not found: ${inputPath}`);
    process.exit(1);
  }

  const scenarios = extractScenarios(inputPath);
  if (scenarios.length === 0) {
    console.log('No benchmark data found in results.');
    process.exit(0);
  }

  const report = generateReport(scenarios);
  console.log(report);

  if (outputPath) {
    appendFileSync(outputPath, report + '\n');
  }
}

main();
