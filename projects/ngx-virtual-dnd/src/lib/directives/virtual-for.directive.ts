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
  ViewContainerRef,
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

  /** Single spacer element for scroll height */
  #spacer: HTMLDivElement | null = null;

  /** Content wrapper for transform-based positioning */
  #wrapper: HTMLDivElement | null = null;

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

    // Clean up spacer and wrapper elements
    this.#spacer?.remove();
    this.#wrapper?.remove();
  }

  /**
   * Set up spacer and wrapper elements for transform-based positioning.
   */
  #updateSpacers(): void {
    // Create single spacer that maintains total scroll height
    const spacer = document.createElement('div');
    spacer.className = 'vdnd-virtual-for-spacer';
    spacer.style.cssText =
      'position: absolute; top: 0; left: 0; width: 1px; visibility: hidden; pointer-events: none;';

    // Create content wrapper for GPU-accelerated transform positioning
    const wrapper = document.createElement('div');
    wrapper.className = 'vdnd-virtual-for-content-wrapper';
    wrapper.style.cssText =
      'position: absolute; top: 0; left: 0; right: 0; will-change: transform;';

    // Insert elements before the directive's anchor comment
    const comment = this.#elementRef.nativeElement;
    comment.parentNode?.insertBefore(spacer, comment);
    comment.parentNode?.insertBefore(wrapper, comment);

    this.#spacer = spacer;
    this.#wrapper = wrapper;

    // Update spacer height and wrapper transform reactively
    effect(() => {
      const { start } = this.#renderRange();
      const itemHeight = this.vdndVirtualForItemHeight();
      const total = this.vdndVirtualForOf().length;

      // Single spacer with full content height
      spacer.style.height = `${total * itemHeight}px`;

      // Transform positions the visible content at the correct offset
      wrapper.style.transform = `translateY(${start * itemHeight}px)`;
    });
  }

  /**
   * Update the rendered views with true view recycling.
   * Views are kept in the DOM and have their context updated in place when possible.
   */
  #updateViews(): void {
    const items = this.vdndVirtualForOf();
    const { start, end } = this.#renderRange();
    const trackByFn = this.vdndVirtualForTrackBy();
    const placeholderIndex = this.#placeholderIndex();

    // 1. Calculate which keys we need and build the ordered list of items to render
    const itemsToRender: { key: unknown; context: VirtualForContext<T> }[] = [];

    for (let i = start; i <= end && i < items.length; i++) {
      // Insert placeholder before this item if needed
      if (placeholderIndex !== null && placeholderIndex === i) {
        itemsToRender.push({
          key: '__placeholder__',
          context: {
            $implicit: { __vdndPlaceholder: true } as unknown as T,
            index: -1,
            first: false,
            last: false,
            count: items.length,
            isPlaceholder: true,
          },
        });
      }

      const item = items[i];
      itemsToRender.push({
        key: trackByFn(i, item),
        context: {
          $implicit: item,
          index: i,
          first: i === start,
          last: i === end || i === items.length - 1,
          count: items.length,
          isPlaceholder: false,
        },
      });
    }

    // Insert placeholder at end if needed
    if (placeholderIndex !== null && placeholderIndex >= items.length) {
      itemsToRender.push({
        key: '__placeholder__',
        context: {
          $implicit: { __vdndPlaceholder: true } as unknown as T,
          index: -1,
          first: false,
          last: true,
          count: items.length,
          isPlaceholder: true,
        },
      });
    }

    const neededKeys = new Set(itemsToRender.map((item) => item.key));

    // 2. Remove views we no longer need (move to pool)
    for (const [key, view] of this.#activeViews) {
      if (!neededKeys.has(key)) {
        const index = this.#viewContainer.indexOf(view);
        if (index >= 0) {
          this.#viewContainer.detach(index);
        }
        this.#viewPool.push(view);
        this.#activeViews.delete(key);
      }
    }

    // 3. For each needed item, update existing view context or get/create from pool
    const viewsInOrder: EmbeddedViewRef<VirtualForContext<T>>[] = [];

    for (const { key, context } of itemsToRender) {
      let view = this.#activeViews.get(key);

      if (view) {
        // View exists - update context in place (no DOM manipulation needed)
        Object.assign(view.context, context);
        view.markForCheck();
      } else {
        // Need a new view - try pool first, then create
        view = this.#viewPool.pop();
        if (view) {
          Object.assign(view.context, context);
          view.markForCheck();
        } else {
          view = this.#templateRef.createEmbeddedView(context);
        }
        this.#activeViews.set(key, view);
      }

      viewsInOrder.push(view);
    }

    // 4. Ensure views are in correct order in ViewContainerRef and wrapper
    for (let i = 0; i < viewsInOrder.length; i++) {
      const view = viewsInOrder[i];
      const currentIndex = this.#viewContainer.indexOf(view);

      if (currentIndex !== i) {
        // View needs to be inserted or moved
        if (currentIndex >= 0) {
          this.#viewContainer.move(view, i);
        } else {
          this.#viewContainer.insert(view, i);
        }
      }

      // Ensure view's root nodes are in the wrapper (for newly inserted views)
      if (this.#wrapper) {
        const expectedChild = this.#wrapper.children[i];
        for (const node of view.rootNodes) {
          if (node instanceof HTMLElement && node !== expectedChild) {
            // Node is not at expected position, insert it
            if (expectedChild) {
              this.#wrapper.insertBefore(node, expectedChild);
            } else {
              this.#wrapper.appendChild(node);
            }
          }
        }
      }
    }

    // 5. Destroy unused views in pool (keep some for reuse)
    while (this.#viewPool.length > 10) {
      const view = this.#viewPool.pop();
      view?.destroy();
    }
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
