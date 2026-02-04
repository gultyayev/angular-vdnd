import {
  computed,
  Directive,
  effect,
  ElementRef,
  EmbeddedViewRef,
  inject,
  Injector,
  input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { VDND_SCROLL_CONTAINER } from '../tokens/scroll-container.token';
import { VDND_VIRTUAL_VIEWPORT } from '../tokens/virtual-viewport.token';
import { DragStateService } from '../services/drag-state.service';

/**
 * Context provided to the template for each virtual item.
 */
export interface VirtualForContext<T> {
  /** The item data (also available as implicit context) */
  $implicit: T;
  /** The item's index in the original array */
  index: number;
  /** Whether this is the first visible item */
  first: boolean;
  /** Whether this is the last visible item */
  last: boolean;
  /** Count of total items */
  count: number;
}

/**
 * Represents an item entry in the render queue for virtual scrolling.
 * @internal
 */
interface RenderEntry<T> {
  type: 'item' | 'placeholder';
  key: unknown;
  context: VirtualForContext<T> | null;
  visualIndex: number;
}

/**
 * A structural directive for virtual scrolling within custom scroll containers.
 * Provides maximum flexibility for advanced use cases where the component wrapper
 * is not suitable.
 *
 * The directive must be placed inside a container marked with the `vdndScrollable`
 * directive, which provides the scroll container context via dependency injection.
 *
 * Placeholders are handled automatically by the parent component (vdnd-virtual-scroll
 * or vdnd-virtual-content) - consumers just render their items normally.
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
 */
@Directive({
  selector: '[vdndVirtualFor][vdndVirtualForOf]',
})
export class VirtualForDirective<T> implements OnInit, OnDestroy {
  readonly #templateRef = inject(TemplateRef<VirtualForContext<T>>);
  readonly #viewContainer = inject(ViewContainerRef);
  readonly #elementRef = inject(ElementRef<Comment>);
  readonly #scrollContainer = inject(VDND_SCROLL_CONTAINER);
  readonly #injector = inject(Injector);
  readonly #dragState = inject(DragStateService);

  /**
   * Optional viewport component that provides wrapper-based positioning.
   * When inside a viewport, items are positioned via the wrapper's transform,
   * so we skip individual absolute positioning.
   */
  readonly #viewport = inject(VDND_VIRTUAL_VIEWPORT, { optional: true });

  /** Whether we're inside a viewport component (use wrapper positioning) */
  readonly #useViewportPositioning = this.#viewport !== null;

  /** Pool of views for reuse */
  readonly #viewPool: EmbeddedViewRef<VirtualForContext<T>>[] = [];

  /** Currently active views keyed by their track-by value */
  readonly #activeViews = new Map<unknown, EmbeddedViewRef<VirtualForContext<T>>>();

  /** Single spacer element for scroll height */
  #spacer: HTMLDivElement | null = null;

  /** Placeholder element for drag operations */
  #placeholder: HTMLDivElement | null = null;

  /** Whether placeholder is currently in the DOM */
  #placeholderInDom = false;

  // ========== Inputs ==========

  /** The array of items to iterate over */
  vdndVirtualForOf = input.required<T[]>();

  /** Height of each item in pixels */
  vdndVirtualForItemHeight = input.required<number>();

  /** Track-by function for efficient updates */
  vdndVirtualForTrackBy = input.required<(index: number, item: T) => unknown>();

  /** Number of items to render outside the visible area */
  vdndVirtualForOverscan = input<number>(3);

  /**
   * ID of the droppable this directive belongs to.
   * Required for placeholder positioning during drag operations.
   */
  vdndVirtualForDroppableId = input<string>();

  // ========== Placeholder Computed Values ==========

  /** Whether the placeholder should be shown in this container */
  readonly #shouldShowPlaceholder = computed(() => {
    const droppableId = this.vdndVirtualForDroppableId();
    if (!droppableId) return false;
    if (!this.#dragState.isDragging()) return false;
    return this.#dragState.activeDroppableId() === droppableId;
  });

  /** The placeholder index when placeholder should be shown */
  readonly #placeholderIndex = computed(() => {
    if (!this.#shouldShowPlaceholder()) return -1;
    return this.#dragState.placeholderIndex() ?? -1;
  });

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

  /** Map of trackBy keys to item indices for quick lookup */
  readonly #itemIndexMap = computed(() => {
    const items = this.vdndVirtualForOf();
    const trackByFn = this.vdndVirtualForTrackBy();
    const map = new Map<unknown, number>();
    for (let i = 0; i < items.length; i++) {
      map.set(trackByFn(i, items[i]), i);
    }
    return map;
  });

  /** Index of the dragged item in this list (-1 if not present or not dragging) */
  readonly #draggedItemIndex = computed(() => {
    const draggedItem = this.#dragState.draggedItem();
    if (!draggedItem) return -1;

    const byId = this.#itemIndexMap().get(draggedItem.draggableId);
    if (byId !== undefined) {
      return byId;
    }

    const data = draggedItem.data as T | null | undefined;
    if (data !== null && data !== undefined) {
      return this.vdndVirtualForOf().indexOf(data);
    }

    return -1;
  });

  constructor() {
    // React to changes and update views
    effect(() => {
      this.#updateViews();
    });
  }

  ngOnInit(): void {
    // Only create spacer when NOT inside a viewport component
    // (viewport provides its own spacer and wrapper positioning)
    if (!this.#useViewportPositioning) {
      this.#updateSpacers();
    }

    // Create placeholder element for drag operations
    this.#createPlaceholder();
  }

  ngOnDestroy(): void {
    this.#viewPool.forEach((view) => view.destroy());
    this.#activeViews.forEach((view) => view.destroy());

    // Clean up spacer element (only if we created one)
    this.#spacer?.remove();

    // Clean up placeholder element
    this.#placeholder?.remove();
  }

  /**
   * Create the placeholder element for drag operations.
   */
  #createPlaceholder(): void {
    const placeholder = document.createElement('div');
    placeholder.className = 'vdnd-drag-placeholder vdnd-drag-placeholder-visible';
    placeholder.style.cssText = 'display: block; pointer-events: none;';
    this.#placeholder = placeholder;
  }

  /**
   * Set up spacer element for scroll height.
   */
  #updateSpacers(): void {
    // Create single spacer that maintains total scroll height
    const spacer = document.createElement('div');
    spacer.className = 'vdnd-virtual-for-spacer';
    spacer.style.cssText =
      'position: absolute; top: 0; left: 0; width: 1px; visibility: hidden; pointer-events: none;';

    // Insert spacer before the directive's anchor comment
    const comment = this.#elementRef.nativeElement;
    comment.parentNode?.insertBefore(spacer, comment);

    this.#spacer = spacer;

    // Update spacer height reactively
    // Must pass injector since we're outside constructor
    effect(
      () => {
        const itemHeight = this.vdndVirtualForItemHeight();
        const total = this.vdndVirtualForOf().length;

        // Single spacer with full content height
        spacer.style.height = `${total * itemHeight}px`;
      },
      { injector: this.#injector },
    );
  }

  /**
   * Update the rendered views with true view recycling.
   * Views are kept in the DOM and have their context updated in place when possible.
   */
  #updateViews(): void {
    const items = this.vdndVirtualForOf();
    const { start, end } = this.#renderRange();
    const itemHeight = this.vdndVirtualForItemHeight();
    const placeholderIndex = this.#placeholderIndex();
    const showPlaceholder = this.#shouldShowPlaceholder();
    const draggedIndex = this.#draggedItemIndex();
    const droppableId = this.vdndVirtualForDroppableId();
    const sourceDroppableId = this.#dragState.sourceDroppableId();
    const isSourceList = droppableId ? droppableId === sourceDroppableId : true;
    const shouldKeepDragged =
      this.#dragState.isDragging() &&
      draggedIndex >= 0 &&
      isSourceList &&
      draggedIndex < items.length;

    // Notify viewport of render start index for wrapper positioning
    this.#notifyViewportRenderStart(start, isSourceList, draggedIndex);

    // 1. Build the list of items to render
    const itemsToRender = this.#calculateItemsToRender({
      items,
      start,
      end,
      showPlaceholder,
      placeholderIndex,
      shouldKeepDragged,
      draggedIndex,
    });

    // 2. Reconcile views with the DOM
    const placeholderDomPosition = this.#reconcileViews(itemsToRender, showPlaceholder, itemHeight);

    // 3. Position placeholder in DOM
    this.#positionPlaceholder(showPlaceholder, placeholderDomPosition, itemHeight);

    // 4. Trim view pool to prevent memory bloat
    this.#trimViewPool();
  }

  /**
   * Notify viewport of render start index for wrapper positioning.
   * Adjusts when the dragged item is above the rendered range.
   */
  #notifyViewportRenderStart(start: number, isSourceList: boolean, draggedIndex: number): void {
    if (!this.#useViewportPositioning) return;

    const shouldAdjustRenderStart =
      this.#dragState.isDragging() && isSourceList && draggedIndex >= 0 && draggedIndex < start;

    const renderStartIndex = shouldAdjustRenderStart ? Math.max(0, start - 1) : start;
    this.#viewport?.setRenderStartIndex(renderStartIndex);
  }

  /**
   * Calculate the list of items to render, including placeholder positioning
   * and keeping the dragged item alive when scrolled out of range.
   */
  #calculateItemsToRender(params: {
    items: T[];
    start: number;
    end: number;
    showPlaceholder: boolean;
    placeholderIndex: number;
    shouldKeepDragged: boolean;
    draggedIndex: number;
  }): RenderEntry<T>[] {
    const {
      items,
      start,
      end,
      showPlaceholder,
      placeholderIndex,
      shouldKeepDragged,
      draggedIndex,
    } = params;
    const trackByFn = this.vdndVirtualForTrackBy();
    const itemsToRender: RenderEntry<T>[] = [];

    // Build render list for visible range
    for (let i = start; i <= end && i < items.length; i++) {
      // Insert placeholder before item at placeholderIndex
      if (
        showPlaceholder &&
        placeholderIndex === i &&
        !itemsToRender.some((r) => r.type === 'placeholder')
      ) {
        itemsToRender.push({
          type: 'placeholder',
          key: '__placeholder__',
          context: null,
          visualIndex: placeholderIndex,
        });
      }

      const item = items[i];
      itemsToRender.push({
        type: 'item',
        key: trackByFn(i, item),
        context: {
          $implicit: item,
          index: i,
          first: i === start,
          last: i === end || i === items.length - 1,
          count: items.length,
        },
        visualIndex: i,
      });
    }

    // Add placeholder at end if needed
    if (
      showPlaceholder &&
      placeholderIndex >= items.length &&
      !itemsToRender.some((r) => r.type === 'placeholder')
    ) {
      itemsToRender.push({
        type: 'placeholder',
        key: '__placeholder__',
        context: null,
        visualIndex: placeholderIndex,
      });
    }

    // Keep dragged item view alive when scrolled out of range
    if (shouldKeepDragged && (draggedIndex < start || draggedIndex > end)) {
      const draggedItem = items[draggedIndex];
      const draggedKey = trackByFn(draggedIndex, draggedItem);
      const alreadyRendered = itemsToRender.some(
        (entry) => entry.type === 'item' && entry.key === draggedKey,
      );
      if (!alreadyRendered) {
        itemsToRender.push({
          type: 'item',
          key: draggedKey,
          context: {
            $implicit: draggedItem,
            index: draggedIndex,
            first: draggedIndex === 0,
            last: draggedIndex === items.length - 1,
            count: items.length,
          },
          visualIndex: draggedIndex,
        });
      }
    }

    return itemsToRender;
  }

  /**
   * Reconcile views with the calculated items to render.
   * Moves unused views to pool, updates existing views, creates new views as needed.
   * Returns the DOM position where placeholder should be inserted.
   */
  #reconcileViews(
    itemsToRender: RenderEntry<T>[],
    showPlaceholder: boolean,
    itemHeight: number,
  ): number {
    // Determine which keys we need
    const neededKeys = new Set(
      itemsToRender.filter((r) => r.type === 'item').map((item) => item.key),
    );

    // Move unused views to pool
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

    // Remove placeholder from DOM if not needed
    if (!showPlaceholder && this.#placeholderInDom && this.#placeholder) {
      this.#placeholder.remove();
      this.#placeholderInDom = false;
    }

    // Process items and track placeholder position
    let viewContainerIndex = 0;
    let placeholderDomPosition = -1;

    for (const entry of itemsToRender) {
      if (entry.type === 'placeholder') {
        placeholderDomPosition = viewContainerIndex;
        continue;
      }

      const view = this.#getOrCreateView(entry.key, entry.context!);

      // Ensure view is at correct position in ViewContainerRef
      const currentIndex = this.#viewContainer.indexOf(view);
      if (currentIndex !== viewContainerIndex) {
        if (currentIndex >= 0) {
          this.#viewContainer.move(view, viewContainerIndex);
        } else {
          this.#viewContainer.insert(view, viewContainerIndex);
        }
      }

      // Apply absolute positioning when not using viewport wrapper
      if (!this.#useViewportPositioning) {
        this.#applyAbsolutePositioning(view, entry.visualIndex * itemHeight);
      }

      viewContainerIndex++;
    }

    return placeholderDomPosition;
  }

  /**
   * Get an existing view or create/recycle one from the pool.
   */
  #getOrCreateView(
    key: unknown,
    context: VirtualForContext<T>,
  ): EmbeddedViewRef<VirtualForContext<T>> {
    let view = this.#activeViews.get(key);

    if (view) {
      // Update existing view context
      Object.assign(view.context, context);
      view.markForCheck();
    } else {
      // Try pool first, then create new
      view = this.#viewPool.pop();
      if (view) {
        Object.assign(view.context, context);
        view.markForCheck();
      } else {
        view = this.#templateRef.createEmbeddedView(context);
      }
      this.#activeViews.set(key, view);
    }

    return view;
  }

  /**
   * Apply absolute positioning styles to a view's root nodes.
   */
  #applyAbsolutePositioning(view: EmbeddedViewRef<VirtualForContext<T>>, topOffset: number): void {
    for (const node of view.rootNodes) {
      if (node instanceof HTMLElement) {
        node.style.position = 'absolute';
        node.style.top = `${topOffset}px`;
        node.style.left = '0';
        node.style.right = '0';
      }
    }
  }

  /**
   * Position the placeholder element in the DOM at the correct index.
   */
  #positionPlaceholder(
    showPlaceholder: boolean,
    placeholderDomPosition: number,
    itemHeight: number,
  ): void {
    if (!showPlaceholder || !this.#placeholder || placeholderDomPosition < 0) {
      return;
    }

    this.#placeholder.style.height = `${itemHeight}px`;

    const container = this.#viewContainer.element.nativeElement.parentElement;
    if (!container) return;

    // Find children excluding spacers and placeholder itself
    const children = Array.from(container.children).filter((el) => {
      const element = el as Element;
      return (
        !element.classList.contains('vdnd-drag-placeholder') &&
        !element.classList.contains('vdnd-virtual-for-spacer') &&
        !element.classList.contains('vdnd-content-spacer')
      );
    });
    const insertBeforeEl = children[placeholderDomPosition] ?? null;

    if (!this.#placeholderInDom) {
      // First insertion
      if (insertBeforeEl) {
        container.insertBefore(this.#placeholder, insertBeforeEl);
      } else {
        container.appendChild(this.#placeholder);
      }
      this.#placeholderInDom = true;
    } else {
      // Move to correct position if needed
      const currentNextSibling = this.#placeholder.nextElementSibling;
      if (insertBeforeEl !== currentNextSibling) {
        if (insertBeforeEl) {
          container.insertBefore(this.#placeholder, insertBeforeEl);
        } else {
          container.appendChild(this.#placeholder);
        }
      }
    }
  }

  /**
   * Trim the view pool to prevent memory bloat, keeping a reasonable buffer.
   */
  #trimViewPool(): void {
    const maxPoolSize = 10;
    while (this.#viewPool.length > maxPoolSize) {
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
