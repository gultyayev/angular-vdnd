import { afterNextRender, EnvironmentInjector, NgZone } from '@angular/core';
import { DragStateService } from '../services/drag-state.service';
import { KeyboardDragService } from '../services/keyboard-drag.service';
import { PositionCalculatorService } from '../services/position-calculator.service';
import { DragIndexCalculatorService } from '../services/drag-index-calculator.service';
import { ElementCloneService } from '../services/element-clone.service';
import { DragEndEvent, DragStartEvent } from '../models/drag-drop.models';

/**
 * Context from the directive needed for keyboard drag operations.
 */
export interface KeyboardDragContext {
  element: HTMLElement;
  draggableId: string;
  groupName: string | null;
  data: unknown;
}

/**
 * Callbacks from the handler back into the directive for events.
 */
export interface KeyboardDragCallbacks {
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  getParentDroppableId: () => string | null;
  calculateSourceIndex: (element: HTMLElement, droppableElement: HTMLElement | null) => number;
}

/**
 * Dependencies injected from the directive (non-injectable handler).
 */
export interface KeyboardDragDeps {
  dragState: DragStateService;
  keyboardDrag: KeyboardDragService;
  positionCalculator: PositionCalculatorService;
  dragIndexCalculator: DragIndexCalculatorService;
  elementClone: ElementCloneService;
  ngZone: NgZone;
  envInjector: EnvironmentInjector;
  callbacks: KeyboardDragCallbacks;
  getContext: () => KeyboardDragContext;
}

/**
 * Handles keyboard-initiated drag operations (Space to start, arrows to move, Space/Enter to drop).
 *
 * Extracted from DraggableDirective to encapsulate:
 * - Starting/completing/cancelling keyboard drags
 * - Document-level keyboard listener during active drag
 * - Focus restoration after drag ends
 * - Cross-list movement via arrow keys
 *
 * Provides a unified `handleKey()` method that eliminates the duplicated
 * key→action dispatch that previously existed in both host bindings and
 * a document-level listener.
 */
export class KeyboardDragHandler {
  readonly #deps: KeyboardDragDeps;
  #boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(deps: KeyboardDragDeps) {
    this.#deps = deps;
    this.#boundKeyDown = this.#onDocumentKeyDown.bind(this);
  }

  /**
   * Whether a keyboard drag is currently active.
   */
  isActive(): boolean {
    return this.#deps.keyboardDrag.isActive();
  }

  /**
   * Start a keyboard drag operation.
   */
  activate(): void {
    const ctx = this.#deps.getContext();
    if (!ctx.groupName) {
      return;
    }

    const element = ctx.element;
    const rect = element.getBoundingClientRect();

    // Find the parent droppable
    const droppableElement = this.#deps.positionCalculator.getDroppableParent(
      element,
      ctx.groupName,
    );
    if (!droppableElement) {
      return;
    }

    const droppableId = this.#deps.positionCalculator.getDroppableId(droppableElement);
    if (!droppableId) {
      return;
    }

    // Calculate source index
    const sourceIndex = this.#deps.callbacks.calculateSourceIndex(element, droppableElement);

    // Get total item count from the droppable
    const totalItemCount = this.#deps.dragIndexCalculator.getTotalItemCount({
      droppableElement,
      isSameList: false,
      draggedItemHeight: rect.height,
    });

    // Clone element BEFORE updating drag state
    const clonedElement = this.#deps.elementClone.cloneElement(element);

    // Start keyboard drag
    this.#deps.keyboardDrag.startKeyboardDrag(
      {
        draggableId: ctx.draggableId,
        droppableId,
        element,
        clonedElement,
        height: rect.height,
        width: rect.width,
        data: ctx.data,
      },
      sourceIndex,
      totalItemCount,
      droppableId,
    );

    // Add document-level keyboard listener (since element is hidden with display:none)
    this.#deps.ngZone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.#boundKeyDown!);
    });

    // Emit drag start event
    this.#deps.callbacks.onDragStart({
      draggableId: ctx.draggableId,
      droppableId,
      data: ctx.data,
      position: { x: rect.left, y: rect.top },
      sourceIndex,
    });
  }

  /**
   * Unified key dispatch. Returns true if the key was handled.
   * Used by both host bindings and the document-level listener.
   */
  handleKey(event: KeyboardEvent): boolean {
    if (!this.isActive()) {
      return false;
    }

    switch (event.key) {
      case ' ': // Space
      case 'Enter':
        event.preventDefault();
        this.complete();
        return true;
      case 'Escape':
      case 'Tab':
        event.preventDefault();
        this.cancel();
        return true;
      case 'ArrowUp':
        event.preventDefault();
        this.#deps.keyboardDrag.moveUp();
        return true;
      case 'ArrowDown':
        event.preventDefault();
        this.#deps.keyboardDrag.moveDown();
        return true;
      case 'ArrowLeft':
        event.preventDefault();
        this.#moveToAdjacentDroppable('left');
        return true;
      case 'ArrowRight':
        event.preventDefault();
        this.#moveToAdjacentDroppable('right');
        return true;
      default:
        return false;
    }
  }

  /**
   * Complete a keyboard drag operation (drop the item).
   */
  complete(): void {
    const ctx = this.#deps.getContext();
    const sourceIndex = this.#deps.dragState.sourceIndex() ?? 0;
    const destinationIndex = this.#deps.dragState.placeholderIndex();

    // Remove document listener
    this.#cleanupDocumentListener();

    // Emit drag end event
    this.#deps.callbacks.onDragEnd({
      draggableId: ctx.draggableId,
      droppableId: this.#deps.callbacks.getParentDroppableId() ?? '',
      cancelled: false,
      data: ctx.data,
      sourceIndex,
      destinationIndex,
    });

    this.#deps.keyboardDrag.completeKeyboardDrag();

    // Restore focus to the moved element after state updates
    this.#restoreFocus(ctx.draggableId);
  }

  /**
   * Cancel a keyboard drag operation.
   */
  cancel(): void {
    const ctx = this.#deps.getContext();
    const sourceIndex = this.#deps.dragState.sourceIndex() ?? 0;

    // Remove document listener
    this.#cleanupDocumentListener();

    // Emit drag end event
    this.#deps.callbacks.onDragEnd({
      draggableId: ctx.draggableId,
      droppableId: this.#deps.callbacks.getParentDroppableId() ?? '',
      cancelled: true,
      data: ctx.data,
      sourceIndex,
      destinationIndex: null,
    });

    this.#deps.keyboardDrag.cancelKeyboardDrag();

    // Restore focus to the original element after state updates
    this.#restoreFocus(ctx.draggableId);
  }

  /**
   * Teardown — remove any active document listener.
   */
  destroy(): void {
    this.#cleanupDocumentListener();
  }

  /**
   * Restore focus to the dragged element after keyboard drag ends.
   * Uses afterNextRender to ensure Angular has finished updating the DOM
   * (element is no longer hidden after isDragging() becomes false).
   *
   * Uses EnvironmentInjector to ensure callback runs even if the directive
   * is destroyed during cross-list moves.
   */
  #restoreFocus(draggableId: string): void {
    // Capture the destination droppable BEFORE scheduling afterNextRender
    // (the directive may be destroyed during cross-list moves)
    const destinationDroppableId = this.#deps.dragState.activeDroppableId();

    afterNextRender(
      () => {
        const element = document.querySelector(
          `[data-draggable-id="${draggableId}"]`,
        ) as HTMLElement | null;

        if (element) {
          element.focus();
        } else if (destinationDroppableId) {
          // Fallback: focus the first draggable in the destination container
          const firstDraggable = document.querySelector(
            `[data-droppable-id="${destinationDroppableId}"] [data-draggable-id]`,
          ) as HTMLElement | null;
          firstDraggable?.focus();
        }
      },
      { injector: this.#deps.envInjector },
    );
  }

  /**
   * Move to an adjacent droppable in the specified direction.
   */
  #moveToAdjacentDroppable(direction: 'left' | 'right'): void {
    const currentDroppableId = this.#deps.dragState.activeDroppableId();
    if (!currentDroppableId) {
      return;
    }

    const groupName = this.#deps.getContext().groupName;
    if (!groupName) {
      return;
    }
    const adjacent = this.#deps.positionCalculator.findAdjacentDroppable(
      currentDroppableId,
      direction,
      groupName,
    );

    if (!adjacent) {
      return;
    }

    // Maintain the current target index (clamped to the new list's size)
    const currentTargetIndex = this.#deps.keyboardDrag.targetIndex() ?? 0;
    const targetIndex = Math.min(currentTargetIndex, adjacent.itemCount);

    this.#deps.keyboardDrag.moveToDroppable(adjacent.id, targetIndex, adjacent.itemCount);
  }

  /**
   * Document-level keydown listener active during keyboard drag.
   */
  #onDocumentKeyDown(event: KeyboardEvent): void {
    this.handleKey(event);
  }

  /**
   * Remove the document-level keyboard listener.
   */
  #cleanupDocumentListener(): void {
    if (this.#boundKeyDown) {
      document.removeEventListener('keydown', this.#boundKeyDown);
    }
  }
}
