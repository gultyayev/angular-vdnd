import { InjectionToken } from '@angular/core';

/**
 * Interface for a scroll container that can be used with VirtualForDirective.
 * Implement this interface to create custom scroll containers.
 *
 * The scrollTop() and containerHeight() methods should return reactive values
 * (internally backed by signals) so that changes trigger re-computation in
 * the virtual scroll directive.
 */
export interface VdndScrollContainer {
  /** The native HTML element that handles scrolling */
  readonly nativeElement: HTMLElement;

  /** Current scroll position from top in pixels (reactive) */
  scrollTop(): number;

  /** Current container height in pixels (reactive) */
  containerHeight(): number;

  /** Scroll to a specific position */
  scrollTo(options: ScrollToOptions): void;
}

/**
 * Injection token for providing a scroll container to VirtualForDirective.
 *
 * Use the `vdndScrollable` directive to provide this token, or implement
 * `VdndScrollContainer` and provide it manually.
 *
 * @example
 * ```html
 * <div vdndScrollable style="overflow: auto; height: 400px;">
 *   <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *     <div>{{ item.name }}</div>
 *   </ng-container>
 * </div>
 * ```
 */
export const VDND_SCROLL_CONTAINER = new InjectionToken<VdndScrollContainer>(
  'VDND_SCROLL_CONTAINER'
);
