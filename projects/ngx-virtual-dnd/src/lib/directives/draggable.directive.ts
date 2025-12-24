import {
  computed,
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { DragStateService } from '../services/drag-state.service';
import { PositionCalculatorService } from '../services/position-calculator.service';
import { AutoScrollService } from '../services/auto-scroll.service';
import { ElementCloneService } from '../services/element-clone.service';
import {
  CursorPosition,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  END_OF_LIST,
  GrabOffset,
} from '../models/drag-drop.models';

/**
 * Makes an element draggable within the virtual scroll drag-and-drop system.
 *
 * @example
 * ```html
 * <div
 *   vdndDraggable="item-1"
 *   vdndDraggableGroup="my-group"
 *   [vdndDraggableData]="item">
 *   Drag me!
 * </div>
 * ```
 */
@Directive({
  selector: '[vdndDraggable]',
  host: {
    '[attr.data-draggable-id]': 'vdndDraggable()',
    '[class.vdnd-draggable]': 'true',
    '[class.vdnd-draggable-dragging]': 'isDragging()',
    '[class.vdnd-draggable-disabled]': 'disabled()',
    '[style.display]': 'isDragging() ? "none" : null',
    '[attr.aria-grabbed]': 'isDragging()',
    '[attr.aria-dropeffect]': '"move"',
    '[tabindex]': 'disabled() ? -1 : 0',
    '(mousedown)': 'onPointerDown($event, false)',
    '(touchstart)': 'onPointerDown($event, true)',
    '(keydown.space)': 'onKeyboardActivate()',
    '(keydown.escape)': 'onEscape()',
  },
})
export class DraggableDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly dragState = inject(DragStateService);
  private readonly positionCalculator = inject(PositionCalculatorService);
  private readonly autoScroll = inject(AutoScrollService);
  private readonly elementClone = inject(ElementCloneService);
  private readonly ngZone = inject(NgZone);

  /** Unique identifier for this draggable */
  vdndDraggable = input.required<string>();

  /** Drag-and-drop group name */
  vdndDraggableGroup = input.required<string>();

  /** Optional data associated with this draggable */
  vdndDraggableData = input<unknown>();

  /** Whether this draggable is disabled */
  disabled = input<boolean>(false);

  /** CSS selector for drag handle (if not provided, entire element is draggable) */
  dragHandle = input<string>();

  /** Minimum distance to move before drag starts (prevents accidental drags) */
  dragThreshold = input<number>(5);

  /**
   * Delay in milliseconds before drag starts after pointer down.
   * User must hold without moving for this duration.
   * Set to 0 for immediate drag (default behavior).
   */
  dragDelay = input<number>(0);

  /** Lock dragging to a single axis ('x' = horizontal only, 'y' = vertical only) */
  lockAxis = input<'x' | 'y' | null>(null);

  /** Emits when drag starts */
  dragStart = output<DragStartEvent>();

  /** Emits during drag movement */
  dragMove = output<DragMoveEvent>();

  /** Emits when drag ends */
  dragEnd = output<DragEndEvent>();

  /** Whether this element is currently being dragged (based on global drag state) */
  readonly isDragging = computed(() => {
    const draggedItem = this.dragState.draggedItem();
    return draggedItem?.draggableId === this.vdndDraggable();
  });

  /** Starting position of the drag */
  private startPosition: CursorPosition | null = null;

  /** Whether we're currently tracking a potential drag */
  private isTracking = false;

  /** Whether touch events are being used */
  private isTouch = false;

  /** Bound event handlers for cleanup */
  private boundPointerMove: ((e: MouseEvent | TouchEvent) => void) | null = null;
  private boundPointerUp: ((e: MouseEvent | TouchEvent) => void) | null = null;

  /** Request animation frame ID for drag updates */
  private rafId: number | null = null;

  /** Timer ID for drag delay */
  private delayTimerId: ReturnType<typeof setTimeout> | null = null;

  /** Whether the delay has been satisfied (user held long enough) */
  private delayReady = false;

  ngOnInit(): void {
    // Set up event listeners
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Handle pointer down (mouse or touch).
   */
  protected onPointerDown(event: MouseEvent | TouchEvent, isTouch: boolean): void {
    if (this.disabled()) {
      return;
    }

    // Check for left mouse button only
    if (!isTouch && (event as MouseEvent).button !== 0) {
      return;
    }

    // Check if click is on drag handle (if specified)
    const handle = this.dragHandle();
    if (handle) {
      const target = event.target as HTMLElement;
      if (!target.closest(handle)) {
        return;
      }
    }

    // Check for elements that should not trigger drag
    const target = event.target as HTMLElement;
    if (
      target.closest('button, input, textarea, select, [contenteditable]') ||
      target.classList.contains('no-drag')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.isTouch = isTouch;
    this.isTracking = true;
    this.startPosition = this.getPosition(event);

    // Handle drag delay
    const delay = this.dragDelay();
    if (delay > 0) {
      this.delayReady = false;
      this.delayTimerId = setTimeout(() => {
        this.delayReady = true;
        this.delayTimerId = null;
      }, delay);
    } else {
      this.delayReady = true;
    }

    // Add document-level event listeners
    this.ngZone.runOutsideAngular(() => {
      if (isTouch) {
        document.addEventListener('touchmove', this.boundPointerMove!, { passive: false });
        document.addEventListener('touchend', this.boundPointerUp!);
        document.addEventListener('touchcancel', this.boundPointerUp!);
      } else {
        document.addEventListener('mousemove', this.boundPointerMove!);
        document.addEventListener('mouseup', this.boundPointerUp!);
      }
    });
  }

  /**
   * Handle pointer move (mouse or touch).
   */
  private onPointerMove(event: MouseEvent | TouchEvent): void {
    if (!this.isTracking) {
      return;
    }

    const position = this.getPosition(event);

    // Check if we've moved past the threshold
    if (!this.isDragging() && this.startPosition) {
      const distance = Math.sqrt(
        Math.pow(position.x - this.startPosition.x, 2) +
          Math.pow(position.y - this.startPosition.y, 2)
      );

      if (distance < this.dragThreshold()) {
        return;
      }

      // If delay is configured and not yet ready, cancel the drag attempt
      // (user moved before the delay was satisfied)
      if (!this.delayReady) {
        this.cancelDelayTimer();
        this.cleanup();
        return;
      }

      // Start the drag
      this.startDrag(position);
    }

    event.preventDefault();

    // Throttle drag updates with requestAnimationFrame
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      this.updateDrag(position);
      this.rafId = null;
    });
  }

  /**
   * Cancel the delay timer if active.
   */
  private cancelDelayTimer(): void {
    if (this.delayTimerId !== null) {
      clearTimeout(this.delayTimerId);
      this.delayTimerId = null;
    }
    this.delayReady = false;
  }

  /**
   * Handle pointer up (mouse or touch).
   */
  private onPointerUp(event: MouseEvent | TouchEvent): void {
    if (!this.isTracking) {
      return;
    }

    event.preventDefault();

    if (this.isDragging()) {
      this.endDrag(false);
    }

    this.cleanup();
  }

  /**
   * Handle keyboard activation (space key).
   */
  protected onKeyboardActivate(): boolean {
    if (this.disabled()) {
      return true;
    }

    // Keyboard drag is complex to implement properly
    // For now, we'll just prevent default behavior
    // Full implementation would involve arrow keys for movement
    return false; // Prevents default
  }

  /**
   * Handle escape key to cancel drag.
   */
  protected onEscape(): boolean {
    if (this.isDragging()) {
      this.endDrag(true);
      this.cleanup();
      return false; // Prevents default
    }
    return true;
  }

  /**
   * Start the drag operation.
   */
  private startDrag(position: CursorPosition): void {
    const element = this.elementRef.nativeElement;
    const rect = element.getBoundingClientRect();

    // Calculate grab offset (cursor position relative to element's top-left corner)
    // This allows the preview to maintain its position relative to where the user grabbed it
    const grabOffset: GrabOffset = {
      x: position.x - rect.left,
      y: position.y - rect.top,
    };

    // Clone element BEFORE updating drag state (which triggers display:none via host binding)
    const clonedElement = this.elementClone.cloneElement(element);

    // Find droppable and calculate initial placeholder position
    // This fixes the UI glitch by ensuring placeholder is set before the element is hidden
    const groupName = this.vdndDraggableGroup();
    const droppableElement = this.positionCalculator.findDroppableAtPoint(
      position.x,
      position.y,
      element,
      groupName
    );

    const activeDroppableId = droppableElement
      ? this.positionCalculator.getDroppableId(droppableElement)
      : this.getParentDroppableId();

    // Calculate source index BEFORE the element is hidden (display: none)
    // This is critical because getBoundingClientRect() returns all zeros for hidden elements
    const sourceIndex = this.calculateSourceIndex(element, droppableElement);

    let initialPlaceholderId: string | null = null;
    let initialPlaceholderIndex: number | null = null;

    if (droppableElement) {
      const indexResult = this.calculatePlaceholderIndex(droppableElement, position, sourceIndex);
      initialPlaceholderIndex = indexResult.index;
      initialPlaceholderId = indexResult.placeholderId;
    }

    this.ngZone.run(() => {
      // Register with drag state service - this triggers isDragging computed to become true
      // which will apply display:none via host binding
      this.dragState.startDrag(
        {
          draggableId: this.vdndDraggable(),
          droppableId: this.getParentDroppableId() ?? '',
          element,
          clonedElement,
          height: rect.height,
          width: rect.width,
          data: this.vdndDraggableData(),
        },
        position,
        grabOffset,
        this.lockAxis(),
        activeDroppableId,
        initialPlaceholderId,
        initialPlaceholderIndex,
        sourceIndex
      );

      // Start auto-scroll monitoring with a callback to recalculate placeholder
      this.autoScroll.startMonitoring(() => this.recalculatePlaceholder());

      // Emit drag start event
      this.dragStart.emit({
        draggableId: this.vdndDraggable(),
        droppableId: this.getParentDroppableId() ?? '',
        data: this.vdndDraggableData(),
        position,
      });
    });
  }

  /**
   * Calculate the source index of the dragged element BEFORE it's hidden.
   * This must be called before startDrag updates the state (which triggers display:none).
   */
  private calculateSourceIndex(
    element: HTMLElement,
    droppableElement: HTMLElement | null
  ): number {
    if (!droppableElement) {
      return 0;
    }

    const rect = element.getBoundingClientRect();
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');
    const scrollableElement = virtualScroll ?? droppableElement;
    const containerRect = scrollableElement.getBoundingClientRect();
    const scrollTop = scrollableElement.scrollTop;

    // Get item height from the element itself
    const itemHeight = rect.height || 50;

    // Calculate the logical index based on the element's position
    const relativeY = rect.top - containerRect.top + scrollTop;
    return Math.round(relativeY / itemHeight);
  }

  /**
   * Recalculate placeholder position (called during auto-scroll).
   */
  private recalculatePlaceholder(): void {
    const cursorPosition = this.dragState.cursorPosition();
    if (!cursorPosition || !this.isDragging()) {
      return;
    }

    // Use the last known cursor position with current scroll state
    this.updateDrag(cursorPosition);
  }

  /**
   * Update the drag position.
   */
  private updateDrag(position: CursorPosition): void {
    const element = this.elementRef.nativeElement;
    const groupName = this.vdndDraggableGroup();

    // Apply axis locking to effective position for droppable detection
    // When axis is locked, use the start position for the locked axis
    const axisLock = this.lockAxis();
    let effectivePosition = position;

    if (axisLock && this.startPosition) {
      effectivePosition = {
        x: axisLock === 'x' ? this.startPosition.x : position.x,
        y: axisLock === 'y' ? this.startPosition.y : position.y,
      };
    }

    // Find droppable at effective position (respects axis locking)
    const droppableElement = this.positionCalculator.findDroppableAtPoint(
      effectivePosition.x,
      effectivePosition.y,
      element,
      groupName
    );

    const activeDroppableId = droppableElement
      ? this.positionCalculator.getDroppableId(droppableElement)
      : null;

    let placeholderId: string | null = null;
    let placeholderIndex: number | null = null;

    if (droppableElement) {
      // Calculate placeholder index based on effective position using mathematical approach
      // This is more stable than DOM-based detection because it doesn't get affected
      // by the placeholder insertion shifting elements around
      const indexResult = this.calculatePlaceholderIndex(droppableElement, effectivePosition);
      placeholderIndex = indexResult.index;
      placeholderId = indexResult.placeholderId;
    }

    // Update drag state with actual cursor position (for preview rendering)
    this.ngZone.run(() => {
      this.dragState.updateDragPosition({
        cursorPosition: position,
        activeDroppableId,
        placeholderId,
        placeholderIndex,
      });

      // Emit drag move event
      this.dragMove.emit({
        draggableId: this.vdndDraggable(),
        sourceDroppableId: this.getParentDroppableId() ?? '',
        targetDroppableId: activeDroppableId,
        placeholderId,
        position,
      });
    });
  }

  /**
   * Calculate the placeholder index based on cursor position.
   * Uses mathematical calculation instead of DOM-based detection to avoid
   * flickering caused by the placeholder insertion shifting elements.
   *
   * @param droppableElement The droppable container element
   * @param position Current cursor position
   * @param sourceIndexOverride Optional source index (used at drag start before element is hidden)
   */
  private calculatePlaceholderIndex(
    droppableElement: HTMLElement,
    position: CursorPosition,
    sourceIndexOverride?: number
  ): { index: number; placeholderId: string } {
    // Look for virtual scroll container within the droppable
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');

    // Get the scrollable element and its properties
    const scrollableElement = virtualScroll ?? droppableElement;
    const rect = scrollableElement.getBoundingClientRect();
    const scrollTop = scrollableElement.scrollTop;
    const scrollHeight = scrollableElement.scrollHeight;

    // Get consistent item height from the dragged item (stable throughout the drag)
    // This prevents drift during auto-scroll when different items become visible
    const draggedItem = this.dragState.draggedItem();
    const itemHeight = draggedItem?.height ?? 50;

    // Get visible items for placeholderId lookup later
    const visibleItems = droppableElement.querySelectorAll(
      '[data-draggable-id]:not([data-draggable-id="placeholder"])'
    );

    // Check if we're dragging within the same list
    const sourceDroppableId = this.dragState.sourceDroppableId();
    const currentDroppableId = this.positionCalculator.getDroppableId(droppableElement);
    const isSameList = sourceDroppableId === currentDroppableId;

    // Get the source index - use stored value from drag state (calculated before element was hidden)
    const draggedItemOriginalIndex = isSameList
      ? (sourceIndexOverride ?? this.dragState.sourceIndex() ?? -1)
      : -1;

    // Calculate total items from scroll height (works with virtual scroll)
    // When in same list, the dragged item is hidden so we need to add 1 back
    let totalItemsFromScroll = Math.round(scrollHeight / itemHeight);
    if (isSameList && draggedItemOriginalIndex >= 0) {
      totalItemsFromScroll += 1; // Account for the hidden dragged item
    }

    // Calculate the logical index based on the preview's CENTER position
    // The preview renders at (cursor - grabOffset), so its center is at:
    // cursor.y - grabOffset.y + itemHeight/2
    // This ensures the placeholder appears where the preview visually is,
    // not where the cursor is (which may differ based on where the user grabbed the item)
    const grabOffset = this.dragState.grabOffset();
    const previewCenterY = grabOffset
      ? position.y - grabOffset.y + itemHeight / 2
      : position.y;
    const relativeY = previewCenterY - rect.top + scrollTop;
    const rawIndex = Math.floor(relativeY / itemHeight);

    // Adjust index when dragging within same list
    // Because the dragged item is hidden (display: none), items below it shift up visually
    // If cursor is at or after the dragged item's original position, add 1 to compensate
    let adjustedIndex = rawIndex;
    if (isSameList && draggedItemOriginalIndex >= 0 && rawIndex >= draggedItemOriginalIndex) {
      adjustedIndex = rawIndex + 1;
    }

    // Clamp to valid range [0, totalItems]
    const clampedIndex = Math.max(0, Math.min(adjustedIndex, totalItemsFromScroll));

    // Determine the placeholderId
    // If at the end or beyond visible range, use END_OF_LIST
    if (clampedIndex >= totalItemsFromScroll) {
      return { index: totalItemsFromScroll, placeholderId: END_OF_LIST };
    }

    // Try to find the item at the calculated index in the visible items
    // With virtual scroll, we need to account for the scroll offset
    // Also account for the hidden dragged item when calculating first visible index
    let firstVisibleIndex = Math.floor(scrollTop / itemHeight);
    if (isSameList && draggedItemOriginalIndex >= 0 && draggedItemOriginalIndex < firstVisibleIndex) {
      firstVisibleIndex += 1;
    }

    const visibleIndex = clampedIndex - firstVisibleIndex;

    // Filter out the dragged item from visible items for lookup
    const allDraggables = Array.from(visibleItems).filter(
      (item) => item.getAttribute('data-draggable-id') !== this.vdndDraggable()
    );

    if (visibleIndex >= 0 && visibleIndex < allDraggables.length) {
      const targetItem = allDraggables[visibleIndex];
      const targetId = targetItem?.getAttribute('data-draggable-id');

      return {
        index: clampedIndex,
        placeholderId: targetId ?? END_OF_LIST,
      };
    }

    // If the target item isn't visible (virtualized), use END_OF_LIST as placeholder ID
    // but still use the calculated index for positioning
    return {
      index: clampedIndex,
      placeholderId: END_OF_LIST,
    };
  }

  /**
   * End the drag operation.
   */
  private endDrag(cancelled: boolean): void {
    this.ngZone.run(() => {
      // Stop auto-scroll monitoring
      this.autoScroll.stopMonitoring();

      // Emit drag end event
      this.dragEnd.emit({
        draggableId: this.vdndDraggable(),
        droppableId: this.getParentDroppableId() ?? '',
        cancelled,
        data: this.vdndDraggableData(),
      });

      // Clear drag state - this triggers isDragging computed to become false
      if (cancelled) {
        this.dragState.cancelDrag();
      } else {
        this.dragState.endDrag();
      }
    });
  }

  /**
   * Get the parent droppable ID.
   */
  private getParentDroppableId(): string | null {
    const droppable = this.positionCalculator.getDroppableParent(
      this.elementRef.nativeElement,
      this.vdndDraggableGroup()
    );

    return droppable ? this.positionCalculator.getDroppableId(droppable) : null;
  }

  /**
   * Get position from mouse or touch event.
   */
  private getPosition(event: MouseEvent | TouchEvent): CursorPosition {
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: event.clientX, y: event.clientY };
  }

  /**
   * Clean up event listeners and state.
   */
  private cleanup(): void {
    this.isTracking = false;
    this.startPosition = null;
    this.cancelDelayTimer();

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Remove event listeners
    if (this.boundPointerMove) {
      document.removeEventListener('mousemove', this.boundPointerMove);
      document.removeEventListener('touchmove', this.boundPointerMove);
    }
    if (this.boundPointerUp) {
      document.removeEventListener('mouseup', this.boundPointerUp);
      document.removeEventListener('touchend', this.boundPointerUp);
      document.removeEventListener('touchcancel', this.boundPointerUp);
    }
  }
}
