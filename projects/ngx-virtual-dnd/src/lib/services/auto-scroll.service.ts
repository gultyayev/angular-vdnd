import { inject, Injectable, NgZone } from '@angular/core';
import { CursorPosition } from '../models/drag-drop.models';
import { DragStateService } from './drag-state.service';
import { PositionCalculatorService } from './position-calculator.service';

/**
 * Configuration for auto-scroll behavior.
 */
export interface AutoScrollConfig {
  /** Distance from edge to start scrolling (in pixels) */
  threshold: number;
  /** Maximum scroll speed (in pixels per frame) */
  maxSpeed: number;
  /** Whether to accelerate scroll based on distance from edge */
  accelerate: boolean;
}

/**
 * Default auto-scroll configuration.
 */
const DEFAULT_CONFIG: AutoScrollConfig = {
  threshold: 50,
  maxSpeed: 15,
  accelerate: true,
};

/**
 * Service that handles auto-scrolling when dragging near container edges.
 */
@Injectable({
  providedIn: 'root',
})
export class AutoScrollService {
  readonly #dragState = inject(DragStateService);
  readonly #positionCalculator = inject(PositionCalculatorService);
  readonly #ngZone = inject(NgZone);

  /** Currently registered scrollable containers */
  #scrollableContainers = new Map<
    string,
    {
      element: HTMLElement;
      config: AutoScrollConfig;
    }
  >();

  /** Active animation frame ID */
  #animationFrameId: number | null = null;

  /** Callback to invoke when scrolling occurs (for placeholder recalculation) */
  #onScrollCallback: (() => void) | null = null;

  /** Optional cursor position override for edge detection (bypasses DragState read) */
  #cursorOverride: CursorPosition | null = null;

  /** Current scroll state */
  #scrollState: {
    containerId: string | null;
    direction: { x: number; y: number };
    speed: number;
  } = {
    containerId: null,
    direction: { x: 0, y: 0 },
    speed: 0,
  };

  /**
   * Register a scrollable container for auto-scrolling.
   */
  registerContainer(
    id: string,
    element: HTMLElement,
    config: Partial<AutoScrollConfig> = {},
  ): void {
    this.#scrollableContainers.set(id, {
      element,
      config: { ...DEFAULT_CONFIG, ...config },
    });
  }

  /**
   * Unregister a scrollable container.
   */
  unregisterContainer(id: string): void {
    this.#scrollableContainers.delete(id);
  }

  /**
   * Start monitoring for auto-scroll.
   * Call this when a drag starts.
   * @param onScroll Optional callback to invoke when scrolling occurs (for placeholder recalculation)
   */
  startMonitoring(onScroll?: () => void): void {
    if (this.#animationFrameId !== null) {
      return;
    }

    this.#onScrollCallback = onScroll ?? null;

    this.#ngZone.runOutsideAngular(() => {
      this.#tick();
    });
  }

  /**
   * Stop monitoring for auto-scroll.
   * Call this when a drag ends.
   */
  stopMonitoring(): void {
    if (this.#animationFrameId !== null) {
      cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }

    this.#onScrollCallback = null;
    this.#cursorOverride = null;
    this.#scrollState = {
      containerId: null,
      direction: { x: 0, y: 0 },
      speed: 0,
    };
  }

  /**
   * Override the cursor position used for edge detection.
   * When set, #tick() uses this instead of DragStateService.cursorPosition().
   * Used by constrainToContainer to provide a position without grabOffset distortion.
   * @internal
   */
  setCursorOverride(position: CursorPosition): void {
    this.#cursorOverride = position;
  }

  /**
   * Animation tick - check cursor position and scroll if needed.
   */
  #tick(): void {
    const cursor = this.#cursorOverride ?? this.#dragState.cursorPosition();
    const isDragging = this.#dragState.isDragging();

    // Stop monitoring if drag ended
    if (!isDragging) {
      this.stopMonitoring();
      return;
    }

    // Skip this frame if no cursor position yet, but continue monitoring
    if (!cursor) {
      this.#animationFrameId = requestAnimationFrame(() => this.#tick());
      return;
    }

    let scrollPerformed = false;

    // Check each container
    for (const [id, { element, config }] of this.#scrollableContainers) {
      const rect = element.getBoundingClientRect();

      // Check if cursor is inside this container
      const isInside = this.#positionCalculator.isInsideContainer(cursor, rect);

      if (!isInside) {
        continue;
      }

      // Check edges
      const nearEdge = this.#positionCalculator.getNearEdge(cursor, rect, config.threshold);

      // Calculate scroll direction and speed
      const direction = { x: 0, y: 0 };
      let maxDistance = 0;

      if (nearEdge.top) {
        direction.y = -1;
        maxDistance = Math.max(maxDistance, config.threshold - (cursor.y - rect.top));
      } else if (nearEdge.bottom) {
        direction.y = 1;
        maxDistance = Math.max(maxDistance, config.threshold - (rect.bottom - cursor.y));
      }

      if (nearEdge.left) {
        direction.x = -1;
        maxDistance = Math.max(maxDistance, config.threshold - (cursor.x - rect.left));
      } else if (nearEdge.right) {
        direction.x = 1;
        maxDistance = Math.max(maxDistance, config.threshold - (rect.right - cursor.x));
      }

      // If near an edge, start scrolling
      if (direction.x !== 0 || direction.y !== 0) {
        // Calculate speed (accelerate based on distance from edge)
        let speed = config.maxSpeed;
        if (config.accelerate) {
          const distanceRatio = maxDistance / config.threshold;
          speed = Math.min(config.maxSpeed, Math.max(1, config.maxSpeed * distanceRatio));
        }

        this.#scrollState = { containerId: id, direction, speed };
        this.#performScroll(element, direction, speed);
        scrollPerformed = true;
        break;
      }
    }

    // Reset scroll state if no scrolling was performed
    if (!scrollPerformed) {
      this.#scrollState = {
        containerId: null,
        direction: { x: 0, y: 0 },
        speed: 0,
      };
    }

    this.#animationFrameId = requestAnimationFrame(() => this.#tick());
  }

  /**
   * Perform the actual scroll operation.
   */
  #performScroll(element: HTMLElement, direction: { x: number; y: number }, speed: number): void {
    const scrollX = direction.x * speed;
    const scrollY = direction.y * speed;

    // Check bounds before scrolling
    const maxScrollY = element.scrollHeight - element.clientHeight;
    const maxScrollX = element.scrollWidth - element.clientWidth;

    if (direction.y < 0 && element.scrollTop <= 0) {
      return;
    }
    if (direction.y > 0 && element.scrollTop >= maxScrollY) {
      return;
    }
    if (direction.x < 0 && element.scrollLeft <= 0) {
      return;
    }
    if (direction.x > 0 && element.scrollLeft >= maxScrollX) {
      return;
    }

    // Use direct property assignment for guaranteed synchronous scroll
    // scrollBy() with 'instant' behavior may have async issues in Safari
    if (scrollY !== 0) {
      element.scrollTop += scrollY;
    }
    if (scrollX !== 0) {
      element.scrollLeft += scrollX;
    }

    // Notify callback IMMEDIATELY in the same frame (no RAF delay)
    // Delaying via RAF causes cumulative drift during continuous autoscroll
    // because multiple scrolls happen before each delayed callback runs.
    // Note: No ngZone.run() needed here - the callback (DraggableDirective.#recalculatePlaceholder)
    // already enters the zone when updating drag state.
    this.#onScrollCallback?.();
  }

  /**
   * Check if auto-scrolling is currently active.
   */
  isScrolling(): boolean {
    return (
      this.#scrollState.containerId !== null &&
      (this.#scrollState.direction.x !== 0 || this.#scrollState.direction.y !== 0)
    );
  }

  /**
   * Get the current scroll direction.
   */
  getScrollDirection(): { x: number; y: number } {
    return this.#scrollState.direction;
  }
}
