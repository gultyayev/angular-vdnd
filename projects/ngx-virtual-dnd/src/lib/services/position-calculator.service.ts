import { Injectable } from '@angular/core';

/**
 * Service for calculating drop positions and finding elements at cursor positions.
 * This is the core algorithm that makes virtual scroll + drag-and-drop work together.
 */
@Injectable({
  providedIn: 'root',
})
export class PositionCalculatorService {
  /** Data attribute used to identify droppable elements */
  private readonly DROPPABLE_ID_ATTR = 'data-droppable-id';

  /** Data attribute used to identify droppable groups */
  private readonly DROPPABLE_GROUP_ATTR = 'data-droppable-group';

  /** Data attribute used to identify draggable elements */
  private readonly DRAGGABLE_ID_ATTR = 'data-draggable-id';

  /** Maximum DOM levels to traverse when looking for parent elements */
  private readonly MAX_PARENT_TRAVERSAL = 15;

  /**
   * Find the droppable element at a given point.
   *
   * This works by temporarily hiding the dragged element, then using
   * document.elementFromPoint to find what's underneath the cursor.
   *
   * @param x - Cursor X coordinate
   * @param y - Cursor Y coordinate
   * @param draggedElement - The element being dragged (will be temporarily hidden)
   * @param groupName - The drag-and-drop group name to filter by
   * @returns The droppable element, or null if none found
   */
  findDroppableAtPoint(
    x: number,
    y: number,
    draggedElement: HTMLElement,
    groupName: string
  ): HTMLElement | null {
    // Temporarily hide the dragged element to "see through" it
    const originalPointerEvents = draggedElement.style.pointerEvents;
    draggedElement.style.pointerEvents = 'none';

    try {
      const elementAtPoint = document.elementFromPoint(x, y);
      if (!elementAtPoint) {
        return null;
      }

      return this.getDroppableParent(elementAtPoint as HTMLElement, groupName);
    } finally {
      // Always restore pointer events
      draggedElement.style.pointerEvents = originalPointerEvents;
    }
  }

  /**
   * Find the draggable element at a given point.
   *
   * @param x - Cursor X coordinate
   * @param y - Cursor Y coordinate
   * @param draggedElement - The element being dragged (will be temporarily hidden)
   * @returns The draggable element, or null if none found
   */
  findDraggableAtPoint(x: number, y: number, draggedElement: HTMLElement): HTMLElement | null {
    // Temporarily hide the dragged element
    const originalPointerEvents = draggedElement.style.pointerEvents;
    draggedElement.style.pointerEvents = 'none';

    try {
      const elementAtPoint = document.elementFromPoint(x, y);
      if (!elementAtPoint) {
        return null;
      }

      return this.getDraggableParent(elementAtPoint as HTMLElement);
    } finally {
      draggedElement.style.pointerEvents = originalPointerEvents;
    }
  }

  /**
   * Walk up the DOM tree to find a droppable parent element.
   *
   * @param element - Starting element
   * @param groupName - The drag-and-drop group name to filter by
   * @returns The droppable parent element, or null if none found
   */
  getDroppableParent(element: HTMLElement, groupName: string): HTMLElement | null {
    let current: HTMLElement | null = element;
    let count = 0;

    while (current && current.tagName !== 'BODY' && count < this.MAX_PARENT_TRAVERSAL) {
      const foundGroup = current.getAttribute(this.DROPPABLE_GROUP_ATTR);

      if (foundGroup && foundGroup === groupName) {
        return current;
      }

      current = current.parentElement;
      count++;
    }

    return null;
  }

  /**
   * Walk up the DOM tree to find a draggable parent element.
   *
   * @param element - Starting element
   * @returns The draggable parent element, or null if none found
   */
  getDraggableParent(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;
    let count = 0;

    while (current && current.tagName !== 'BODY' && count < this.MAX_PARENT_TRAVERSAL) {
      const draggableId = current.getAttribute(this.DRAGGABLE_ID_ATTR);

      if (draggableId) {
        return current;
      }

      current = current.parentElement;
      count++;
    }

    return null;
  }

  /**
   * Get the draggable ID from an element.
   */
  getDraggableId(element: HTMLElement): string | null {
    return element.getAttribute(this.DRAGGABLE_ID_ATTR);
  }

  /**
   * Get the droppable ID from an element.
   */
  getDroppableId(element: HTMLElement): string | null {
    return element.getAttribute(this.DROPPABLE_ID_ATTR);
  }

  /**
   * Calculate the drop index based on mathematical position.
   *
   * This is an alternative approach that doesn't require the target element
   * to be in the DOM. Useful when the target might be virtualized away.
   *
   * @param scrollTop - Current scroll position of the container
   * @param cursorY - Cursor Y position (viewport-relative)
   * @param containerTop - Top position of the container (viewport-relative)
   * @param itemHeight - Height of each item
   * @param totalItems - Total number of items in the list
   * @returns The calculated drop index
   */
  calculateDropIndex(
    scrollTop: number,
    cursorY: number,
    containerTop: number,
    itemHeight: number,
    totalItems: number
  ): number {
    // Calculate the position relative to the container's content
    const relativeY = cursorY - containerTop + scrollTop;

    // Calculate which item index this corresponds to
    const index = Math.floor(relativeY / itemHeight);

    // Clamp to valid range
    return Math.max(0, Math.min(index, totalItems));
  }

  /**
   * Check if a point is within a specific threshold of a container's edge.
   *
   * @param position - Current cursor position
   * @param containerRect - Container's bounding rect
   * @param threshold - Distance from edge to trigger (in pixels)
   * @returns Object indicating which edges are near
   */
  getNearEdge(
    position: { x: number; y: number },
    containerRect: DOMRect,
    threshold: number
  ): { top: boolean; bottom: boolean; left: boolean; right: boolean } {
    return {
      top: position.y - containerRect.top <= threshold,
      bottom: containerRect.bottom - position.y <= threshold,
      left: position.x - containerRect.left <= threshold,
      right: containerRect.right - position.x <= threshold,
    };
  }

  /**
   * Determine if the cursor is inside a container.
   */
  isInsideContainer(position: { x: number; y: number }, containerRect: DOMRect): boolean {
    return (
      position.x >= containerRect.left &&
      position.x <= containerRect.right &&
      position.y >= containerRect.top &&
      position.y <= containerRect.bottom
    );
  }
}
