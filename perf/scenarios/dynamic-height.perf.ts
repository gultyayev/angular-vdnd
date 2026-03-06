import { test } from '@playwright/test';
import { MetricsCollector, ScenarioMetrics } from '../fixtures/metrics-collector';
import { PerfPage } from '../fixtures/perf.page';
import { aggregate, round } from '../fixtures/statistics';

const ITERATIONS = 5;
const WARMUP_ITERATIONS = 1;
const CPU_THROTTLE = 4;

test.describe('Dynamic Height Scroll Performance', () => {
  test('scroll through dynamic height list', async ({ page }, testInfo) => {
    const perfPage = new PerfPage(page);
    const collector = new MetricsCollector(page);
    await collector.init();
    await collector.setCpuThrottling(CPU_THROTTLE);

    // Navigate to the dynamic height demo (150 tasks by default with varying heights)
    await perfPage.goto('/dynamic-height');

    const results: ScenarioMetrics[] = [];
    const totalRuns = WARMUP_ITERATIONS + ITERATIONS;

    for (let i = 0; i < totalRuns; i++) {
      // Reset scroll to top via Ionic's IonContent scroll container
      await page.evaluate(() => {
        const scrollable = document.querySelector('[vdndScrollable]') as HTMLElement;
        if (scrollable) scrollable.scrollTop = 0;
      });
      await page.waitForTimeout(300);

      const metrics = await collector.measureScenario(async () => {
        // Scroll to the bottom of the dynamic-height list
        // 150 items * ~80px estimated height = ~12000px, but heights vary
        await page.evaluate(() => {
          return new Promise<void>((resolve) => {
            const scrollable = document.querySelector('[vdndScrollable]') as HTMLElement;
            if (!scrollable) {
              resolve();
              return;
            }
            const target = scrollable.scrollHeight;
            const start = scrollable.scrollTop;
            const delta = target - start;
            const duration = 2000;
            const startTime = performance.now();
            const step = () => {
              const elapsed = performance.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased =
                progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
              scrollable.scrollTop = start + delta * eased;
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                resolve();
              }
            };
            requestAnimationFrame(step);
          });
        });
      });

      if (i >= WARMUP_ITERATIONS) {
        results.push(metrics);
      }
    }

    const report = {
      scenario: 'dynamic-height-scroll',
      cpuThrottle: CPU_THROTTLE,
      iterations: ITERATIONS,
      totalBlockingTime: aggregate(results.map((r) => round(r.totalBlockingTime))),
      longTaskCount: aggregate(results.map((r) => r.longTaskCount)),
      layoutCount: aggregate(results.map((r) => r.layoutCount)),
      recalcStyleCount: aggregate(results.map((r) => r.recalcStyleCount)),
      avgFrameTime: aggregate(results.map((r) => round(r.avgFrameTime))),
      maxFrameGap: aggregate(results.map((r) => round(r.maxFrameGap))),
      jsHeapDelta: aggregate(results.map((r) => round(r.jsHeapDelta / 1024))),
    };

    testInfo.attach('dynamic-height-scroll', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });

    await collector.dispose();
  });
});
