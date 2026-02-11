import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { VDND_VIRTUAL_VIEWPORT, VdndVirtualViewport } from '../tokens/virtual-viewport.token';
import { VDND_SCROLL_CONTAINER, VdndScrollContainer } from '../tokens/scroll-container.token';
import type { VirtualScrollStrategy } from '../models/virtual-scroll-strategy';
import { FixedHeightStrategy } from '../strategies/fixed-height.strategy';
import { DynamicHeightStrategy } from '../strategies/dynamic-height.strategy';

/**
 * A virtual content component that provides wrapper-based positioning
 * for virtual scrolling within an EXTERNAL scroll container.
 *
 * Use this component when you need virtual scrolling alongside other content
 * (headers, footers) within a shared scroll container. The component provides
 * a content wrapper with GPU-accelerated transform positioning while delegating
 * scroll handling to the parent `vdndScrollable` container.
 *
 * @example
 * Mixed content with header and footer:
 * ```html
 * <div vdndScrollable style="overflow: auto; height: 100vh;">
 *   <!-- Header that scrolls away -->
 *   <div class="header" #header>Welcome!</div>
 *
 *   <!-- Virtual list with wrapper positioning -->
 *   <vdnd-virtual-content
 *     [itemHeight]="50"
 *     [totalItems]="items().length"
 *     [contentOffset]="header.offsetHeight">
 *     <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *       <div class="item">{{ item.name }}</div>
 *     </ng-container>
 *   </vdnd-virtual-content>
 *
 *   <!-- Footer at the end -->
 *   <div class="footer">Load more</div>
 * </div>
 * ```
 */
@Component({
  selector: 'vdnd-virtual-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: VDND_VIRTUAL_VIEWPORT, useExisting: VirtualContentComponent },
    { provide: VDND_SCROLL_CONTAINER, useExisting: VirtualContentComponent },
  ],
  host: {
    class: 'vdnd-virtual-content',
    '[style.display]': '"block"',
    '[style.position]': '"relative"',
    '[attr.data-content-offset]': 'contentOffset()',
    '[attr.data-item-height]': 'itemHeight()',
  },
  template: `
    <!-- Spacer maintains scroll height for the virtual list portion -->
    <div
      class="vdnd-content-spacer"
      [style.position]="'absolute'"
      [style.top.px]="0"
      [style.left.px]="0"
      [style.width.px]="1"
      [style.height.px]="totalHeight()"
      [style.visibility]="'hidden'"
      [style.pointer-events]="'none'"
    ></div>

    <!-- Content wrapper with GPU-accelerated transform -->
    <div
      class="vdnd-content-wrapper"
      [style.position]="'absolute'"
      [style.top.px]="0"
      [style.left.px]="0"
      [style.right.px]="0"
      [style.will-change]="'transform'"
      [style.transform]="contentTransform()"
    >
      <ng-content></ng-content>
    </div>
  `,
})
export class VirtualContentComponent implements VdndVirtualViewport, VdndScrollContainer {
  readonly #elementRef = inject(ElementRef<HTMLElement>);

  /**
   * The parent scroll container injected via skip-self to get the actual scrollable element.
   * We provide our own VDND_SCROLL_CONTAINER with adjusted values to children.
   */
  readonly #parentScrollContainer = inject(VDND_SCROLL_CONTAINER, { skipSelf: true });

  // ========== Inputs ==========

  /** Height of each item in pixels (used as estimate in dynamic mode) */
  itemHeight = input.required<number>();

  /** Total number of items */
  totalItems = input.required<number>();

  /** Offset for content above the virtual list (e.g., header height) */
  contentOffset = input<number>(0);

  /**
   * Enable dynamic item height mode.
   * When true, items are auto-measured via ResizeObserver and `itemHeight`
   * serves as the initial estimate for unmeasured items.
   */
  dynamicItemHeight = input<boolean>(false);

  // ========== Internal State ==========

  /**
   * The actual first rendered item index, set by VirtualForDirective.
   * This accounts for overscan and is used for wrapper positioning.
   */
  readonly #renderStartIndex = signal(0);

  // ========== Strategy ==========

  /** The virtual scroll strategy, created based on dynamicItemHeight input */
  readonly #strategy = computed<VirtualScrollStrategy>(() => {
    const height = this.itemHeight();
    return this.dynamicItemHeight()
      ? new DynamicHeightStrategy(height)
      : new FixedHeightStrategy(height);
  });

  get strategy(): VirtualScrollStrategy {
    return this.#strategy();
  }

  // ========== Computed Values ==========

  /** Total height of all items (for scroll height) */
  readonly totalHeight = computed(() => {
    const s = this.#strategy();
    return s.getTotalHeight(this.totalItems());
  });

  /**
   * Adjusted scroll position - subtracts the content offset so the virtual scroll
   * calculates visible items correctly relative to where the list starts.
   */
  readonly #adjustedScrollTop = computed(() => {
    return Math.max(0, this.#parentScrollContainer.scrollTop() - this.contentOffset());
  });

  /** Transform for content wrapper positioning */
  readonly contentTransform = computed(() => {
    const startIndex = this.#renderStartIndex();
    const s = this.#strategy();
    const offset = s.getOffsetForIndex(startIndex);
    return `translateY(${offset}px)`;
  });

  // ========== VdndVirtualViewport Implementation ==========

  /** Adjusted scroll position relative to the virtual list start */
  scrollTop(): number {
    return this.#adjustedScrollTop();
  }

  containerHeight(): number {
    return this.#parentScrollContainer.containerHeight();
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

  getOffsetForIndex(index: number): number {
    return this.#strategy().getOffsetForIndex(index);
  }

  // ========== VdndScrollContainer Implementation ==========

  /**
   * Scroll to a specific position, adjusting for content offset.
   */
  scrollTo(options: ScrollToOptions): void {
    const adjustedOptions = { ...options };
    if (adjustedOptions.top !== undefined) {
      // Add offset back when scrolling to ensure correct position
      adjustedOptions.top += this.contentOffset();
    }
    this.#parentScrollContainer.scrollTo(adjustedOptions);
  }
}
