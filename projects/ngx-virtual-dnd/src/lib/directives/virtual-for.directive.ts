import {
  computed,
  Directive,
  effect,
  ElementRef,
  EmbeddedViewRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import { DragStateService } from '../services/drag-state.service';
import { VDND_SCROLL_CONTAINER } from '../tokens/scroll-container.token';

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
 * The directive must be placed inside a container marked with the `vdndScrollable`
 * directive, which provides the scroll container context via dependency injection.
 *
 * @example
 * Basic usage:
 * ```html
 * <div vdndScrollable style="overflow: auto; height: 400px">
 *   <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *     <div class="item">{{ item.name }}</div>
 *   </ng-container>
 * </div>
 * ```
 *
 * @example
 * With Ionic ion-content:
 * ```html
 * <ion-content vdndScrollable class="ion-content-scroll-host">
 *   <ng-container *vdndVirtualFor="let item of items(); itemHeight: 50; trackBy: trackById">
 *     <div class="item">{{ item.name }}</div>
 *   </ng-container>
 * </ion-content>
 * ```
 *
 * @example
 * With placeholder support:
 * ```html
 * <div vdndScrollable style="overflow: auto; height: 400px">
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
  readonly #dragState = inject(DragStateService);
  readonly #scrollContainer = inject(VDND_SCROLL_CONTAINER);

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

  /** First visible item index */
  readonly #firstVisibleIndex = computed(() => {
    const itemHeight = this.vdndVirtualForItemHeight();
    if (itemHeight <= 0) return 0;
    return Math.floor(this.#scrollContainer.scrollTop() / itemHeight);
  });

  /** Number of visible items */
  readonly #visibleCount = computed(() => {
    const height = this.#scrollContainer.containerHeight();
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
    this.#updateSpacers();
  }

  ngOnDestroy(): void {
    this.#viewPool.forEach((view) => view.destroy());
    this.#activeViews.forEach((view) => view.destroy());
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
  #getOrCreateView(
    key: unknown,
    context: VirtualForContext<T>,
  ): EmbeddedViewRef<VirtualForContext<T>> {
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
    _ctx: unknown,
  ): _ctx is VirtualForContext<T> {
    return true;
  }
}
