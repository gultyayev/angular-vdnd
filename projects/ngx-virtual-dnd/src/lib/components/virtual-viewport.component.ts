import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { VDND_VIRTUAL_VIEWPORT, VdndVirtualViewport } from '../tokens/virtual-viewport.token';
import { VDND_SCROLL_CONTAINER, VdndScrollContainer } from '../tokens/scroll-container.token';
import { AutoScrollConfig, AutoScrollService } from '../services/auto-scroll.service';
import {
  bindRafThrottledScrollTopSignal,
  bindResizeObserverHeightSignal,
} from '../utils/dom-signal-bindings';

/**
 * A virtual viewport component that provides efficient wrapper-based positioning
 * for virtual scrolling. This component acts as the scroll container and provides
 * a content wrapper with GPU-accelerated transform positioning.
 *
 * Use this component when you need virtual scrolling with optimal performance.
 * Items rendered inside via `*vdndVirtualFor` will be positioned using a single
 * transform on the wrapper, rather than individual absolute positioning.
 *
 * @example
 * Basic usage:
 * ```html
 * <vdnd-virtual-viewport
 *   [itemHeight]="50"
 *   [totalItems]="items().length"
 *   style="height: 400px;">
 *   <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *     <div class="item">{{ item.name }}</div>
 *   </ng-container>
 * </vdnd-virtual-viewport>
 * ```
 *
 * @example
 * With Ionic (disable Ionic's scroll, use viewport as scroll host):
 * ```html
 * <ion-content [scrollY]="false">
 *   <vdnd-virtual-viewport
 *     class="ion-content-scroll-host"
 *     [itemHeight]="72"
 *     [totalItems]="tasks().length"
 *     style="height: 100%;">
 *     <ng-container *vdndVirtualFor="...">
 *       ...
 *     </ng-container>
 *   </vdnd-virtual-viewport>
 * </ion-content>
 * ```
 *
 * @example
 * With content offset (for headers above the list):
 * ```html
 * <vdnd-virtual-viewport
 *   [itemHeight]="50"
 *   [totalItems]="items().length"
 *   [contentOffset]="headerHeight()"
 *   style="height: 100%;">
 *   <div class="header" [style.height.px]="headerHeight()">Header</div>
 *   <ng-container *vdndVirtualFor="...">
 *     ...
 *   </ng-container>
 * </vdnd-virtual-viewport>
 * ```
 */
@Component({
  selector: 'vdnd-virtual-viewport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: VDND_VIRTUAL_VIEWPORT, useExisting: VirtualViewportComponent },
    { provide: VDND_SCROLL_CONTAINER, useExisting: VirtualViewportComponent },
  ],
  host: {
    class: 'vdnd-virtual-viewport',
    '[style.display]': '"block"',
    '[style.overflow]': '"auto"',
    '[style.position]': '"relative"',
    // Disable browser scroll anchoring to prevent scroll position adjustments
    // when DOM changes (e.g., placeholder position updates during drag)
    '[style.overflow-anchor]': '"none"',
  },
  template: `
    <!-- Spacer maintains total scroll height -->
    <div
      class="vdnd-viewport-spacer"
      [style.position]="'absolute'"
      [style.top.px]="contentOffset()"
      [style.left.px]="0"
      [style.width.px]="1"
      [style.height.px]="totalHeight()"
      [style.visibility]="'hidden'"
      [style.pointer-events]="'none'"
    ></div>

    <!-- Content wrapper with GPU-accelerated transform -->
    <div
      class="vdnd-viewport-content"
      [style.position]="'absolute'"
      [style.top.px]="contentOffset()"
      [style.left.px]="0"
      [style.right.px]="0"
      [style.will-change]="'transform'"
      [style.transform]="contentTransform()"
    >
      <ng-content></ng-content>
    </div>
  `,
})
export class VirtualViewportComponent
  implements VdndVirtualViewport, VdndScrollContainer, OnInit, OnDestroy
{
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #ngZone = inject(NgZone);
  readonly #autoScrollService = inject(AutoScrollService);

  /** Current scroll position (reactive) */
  readonly #scrollTop = signal(0);

  /** Measured container height (reactive) */
  readonly #containerHeight = signal(0);

  /** Cleanup function for scroll listener */
  #scrollCleanup: (() => void) | null = null;
  #resizeCleanup: (() => void) | null = null;

  /** Generated ID for auto-scroll registration */
  #generatedScrollId = `vdnd-viewport-${Math.random().toString(36).slice(2, 9)}`;

  /**
   * The actual first rendered item index, set by VirtualForDirective.
   * This accounts for overscan and is used for wrapper positioning.
   */
  readonly #renderStartIndex = signal(0);

  // ========== Inputs ==========

  /** Height of each item in pixels */
  itemHeight = input.required<number>();

  /** Total number of items */
  totalItems = input.required<number>();

  /** Offset for content below headers (in pixels) */
  contentOffset = input<number>(0);

  /** Unique ID for this scroll container (used for auto-scroll registration) */
  scrollContainerId = input<string>();

  /** Whether auto-scroll is enabled when dragging near edges */
  autoScrollEnabled = input<boolean>(true);

  /** Auto-scroll configuration */
  autoScrollConfig = input<Partial<AutoScrollConfig>>({});

  // ========== Computed Values ==========

  /** Total height of all items (for scroll height) */
  readonly totalHeight = computed(() => this.totalItems() * this.itemHeight());

  /** Transform for content wrapper positioning */
  readonly contentTransform = computed(() => {
    const startIndex = this.#renderStartIndex();
    const itemHeight = this.itemHeight();
    return `translateY(${startIndex * itemHeight}px)`;
  });

  // ========== VdndVirtualViewport Implementation ==========

  scrollTop(): number {
    return this.#scrollTop();
  }

  containerHeight(): number {
    return this.#containerHeight();
  }

  get nativeElement(): HTMLElement {
    return this.#elementRef.nativeElement;
  }

  /**
   * Called by VirtualForDirective to inform this viewport of the actual
   * first rendered item index. Used for wrapper positioning.
   */
  setRenderStartIndex(index: number): void {
    this.#renderStartIndex.set(index);
  }

  // ========== VdndScrollContainer Implementation ==========

  scrollTo(options: ScrollToOptions): void {
    this.nativeElement.scrollTo(options);
  }

  scrollBy(delta: number): void {
    const newPosition = Math.max(
      0,
      Math.min(
        this.scrollTop() + delta,
        this.nativeElement.scrollHeight - this.nativeElement.clientHeight,
      ),
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
    this.#resizeCleanup?.();
    this.#unregisterAutoScroll();
  }

  // ========== Private Methods ==========

  /** Minimum scroll delta (px) to trigger signal update */
  readonly #scrollThreshold = 5;

  #setupScrollListener(): void {
    this.#scrollCleanup = bindRafThrottledScrollTopSignal({
      element: this.nativeElement,
      ngZone: this.#ngZone,
      scrollTop: this.#scrollTop,
      thresholdPx: this.#scrollThreshold,
    });
  }

  #setupResizeObserver(): void {
    this.#resizeCleanup = bindResizeObserverHeightSignal({
      element: this.nativeElement,
      ngZone: this.#ngZone,
      height: this.#containerHeight,
      minDeltaPx: 1,
    });
  }

  #registerAutoScroll(): void {
    if (this.autoScrollEnabled()) {
      const id = this.scrollContainerId() ?? this.#generatedScrollId;
      this.#autoScrollService.registerContainer(id, this.nativeElement, this.autoScrollConfig());
    }
  }

  #unregisterAutoScroll(): void {
    const id = this.scrollContainerId() ?? this.#generatedScrollId;
    this.#autoScrollService.unregisterContainer(id);
  }
}
