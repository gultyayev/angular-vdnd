import { computed, Injectable, signal } from '@angular/core';
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

  /**
   * Start a drag operation.
   */
  startDrag(
    item: DraggedItem,
    initialPosition?: CursorPosition,
    grabOffset?: GrabOffset,
    lockAxis?: 'x' | 'y' | null,
    activeDroppableId?: string | null,
    placeholderId?: string | null,
    placeholderIndex?: number | null,
    sourceIndex?: number | null
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
      cursorPosition: initialPosition ?? null,
      grabOffset: grabOffset ?? null,
      initialPosition: initialPosition ?? null,
      lockAxis: lockAxis ?? null,
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
   */
  endDrag(): void {
    this.#wasCancelled.set(false);
    this.#state.set(INITIAL_DRAG_STATE);
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
}
