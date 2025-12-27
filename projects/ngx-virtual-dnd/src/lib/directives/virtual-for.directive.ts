import {
  computed,
  Directive,
  effect,
  ElementRef,
  EmbeddedViewRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { DragStateService } from '../services/drag-state.service';

/**
 * Context provided to the template for each virtual item.
 */
export interface VirtualForContext<T> {
  /** The item data (also available as implicit context) */
  $implicit: T;
  /** The item's index in the original array (-1 for placeholders) */
  index: number;
  /** Whether this is the first visible item */
  first: boolean;
  /** Whether this is the last visible item */
  last: boolean;
  /** Count of total items */
  count: number;
  /** Whether this item is an auto-inserted placeholder */
  isPlaceholder?: boolean;
}

/**
 * A structural directive for virtual scrolling within custom scroll containers.
 * Provides maximum flexibility for advanced use cases where the component wrapper
 * is not suitable.
 *
 * The directive must be placed inside a scrollable container (overflow: auto/scroll).
 * It will automatically detect the scroll container and manage virtual rendering.
 *
 * @example
 * ```html
 * <div class="custom-scroll-container" style="overflow: auto; height: 400px">
 *   <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *     <div class="item">{{ item.name }}</div>
 *   </ng-container>
 * </div>
 * ```
 *
 * @example
 * With placeholder support:
 * ```html
 * <div class="scroll-container" style="overflow: auto; height: 400px">
 *   <ng-container *vdndVirtualFor="
 *     let item of items();
 *     itemHeight: 50;
 *     trackBy: trackById;
 *     droppableId: 'list-1';
 *     let isPlaceholder = isPlaceholder
 *   ">
 *     @if (isPlaceholder) {
 *       <div class="placeholder"></div>
 *     } @else {
 *       <div class="item">{{ item.name }}</div>
 *     }
 *   </ng-container>
 * </div>
 * ```
 */
@Directive({
  selector: '[vdndVirtualFor][vdndVirtualForOf]',
})
export class VirtualForDirective<T> implements OnInit, OnDestroy {
  readonly #templateRef = inject(TemplateRef<VirtualForContext<T>>);
  readonly #viewContainer = inject(ViewContainerRef);
  readonly #elementRef = inject(ElementRef<Comment>);
  readonly #ngZone = inject(NgZone);
  readonly #dragState = inject(DragStateService);

  /** ResizeObserver for container height detection */
  #resizeObserver: ResizeObserver | null = null;

  /** Scroll event cleanup function */
  #scrollCleanup: (() => void) | null = null;

  /** The scrollable container element */
  #scrollContainer: HTMLElement | null = null;

  /** Current scroll position */
  readonly #scrollTop = signal(0);

  /** Measured container height */
  readonly #containerHeight = signal(0);

  /** Pool of views for reuse */
  readonly #viewPool: EmbeddedViewRef<VirtualForContext<T>>[] = [];

  /** Currently active views keyed by their track-by value */
  readonly #activeViews = new Map<unknown, EmbeddedViewRef<VirtualForContext<T>>>();

  // ========== Inputs ==========

  /** The array of items to iterate over */
  vdndVirtualForOf = input.required<T[]>();

  /** Height of each item in pixels */
  vdndVirtualForItemHeight = input.required<number>();

  /** Track-by function for efficient updates */
  vdndVirtualForTrackBy = input.required<(index: number, item: T) => unknown>();

  /** Number of items to render outside the visible area */
  vdndVirtualForOverscan = input<number>(3);

  /** Droppable ID for auto-placeholder support */
  vdndVirtualForDroppableId = input<string>();

  /** Whether to auto-insert placeholder */
  vdndVirtualForAutoPlaceholder = input<boolean>(true);

  // ========== Computed Values ==========

  /** Total height of all items */
  readonly #totalHeight = computed(() => {
    return this.vdndVirtualForOf().length * this.vdndVirtualForItemHeight();
  });

  /** First visible item index */
  readonly #firstVisibleIndex = computed(() => {
    const itemHeight = this.vdndVirtualForItemHeight();
    if (itemHeight <= 0) return 0;
    return Math.floor(this.#scrollTop() / itemHeight);
  });

  /** Number of visible items */
  readonly #visibleCount = computed(() => {
    const height = this.#containerHeight();
    const itemHeight = this.vdndVirtualForItemHeight();
    if (height <= 0 || itemHeight <= 0) return 0;
    return Math.ceil(height / itemHeight);
  });

  /** Range of items to render */
  readonly #renderRange = computed(() => {
    const first = this.#firstVisibleIndex();
    const visible = this.#visibleCount();
    const overscan = this.vdndVirtualForOverscan();
    const total = this.vdndVirtualForOf().length;

    const start = Math.max(0, first - overscan);
    const end = Math.min(total - 1, first + visible + overscan);

    return { start, end };
  });

  /** Whether placeholder should be shown */
  readonly #shouldShowPlaceholder = computed(() => {
    if (!this.vdndVirtualForAutoPlaceholder()) return false;
    const droppableId = this.vdndVirtualForDroppableId();
    if (!droppableId) return false;
    return this.#dragState.activeDroppableId() === droppableId;
  });

  /** Placeholder index if applicable */
  readonly #placeholderIndex = computed(() => {
    if (!this.#shouldShowPlaceholder()) return null;
    return this.#dragState.placeholderIndex();
  });

  constructor() {
    // React to changes and update views
    effect(() => {
      this.#updateViews();
    });
  }

  ngOnInit(): void {
    this.#findScrollContainer();
    this.#setupScrollListener();
    this.#setupResizeObserver();
    this.#updateSpacers();
  }

  ngOnDestroy(): void {
    this.#scrollCleanup?.();
    this.#resizeObserver?.disconnect();
    this.#viewPool.forEach((view) => view.destroy());
    this.#activeViews.forEach((view) => view.destroy());
  }

  /**
   * Find the nearest scrollable ancestor.
   */
  #findScrollContainer(): void {
    let element = this.#elementRef.nativeElement.parentElement;

    while (element) {
      const style = getComputedStyle(element);
      if (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll' ||
        style.overflow === 'auto' ||
        style.overflow === 'scroll'
      ) {
        this.#scrollContainer = element;
        return;
      }
      element = element.parentElement;
    }

    console.warn('[vdndVirtualFor] No scrollable container found. Virtual scrolling may not work correctly.');
  }

  /**
   * Set up scroll event listener.
   */
  #setupScrollListener(): void {
    if (!this.#scrollContainer) return;

    const onScroll = () => {
      this.#ngZone.run(() => {
        this.#scrollTop.set(this.#scrollContainer!.scrollTop);
      });
    };

    this.#ngZone.runOutsideAngular(() => {
      this.#scrollContainer!.addEventListener('scroll', onScroll, { passive: true });
    });

    this.#scrollCleanup = () => {
      this.#scrollContainer?.removeEventListener('scroll', onScroll);
    };
  }

  /**
   * Set up resize observer for container.
   */
  #setupResizeObserver(): void {
    if (!this.#scrollContainer) return;

    this.#ngZone.runOutsideAngular(() => {
      this.#resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          if (Math.abs(height - this.#containerHeight()) > 1) {
            this.#ngZone.run(() => {
              this.#containerHeight.set(height);
            });
          }
        }
      });
      this.#resizeObserver.observe(this.#scrollContainer!);
    });

    // Initial height measurement
    this.#containerHeight.set(this.#scrollContainer.clientHeight);
  }

  /**
   * Update spacer elements.
   */
  #updateSpacers(): void {
    // Create top spacer
    const topSpacer = document.createElement('div');
    topSpacer.className = 'vdnd-virtual-for-spacer-top';
    topSpacer.style.height = '0px';

    // Create bottom spacer
    const bottomSpacer = document.createElement('div');
    bottomSpacer.className = 'vdnd-virtual-for-spacer-bottom';
    bottomSpacer.style.height = '0px';

    // Insert spacers
    const comment = this.#elementRef.nativeElement;
    comment.parentNode?.insertBefore(topSpacer, comment);
    comment.parentNode?.appendChild(bottomSpacer);

    // Update spacer heights reactively
    effect(() => {
      const { start, end } = this.#renderRange();
      const itemHeight = this.vdndVirtualForItemHeight();
      const total = this.vdndVirtualForOf().length;

      topSpacer.style.height = `${start * itemHeight}px`;
      bottomSpacer.style.height = `${Math.max(0, total - end - 1) * itemHeight}px`;
    });
  }

  /**
   * Update the rendered views.
   */
  #updateViews(): void {
    const items = this.vdndVirtualForOf();
    const { start, end } = this.#renderRange();
    const trackByFn = this.vdndVirtualForTrackBy();
    const placeholderIndex = this.#placeholderIndex();

    // Collect keys that should be active
    const activeKeys = new Set<unknown>();

    // Clear view container but keep views in pool
    this.#activeViews.forEach((view, key) => {
      this.#viewPool.push(view);
      this.#activeViews.delete(key);
    });
    this.#viewContainer.clear();

    let viewIndex = 0;

    // Render items in range with placeholder
    for (let i = start; i <= end && i < items.length; i++) {
      // Insert placeholder before this item if needed
      if (placeholderIndex !== null && placeholderIndex === i) {
        const placeholderContext: VirtualForContext<T> = {
          $implicit: { __vdndPlaceholder: true } as unknown as T,
          index: -1,
          first: false,
          last: false,
          count: items.length,
          isPlaceholder: true,
        };
        const placeholderView = this.#getOrCreateView('__placeholder__', placeholderContext);
        this.#viewContainer.insert(placeholderView, viewIndex++);
        activeKeys.add('__placeholder__');
      }

      const item = items[i];
      const key = trackByFn(i, item);
      const context: VirtualForContext<T> = {
        $implicit: item,
        index: i,
        first: i === start,
        last: i === end || i === items.length - 1,
        count: items.length,
        isPlaceholder: false,
      };

      const view = this.#getOrCreateView(key, context);
      this.#viewContainer.insert(view, viewIndex++);
      activeKeys.add(key);
    }

    // Insert placeholder at end if needed
    if (placeholderIndex !== null && placeholderIndex >= items.length) {
      const placeholderContext: VirtualForContext<T> = {
        $implicit: { __vdndPlaceholder: true } as unknown as T,
        index: -1,
        first: false,
        last: true,
        count: items.length,
        isPlaceholder: true,
      };
      const placeholderView = this.#getOrCreateView('__placeholder__', placeholderContext);
      this.#viewContainer.insert(placeholderView, viewIndex++);
    }

    // Destroy unused views in pool (keep some for reuse)
    while (this.#viewPool.length > 10) {
      const view = this.#viewPool.pop();
      view?.destroy();
    }
  }

  /**
   * Get an existing view from pool or create a new one.
   */
  #getOrCreateView(key: unknown, context: VirtualForContext<T>): EmbeddedViewRef<VirtualForContext<T>> {
    // Check if we have this view active already
    let view = this.#activeViews.get(key);
    if (view) {
      // Update context
      Object.assign(view.context, context);
      view.markForCheck();
      return view;
    }

    // Try to reuse from pool
    view = this.#viewPool.pop();
    if (view) {
      Object.assign(view.context, context);
      view.markForCheck();
    } else {
      // Create new view
      view = this.#templateRef.createEmbeddedView(context);
    }

    this.#activeViews.set(key, view);
    return view;
  }

  /**
   * Static method for Angular's structural directive microsyntax.
   */
  static ngTemplateContextGuard<T>(
    _dir: VirtualForDirective<T>,
    _ctx: unknown
  ): _ctx is VirtualForContext<T> {
    return true;
  }
}
