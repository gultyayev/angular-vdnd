import type { NgZone } from '@angular/core';

/**
 * A bound event listener that can be added and removed from the DOM.
 */
export interface BoundListener {
  /** Add the event listener to the target element */
  add(): void;
  /** Remove the event listener from the target element */
  remove(): void;
}

/**
 * Configuration for creating a bound event listener.
 */
export interface BoundListenerConfig<E extends Event> {
  /** The target element to listen on */
  target: EventTarget;
  /** The event type (e.g., 'mousemove', 'touchstart') */
  type: string;
  /** The event handler function */
  handler: (e: E) => void;
  /** Angular's NgZone for running listeners outside Angular */
  ngZone: NgZone;
  /** Optional event listener options */
  options?: AddEventListenerOptions;
}

/**
 * Creates a bound event listener that properly handles NgZone and cleanup.
 *
 * The listener is created but NOT automatically added. Call `add()` to attach
 * it and `remove()` to detach it.
 *
 * @example
 * ```typescript
 * // Create the listener
 * readonly #moveListener = createBoundListener({
 *   target: document,
 *   type: 'mousemove',
 *   handler: this.#onMouseMove.bind(this),
 *   ngZone: this.#ngZone,
 * });
 *
 * // In ngOnInit or when starting interaction
 * this.#moveListener.add();
 *
 * // In ngOnDestroy or when ending interaction
 * this.#moveListener.remove();
 * ```
 */
export function createBoundListener<E extends Event>(
  config: BoundListenerConfig<E>,
): BoundListener {
  const { target, type, handler, ngZone, options } = config;

  // Pre-bind the handler so we have a stable reference for removal
  const boundHandler = handler;
  let isAttached = false;

  return {
    add(): void {
      if (isAttached) return;
      ngZone.runOutsideAngular(() => {
        target.addEventListener(type, boundHandler as EventListener, options);
      });
      isAttached = true;
    },
    remove(): void {
      if (!isAttached) return;
      target.removeEventListener(type, boundHandler as EventListener, options);
      isAttached = false;
    },
  };
}

/**
 * A collection of related event listeners that can be managed together.
 */
export interface ListenerGroup {
  /** Add all listeners in the group */
  addAll(): void;
  /** Remove all listeners in the group */
  removeAll(): void;
  /** Add a specific listener by key */
  add(key: string): void;
  /** Remove a specific listener by key */
  remove(key: string): void;
}

/**
 * Creates a group of related event listeners for batch management.
 *
 * @example
 * ```typescript
 * readonly #pointerListeners = createListenerGroup({
 *   mousemove: createBoundListener({ ... }),
 *   mouseup: createBoundListener({ ... }),
 *   touchmove: createBoundListener({ ... }),
 *   touchend: createBoundListener({ ... }),
 * });
 *
 * // Add all listeners at once
 * this.#pointerListeners.addAll();
 *
 * // Remove all listeners at once
 * this.#pointerListeners.removeAll();
 *
 * // Or manage individually
 * this.#pointerListeners.add('mousemove');
 * ```
 */
export function createListenerGroup(listeners: Record<string, BoundListener>): ListenerGroup {
  return {
    addAll(): void {
      Object.values(listeners).forEach((listener) => listener.add());
    },
    removeAll(): void {
      Object.values(listeners).forEach((listener) => listener.remove());
    },
    add(key: string): void {
      listeners[key]?.add();
    },
    remove(key: string): void {
      listeners[key]?.remove();
    },
  };
}
