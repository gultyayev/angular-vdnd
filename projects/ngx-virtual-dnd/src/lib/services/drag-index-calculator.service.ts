import { inject, Injectable } from '@angular/core';
import { type CursorPosition, END_OF_LIST, type GrabOffset } from '../models/drag-drop.models';
import { PositionCalculatorService } from './position-calculator.service';
import type { VirtualScrollStrategy } from '../models/virtual-scroll-strategy';

@Injectable({
  providedIn: 'root',
})
export class DragIndexCalculatorService {
  readonly #positionCalculator = inject(PositionCalculatorService);

  /** Registered strategies by droppable ID */
  readonly #strategies = new Map<string, VirtualScrollStrategy>();

  /**
   * Register a virtual scroll strategy for a droppable.
   * Used by virtual scroll components to provide dynamic height lookups.
   */
  registerStrategy(droppableId: string, strategy: VirtualScrollStrategy): void {
    this.#strategies.set(droppableId, strategy);
  }

  /**
   * Unregister a strategy when the droppable is destroyed.
   */
  unregisterStrategy(droppableId: string): void {
    this.#strategies.delete(droppableId);
  }

  /**
   * Get the registered strategy for a droppable ID.
   * Used by draggable to calculate source index with variable heights.
   */
  getStrategyForDroppable(droppableId: string): VirtualScrollStrategy | undefined {
    return this.#strategies.get(droppableId);
  }

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
      rect = container.getBoundingClientRect();
      currentScrollTop = container.scrollTop;
    } else if (virtualContent) {
      // Page-level scroll: find scrollable parent and get adjusted scroll
      const scrollableParent = virtualContent.closest('.vdnd-scrollable') as HTMLElement | null;
      if (scrollableParent) {
        container = scrollableParent;
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
        rect = container.getBoundingClientRect();
        currentScrollTop = 0;
      }
    } else {
      // Fallback: use droppable element directly
      container = droppableElement;
      rect = container.getBoundingClientRect();
      currentScrollTop = container.scrollTop;
    }

    // Check if a registered strategy exists for this droppable
    const currentDroppableId = this.#positionCalculator.getDroppableId(droppableElement);
    const strategy = currentDroppableId ? this.#strategies.get(currentDroppableId) : null;

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
    // So preview center = cursorPosition.y - grabOffset.y + previewHeight/2
    // Using math avoids Safari's stale getBoundingClientRect() issue during autoscroll
    // Use actual dragged item height when available (important for dynamic heights)
    const previewHeight = this.#getDraggedItemHeightFallback(draggedItemHeight, itemHeight);
    const previewCenterY = position.y - (grabOffset?.y ?? 0) + previewHeight / 2;

    // Convert to visual index
    const relativeY = previewCenterY - rect.top + currentScrollTop;

    // Determine same-list drag info before strategy branch
    const isSameList = sourceDroppableId !== null && sourceDroppableId === currentDroppableId;
    const sourceIndexValue = isSameList ? (sourceIndex ?? -1) : -1;

    let visualIndex: number;
    if (strategy) {
      // Excluded index is set persistently by VirtualForDirective's effect,
      // so findIndexAtOffset already skips the hidden dragged item.
      visualIndex = strategy.findIndexAtOffset(relativeY);
    } else {
      // Fixed height: simple division
      visualIndex = Math.floor(relativeY / itemHeight);
    }

    // Same-list +1 adjustment:
    // - No strategy: always adjust when visual index is at/after source
    // - Strategy: adjust only if exclusion has not been applied yet
    //   (prevents an off-by-one window during early drag updates)
    let placeholderIndex = visualIndex;
    if (isSameList && sourceIndexValue >= 0 && visualIndex >= sourceIndexValue) {
      const needsAdjustment = !strategy || !this.#isSourceIndexExcluded(strategy, sourceIndexValue);
      if (needsAdjustment) {
        placeholderIndex = visualIndex + 1;
      }
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
    // Check if a registered strategy exists
    const droppableId = this.#positionCalculator.getDroppableId(droppableElement);
    const strategy = droppableId ? this.#strategies.get(droppableId) : null;

    // Check for embedded virtual scroll component
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');
    if (virtualScroll) {
      // Use data-total-items attribute if available (always the true N)
      const totalItemsAttr = virtualScroll.getAttribute('data-total-items');
      if (totalItemsAttr) {
        const count = parseInt(totalItemsAttr, 10);
        if (Number.isFinite(count)) {
          return count;
        }
      }

      // Fallback: Use the spacer's height, NOT scrollHeight, to determine item count.
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

      // When strategy exists, spacer height already accounts for exclusion
      // Don't apply same-list +1 adjustment — strategy handles it
      if (strategy) {
        const count = Math.round(totalHeight / itemHeight);
        return count;
      }

      // Spacer height reflects full N items (getTotalHeight no longer excludes)
      const count = Math.floor(totalHeight / itemHeight);
      return count;
    }

    // Check for page-level scroll (vdnd-virtual-content)
    const virtualContent = droppableElement.matches('vdnd-virtual-content')
      ? droppableElement
      : droppableElement.closest('vdnd-virtual-content');
    if (virtualContent) {
      // Prefer explicit total items attribute (works for both fixed and dynamic heights)
      const totalItemsAttr = (virtualContent as HTMLElement).getAttribute('data-total-items');
      if (totalItemsAttr) {
        const count = parseInt(totalItemsAttr, 10);
        if (Number.isFinite(count)) {
          // data-total-items is always the true total N (from totalItems input)
          return count;
        }
      }

      // Fallback: use spacer height to determine total items
      const spacer = virtualContent.querySelector('.vdnd-content-spacer') as HTMLElement | null;
      if (spacer) {
        const totalHeight = parseFloat(spacer.style.height) || 0;
        const configuredHeight = virtualContent.getAttribute('data-item-height');
        const itemHeight = configuredHeight
          ? parseInt(configuredHeight, 10)
          : this.#getDraggedItemHeightFallback(draggedItemHeight, 72);
        return Math.floor(totalHeight / itemHeight);
      }
    }

    // Fallback for non-virtual scroll — querySelectorAll finds all N items
    // (including the hidden dragged item), so no adjustment needed
    const items = droppableElement.querySelectorAll('[data-draggable-id]');
    return items.length;
  }

  #getDraggedItemHeightFallback(height: number, fallback: number): number {
    return Number.isFinite(height) && height > 0 ? height : fallback;
  }

  /**
   * Detect whether a strategy has already excluded the source index.
   *
   * With exclusion applied, the source slot collapses in visual space:
   * offset(sourceIndex + 1) <= offset(sourceIndex). Without exclusion,
   * the next offset is strictly greater.
   */
  #isSourceIndexExcluded(strategy: VirtualScrollStrategy, sourceIndex: number): boolean {
    if (sourceIndex < 0) {
      return false;
    }

    const sourceOffset = strategy.getOffsetForIndex(sourceIndex);
    const nextOffset = strategy.getOffsetForIndex(sourceIndex + 1);

    return nextOffset <= sourceOffset;
  }
}
