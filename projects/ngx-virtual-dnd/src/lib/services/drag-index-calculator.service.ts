import { inject, Injectable } from '@angular/core';
import { type CursorPosition, END_OF_LIST, type GrabOffset } from '../models/drag-drop.models';
import { PositionCalculatorService } from './position-calculator.service';

@Injectable({
  providedIn: 'root',
})
export class DragIndexCalculatorService {
  readonly #positionCalculator = inject(PositionCalculatorService);

  getTotalItemCount(args: {
    droppableElement: HTMLElement;
    isSameList: boolean;
    draggedItemHeight: number;
  }): number {
    return this.#getTotalItemCount(args.droppableElement, args.isSameList, args.draggedItemHeight);
  }

  calculatePlaceholderIndex(args: {
    droppableElement: HTMLElement;
    position: CursorPosition;
    grabOffset: GrabOffset | null;
    draggedItemHeight: number;
    sourceDroppableId: string | null;
    sourceIndex: number | null;
  }): { index: number; placeholderId: string } {
    const {
      droppableElement,
      position,
      grabOffset,
      draggedItemHeight,
      sourceDroppableId,
      sourceIndex,
    } = args;

    // Get container and measurements - handle both embedded virtual-scroll and page-level scroll
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');
    const virtualContent = droppableElement.matches('vdnd-virtual-content')
      ? droppableElement
      : droppableElement.closest('vdnd-virtual-content');

    let container: HTMLElement;
    let currentScrollTop: number;
    let rect: DOMRect;

    if (virtualScroll) {
      // Standard virtual scroll component - scroll container is the virtual scroll element
      container = virtualScroll as HTMLElement;
      // Force layout flush - critical for Safari after programmatic scroll
      void container.offsetHeight;
      rect = container.getBoundingClientRect();
      currentScrollTop = container.scrollTop;
    } else if (virtualContent) {
      // Page-level scroll: find scrollable parent and get adjusted scroll
      const scrollableParent = virtualContent.closest('.vdnd-scrollable') as HTMLElement | null;
      if (scrollableParent) {
        container = scrollableParent;
        void container.offsetHeight;
        // Use scroll container rect + content offset to avoid stale virtualContent rects.
        rect = container.getBoundingClientRect();
        const contentOffsetAttr = (virtualContent as HTMLElement).getAttribute(
          'data-content-offset',
        );
        const contentOffset = contentOffsetAttr ? parseFloat(contentOffsetAttr) : 0;
        const offsetValue = Number.isFinite(contentOffset) ? contentOffset : 0;
        currentScrollTop = container.scrollTop - offsetValue;
      } else {
        container = virtualContent as HTMLElement;
        void container.offsetHeight;
        rect = container.getBoundingClientRect();
        currentScrollTop = 0;
      }
    } else {
      // Fallback: use droppable element directly
      container = droppableElement;
      void container.offsetHeight;
      rect = container.getBoundingClientRect();
      currentScrollTop = container.scrollTop;
    }

    // Prefer configured item height from virtual scroll/content over actual element height.
    // This prevents drift when actual element height differs from grid spacing.
    const configuredHeight =
      virtualScroll?.getAttribute('data-item-height') ??
      (virtualContent as HTMLElement | null)?.getAttribute('data-item-height');
    const parsedHeight = configuredHeight ? parseFloat(configuredHeight) : Number.NaN;
    const itemHeight = Number.isFinite(parsedHeight)
      ? parsedHeight
      : this.#getDraggedItemHeightFallback(draggedItemHeight, 50);

    // Calculate preview center position mathematically
    // The preview is positioned at: cursorPosition - grabOffset (see drag-preview.component.ts)
    // So preview center = cursorPosition.y - grabOffset.y + itemHeight/2
    // Using math avoids Safari's stale getBoundingClientRect() issue during autoscroll
    const previewCenterY = position.y - (grabOffset?.y ?? 0) + itemHeight / 2;

    // Convert to visual index (which slot the preview center is in)
    const relativeY = previewCenterY - rect.top + currentScrollTop;
    const visualIndex = Math.floor(relativeY / itemHeight);

    // Check if same-list drag
    const currentDroppableId = this.#positionCalculator.getDroppableId(droppableElement);
    const isSameList = sourceDroppableId !== null && sourceDroppableId === currentDroppableId;

    // Same-list adjustment: if pointing at or after source position, add 1
    // This accounts for the hidden item shifting everything up visually
    let placeholderIndex = visualIndex;
    const sourceIndexValue = isSameList ? (sourceIndex ?? -1) : -1;
    if (isSameList && sourceIndexValue >= 0 && visualIndex >= sourceIndexValue) {
      placeholderIndex = visualIndex + 1;
    }

    // Get total items for clamping
    const totalItems = this.#getTotalItemCount(droppableElement, isSameList, draggedItemHeight);

    // Edge detection: allow dropping at the END of the list when cursor is near bottom edge.
    // Due to max scroll limits, the math alone can't reach totalItems when the list is longer
    // than the viewport. If cursor is in the bottom portion of the container and we're at
    // or past the last visible slot, snap to totalItems.
    const cursorRelativeToBottom = rect.bottom - previewCenterY;
    const isNearBottomEdge = cursorRelativeToBottom < itemHeight;
    if (isNearBottomEdge && placeholderIndex >= totalItems - 1) {
      placeholderIndex = totalItems;
    }

    // Clamp to valid range
    placeholderIndex = Math.max(0, Math.min(placeholderIndex, totalItems));

    return { index: placeholderIndex, placeholderId: END_OF_LIST };
  }

  #getTotalItemCount(
    droppableElement: HTMLElement,
    isSameList: boolean,
    draggedItemHeight: number,
  ): number {
    // Check for embedded virtual scroll component
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');
    if (virtualScroll) {
      // Use the spacer's height, NOT scrollHeight, to determine item count.
      // scrollHeight can be inflated by absolutely-positioned elements like the placeholder.
      const spacer = virtualScroll.querySelector(
        '.vdnd-virtual-scroll-spacer',
      ) as HTMLElement | null;
      const configuredHeight = virtualScroll.getAttribute('data-item-height');
      const itemHeight = configuredHeight
        ? parseInt(configuredHeight, 10)
        : this.#getDraggedItemHeightFallback(draggedItemHeight, 50);

      let totalHeight: number;
      if (spacer) {
        // Get the spacer's explicit height (set via Angular binding)
        totalHeight = parseFloat(spacer.style.height) || 0;
      } else {
        // Fallback: use scrollHeight if spacer not found
        totalHeight = (virtualScroll as HTMLElement).scrollHeight;
      }

      // When same-list, spacer height reflects N-1 items (one is hidden)
      // Add 1 back to get true total
      const count = Math.floor(totalHeight / itemHeight);
      return isSameList ? count + 1 : count;
    }

    // Check for page-level scroll (vdnd-virtual-content)
    const virtualContent = droppableElement.matches('vdnd-virtual-content')
      ? droppableElement
      : droppableElement.closest('vdnd-virtual-content');
    if (virtualContent) {
      // Use spacer height to determine total items
      const spacer = virtualContent.querySelector('.vdnd-content-spacer') as HTMLElement | null;
      if (spacer) {
        const totalHeight = parseFloat(spacer.style.height) || 0;
        const configuredHeight = virtualContent.getAttribute('data-item-height');
        const itemHeight = configuredHeight
          ? parseInt(configuredHeight, 10)
          : this.#getDraggedItemHeightFallback(draggedItemHeight, 72);
        const count = Math.floor(totalHeight / itemHeight);
        return isSameList ? count + 1 : count;
      }
    }

    // Fallback for non-virtual scroll
    const items = droppableElement.querySelectorAll('[data-draggable-id]');
    return items.length + (isSameList ? 1 : 0);
  }

  #getDraggedItemHeightFallback(height: number, fallback: number): number {
    return Number.isFinite(height) && height > 0 ? height : fallback;
  }
}
