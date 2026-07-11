import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AutoScrollService } from '../services/auto-scroll.service';

/**
 * Enable edge auto-scrolling during drag operations.
 *
 * Add to an application's (or route's) providers to opt into autoscroll:
 *
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideVdndAutoScroll()],
 * });
 * ```
 *
 * Without this provider, `vdndScrollable` / `vdndDroppable` containers and the
 * virtual-scroll components still work — they simply don't edge-scroll while
 * dragging. Autoscroll registers as a tick participant in the always-on
 * `DragSchedulerService`, so enabling it never adds a second RAF loop.
 */
export function provideVdndAutoScroll(): EnvironmentProviders {
  return makeEnvironmentProviders([AutoScrollService]);
}
