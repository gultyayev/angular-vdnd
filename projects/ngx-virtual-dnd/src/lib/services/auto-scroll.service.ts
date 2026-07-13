import { inject, Injectable } from '@angular/core';
import { CursorPosition } from '../models/drag-drop.models';
import { DragStateService } from './drag-state.service';
import { PositionCalculatorService } from './position-calculator.service';
import { DragSchedulerService } from './drag-scheduler.service';

/**
 * Configuration for auto-scroll behavior.
 */
export interface AutoScrollConfig {
  /** Distance from edge to start scrolling (in pixels) */
  threshold: number;
  /** Maximum scroll speed in pixels per 60fps frame (about 16.67ms) */
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

const BASE_FRAME_DURATION_MS = 1000 / 60;
const MIN_SCROLL_FRAME_SCALE = 1;
const MAX_SCROLL_FRAME_SCALE = 6;

/**
 * Service that handles auto-scrolling when dragging near container edges.
 */
@Injectable({
  providedIn: 'root',
})
export class AutoScrollService {
  readonly #dragState = inject(DragStateService);
  readonly #positionCalculator = inject(PositionCalculatorService);
  readonly #scheduler = inject(DragSchedulerService);

  /** Currently registered scrollable containers */
  #scrollableContainers = new Map<
    string,
    {
      element: HTMLElement;
      config: AutoScrollConfig;
    }
  >();

  /** Bound reference to #participantTick for stable add/remove with the scheduler. */
  readonly #boundParticipantTick: () => void = () => this.#participantTick();

  /** Callback to invoke when scrolling occurs (for placeholder recalculation) */
  #onScrollCallback: (() => void) | null = null;

  /** Optional cursor position override for edge detection (bypasses DragState read) */
  #cursorOverride: CursorPosition | null = null;

  /** Last tick cursor position for stationary detection */
  #lastTickCursorX = NaN;
  #lastTickCursorY = NaN;

  /**
   * Last timestamp used to scale per-frame autoscroll distance by elapsed frame time.
   * Scale is intentionally floored at 1 to preserve the existing feel on 60fps+ displays while
   * compensating slower frames that would otherwise under-scroll.
   */
  #lastScrollTimestamp = 0;

  /** Reusable direction object for tick loop (avoids per-frame allocation) */
  readonly #tickDirection = { x: 0, y: 0 };

  /** Current scroll state */
  readonly #scrollState: {
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
   * Registers this service as a tick participant in DragSchedulerService.
   * The scheduler drives the RAF loop; this service handles scroll logic each frame.
   * @param onScroll Optional callback to invoke when scrolling occurs (for placeholder recalculation)
   */
  startMonitoring(onScroll?: () => void): void {
    this.#onScrollCallback = onScroll ?? null;
    this.#scheduler.addParticipant(this.#boundParticipantTick);
  }

  /**
   * Stop monitoring for auto-scroll.
   * Removes this service from the scheduler's participant list.
   * Call this when a drag ends.
   */
  stopMonitoring(): void {
    this.#scheduler.removeParticipant(this.#boundParticipantTick);
    this.#onScrollCallback = null;
    this.#cursorOverride = null;
    this.#lastTickCursorX = NaN;
    this.#lastTickCursorY = NaN;
    this.#lastScrollTimestamp = 0;
    this.#scrollState.containerId = null;
    this.#scrollState.direction.x = 0;
    this.#scrollState.direction.y = 0;
    this.#scrollState.speed = 0;
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
   * Participant tick — called by DragSchedulerService each RAF frame.
   *
   * Runs the edge-scroll check and, if a scroll is performed, synchronously
   * invokes #onScrollCallback (the placeholder recalculator) in the same frame.
   * No RAF scheduling here — the scheduler owns the loop.
   */
  #participantTick(): void {
    const cursor = this.#cursorOverride ?? this.#dragState.cursorPosition();

    // No cursor yet — nothing to scroll toward.
    if (!cursor) {
      return;
    }

    // Skip the container iteration when cursor hasn't moved and scroll is idle.
    if (
      cursor.x === this.#lastTickCursorX &&
      cursor.y === this.#lastTickCursorY &&
      !this.isScrolling()
    ) {
      return;
    }
    this.#lastTickCursorX = cursor.x;
    this.#lastTickCursorY = cursor.y;

    let scrollPerformed = false;

    for (const [id, { element, config }] of this.#scrollableContainers) {
      const rect = element.getBoundingClientRect();
      const isInside = this.#positionCalculator.isInsideContainer(cursor, rect);

      if (!isInside) {
        continue;
      }

      const nearEdge = this.#positionCalculator.getNearEdge(cursor, rect, config.threshold);

      // Reuse the per-frame direction object to avoid allocation.
      const direction = this.#tickDirection;
      direction.x = 0;
      direction.y = 0;
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

      if (direction.x !== 0 || direction.y !== 0) {
        let speed = config.maxSpeed;
        if (config.accelerate) {
          const distanceRatio = maxDistance / config.threshold;
          speed = Math.min(config.maxSpeed, Math.max(1, config.maxSpeed * distanceRatio));
        }

        this.#scrollState.containerId = id;
        this.#scrollState.direction.x = direction.x;
        this.#scrollState.direction.y = direction.y;
        this.#scrollState.speed = speed;
        this.#performScroll(element, direction, speed);
        scrollPerformed = true;
        break;
      }
    }

    if (!scrollPerformed) {
      this.#lastScrollTimestamp = 0;
      this.#scrollState.containerId = null;
      this.#scrollState.direction.x = 0;
      this.#scrollState.direction.y = 0;
      this.#scrollState.speed = 0;
    }
  }

  /**
   * Perform the actual scroll operation.
   */
  #performScroll(element: HTMLElement, direction: { x: number; y: number }, speed: number): void {
    const frameScale = this.#getFrameScale();
    const scrollX = direction.x * speed * frameScale;
    const scrollY = direction.y * speed * frameScale;

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

  #getFrameScale(): number {
    const now = performance.now();
    const elapsedMs =
      this.#lastScrollTimestamp === 0 ? BASE_FRAME_DURATION_MS : now - this.#lastScrollTimestamp;

    this.#lastScrollTimestamp = now;

    return Math.min(
      Math.max(elapsedMs / BASE_FRAME_DURATION_MS, MIN_SCROLL_FRAME_SCALE),
      MAX_SCROLL_FRAME_SCALE,
    );
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
