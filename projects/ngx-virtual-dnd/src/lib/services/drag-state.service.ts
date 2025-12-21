import { computed, Injectable, signal } from '@angular/core';
import {
  CursorPosition,
  DraggedItem,
  DragState,
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
  private readonly _state = signal<DragState>(INITIAL_DRAG_STATE);

  /** Read-only access to the full state */
  readonly state = this._state.asReadonly();

  /** Whether a drag operation is in progress */
  readonly isDragging = computed(() => this._state().isDragging);

  /** The currently dragged item, or null */
  readonly draggedItem = computed(() => this._state().draggedItem);

  /** ID of the droppable where the drag started */
  readonly sourceDroppableId = computed(() => this._state().sourceDroppableId);

  /** ID of the droppable currently being hovered over */
  readonly activeDroppableId = computed(() => this._state().activeDroppableId);

  /** ID of the item the placeholder should appear before */
  readonly placeholderId = computed(() => this._state().placeholderId);

  /** Current cursor position */
  readonly cursorPosition = computed(() => this._state().cursorPosition);

  /**
   * Start a drag operation.
   */
  startDrag(item: DraggedItem): void {
    this._state.set({
      isDragging: true,
      draggedItem: item,
      sourceDroppableId: item.droppableId,
      activeDroppableId: null,
      placeholderId: null,
      cursorPosition: null,
    });
  }

  /**
   * Update the drag position and targets.
   */
  updateDragPosition(update: {
    cursorPosition: CursorPosition;
    activeDroppableId: string | null;
    placeholderId: string | null;
  }): void {
    if (!this._state().isDragging) {
      return;
    }

    this._state.update((state) => ({
      ...state,
      cursorPosition: update.cursorPosition,
      activeDroppableId: update.activeDroppableId,
      placeholderId: update.placeholderId,
    }));
  }

  /**
   * Update just the active droppable.
   */
  setActiveDroppable(droppableId: string | null): void {
    if (!this._state().isDragging) {
      return;
    }

    this._state.update((state) => ({
      ...state,
      activeDroppableId: droppableId,
    }));
  }

  /**
   * Update just the placeholder position.
   */
  setPlaceholder(placeholderId: string | null): void {
    if (!this._state().isDragging) {
      return;
    }

    this._state.update((state) => ({
      ...state,
      placeholderId,
    }));
  }

  /**
   * End the drag operation and reset state.
   */
  endDrag(): void {
    this._state.set(INITIAL_DRAG_STATE);
  }

  /**
   * Cancel the drag operation (same as end for now, but semantically different).
   */
  cancelDrag(): void {
    this._state.set(INITIAL_DRAG_STATE);
  }

  /**
   * Check if a specific droppable is currently active.
   */
  isDroppableActive(droppableId: string): boolean {
    return this._state().activeDroppableId === droppableId;
  }

  /**
   * Get the current state snapshot (for event creation).
   */
  getStateSnapshot(): DragState {
    return this._state();
  }
}
