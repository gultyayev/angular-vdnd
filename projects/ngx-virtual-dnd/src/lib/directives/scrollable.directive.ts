import { Directive, ElementRef, inject, input, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { VDND_SCROLL_CONTAINER, VdndScrollContainer } from '../tokens/scroll-container.token';
import { AutoScrollConfig, AutoScrollService } from '../services/auto-scroll.service';

/**
 * Directive that marks an element as a scrollable container for virtual scrolling.
 *
 * Apply this directive to any scrollable element (with `overflow: auto` or `overflow: scroll`)
 * that contains a `*vdndVirtualFor` directive. The virtual scroll will use this element
 * as its scroll container.
 *
 * @example
 * Basic usage with a custom scroll container:
 * ```html
 * <div vdndScrollable style="overflow: auto; height: 400px;">
 *   <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *     <div>{{ item.name }}</div>
 *   </ng-container>
 * </div>
 * ```
 *
 * @example
 * With Ionic ion-content:
 * ```html
 * <ion-content vdndScrollable class="ion-content-scroll-host">
 *   <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *     <div>{{ item.name }}</div>
 *   </ng-container>
 * </ion-content>
 * ```
 *
 * @example
 * With auto-scroll configuration:
 * ```html
 * <div vdndScrollable
 *      [autoScrollEnabled]="true"
 *      [autoScrollConfig]="{ threshold: 80, maxSpeed: 20 }"
 *      style="overflow: auto; height: 400px;">
 *   ...
 * </div>
 * ```
 */
@Directive({
  selector: '[vdndScrollable]',
  providers: [{ provide: VDND_SCROLL_CONTAINER, useExisting: ScrollableDirective }],
  host: {
    class: 'vdnd-scrollable',
  },
})
export class ScrollableDirective implements VdndScrollContainer, OnInit, OnDestroy {
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #ngZone = inject(NgZone);
  readonly #autoScrollService = inject(AutoScrollService);

  /** Current scroll position (reactive) */
  readonly #scrollTop = signal(0);

  /** Measured container height (reactive) */
  readonly #containerHeight = signal(0);

  /** Cleanup function for scroll listener */
  #scrollCleanup: (() => void) | null = null;

  /** ResizeObserver for container height detection */
  #resizeObserver: ResizeObserver | null = null;

  /** Generated ID for auto-scroll registration */
  #generatedScrollId = `vdnd-scroll-${Math.random().toString(36).slice(2, 9)}`;

  // ========== Inputs ==========

  /** Unique ID for this scroll container (used for auto-scroll registration) */
  scrollContainerId = input<string>();

  /** Whether auto-scroll is enabled when dragging near edges */
  autoScrollEnabled = input<boolean>(true);

  /** Auto-scroll configuration */
  autoScrollConfig = input<Partial<AutoScrollConfig>>({});

  // ========== VdndScrollContainer Implementation ==========

  get nativeElement(): HTMLElement {
    return this.#elementRef.nativeElement;
  }

  scrollTop(): number {
    return this.#scrollTop();
  }

  scrollTo(options: ScrollToOptions): void {
    this.nativeElement.scrollTo(options);
  }

  // ========== Additional API ==========

  /** Get the measured container height */
  containerHeight(): number {
    return this.#containerHeight();
  }

  /** Scroll by a delta amount */
  scrollBy(delta: number): void {
    const newPosition = Math.max(
      0,
      Math.min(
        this.scrollTop() + delta,
        this.nativeElement.scrollHeight - this.nativeElement.clientHeight
      )
    );
    this.scrollTo({ top: newPosition });
  }

  // ========== Lifecycle ==========

  ngOnInit(): void {
    this.#setupScrollListener();
    this.#setupResizeObserver();
    this.#registerAutoScroll();
  }

  ngOnDestroy(): void {
    this.#scrollCleanup?.();
    this.#resizeObserver?.disconnect();
    this.#unregisterAutoScroll();
  }

  // ========== Private Methods ==========

  #setupScrollListener(): void {
    const onScroll = () => {
      this.#ngZone.run(() => {
        this.#scrollTop.set(this.nativeElement.scrollTop);
      });
    };

    this.#ngZone.runOutsideAngular(() => {
      this.nativeElement.addEventListener('scroll', onScroll, { passive: true });
    });

    this.#scrollCleanup = () => {
      this.nativeElement.removeEventListener('scroll', onScroll);
    };

    // Set initial scroll position
    this.#scrollTop.set(this.nativeElement.scrollTop);
  }

  #setupResizeObserver(): void {
    this.#ngZone.runOutsideAngular(() => {
      this.#resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          // Only update if height changed significantly (> 1px) to avoid loops
          if (Math.abs(height - this.#containerHeight()) > 1) {
            this.#ngZone.run(() => {
              this.#containerHeight.set(height);
            });
          }
        }
      });
      this.#resizeObserver.observe(this.nativeElement);
    });

    // Set initial height
    this.#containerHeight.set(this.nativeElement.clientHeight);
  }

  #registerAutoScroll(): void {
    if (this.autoScrollEnabled()) {
      const id = this.scrollContainerId() ?? this.#generatedScrollId;
      this.#autoScrollService.registerContainer(
        id,
        this.nativeElement,
        this.autoScrollConfig()
      );
    }
  }

  #unregisterAutoScroll(): void {
    const id = this.scrollContainerId() ?? this.#generatedScrollId;
    this.#autoScrollService.unregisterContainer(id);
  }
}
