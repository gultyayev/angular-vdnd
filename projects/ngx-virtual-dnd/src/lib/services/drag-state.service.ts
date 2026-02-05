import { computed, effect, Injectable, signal } from '@angular/core';
import {
  CursorPosition,
  DraggedItem,
  DragState,
  GrabOffset,
  INITIAL_DRAG_STATE,
} from '../models/drag-drop.models';

/**
 * Central service for managing drag-and-drop state.
 * Uses signals for reactive state management.
 */
@Injectable({
  providedIn: 'root',
})
export class DragStateService {
  /** Internal state signal */
  readonly #state = signal<DragState>(INITIAL_DRAG_STATE);

  /** Flag indicating if the last drag was cancelled (not dropped) */
  readonly #wasCancelled = signal<boolean>(false);

  /**
   * Tracks an item during the "drop pending" phase.
   * This keeps the dragged item hidden (display: none) until the consumer's
   * drop handler has finished updating the data. This prevents a visual flicker
   * where the item briefly appears at its original position before the list reorders.
   */
  readonly #dropPendingItemId = signal<string | null>(null);

  /** Read-only signal to check if a specific item is in drop-pending state */
  readonly dropPendingItemId = this.#dropPendingItemId.asReadonly();

  /** Whether the last drag was cancelled (for droppable to check before emitting drop) */
  readonly wasCancelled = this.#wasCancelled.asReadonly();

  /** Read-only access to the full state */
  readonly state = this.#state.asReadonly();

  /** Whether a drag operation is in progress */
  readonly isDragging = computed(() => this.#state().isDragging);

  /** The currently dragged item, or null */
  readonly draggedItem = computed(() => this.#state().draggedItem);

  /** ID of the currently dragged item, or null (convenience signal for filtering) */
  readonly draggedItemId = computed(() => this.#state().draggedItem?.draggableId ?? null);

  /** ID of the droppable where the drag started */
  readonly sourceDroppableId = computed(() => this.#state().sourceDroppableId);

  /** Original index of the dragged item in the source list */
  readonly sourceIndex = computed(() => this.#state().sourceIndex);

  /** ID of the droppable currently being hovered over */
  readonly activeDroppableId = computed(() => this.#state().activeDroppableId);

  /** ID of the item the placeholder should appear before */
  readonly placeholderId = computed(() => this.#state().placeholderId);

  /** Index where the placeholder should be inserted */
  readonly placeholderIndex = computed(() => this.#state().placeholderIndex);

  /** Current cursor position */
  readonly cursorPosition = computed(() => this.#state().cursorPosition);

  /** Offset from cursor to element top-left (for maintaining grab position) */
  readonly grabOffset = computed(() => this.#state().grabOffset);

  /** Position when drag started (for axis locking) */
  readonly initialPosition = computed(() => this.#state().initialPosition);

  /** Axis to lock movement to */
  readonly lockAxis = computed(() => this.#state().lockAxis);

  /** Whether this is a keyboard-initiated drag */
  readonly isKeyboardDrag = computed(() => this.#state().isKeyboardDrag);

  /** Target index during keyboard navigation */
  readonly keyboardTargetIndex = computed(() => this.#state().keyboardTargetIndex);

  constructor() {
    // Inject cursor styles once (for consistent grabbing cursor during drag)
    if (typeof document !== 'undefined') {
      const styleId = 'vdnd-cursor-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          body.vdnd-dragging,
          body.vdnd-dragging * {
            cursor: grabbing !important;
          }
        `;
        document.head.appendChild(style);
      }
    }

    // Effect to toggle body class during drag
    effect(() => {
      if (typeof document === 'undefined') return;
      const isDragging = this.isDragging();
      document.body.classList.toggle('vdnd-dragging', isDragging);
    });
  }

  /**
   * Start a drag operation.
   */
  startDrag(
    item: DraggedItem,
    cursorPosition?: CursorPosition,
    grabOffset?: GrabOffset,
    lockAxis?: 'x' | 'y' | null,
    activeDroppableId?: string | null,
    placeholderId?: string | null,
    placeholderIndex?: number | null,
    sourceIndex?: number | null,
    isKeyboardDrag?: boolean,
    axisLockPosition?: CursorPosition,
  ): void {
    // Reset cancellation flag at start of new drag
    this.#wasCancelled.set(false);
    this.#state.set({
      isDragging: true,
      draggedItem: item,
      sourceDroppableId: item.droppableId,
      sourceIndex: sourceIndex ?? null,
      activeDroppableId: activeDroppableId ?? null,
      placeholderId: placeholderId ?? null,
      placeholderIndex: placeholderIndex ?? null,
      cursorPosition: cursorPosition ?? null,
      grabOffset: grabOffset ?? null,
      initialPosition: axisLockPosition ?? cursorPosition ?? null,
      lockAxis: lockAxis ?? null,
      isKeyboardDrag: isKeyboardDrag ?? false,
      keyboardTargetIndex: isKeyboardDrag ? (sourceIndex ?? 0) : null,
    });
  }

  /**
   * Update the drag position and targets.
   */
  updateDragPosition(update: {
    cursorPosition: CursorPosition;
    activeDroppableId: string | null;
    placeholderId: string | null;
    placeholderIndex: number | null;
  }): void {
    if (!this.#state().isDragging) {
      return;
    }

    this.#state.update((state) => ({
      ...state,
      cursorPosition: update.cursorPosition,
      activeDroppableId: update.activeDroppableId,
      placeholderId: update.placeholderId,
      placeholderIndex: update.placeholderIndex,
    }));
  }

  /**
   * Update just the active droppable.
   */
  setActiveDroppable(droppableId: string | null): void {
    if (!this.#state().isDragging) {
      return;
    }

    this.#state.update((state) => ({
      ...state,
      activeDroppableId: droppableId,
    }));
  }

  /**
   * Update just the placeholder position.
   */
  setPlaceholder(placeholderId: string | null): void {
    if (!this.#state().isDragging) {
      return;
    }

    this.#state.update((state) => ({
      ...state,
      placeholderId,
    }));
  }

  /**
   * End the drag operation and reset state (normal drop).
   * Sets dropPendingItemId to keep the item hidden until completeDropTransition() is called.
   */
  endDrag(): void {
    const draggedId = this.#state().draggedItem?.draggableId ?? null;
    this.#wasCancelled.set(false);
    // Set drop pending BEFORE clearing state to keep item hidden
    this.#dropPendingItemId.set(draggedId);
    this.#state.set(INITIAL_DRAG_STATE);

    // Safety: clear pending state after effects have had a chance to run.
    // This handles edge cases like dropping outside any droppable, where no
    // drop event fires and completeDropTransition() is never called.
    // Using setTimeout(..., 0) ensures this runs after the current synchronous
    // execution including all effects. If a droppable did handle the drop,
    // dropPendingItemId will already be null and this does nothing.
    setTimeout(() => {
      if (this.#dropPendingItemId() === draggedId) {
        this.#dropPendingItemId.set(null);
      }
    }, 0);
  }

  /**
   * Complete the drop transition - called after the drop event has been processed.
   * This makes the dragged item visible again (at its new position).
   */
  completeDropTransition(): void {
    this.#dropPendingItemId.set(null);
  }

  /**
   * Cancel the drag operation (escape key, disabled, etc.).
   */
  cancelDrag(): void {
    this.#wasCancelled.set(true);
    this.#state.set(INITIAL_DRAG_STATE);
  }

  /**
   * Check if a specific droppable is currently active.
   */
  isDroppableActive(droppableId: string): boolean {
    return this.#state().activeDroppableId === droppableId;
  }

  /**
   * Get the current state snapshot (for event creation).
   */
  getStateSnapshot(): DragState {
    return this.#state();
  }

  /**
   * Update the keyboard target index (for keyboard drag navigation).
   * Also updates placeholder position to match, applying same-list adjustment.
   */
  setKeyboardTargetIndex(targetIndex: number): void {
    if (!this.#state().isDragging || !this.#state().isKeyboardDrag) {
      return;
    }

    this.#state.update((state) => {
      // Same-list adjustment: if target is at or after source, add 1
      // This accounts for the hidden item shifting everything up visually
      const sourceDroppableId = state.draggedItem?.droppableId;
      const activeDroppableId = state.activeDroppableId;
      const isSameList = sourceDroppableId === activeDroppableId;
      const sourceIndex = state.sourceIndex ?? -1;

      let placeholderIndex = targetIndex;
      if (isSameList && sourceIndex >= 0 && targetIndex >= sourceIndex) {
        placeholderIndex = targetIndex + 1;
      }

      return {
        ...state,
        keyboardTargetIndex: targetIndex,
        placeholderIndex,
      };
    });
  }

  /**
   * Update the active droppable during keyboard navigation (for cross-list moves).
   */
  setKeyboardActiveDroppable(droppableId: string | null, targetIndex: number): void {
    if (!this.#state().isDragging || !this.#state().isKeyboardDrag) {
      return;
    }

    this.#state.update((state) => {
      // Same-list adjustment: if moving back to source list and target is at or after source, add 1
      const sourceDroppableId = state.draggedItem?.droppableId;
      const isSameList = sourceDroppableId === droppableId;
      const sourceIndex = state.sourceIndex ?? -1;

      let placeholderIndex = targetIndex;
      if (isSameList && sourceIndex >= 0 && targetIndex >= sourceIndex) {
        placeholderIndex = targetIndex + 1;
      }

      return {
        ...state,
        activeDroppableId: droppableId,
        keyboardTargetIndex: targetIndex,
        placeholderIndex,
      };
    });
  }
}
