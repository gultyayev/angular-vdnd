import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DragStateService } from '../services/drag-state.service';
import { AutoScrollService, AutoScrollConfig } from '../services/auto-scroll.service';

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
 * - Automatic height detection via ResizeObserver when containerHeight is not provided
 *
 * @example
 * ```html
 * <!-- With explicit height -->
 * <vdnd-virtual-scroll
 *   [items]="items()"
 *   [itemHeight]="50"
 *   [containerHeight]="400"
 *   [trackByFn]="trackById">
 *   <ng-template let-item let-index="index">
 *     <div class="item">{{ item.name }}</div>
 *   </ng-template>
 * </vdnd-virtual-scroll>
 *
 * <!-- With CSS-based height (auto-detected) -->
 * <vdnd-virtual-scroll
 *   style="height: 100%"
 *   [items]="items()"
 *   [itemHeight]="50"
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
    '[style.height.px]': 'containerHeight() ?? null',
    '[style.overflow]': '"auto"',
    '[style.position]': '"relative"',
    '[attr.data-item-height]': 'itemHeight()',
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
        <ng-container
          *ngTemplateOutlet="itemTemplate(); context: {
            $implicit: item.data,
            index: item.index,
            isSticky: item.isSticky
          }">
        </ng-container>
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
  `,
})
export class VirtualScrollContainerComponent<T> implements OnInit, AfterViewInit, OnDestroy {
  readonly #dragState = inject(DragStateService);
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #autoScrollService = inject(AutoScrollService);
  readonly #ngZone = inject(NgZone);

  /** ResizeObserver for automatic height detection */
  #resizeObserver: ResizeObserver | null = null;

  /** Measured height from ResizeObserver (used when containerHeight is not provided) */
  readonly #measuredHeight = signal(0);

  /** The scrollable container element */
  protected readonly contentContainer = viewChild<ElementRef<HTMLElement>>('contentContainer');

  /** Template for rendering each item - passed as input instead of content child for reliability */
  itemTemplate = input.required<TemplateRef<VirtualScrollItemContext<T>>>();

  /** Unique ID for this scroll container (used for auto-scroll registration) */
  scrollContainerId = input<string>();

  /** Whether auto-scroll is enabled when dragging near edges */
  autoScrollEnabled = input<boolean>(true);

  /** Auto-scroll configuration */
  autoScrollConfig = input<Partial<AutoScrollConfig>>({});

  /** Array of items to render */
  items = input.required<T[]>();

  /** Height of each item in pixels */
  itemHeight = input.required<number>();

  /**
   * Height of the container in pixels.
   * If not provided, the container will automatically measure its height from CSS.
   * This allows you to set the height via CSS (e.g., flex, height: 100%, etc.)
   * and the component will adapt automatically, including on resize.
   */
  containerHeight = input<number>();

  /**
   * Effective height used for calculations.
   * Uses explicit containerHeight if provided, otherwise uses measured height.
   */
  readonly effectiveHeight = computed(() => this.containerHeight() ?? this.#measuredHeight());

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
  readonly #scrollTop = signal(0);

  /** Total height of all items (for scrollbar) */
  protected readonly totalHeight = computed(() => {
    const count = this.items().length;
    const draggedId = this.draggedItemId();
    // Subtract 1 when dragging - the dragged item is position:absolute (out of flow)
    const effectiveCount = draggedId ? count - 1 : count;
    return effectiveCount * this.itemHeight();
  });

  /** First visible item index */
  readonly #firstVisibleIndex = computed(() => {
    return Math.floor(this.#scrollTop() / this.itemHeight());
  });

  /** Number of items visible in the viewport */
  readonly #visibleCount = computed(() => {
    const height = this.effectiveHeight();
    if (height <= 0) return 0;
    return Math.ceil(height / this.itemHeight());
  });

  /** Range of items to render (with overscan) */
  readonly #renderRange = computed(() => {
    const first = this.#firstVisibleIndex();
    const visible = this.#visibleCount();
    const overscan = this.overscan();
    const total = this.items().length;

    const start = Math.max(0, first - overscan);
    const end = Math.min(total - 1, first + visible + overscan);

    return { start, end };
  });

  /** Height of the top spacer (unrendered items above) */
  protected readonly topSpacerHeight = computed(() => {
    const { start } = this.#renderRange();
    const draggedIndex = this.#draggedItemIndex();
    // If dragged item is in the unrendered top section, subtract 1 (it's position:absolute)
    const adjustment = draggedIndex >= 0 && draggedIndex < start ? 1 : 0;
    return Math.max(0, start - adjustment) * this.itemHeight();
  });

  /** Height of the bottom spacer (unrendered items below) */
  protected readonly bottomSpacerHeight = computed(() => {
    const total = this.items().length;
    const { end } = this.#renderRange();
    const draggedIndex = this.#draggedItemIndex();
    const unrenderedBelow = Math.max(0, total - end - 1);
    // If dragged item is in the unrendered bottom section, subtract 1 (it's position:absolute)
    const adjustment = draggedIndex > end ? 1 : 0;
    return Math.max(0, unrenderedBelow - adjustment) * this.itemHeight();
  });

  /** The ID of the currently dragged item (if any) */
  protected readonly draggedItemId = computed(() => {
    return this.#dragState.draggedItem()?.draggableId ?? null;
  });

  /** The index of the currently dragged item in the items array (-1 if not found or not dragging) */
  readonly #draggedItemIndex = computed(() => {
    const draggedId = this.draggedItemId();
    if (!draggedId) return -1;

    const items = this.items();
    const idFn = this.itemIdFn();

    for (let i = 0; i < items.length; i++) {
      if (idFn(items[i]) === draggedId) {
        return i;
      }
    }
    return -1;
  });

  /** Items to render, including sticky items */
  protected readonly renderedItems = computed(() => {
    const items = this.items();
    const { start, end } = this.#renderRange();
    const stickyIds = new Set(this.stickyItemIds());
    const idFn = this.itemIdFn();
    const draggedId = this.draggedItemId();

    const result: { data: T; index: number; isSticky: boolean; isDragging: boolean }[] = [];
    const renderedIds = new Set<string>();

    // First, add all items in the visible range
    for (let i = start; i <= end && i < items.length; i++) {
      const item = items[i];
      const id = idFn(item);
      result.push({
        data: item,
        index: i,
        isSticky: stickyIds.has(id),
        isDragging: id === draggedId,
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
          isDragging: id === draggedId,
        });
        renderedIds.add(id);
      }
    }

    return result;
  });

  /** Generated ID for auto-scroll registration */
  #generatedScrollId = `vdnd-scroll-${Math.random().toString(36).slice(2, 9)}`;

  /** Track previous dragged ID to detect drag end */
  #previousDraggedId: string | null = null;

  constructor() {
    // Emit visible range changes
    effect(() => {
      const range = this.#renderRange();
      this.visibleRangeChange.emit(range);
    });

    // Preserve scroll position when drag ends at bottom of list
    // During drag, totalHeight is reduced by 1 item (dragged item is hidden)
    // When drag ends, totalHeight increases - we need to adjust scroll if we were at bottom
    effect(
      () => {
        const currentDraggedId = this.draggedItemId();
        const element = this.#elementRef.nativeElement;

        // Detect drag end (was dragging, now not)
        if (this.#previousDraggedId !== null && currentDraggedId === null) {
          const currentScrollTop = element.scrollTop;
          const itemHeight = this.itemHeight();
          const height = this.effectiveHeight();
          const totalItems = this.items().length;

          // Calculate if we were at/near bottom (within 10px tolerance)
          // During drag, max scroll was (totalItems - 1) * itemHeight - height
          const dragReducedMaxScroll = (totalItems - 1) * itemHeight - height;
          const wasAtBottom = currentScrollTop >= dragReducedMaxScroll - 10;

          if (wasAtBottom && dragReducedMaxScroll > 0) {
            // Adjust scroll to new bottom position after totalHeight increases
            queueMicrotask(() => {
              const newMaxScroll = Math.max(0, totalItems * itemHeight - height);
              element.scrollTop = newMaxScroll;
              this.#scrollTop.set(newMaxScroll);
            });
          }
        }

        this.#previousDraggedId = currentDraggedId;
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit(): void {
    // Register with auto-scroll service
    if (this.autoScrollEnabled()) {
      const id = this.scrollContainerId() ?? this.#generatedScrollId;
      this.#autoScrollService.registerContainer(
        id,
        this.#elementRef.nativeElement,
        this.autoScrollConfig()
      );
    }
  }

  ngAfterViewInit(): void {
    // Set up ResizeObserver for automatic height detection when containerHeight is not provided
    this.#ngZone.runOutsideAngular(() => {
      this.#resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          // Only update if height changed significantly (> 1px) to avoid loops
          if (Math.abs(height - this.#measuredHeight()) > 1) {
            this.#ngZone.run(() => {
              this.#measuredHeight.set(height);
            });
          }
        }
      });
      this.#resizeObserver.observe(this.#elementRef.nativeElement);
    });
  }

  ngOnDestroy(): void {
    // Clean up ResizeObserver
    this.#resizeObserver?.disconnect();

    // Unregister from auto-scroll service
    const id = this.scrollContainerId() ?? this.#generatedScrollId;
    this.#autoScrollService.unregisterContainer(id);
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
    if (Math.abs(newScrollTop - this.#scrollTop()) >= threshold) {
      this.#scrollTop.set(newScrollTop);
      this.scrollPositionChange.emit(newScrollTop);
    }
  }

  /**
   * Scroll to a specific position.
   */
  scrollTo(position: number): void {
    this.#elementRef.nativeElement.scrollTop = position;
    this.#scrollTop.set(position);
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
    return this.#scrollTop();
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
      Math.min(this.getScrollTop() + delta, this.getScrollHeight() - this.effectiveHeight())
    );
    this.scrollTo(newPosition);
  }
}
