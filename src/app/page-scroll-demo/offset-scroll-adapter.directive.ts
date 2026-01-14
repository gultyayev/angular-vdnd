import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { VDND_SCROLL_CONTAINER, VdndScrollContainer } from 'ngx-virtual-dnd';

/**
 * Directive that adapts a scroll container to work with VirtualForDirective
 * when the virtual list is not at the top of the scroll container.
 *
 * This directive:
 * 1. Provides a `position: relative` container for the virtual scroll's absolute positioning
 * 2. Adjusts scroll values to account for content above the virtual list (header offset)
 * 3. Allows virtual scrolling to work correctly with page-level scrolling
 */
@Directive({
  selector: '[appOffsetScrollAdapter]',
  providers: [{ provide: VDND_SCROLL_CONTAINER, useExisting: OffsetScrollAdapterDirective }],
  host: {
    style: 'display: block; position: relative;',
  },
})
export class OffsetScrollAdapterDirective implements VdndScrollContainer, OnInit, OnDestroy {
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #ngZone = inject(NgZone);

  /** The actual scroll element (e.g., the vdndScrollable container) */
  scrollElement = input.required<HTMLElement>();

  /** The height of content above the virtual list (header height) */
  contentOffset = input.required<number>();

  /** Raw scroll position from the scroll element - updated via scroll listener */
  readonly #rawScrollTop = signal(0);

  /** Cleanup function for scroll listener */
  #scrollCleanup: (() => void) | null = null;

  /** Pending RAF ID for scroll throttling */
  #pendingScrollRaf: number | null = null;

  /** Last scroll position committed to signal (for threshold check) */
  #lastCommittedScrollTop = 0;

  /** Minimum scroll delta (px) to trigger signal update */
  readonly #scrollThreshold = 5;

  // ========== VdndScrollContainer Implementation ==========

  get nativeElement(): HTMLElement {
    return this.#elementRef.nativeElement;
  }

  /**
   * Returns the adjusted scroll position - subtracts the header height
   * so the virtual scroll calculates visible items correctly.
   */
  scrollTop(): number {
    return Math.max(0, this.#rawScrollTop() - this.contentOffset());
  }

  /**
   * Returns the container height directly from the scroll element.
   * This ensures we always get the current value even if it wasn't available
   * during initial setup.
   */
  containerHeight(): number {
    // Directly read from the element to ensure we get the current value
    return this.scrollElement()?.clientHeight ?? 0;
  }

  scrollTo(options: ScrollToOptions): void {
    // Adjust scroll position to account for offset
    const adjustedOptions = { ...options };
    if (adjustedOptions.top !== undefined) {
      adjustedOptions.top += this.contentOffset();
    }
    this.scrollElement()?.scrollTo(adjustedOptions);
  }

  // ========== Lifecycle ==========

  ngOnInit(): void {
    // Set up scroll listener when input becomes available
    effect(() => {
      const scrollEl = this.scrollElement();
      if (scrollEl && scrollEl.tagName) {
        this.#setupScrollListener(scrollEl);
      }
    });
  }

  ngOnDestroy(): void {
    this.#scrollCleanup?.();
  }

  // ========== Private Methods ==========

  #setupScrollListener(scrollEl: HTMLElement): void {
    // Clean up previous listener if any
    this.#scrollCleanup?.();

    const onScroll = () => {
      // Skip if already have a pending update
      if (this.#pendingScrollRaf !== null) {
        return;
      }

      const currentScrollTop = scrollEl.scrollTop;

      // Apply threshold check to avoid excessive updates
      if (Math.abs(currentScrollTop - this.#lastCommittedScrollTop) < this.#scrollThreshold) {
        return;
      }

      // Schedule update via RAF to coalesce multiple scroll events
      this.#pendingScrollRaf = requestAnimationFrame(() => {
        this.#pendingScrollRaf = null;
        const finalScrollTop = scrollEl.scrollTop;

        // Double-check threshold in case scroll reversed
        if (Math.abs(finalScrollTop - this.#lastCommittedScrollTop) >= this.#scrollThreshold) {
          this.#lastCommittedScrollTop = finalScrollTop;
          this.#rawScrollTop.set(finalScrollTop);
        }
      });
    };

    this.#ngZone.runOutsideAngular(() => {
      scrollEl.addEventListener('scroll', onScroll, { passive: true });
    });

    this.#scrollCleanup = () => {
      if (this.#pendingScrollRaf !== null) {
        cancelAnimationFrame(this.#pendingScrollRaf);
        this.#pendingScrollRaf = null;
      }
      scrollEl.removeEventListener('scroll', onScroll);
    };

    // Set initial scroll position
    this.#lastCommittedScrollTop = scrollEl.scrollTop;
    this.#rawScrollTop.set(scrollEl.scrollTop);
  }
}
