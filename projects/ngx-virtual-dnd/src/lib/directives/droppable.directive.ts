import {
  afterNextRender,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  untracked,
} from '@angular/core';
import { DragStateService } from '../services/drag-state.service';
import { AutoScrollConfig, AutoScrollService } from '../services/auto-scroll.service';
import { PositionCalculatorService } from '../services/position-calculator.service';
import { DragState, DropEvent, END_OF_LIST } from '../models/drag-drop.models';
import { VDND_GROUP_TOKEN } from './droppable-group.directive';
import { createEffectiveGroupSignal } from '../utils/group-resolution';
import { createAutoScrollRegistration } from '../utils/auto-scroll-registration';
import { queryByAttribute } from '../utils/attribute-selectors';
import { normalizeDropDestinationIndex } from '../utils/drop-index-normalization';

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
    '[attr.data-droppable-disabled]': 'disabled() || null',
    '[attr.data-constrain-to-container]': 'constrainToContainer() || null',
    '[attr.aria-dropeffect]': '"move"',
    '[class.vdnd-droppable]': 'true',
    '[class.vdnd-droppable-active]': 'isActive()',
    '[class.vdnd-droppable-disabled]': 'disabled()',
  },
})
export class DroppableDirective implements OnDestroy {
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #dragState = inject(DragStateService);
  readonly #autoScroll = inject(AutoScrollService);
  readonly #positionCalculator = inject(PositionCalculatorService);
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

  /**
   * The current placeholder ID when this droppable is active.
   *
   * @deprecated Mirrors the always-`END_OF_LIST` `DragStateService.placeholderId`
   * and never reflects the real placeholder position. Read
   * `DragStateService.placeholderIndex` instead. Slated for removal in the next
   * major version.
   */
  readonly placeholderId = computed(() => {
    if (!this.isActive()) {
      return null;
    }
    return this.#dragState.placeholderId();
  });

  /** Track previous active state to detect the drag-end transition */
  #wasActive = false;

  /**
   * The terminal drag snapshot this droppable has already processed. `endedDragState`
   * persists until the next drag starts, so this guards against replaying the same drop
   * when the effect re-runs (e.g. `disabled()` toggling) after the drag has ended.
   */
  #handledEndedState: DragState | null = null;

  constructor() {
    createAutoScrollRegistration({
      autoScrollService: this.#autoScroll,
      getElement: () => this.#elementRef.nativeElement,
      getId: () => this.vdndDroppable(),
      enabled: () => this.autoScrollEnabled(),
      config: () => this.autoScrollConfig(),
      // Register whenever a group is resolved; do NOT gate on scrollability. DOM size is
      // not reactive, so a list that becomes scrollable after init (async data, resize)
      // would never register. AutoScrollService filters by live scroll geometry per drag.
      canRegister: () => Boolean(this.effectiveGroup()),
    });

    // Notify the calculator once this droppable is rendered (host data attributes applied).
    // Matters when it mounts DURING an active drag — the candidate snapshot was frozen at
    // drag start, so without this a conditionally rendered list would never become a target.
    afterNextRender(() => {
      const group = this.effectiveGroup();
      if (group) {
        this.#positionCalculator.notifyCandidatesChanged(group);
      }
    });

    // React to state changes and handle drop events.
    //
    // Keyed only on the low-frequency fields (isActive/isDragging/draggedItem). The final
    // placeholder/index values #handleDrop needs are captured by DragStateService.endDrag()
    // into endedDragState() at the drag-end boundary, so this effect never has to poll the
    // high-frequency cursor/placeholder signals — reading them here would make it re-run and
    // re-allocate a snapshot on every 60fps frame, defeating the service's signal splitting.
    effect(() => {
      const active = this.isActive();
      const draggedItem = this.#dragState.draggedItem();
      const isDragging = this.#dragState.isDragging();

      // Handle drag end (drop). This droppable is the release target when it was either
      // observed active during the drag (#wasActive) OR named as the target in the ended
      // drag snapshot. The snapshot path covers the pointer-up flush, where the final
      // position is processed and the state cleared in the same synchronous task, so this
      // effect never observes isActive() === true mid-drag and #wasActive stays false.
      const endedState = untracked(() => this.#dragState.endedDragState());
      const endedTargetedThis = endedState?.activeDroppableId === this.vdndDroppable();

      if (!isDragging && draggedItem === null && (this.#wasActive || endedTargetedThis)) {
        // Consume each terminal snapshot exactly once. endedDragState persists until the
        // next drag starts and disabled()/other inputs re-run this effect, so without a
        // per-snapshot guard a later state change would replay the same historical drop.
        if (endedState !== this.#handledEndedState) {
          this.#handledEndedState = endedState;
          // Emit only for an enabled target that ended normally. A target disabled at
          // release still consumes the snapshot (so re-enabling can't resurrect the drop)
          // but emits nothing, keeping dragEnd and drop consistent.
          if (!this.disabled() && !this.#dragState.wasCancelled()) {
            this.#handleDrop();
          }
        }
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

    // If this droppable unmounts mid-drag, tell the calculator so it drops it from the
    // frozen candidate list (deferred re-query runs once the element has left the DOM).
    const group = untracked(() => this.effectiveGroup());
    if (group) {
      this.#positionCalculator.notifyCandidatesChanged(group);
    }
  }

  /**
   * Handle a drop on this droppable.
   */
  #handleDrop(): void {
    // The live state is cleared before this effect fires, so read the terminal snapshot
    // captured by endDrag()/cancelDrag() immediately before the reset.
    const state = untracked(() => this.#dragState.endedDragState());

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
    // Fall back to a DOM append at the end of the list if not. Then normalize to
    // the same consumer-facing insertion index emitted by DragEndEvent.
    const placeholderIndex =
      state.placeholderIndex !== null && state.placeholderIndex !== undefined
        ? state.placeholderIndex
        : this.#getEndOfListIndex();
    const destinationIndex = normalizeDropDestinationIndex({
      sourceIndex,
      placeholderIndex,
      sourceDroppableId,
      activeDroppableId: this.vdndDroppable(),
    });

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
    const droppable = queryByAttribute<HTMLElement>(document, 'data-droppable-id', droppableId);
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
   * Fallback destination index used only when the pre-calculated
   * `placeholderIndex` is unavailable.
   *
   * The placeholder always resolves to the end of the list at the model level
   * (see the deprecated `DropDestination.placeholderId`), so this returns the
   * count of real draggables — an append at the end.
   */
  #getEndOfListIndex(): number {
    // Exclude placeholder elements from the count
    const draggables = this.#elementRef.nativeElement.querySelectorAll(
      '[data-draggable-id]:not([data-draggable-id="placeholder"])',
    );
    return draggables.length;
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
