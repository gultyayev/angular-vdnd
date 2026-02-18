import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { DragStateService } from '../services/drag-state.service';
import { AutoScrollConfig, AutoScrollService } from '../services/auto-scroll.service';
import { DragState, DropEvent, END_OF_LIST } from '../models/drag-drop.models';
import { VDND_GROUP_TOKEN } from './droppable-group.directive';
import { createEffectiveGroupSignal } from '../utils/group-resolution';

/**
 * Marks an element as a valid drop target within the virtual scroll drag-and-drop system.
 *
 * @example
 * ```html
 * <!-- With explicit group -->
 * <div
 *   vdndDroppable="list-1"
 *   vdndDroppableGroup="my-group"
 *   (drop)="onDrop($event)">
 *   <!-- Draggable items here -->
 * </div>
 *
 * <!-- With inherited group from parent vdndGroup directive -->
 * <div vdndGroup="my-group">
 *   <div vdndDroppable="list-1" (drop)="onDrop($event)">
 *     <!-- Draggable items here -->
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[vdndDroppable]',
  host: {
    '[attr.data-droppable-id]': 'vdndDroppable()',
    '[attr.data-droppable-group]': 'effectiveGroup()',
    '[attr.data-constrain-to-container]': 'constrainToContainer() || null',
    '[attr.aria-dropeffect]': '"move"',
    '[class.vdnd-droppable]': 'true',
    '[class.vdnd-droppable-active]': 'isActive()',
    '[class.vdnd-droppable-disabled]': 'disabled()',
  },
})
export class DroppableDirective implements OnInit, OnDestroy {
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #dragState = inject(DragStateService);
  readonly #autoScroll = inject(AutoScrollService);
  readonly #parentGroup = inject(VDND_GROUP_TOKEN, { optional: true });

  /** Unique identifier for this droppable */
  vdndDroppable = input.required<string>();

  /**
   * Drag-and-drop group name.
   * Optional when a parent `vdndGroup` directive provides the group context.
   */
  vdndDroppableGroup = input<string>();

  /**
   * Resolved group name - uses explicit input or falls back to parent group.
   * Returns null (and disables dropping) if neither is available.
   */
  readonly effectiveGroup = createEffectiveGroupSignal({
    explicitGroup: this.vdndDroppableGroup,
    parentGroup: this.#parentGroup,
    elementId: this.vdndDroppable,
    elementType: 'droppable',
  });

  /** Optional data associated with this droppable */
  vdndDroppableData = input<unknown>();

  /** Whether this droppable is disabled */
  disabled = input<boolean>(false);

  /** Enable auto-scroll when dragging near edges */
  autoScrollEnabled = input<boolean>(true);

  /** Auto-scroll configuration */
  autoScrollConfig = input<Partial<AutoScrollConfig>>({});

  /** Constrain drag preview and placeholder to container boundaries */
  constrainToContainer = input<boolean>(false);

  /** Emits when an item is dropped on this droppable */
  // eslint-disable-next-line @angular-eslint/no-output-native
  drop = output<DropEvent>();

  /** Whether this droppable is currently being targeted */
  readonly isActive = computed(() => {
    const activeId = this.#dragState.activeDroppableId();
    return activeId === this.vdndDroppable() && !this.disabled();
  });

  /** The current placeholder ID when this droppable is active */
  readonly placeholderId = computed(() => {
    if (!this.isActive()) {
      return null;
    }
    return this.#dragState.placeholderId();
  });

  /** Track previous active state for cache clearing on leave */
  #wasActive = false;

  /** Cached state for handling drop (since state is cleared before effect fires) */
  #cachedDragState: DragState | null = null;

  ngOnInit(): void {
    // Without a group, this droppable can't participate in DnD (fail gracefully).
    if (!this.effectiveGroup()) {
      return;
    }

    // Register with auto-scroll service only if this element is actually scrollable
    // (i.e., has overflow: auto/scroll and content taller than container)
    if (this.autoScrollEnabled() && this.#isScrollable()) {
      this.#autoScroll.registerContainer(
        this.vdndDroppable(),
        this.#elementRef.nativeElement,
        this.autoScrollConfig(),
      );
    }
  }

  /**
   * Check if this element is actually scrollable.
   */
  #isScrollable(): boolean {
    const el = this.#elementRef.nativeElement;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;

    // Check if overflow allows scrolling
    const hasScrollableOverflow =
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowX === 'auto' ||
      overflowX === 'scroll';

    if (!hasScrollableOverflow) {
      return false;
    }

    // Check if content is larger than container
    return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
  }

  constructor() {
    // React to state changes and handle drop events
    effect(() => {
      const active = this.isActive();
      const draggedItem = this.#dragState.draggedItem();
      const isDragging = this.#dragState.isDragging();

      // Cache state while active for use during drop handling
      if (active && isDragging && draggedItem) {
        this.#cachedDragState = this.#dragState.getStateSnapshot();
      }

      // Handle drag end (drop)
      if (!isDragging && this.#wasActive && draggedItem === null) {
        // Check if drag was cancelled (e.g., Escape key)
        if (!this.#dragState.wasCancelled()) {
          // Drag ended normally - this is a drop
          this.#handleDrop();
        }
        this.#cachedDragState = null;
      }

      // Clear cached state when leaving without dropping
      if (!active && this.#wasActive && isDragging) {
        this.#cachedDragState = null;
      }

      this.#wasActive = active;
    });
  }

  ngOnDestroy(): void {
    // Clean up if this droppable is destroyed while being active
    if (this.isActive()) {
      this.#dragState.setActiveDroppable(null);
    }

    // Unregister from auto-scroll
    this.#autoScroll.unregisterContainer(this.vdndDroppable());
  }

  /**
   * Handle a drop on this droppable.
   */
  #handleDrop(): void {
    // Use cached state since the actual state is cleared before this effect fires
    const state = this.#cachedDragState;

    if (!state?.draggedItem || state.activeDroppableId !== this.vdndDroppable()) {
      return;
    }

    const sourceDroppableId = state.sourceDroppableId ?? '';
    const placeholderId = state.placeholderId ?? END_OF_LIST;

    // Use the stored source index from drag state
    // This is critical for virtual scrolling where the original element may no longer
    // be in the DOM after autoscroll (it gets virtualized out of view)
    const sourceIndex =
      state.sourceIndex ?? this.#getItemIndex(state.draggedItem.draggableId, sourceDroppableId);

    // Use the pre-calculated placeholderIndex if available (more reliable)
    // Fall back to DOM-based calculation if not
    let destinationIndex =
      state.placeholderIndex !== null && state.placeholderIndex !== undefined
        ? state.placeholderIndex
        : this.#getDestinationIndex(placeholderId);

    // Adjust for same-list reordering: if moving within the same list and
    // the destination is after the source, we need to account for the item
    // being removed from its original position
    if (sourceDroppableId === this.vdndDroppable() && sourceIndex < destinationIndex) {
      destinationIndex--;
    }

    this.drop.emit({
      source: {
        draggableId: state.draggedItem.draggableId,
        droppableId: sourceDroppableId,
        index: sourceIndex,
        data: state.draggedItem.data,
      },
      destination: {
        droppableId: this.vdndDroppable(),
        placeholderId,
        index: destinationIndex,
        data: this.vdndDroppableData(),
      },
    });
  }

  /**
   * Get the index of an item in a droppable.
   * This is a simplified implementation - in practice, the consumer would track this.
   */
  #getItemIndex(draggableId: string, droppableId: string): number {
    // Find all draggables in the source droppable
    const droppable = document.querySelector(`[data-droppable-id="${droppableId}"]`);
    if (!droppable) {
      return 0;
    }

    const draggables = droppable.querySelectorAll('[data-draggable-id]');
    for (let i = 0; i < draggables.length; i++) {
      if (draggables[i].getAttribute('data-draggable-id') === draggableId) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Get the destination index based on the placeholder.
   */
  #getDestinationIndex(placeholderId: string): number {
    // Exclude placeholder elements from the count
    const draggables = this.#elementRef.nativeElement.querySelectorAll(
      '[data-draggable-id]:not([data-draggable-id="placeholder"])',
    );

    if (placeholderId === END_OF_LIST) {
      return draggables.length;
    }

    // Find the index of the placeholder item
    for (let i = 0; i < draggables.length; i++) {
      if (draggables[i].getAttribute('data-draggable-id') === placeholderId) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Get the element reference (for external use).
   */
  getElement(): HTMLElement {
    return this.#elementRef.nativeElement;
  }

  /**
   * Manually scroll this droppable.
   */
  scrollBy(delta: number): void {
    this.#elementRef.nativeElement.scrollTop += delta;
  }

  /**
   * Get the current scroll position.
   */
  getScrollTop(): number {
    return this.#elementRef.nativeElement.scrollTop;
  }

  /**
   * Get the scroll height.
   */
  getScrollHeight(): number {
    return this.#elementRef.nativeElement.scrollHeight;
  }
}
