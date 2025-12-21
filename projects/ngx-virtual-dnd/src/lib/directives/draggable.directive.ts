import {
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
import {
  CursorPosition,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  END_OF_LIST,
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

  /** Emits when drag starts */
  dragStart = output<DragStartEvent>();

  /** Emits during drag movement */
  dragMove = output<DragMoveEvent>();

  /** Emits when drag ends */
  dragEnd = output<DragEndEvent>();

  /** Whether this element is currently being dragged */
  readonly isDragging = signal(false);

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

    this.ngZone.run(() => {
      this.isDragging.set(true);

      // Register with drag state service
      this.dragState.startDrag({
        draggableId: this.vdndDraggable(),
        droppableId: this.getParentDroppableId() ?? '',
        element,
        height: rect.height,
        width: rect.width,
        data: this.vdndDraggableData(),
      });

      // Start auto-scroll monitoring
      this.autoScroll.startMonitoring();

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
   * Update the drag position.
   */
  private updateDrag(position: CursorPosition): void {
    const element = this.elementRef.nativeElement;
    const groupName = this.vdndDraggableGroup();

    // Find droppable at cursor position
    const droppableElement = this.positionCalculator.findDroppableAtPoint(
      position.x,
      position.y,
      element,
      groupName
    );

    const activeDroppableId = droppableElement
      ? this.positionCalculator.getDroppableId(droppableElement)
      : null;

    let placeholderId: string | null = null;
    let placeholderIndex: number | null = null;

    if (droppableElement) {
      // Calculate placeholder index based on cursor position using mathematical approach
      // This is more stable than DOM-based detection because it doesn't get affected
      // by the placeholder insertion shifting elements around
      const indexResult = this.calculatePlaceholderIndex(droppableElement, position);
      placeholderIndex = indexResult.index;
      placeholderId = indexResult.placeholderId;
    }

    // Update drag state
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
   */
  private calculatePlaceholderIndex(
    droppableElement: HTMLElement,
    position: CursorPosition
  ): { index: number; placeholderId: string } {
    // Look for virtual scroll container within the droppable
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');

    // Get the scrollable element and its properties
    const scrollableElement = virtualScroll ?? droppableElement;
    const rect = scrollableElement.getBoundingClientRect();
    const scrollTop = scrollableElement.scrollTop;
    const scrollHeight = scrollableElement.scrollHeight;

    // Try to get item height from virtual scroll or estimate from first item
    let itemHeight = 50; // Default fallback
    const firstItem = droppableElement.querySelector('[data-draggable-id]');
    if (firstItem) {
      const itemRect = firstItem.getBoundingClientRect();
      itemHeight = itemRect.height || 50;
    }

    // Calculate total items from scroll height (works with virtual scroll)
    // This gives us the actual total, not just visible items
    const totalItemsFromScroll = Math.round(scrollHeight / itemHeight);

    // Also get visible items for ID lookup
    const allDraggables = droppableElement.querySelectorAll(
      '[data-draggable-id]:not([data-draggable-id="placeholder"])'
    );

    // Calculate the logical index based on cursor position
    // This ignores any placeholder that might be in the DOM
    const relativeY = position.y - rect.top + scrollTop;
    const rawIndex = Math.floor(relativeY / itemHeight);

    // Clamp to valid range [0, totalItems]
    const clampedIndex = Math.max(0, Math.min(rawIndex, totalItemsFromScroll));

    // Determine the placeholderId
    // If at the end or beyond visible range, use END_OF_LIST
    if (clampedIndex >= totalItemsFromScroll) {
      return { index: totalItemsFromScroll, placeholderId: END_OF_LIST };
    }

    // Try to find the item at the calculated index in the visible items
    // With virtual scroll, we need to account for the scroll offset
    const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
    const visibleIndex = clampedIndex - firstVisibleIndex;

    if (visibleIndex >= 0 && visibleIndex < allDraggables.length) {
      const targetItem = allDraggables[visibleIndex];
      const targetId = targetItem?.getAttribute('data-draggable-id');

      // If the target is the item being dragged, skip it
      if (targetId === this.vdndDraggable()) {
        // If dragging within the same list, adjust the index
        return {
          index: clampedIndex + 1,
          placeholderId: END_OF_LIST,
        };
      }

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
      this.isDragging.set(false);

      // Stop auto-scroll monitoring
      this.autoScroll.stopMonitoring();

      // Emit drag end event
      this.dragEnd.emit({
        draggableId: this.vdndDraggable(),
        droppableId: this.getParentDroppableId() ?? '',
        cancelled,
        data: this.vdndDraggableData(),
      });

      // Clear drag state
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
