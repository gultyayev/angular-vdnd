import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DragStateService } from '../services/drag-state.service';

/**
 * Context provided to the item template.
 */
export interface VirtualScrollItemContext<T> {
  /** The item data */
  $implicit: T;
  /** The item's index in the original array */
  index: number;
  /** Whether this item is "sticky" (always rendered) */
  isSticky: boolean;
}

/**
 * Event emitted when the visible range changes.
 */
export interface VisibleRangeChange {
  start: number;
  end: number;
}

/**
 * A virtual scroll container that only renders visible items.
 *
 * Key features:
 * - Only renders items within the visible viewport plus an overscan buffer
 * - Supports "sticky" items that are always rendered (used for dragged items)
 * - Uses spacer divs to maintain correct scroll height
 * - Integrates with the drag-and-drop system
 *
 * @example
 * ```html
 * <vdnd-virtual-scroll
 *   [items]="items()"
 *   [itemHeight]="50"
 *   [containerHeight]="400"
 *   [trackByFn]="trackById">
 *   <ng-template let-item let-index="index">
 *     <div class="item">{{ item.name }}</div>
 *   </ng-template>
 * </vdnd-virtual-scroll>
 * ```
 */
@Component({
  selector: 'vdnd-virtual-scroll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'vdnd-virtual-scroll',
    '[style.height.px]': 'containerHeight()',
    '[style.overflow]': '"auto"',
    '[style.position]': '"relative"',
    '(scroll)': 'onScroll($event)',
  },
  template: `
    <div
      class="vdnd-virtual-scroll-content"
      #contentContainer
      [style.min-height.px]="totalHeight()">
      <!-- Spacer for items above viewport -->
      <div
        class="vdnd-virtual-scroll-spacer-top"
        [style.height.px]="topSpacerHeight()">
      </div>

      <!-- Rendered items -->
      @for (item of renderedItems(); track trackByFn()(item.index, item.data)) {
        <div
          class="vdnd-virtual-scroll-item"
          [class.vdnd-virtual-scroll-item-sticky]="item.isSticky"
          [style.height.px]="itemHeight()">
          <ng-container
            *ngTemplateOutlet="itemTemplate(); context: {
              $implicit: item.data,
              index: item.index,
              isSticky: item.isSticky
            }">
          </ng-container>
        </div>
      }

      <!-- Spacer for items below viewport -->
      <div
        class="vdnd-virtual-scroll-spacer-bottom"
        [style.height.px]="bottomSpacerHeight()">
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .vdnd-virtual-scroll-content {
      position: relative;
      width: 100%;
    }

    .vdnd-virtual-scroll-item {
      box-sizing: border-box;
    }
  `,
})
export class VirtualScrollContainerComponent<T> {
  private readonly dragState = inject(DragStateService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  /** The scrollable container element */
  protected readonly contentContainer = viewChild<ElementRef<HTMLElement>>('contentContainer');

  /** Template for rendering each item - passed as input instead of content child for reliability */
  itemTemplate = input.required<TemplateRef<VirtualScrollItemContext<T>>>();

  /** Array of items to render */
  items = input.required<T[]>();

  /** Height of each item in pixels */
  itemHeight = input.required<number>();

  /** Height of the container in pixels */
  containerHeight = input.required<number>();

  /** Number of items to render above/below the visible area */
  overscan = input<number>(3);

  /** IDs of items that should always be rendered (e.g., dragged items) */
  stickyItemIds = input<string[]>([]);

  /** Function to get a unique ID from an item */
  itemIdFn = input.required<(item: T) => string>();

  /** Track-by function for the @for loop */
  trackByFn = input.required<(index: number, item: T) => string | number>();

  /** Emits when the visible range changes */
  visibleRangeChange = output<VisibleRangeChange>();

  /** Emits when scroll position changes */
  scrollPositionChange = output<number>();

  /** Current scroll position */
  private readonly scrollTop = signal(0);

  /** Total height of all items (for scrollbar) */
  protected readonly totalHeight = computed(() => {
    return this.items().length * this.itemHeight();
  });

  /** First visible item index */
  private readonly firstVisibleIndex = computed(() => {
    return Math.floor(this.scrollTop() / this.itemHeight());
  });

  /** Number of items visible in the viewport */
  private readonly visibleCount = computed(() => {
    return Math.ceil(this.containerHeight() / this.itemHeight());
  });

  /** Range of items to render (with overscan) */
  private readonly renderRange = computed(() => {
    const first = this.firstVisibleIndex();
    const visible = this.visibleCount();
    const overscan = this.overscan();
    const total = this.items().length;

    const start = Math.max(0, first - overscan);
    const end = Math.min(total - 1, first + visible + overscan);

    return { start, end };
  });

  /** Height of the top spacer (unrendered items above) */
  protected readonly topSpacerHeight = computed(() => {
    return this.renderRange().start * this.itemHeight();
  });

  /** Height of the bottom spacer (unrendered items below) */
  protected readonly bottomSpacerHeight = computed(() => {
    const total = this.items().length;
    const end = this.renderRange().end;
    const unrenderedBelow = Math.max(0, total - end - 1);
    return unrenderedBelow * this.itemHeight();
  });

  /** Items to render, including sticky items */
  protected readonly renderedItems = computed(() => {
    const items = this.items();
    const { start, end } = this.renderRange();
    const stickyIds = new Set(this.stickyItemIds());
    const idFn = this.itemIdFn();

    const result: { data: T; index: number; isSticky: boolean }[] = [];
    const renderedIds = new Set<string>();

    // First, add all items in the visible range
    for (let i = start; i <= end && i < items.length; i++) {
      const item = items[i];
      const id = idFn(item);
      result.push({
        data: item,
        index: i,
        isSticky: stickyIds.has(id),
      });
      renderedIds.add(id);
    }

    // Then, add any sticky items that aren't already rendered
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = idFn(item);

      if (stickyIds.has(id) && !renderedIds.has(id)) {
        result.push({
          data: item,
          index: i,
          isSticky: true,
        });
        renderedIds.add(id);
      }
    }

    return result;
  });

  constructor() {
    // Emit visible range changes
    effect(() => {
      const range = this.renderRange();
      this.visibleRangeChange.emit(range);
    });
  }

  /**
   * Handle scroll events.
   */
  protected onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    const newScrollTop = target.scrollTop;

    // Only update if the scroll position has changed significantly
    // (at least 10% of an item height, to reduce updates)
    const threshold = Math.max(5, this.itemHeight() * 0.1);
    if (Math.abs(newScrollTop - this.scrollTop()) >= threshold) {
      this.scrollTop.set(newScrollTop);
      this.scrollPositionChange.emit(newScrollTop);
    }
  }

  /**
   * Scroll to a specific position.
   */
  scrollTo(position: number): void {
    this.elementRef.nativeElement.scrollTop = position;
    this.scrollTop.set(position);
  }

  /**
   * Scroll to a specific item index.
   */
  scrollToIndex(index: number): void {
    const position = index * this.itemHeight();
    this.scrollTo(position);
  }

  /**
   * Get the current scroll position.
   */
  getScrollTop(): number {
    return this.scrollTop();
  }

  /**
   * Get the total scrollable height.
   */
  getScrollHeight(): number {
    return this.totalHeight();
  }

  /**
   * Scroll by a delta amount.
   */
  scrollBy(delta: number): void {
    const newPosition = Math.max(
      0,
      Math.min(this.getScrollTop() + delta, this.getScrollHeight() - this.containerHeight())
    );
    this.scrollTo(newPosition);
  }
}
