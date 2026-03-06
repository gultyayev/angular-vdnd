import { CDPSession, Page } from '@playwright/test';

export interface PerfSnapshot {
  timestamp: number;
  jsHeapUsedSize: number;
  layoutCount: number;
  recalcStyleCount: number;
}

export interface LongTask {
  startTime: number;
  duration: number;
}

export interface ScenarioMetrics {
  durationMs: number;
  longTaskCount: number;
  totalBlockingTime: number;
  layoutCount: number;
  recalcStyleCount: number;
  jsHeapBefore: number;
  jsHeapAfter: number;
  jsHeapDelta: number;
  frameCount: number;
  avgFrameTime: number;
  maxFrameGap: number;
  droppedFrames: number;
  p99FrameTime: number;
}

export class MetricsCollector {
  #page: Page;
  #cdp: CDPSession | null = null;

  constructor(page: Page) {
    this.#page = page;
  }

  async init(): Promise<void> {
    this.#cdp = await this.#page.context().newCDPSession(this.#page);
    await this.#cdp.send('Performance.enable');
  }

  async setCpuThrottling(rate: number): Promise<void> {
    await this.#cdp!.send('Emulation.setCPUThrottlingRate', { rate });
  }

  async clearCpuThrottling(): Promise<void> {
    await this.#cdp!.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  /** Force garbage collection via CDP (requires --js-flags=--expose-gc). */
  async forceGC(): Promise<void> {
    await this.#cdp!.send('Runtime.evaluate', {
      expression: 'typeof gc === "function" && gc()',
      awaitPromise: false,
    });
  }

  async getSnapshot(): Promise<PerfSnapshot> {
    const { metrics } = await this.#cdp!.send('Performance.getMetrics');
    const get = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
    return {
      timestamp: Date.now(),
      jsHeapUsedSize: get('JSHeapUsedSize'),
      layoutCount: get('LayoutCount'),
      recalcStyleCount: get('RecalcStyleCount'),
    };
  }

  /**
   * Inject a PerformanceObserver for long tasks and an rAF-based frame tracker into the page.
   * Must be called before the scenario runs.
   */
  async injectObservers(): Promise<void> {
    await this.#page.evaluate(() => {
      const w = window as Window & Record<string, unknown>;
      w.__perfLongTasks = [];
      w.__perfFrames = [];
      w.__perfLastFrameTime = 0;
      w.__perfTrackingActive = true;

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (w.__perfLongTasks as { startTime: number; duration: number }[]).push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: 'longtask', buffered: true });

      const trackFrame = () => {
        const now = performance.now();
        if ((w.__perfLastFrameTime as number) > 0) {
          (w.__perfFrames as number[]).push(now - (w.__perfLastFrameTime as number));
        }
        w.__perfLastFrameTime = now;
        if (w.__perfTrackingActive) {
          requestAnimationFrame(trackFrame);
        }
      };
      requestAnimationFrame(trackFrame);
    });
  }

  async collectObserverResults(): Promise<{ longTasks: LongTask[]; frameTimes: number[] }> {
    return this.#page.evaluate(() => {
      const w = window as Window & Record<string, unknown>;
      w.__perfTrackingActive = false;
      return {
        longTasks: (w.__perfLongTasks as LongTask[]) ?? [],
        frameTimes: (w.__perfFrames as number[]) ?? [],
      };
    });
  }

  /**
   * Measure a scenario: takes snapshots, injects observers, runs the scenario,
   * then collects all metrics.
   */
  async measureScenario(scenario: () => Promise<void>): Promise<ScenarioMetrics> {
    await this.forceGC();
    const before = await this.getSnapshot();
    await this.injectObservers();
    const startTime = Date.now();

    await scenario();

    const durationMs = Date.now() - startTime;
    const after = await this.getSnapshot();
    const { longTasks, frameTimes } = await this.collectObserverResults();

    const totalBlockingTime = longTasks.reduce(
      (sum, task) => sum + Math.max(0, task.duration - 50),
      0,
    );

    const frameCount = frameTimes.length;
    const avgFrameTime = frameCount > 0 ? frameTimes.reduce((a, b) => a + b, 0) / frameCount : 0;
    const maxFrameGap = frameCount > 0 ? Math.max(...frameTimes) : 0;
    const droppedFrames = frameTimes.filter((t) => t > 16.7).length;
    const sortedFrames = [...frameTimes].sort((a, b) => a - b);
    const p99Index = sortedFrames.length > 0 ? Math.ceil(sortedFrames.length * 0.99) - 1 : 0;
    const p99FrameTime =
      sortedFrames.length > 0 ? sortedFrames[Math.min(p99Index, sortedFrames.length - 1)] : 0;

    return {
      durationMs,
      longTaskCount: longTasks.length,
      totalBlockingTime,
      layoutCount: after.layoutCount - before.layoutCount,
      recalcStyleCount: after.recalcStyleCount - before.recalcStyleCount,
      jsHeapBefore: before.jsHeapUsedSize,
      jsHeapAfter: after.jsHeapUsedSize,
      jsHeapDelta: after.jsHeapUsedSize - before.jsHeapUsedSize,
      frameCount,
      avgFrameTime,
      maxFrameGap,
      droppedFrames,
      p99FrameTime,
    };
  }

  async dispose(): Promise<void> {
    await this.clearCpuThrottling();
    if (this.#cdp) {
      await this.#cdp.detach();
    }
  }
}
