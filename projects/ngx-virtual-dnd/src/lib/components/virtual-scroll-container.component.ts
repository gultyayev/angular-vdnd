import {
  afterNextRender,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DragStateService } from '../services/drag-state.service';
import { AutoScrollConfig, AutoScrollService } from '../services/auto-scroll.service';
import { DragPlaceholderComponent } from './drag-placeholder.component';
import {
  bindRafThrottledScrollTopSignal,
  bindResizeObserverHeightSignal,
} from '../utils/dom-signal-bindings';

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
  imports: [NgTemplateOutlet, DragPlaceholderComponent],
  host: {
    class: 'vdnd-virtual-scroll',
    '[style.height.px]': 'containerHeight() ?? null',
    '[style.overflow]': '"auto"',
    '[style.position]': '"relative"',
    '[attr.data-item-height]': 'itemHeight()',
  },
  template: `
    <div class="vdnd-virtual-scroll-content">
      <!-- Single spacer maintains scroll height -->
      <div class="vdnd-virtual-scroll-spacer" [style.height.px]="totalHeight()"></div>

      <!-- Content wrapper positioned via GPU-accelerated transform -->
      <div class="vdnd-virtual-scroll-content-wrapper" [style.transform]="contentTransform()">
        @for (entry of renderedItems(); track trackEntry($index, entry)) {
          @if (entry.type === 'placeholder') {
            <vdnd-drag-placeholder [itemHeight]="itemHeight()" />
          } @else {
            <ng-container
              *ngTemplateOutlet="
                itemTemplate();
                context: {
                  $implicit: entry.data,
                  index: entry.index,
                  isSticky: entry.isSticky,
                }
              "
            >
            </ng-container>
          }
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      /* Disable browser scroll anchoring - this prevents scroll position from being
         adjusted when the DOM changes (e.g., when placeholder position updates).
         Without this, autoscroll UP would fight with browser's scroll restoration. */
      overflow-anchor: none;
    }

    .vdnd-virtual-scroll-content {
      position: relative;
      width: 100%;
    }

    .vdnd-virtual-scroll-spacer {
      /* Invisible spacer that maintains scroll height */
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      visibility: hidden;
      pointer-events: none;
    }

    .vdnd-virtual-scroll-content-wrapper {
      /* GPU-accelerated positioning */
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      will-change: transform;
    }
  `,
})
export class VirtualScrollContainerComponent<T> implements OnInit, AfterViewInit, OnDestroy {
  readonly #dragState = inject(DragStateService);
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #autoScrollService = inject(AutoScrollService);
  readonly #ngZone = inject(NgZone);
  readonly #injector = inject(Injector);

  /** Cleanup function for scroll listener */
  #scrollCleanup: (() => void) | null = null;
  #resizeCleanup: (() => void) | null = null;

  /** Measured height from ResizeObserver (used when containerHeight is not provided) */
  readonly #measuredHeight = signal(0);

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

  /**
   * Track-by function for the @for loop.
   * Optional - if not provided, will be derived from itemIdFn.
   */
  trackByFn = input<(index: number, item: T) => string | number>();

  /**
   * ID of the droppable this virtual scroll belongs to.
   * Required for placeholder positioning.
   */
  droppableId = input<string>();

  /**
   * Whether to automatically add the dragged item to the sticky list.
   * This ensures the dragged item remains visible during virtual scrolling.
   * @default true
   */
  autoStickyDraggedItem = input<boolean>(true);

  /**
   * Effective track-by function - uses provided trackByFn or derives from itemIdFn.
   */
  protected readonly effectiveTrackByFn = computed(() => {
    const userFn = this.trackByFn();
    if (userFn) return userFn;

    const idFn = this.itemIdFn();
    return (_index: number, item: T) => idFn(item);
  });

  /**
   * Track function for rendered entries (items + placeholder).
   */
  protected trackEntry(
    _index: number,
    entry: { type: 'item' | 'placeholder'; data: T | null; index: number },
  ): string | number {
    if (entry.type === 'placeholder') {
      return '__placeholder__';
    }
    const trackFn = this.effectiveTrackByFn();
    return trackFn(entry.index, entry.data as T);
  }

  /**
   * Effective sticky item IDs - combines user-provided IDs with auto-sticky dragged item.
   */
  protected readonly effectiveStickyIds = computed(() => {
    const userIds = this.stickyItemIds();

    if (!this.autoStickyDraggedItem()) {
      return userIds;
    }

    const draggedId = this.draggedItemId();
    if (!draggedId) {
      return userIds;
    }

    // Avoid creating new array if dragged ID is already in the list
    if (userIds.includes(draggedId)) {
      return userIds;
    }

    return [...userIds, draggedId];
  });

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
    // Only subtract 1 if the dragged item belongs to THIS list (is in our items array).
    // Cross-list drags shouldn't affect the target list's height.
    const isDraggedItemInThisList = draggedId !== null && this.#itemIndexMap().has(draggedId);
    const effectiveCount = isDraggedItemInThisList ? count - 1 : count;
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

  /** Transform offset for content wrapper (position of first rendered item) */
  protected readonly contentTransform = computed(() => {
    const { start } = this.#renderRange();
    const draggedIndex = this.#draggedItemIndex();
    // If dragged item is in the unrendered top section, subtract 1 (it's position:absolute)
    const adjustment = draggedIndex >= 0 && draggedIndex < start ? 1 : 0;
    const offset = Math.max(0, start - adjustment) * this.itemHeight();
    return `translateY(${offset}px)`;
  });

  /** The ID of the currently dragged item (if any) */
  protected readonly draggedItemId = computed(() => {
    return this.#dragState.draggedItem()?.draggableId ?? null;
  });

  /** Map of item IDs to their indices - rebuilt only when items() changes (O(n) once, then O(1) lookups) */
  readonly #itemIndexMap = computed(() => {
    const items = this.items();
    const idFn = this.itemIdFn();
    const map = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      map.set(idFn(items[i]), i);
    }
    return map;
  });

  /** The index of the currently dragged item in the items array (-1 if not found or not dragging) */
  readonly #draggedItemIndex = computed(() => {
    const draggedId = this.draggedItemId();
    if (!draggedId) return -1;
    return this.#itemIndexMap().get(draggedId) ?? -1;
  });

  /** Memoized Set of sticky IDs - rebuilt only when effectiveStickyIds() changes */
  readonly #stickyIdsSet = computed(() => new Set(this.effectiveStickyIds()));

  /** Whether the placeholder should be shown in this container */
  protected readonly shouldShowPlaceholder = computed(() => {
    if (!this.#dragState.isDragging()) return false;
    return this.#dragState.activeDroppableId() === this.droppableId();
  });

  /** The placeholder index when placeholder should be shown */
  protected readonly placeholderIndex = computed(() => {
    if (!this.shouldShowPlaceholder()) return -1;
    return this.#dragState.placeholderIndex() ?? -1;
  });

  /** Items to render, including sticky items and placeholder */
  protected readonly renderedItems = computed(() => {
    const items = this.items();
    const { start, end } = this.#renderRange();
    const stickyIds = this.#stickyIdsSet();
    const idFn = this.itemIdFn();
    const itemIndexMap = this.#itemIndexMap();
    const draggedId = this.draggedItemId();
    const placeholderIdx = this.placeholderIndex();

    const result: {
      type: 'item' | 'placeholder';
      data: T | null;
      index: number;
      isSticky: boolean;
      isDragging: boolean;
    }[] = [];
    const renderedIds = new Set<string>();
    let hasPlaceholder = false;

    // Add all items in the visible range, inserting placeholder at correct position
    for (let i = start; i <= end && i < items.length; i++) {
      // Insert placeholder before item at placeholderIndex
      if (placeholderIdx === i && !hasPlaceholder) {
        result.push({
          type: 'placeholder',
          data: null,
          index: placeholderIdx,
          isSticky: false,
          isDragging: false,
        });
        hasPlaceholder = true;
      }

      const item = items[i];
      const id = idFn(item);
      result.push({
        type: 'item',
        data: item,
        index: i,
        isSticky: stickyIds.has(id),
        isDragging: id === draggedId,
      });
      renderedIds.add(id);
    }

    // If placeholder is at the end (after all items), add it
    if (placeholderIdx >= items.length && placeholderIdx >= 0 && !hasPlaceholder) {
      result.push({
        type: 'placeholder',
        data: null,
        index: placeholderIdx,
        isSticky: false,
        isDragging: false,
      });
      hasPlaceholder = true;
    }

    // Add any sticky items that aren't already rendered
    const missingStickyIndices: { id: string; index: number }[] = [];
    for (const id of stickyIds) {
      if (renderedIds.has(id)) continue;
      const index = itemIndexMap.get(id);
      if (index === undefined) continue;
      missingStickyIndices.push({ id, index });
    }
    if (missingStickyIndices.length > 1) {
      missingStickyIndices.sort((a, b) => a.index - b.index);
    }

    for (const { id, index } of missingStickyIndices) {
      const item = items[index];
      if (item === undefined) continue;
      result.push({
        type: 'item',
        data: item,
        index,
        isSticky: true,
        isDragging: id === draggedId,
      });
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

    // Keyboard drag autoscroll: scroll to keep target index visible
    effect(() => {
      // Only apply when this droppable is active during keyboard drag
      if (!this.#dragState.isKeyboardDrag()) return;
      const activeDroppable = this.#dragState.activeDroppableId();
      if (activeDroppable !== this.droppableId()) return;

      const targetIndex = this.#dragState.keyboardTargetIndex();
      if (targetIndex === null) return;

      const itemHeight = this.itemHeight();
      const height = this.effectiveHeight();
      if (height <= 0) return;

      const element = this.#elementRef.nativeElement;
      const currentScrollTop = element.scrollTop;

      // Calculate target item position
      const targetTop = targetIndex * itemHeight;
      const targetBottom = targetTop + itemHeight;

      // Calculate visible range
      const viewportTop = currentScrollTop;
      const viewportBottom = currentScrollTop + height;

      // Check if target is fully visible
      if (targetTop < viewportTop) {
        // Target is above viewport - scroll up
        element.scrollTop = targetTop;
        this.#scrollTop.set(targetTop);
      } else if (targetBottom > viewportBottom) {
        // Target is below viewport - scroll down
        const newScrollTop = targetBottom - height;
        element.scrollTop = newScrollTop;
        this.#scrollTop.set(newScrollTop);
      }
    });

    // Preserve scroll position when drag ends at bottom of list
    // During drag, totalHeight is reduced by 1 item (dragged item is hidden)
    // When drag ends, totalHeight increases - we need to adjust scroll if we were at bottom
    effect(() => {
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
          afterNextRender(
            () => {
              const newMaxScroll = Math.max(0, totalItems * itemHeight - height);
              element.scrollTop = newMaxScroll;
              this.#scrollTop.set(newMaxScroll);
            },
            { injector: this.#injector },
          );
        }
      }

      this.#previousDraggedId = currentDraggedId;
    });
  }

  ngOnInit(): void {
    // Register with auto-scroll service
    if (this.autoScrollEnabled()) {
      const id = this.scrollContainerId() ?? this.#generatedScrollId;
      this.#autoScrollService.registerContainer(
        id,
        this.#elementRef.nativeElement,
        this.autoScrollConfig(),
      );
    }
  }

  ngAfterViewInit(): void {
    const element = this.#elementRef.nativeElement;

    this.#resizeCleanup = bindResizeObserverHeightSignal({
      element,
      ngZone: this.#ngZone,
      height: this.#measuredHeight,
      minDeltaPx: 1,
    });

    // Scroll listener outside Angular zone with RAF throttling.
    // This avoids template event binding which would mark the component dirty 60x/sec.
    this.#scrollCleanup = bindRafThrottledScrollTopSignal({
      element,
      ngZone: this.#ngZone,
      scrollTop: this.#scrollTop,
      thresholdPx: 5,
      onCommit: (newScrollTop) => {
        this.scrollPositionChange.emit(newScrollTop);
      },
    });
  }

  ngOnDestroy(): void {
    this.#scrollCleanup?.();
    this.#resizeCleanup?.();

    // Unregister from auto-scroll service
    const id = this.scrollContainerId() ?? this.#generatedScrollId;
    this.#autoScrollService.unregisterContainer(id);
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
      Math.min(this.getScrollTop() + delta, this.getScrollHeight() - this.effectiveHeight()),
    );
    this.scrollTo(newPosition);
  }
}
