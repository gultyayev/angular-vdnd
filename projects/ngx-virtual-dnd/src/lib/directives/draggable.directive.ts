import { computed, Directive, ElementRef, inject, input, NgZone, OnDestroy, OnInit, output } from '@angular/core';
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
  GrabOffset
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
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #dragState = inject(DragStateService);
  readonly #positionCalculator = inject(PositionCalculatorService);
  readonly #autoScroll = inject(AutoScrollService);
  readonly #elementClone = inject(ElementCloneService);
  readonly #ngZone = inject(NgZone);

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
    const draggedItem = this.#dragState.draggedItem();
    return draggedItem?.draggableId === this.vdndDraggable();
  });

  /** Starting position of the drag */
  #startPosition: CursorPosition | null = null;

  /** Whether we're currently tracking a potential drag */
  #isTracking = false;

  /** Whether touch events are being used */
  #isTouch = false;

  /** Bound event handlers for cleanup */
  #boundPointerMove: ((e: MouseEvent | TouchEvent) => void) | null = null;
  #boundPointerUp: ((e: MouseEvent | TouchEvent) => void) | null = null;
  #boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  /** Request animation frame ID for drag updates */
  #rafId: number | null = null;

  /** Timer ID for drag delay */
  #delayTimerId: ReturnType<typeof setTimeout> | null = null;

  /** Whether the delay has been satisfied (user held long enough) */
  #delayReady = false;

  ngOnInit(): void {
    // Set up event listeners
    this.#boundPointerMove = this.#onPointerMove.bind(this);
    this.#boundPointerUp = this.#onPointerUp.bind(this);
    this.#boundKeyDown = this.#onKeyDown.bind(this);
  }

  ngOnDestroy(): void {
    this.#cleanup();
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

    this.#isTouch = isTouch;
    this.#isTracking = true;
    this.#startPosition = this.#getPosition(event);

    // Handle drag delay
    const delay = this.dragDelay();
    if (delay > 0) {
      this.#delayReady = false;
      this.#delayTimerId = setTimeout(() => {
        this.#delayReady = true;
        this.#delayTimerId = null;
      }, delay);
    } else {
      this.#delayReady = true;
    }

    // Add document-level event listeners
    this.#ngZone.runOutsideAngular(() => {
      if (isTouch) {
        document.addEventListener('touchmove', this.#boundPointerMove!, { passive: false });
        document.addEventListener('touchend', this.#boundPointerUp!);
        document.addEventListener('touchcancel', this.#boundPointerUp!);
      } else {
        document.addEventListener('mousemove', this.#boundPointerMove!);
        document.addEventListener('mouseup', this.#boundPointerUp!);
      }
      // Listen for Escape key on document to cancel drag
      document.addEventListener('keydown', this.#boundKeyDown!);
    });
  }

  /**
   * Handle pointer move (mouse or touch).
   */
  #onPointerMove(event: MouseEvent | TouchEvent): void {
    if (!this.#isTracking) {
      return;
    }

    const position = this.#getPosition(event);

    // Check if we've moved past the threshold
    if (!this.isDragging() && this.#startPosition) {
      const distance = Math.sqrt(
        Math.pow(position.x - this.#startPosition.x, 2) +
          Math.pow(position.y - this.#startPosition.y, 2)
      );

      if (distance < this.dragThreshold()) {
        return;
      }

      // If delay is configured and not yet ready, cancel the drag attempt
      // (user moved before the delay was satisfied)
      if (!this.#delayReady) {
        this.#cancelDelayTimer();
        this.#cleanup();
        return;
      }

      // Start the drag
      this.#startDrag(position);
    }

    event.preventDefault();

    // Throttle drag updates with requestAnimationFrame
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
    }

    this.#rafId = requestAnimationFrame(() => {
      this.#updateDrag(position);
      this.#rafId = null;
    });
  }

  /**
   * Cancel the delay timer if active.
   */
  #cancelDelayTimer(): void {
    if (this.#delayTimerId !== null) {
      clearTimeout(this.#delayTimerId);
      this.#delayTimerId = null;
    }
    this.#delayReady = false;
  }

  /**
   * Handle pointer up (mouse or touch).
   */
  #onPointerUp(event: MouseEvent | TouchEvent): void {
    if (!this.#isTracking) {
      return;
    }

    event.preventDefault();

    if (this.isDragging()) {
      this.#endDrag(false);
    }

    this.#cleanup();
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
      this.#endDrag(true);
      this.#cleanup();
      return false; // Prevents default
    }
    return true;
  }

  /**
   * Start the drag operation.
   */
  #startDrag(position: CursorPosition): void {
    const element = this.#elementRef.nativeElement;
    const rect = element.getBoundingClientRect();

    // Calculate grab offset using the START position (where user initially pressed down)
    // NOT the current position (where drag threshold was exceeded)
    // This ensures the preview maintains its position relative to where the user grabbed it
    const startPos = this.#startPosition ?? position;
    const grabOffset: GrabOffset = {
      x: startPos.x - rect.left,
      y: startPos.y - rect.top,
    };

    // Clone element BEFORE updating drag state (which triggers display:none via host binding)
    const clonedElement = this.#elementClone.cloneElement(element);

    // Find droppable and calculate initial placeholder position
    // This fixes the UI glitch by ensuring placeholder is set before the element is hidden
    const groupName = this.vdndDraggableGroup();
    const droppableElement = this.#positionCalculator.findDroppableAtPoint(
      position.x,
      position.y,
      element,
      groupName
    );

    const activeDroppableId = droppableElement
      ? this.#positionCalculator.getDroppableId(droppableElement)
      : this.#getParentDroppableId();

    // Calculate source index BEFORE the element is hidden (display: none)
    // This is critical because getBoundingClientRect() returns all zeros for hidden elements
    const sourceIndex = this.#calculateSourceIndex(element, droppableElement);

    let initialPlaceholderId: string | null = null;
    let initialPlaceholderIndex: number | null = null;

    if (droppableElement) {
      const indexResult = this.#calculatePlaceholderIndex(droppableElement, position, sourceIndex);
      initialPlaceholderIndex = indexResult.index;
      initialPlaceholderId = indexResult.placeholderId;
    }

    this.#ngZone.run(() => {
      // Register with drag state service - this triggers isDragging computed to become true
      // which will apply display:none via host binding
      this.#dragState.startDrag(
        {
          draggableId: this.vdndDraggable(),
          droppableId: this.#getParentDroppableId() ?? '',
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
      this.#autoScroll.startMonitoring(() => this.#recalculatePlaceholder());

      // Emit drag start event
      this.dragStart.emit({
        draggableId: this.vdndDraggable(),
        droppableId: this.#getParentDroppableId() ?? '',
        data: this.vdndDraggableData(),
        position,
      });
    });
  }

  /**
   * Calculate the source index of the dragged element BEFORE it's hidden.
   * This must be called before startDrag updates the state (which triggers display:none).
   */
  #calculateSourceIndex(
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
  #recalculatePlaceholder(): void {
    const cursorPosition = this.#dragState.cursorPosition();
    if (!cursorPosition || !this.isDragging()) {
      return;
    }

    // Recalculate placeholder based on current scroll position
    this.#updateDrag(cursorPosition);
  }

  /**
   * Update the drag position.
   * @param position Current cursor position
   */
  #updateDrag(position: CursorPosition): void {
    const element = this.#elementRef.nativeElement;
    const groupName = this.vdndDraggableGroup();

    // Apply axis locking to effective position for droppable detection
    // When axis is locked, use the start position for the locked axis
    const axisLock = this.lockAxis();
    let effectivePosition = position;

    if (axisLock && this.#startPosition) {
      effectivePosition = {
        x: axisLock === 'x' ? this.#startPosition.x : position.x,
        y: axisLock === 'y' ? this.#startPosition.y : position.y,
      };
    }

    // Find droppable at effective position (respects axis locking)
    const droppableElement = this.#positionCalculator.findDroppableAtPoint(
      effectivePosition.x,
      effectivePosition.y,
      element,
      groupName
    );

    const activeDroppableId = droppableElement
      ? this.#positionCalculator.getDroppableId(droppableElement)
      : null;

    let placeholderId: string | null = null;
    let placeholderIndex: number | null = null;

    if (droppableElement) {
      // Calculate placeholder index based on effective position using mathematical approach
      // This is more stable than DOM-based detection because it doesn't get affected
      // by the placeholder insertion shifting elements around
      const indexResult = this.#calculatePlaceholderIndex(droppableElement, effectivePosition);
      placeholderIndex = indexResult.index;
      placeholderId = indexResult.placeholderId;
    }

    // Update drag state with actual cursor position (for preview rendering)
    this.#ngZone.run(() => {
      this.#dragState.updateDragPosition({
        cursorPosition: position,
        activeDroppableId,
        placeholderId,
        placeholderIndex,
      });

      // Emit drag move event
      this.dragMove.emit({
        draggableId: this.vdndDraggable(),
        sourceDroppableId: this.#getParentDroppableId() ?? '',
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
  #calculatePlaceholderIndex(
    droppableElement: HTMLElement,
    position: CursorPosition,
    sourceIndexOverride?: number
  ): { index: number; placeholderId: string } {
    // Get container and measurements
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');
    const container = (virtualScroll ?? droppableElement) as HTMLElement;
    // Force layout flush - critical for Safari after programmatic scroll
    // Safari caches hit-testing results and only invalidates on user-initiated scroll
    void container.offsetHeight;
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    // Prefer configured item height from virtual scroll over actual element height
    // This prevents drift when actual element height differs from grid spacing
    const configuredHeight = virtualScroll?.getAttribute('data-item-height');
    const itemHeight = configuredHeight ? parseInt(configuredHeight, 10) : (this.#dragState.draggedItem()?.height ?? 50);

    // Calculate preview center position mathematically
    // The preview is positioned at: cursorPosition - grabOffset (see drag-preview.component.ts)
    // So preview center = cursorPosition.y - grabOffset.y + itemHeight/2
    // Using math avoids Safari's stale getBoundingClientRect() issue during autoscroll
    const grabOffset = this.#dragState.grabOffset();
    const previewCenterY = position.y - (grabOffset?.y ?? 0) + itemHeight / 2;

    // Convert to visual index (which slot the preview center is in)
    const relativeY = previewCenterY - rect.top + scrollTop;
    const visualIndex = Math.floor(relativeY / itemHeight);

    // Check if same-list drag
    const sourceDroppableId = this.#dragState.sourceDroppableId();
    const currentDroppableId = this.#positionCalculator.getDroppableId(droppableElement);
    const isSameList = sourceDroppableId === currentDroppableId;

    // Get source index
    const sourceIndex = isSameList
      ? (sourceIndexOverride ?? this.#dragState.sourceIndex() ?? -1)
      : -1;

    // Same-list adjustment: if pointing at or after source position, add 1
    // This accounts for the hidden item shifting everything up visually
    let placeholderIndex = visualIndex;
    if (isSameList && sourceIndex >= 0 && visualIndex >= sourceIndex) {
      placeholderIndex = visualIndex + 1;
    }

    // Clamp to valid range
    const totalItems = this.#getTotalItemCount(droppableElement, isSameList);
    placeholderIndex = Math.max(0, Math.min(placeholderIndex, totalItems));

    return { index: placeholderIndex, placeholderId: END_OF_LIST };
  }

  /**
   * Get the total item count for a droppable.
   * Accounts for hidden item during same-list drag.
   */
  #getTotalItemCount(droppableElement: HTMLElement, isSameList: boolean): number {
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');
    if (virtualScroll) {
      const scrollHeight = (virtualScroll as HTMLElement).scrollHeight;
      // Prefer configured item height from virtual scroll over actual element height
      const configuredHeight = virtualScroll.getAttribute('data-item-height');
      const itemHeight = configuredHeight ? parseInt(configuredHeight, 10) : (this.#dragState.draggedItem()?.height ?? 50);
      // When same-list, scrollHeight reflects N-1 items (one is hidden)
      // Add 1 back to get true total
      const count = Math.floor(scrollHeight / itemHeight);
      return isSameList ? count + 1 : count;
    }
    // Fallback for non-virtual scroll
    const items = droppableElement.querySelectorAll('[data-draggable-id]');
    return items.length + (isSameList ? 1 : 0);
  }

  /**
   * End the drag operation.
   */
  #endDrag(cancelled: boolean): void {
    this.#ngZone.run(() => {
      // Stop auto-scroll monitoring
      this.#autoScroll.stopMonitoring();

      // Emit drag end event
      this.dragEnd.emit({
        draggableId: this.vdndDraggable(),
        droppableId: this.#getParentDroppableId() ?? '',
        cancelled,
        data: this.vdndDraggableData(),
      });

      // Clear drag state - this triggers isDragging computed to become false
      if (cancelled) {
        this.#dragState.cancelDrag();
      } else {
        this.#dragState.endDrag();
      }
    });
  }

  /**
   * Get the parent droppable ID.
   */
  #getParentDroppableId(): string | null {
    const droppable = this.#positionCalculator.getDroppableParent(
      this.#elementRef.nativeElement,
      this.vdndDraggableGroup()
    );

    return droppable ? this.#positionCalculator.getDroppableId(droppable) : null;
  }

  /**
   * Get position from mouse or touch event.
   */
  #getPosition(event: MouseEvent | TouchEvent): CursorPosition {
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: event.clientX, y: event.clientY };
  }

  /**
   * Clean up event listeners and state.
   */
  #cleanup(): void {
    this.#isTracking = false;
    this.#startPosition = null;
    this.#cancelDelayTimer();

    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    // Remove event listeners
    if (this.#boundPointerMove) {
      document.removeEventListener('mousemove', this.#boundPointerMove);
      document.removeEventListener('touchmove', this.#boundPointerMove);
    }
    if (this.#boundPointerUp) {
      document.removeEventListener('mouseup', this.#boundPointerUp);
      document.removeEventListener('touchend', this.#boundPointerUp);
      document.removeEventListener('touchcancel', this.#boundPointerUp);
    }
    if (this.#boundKeyDown) {
      document.removeEventListener('keydown', this.#boundKeyDown);
    }
  }

  /**
   * Handle keydown events on document to cancel drag with Escape.
   */
  #onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isDragging()) {
      this.#ngZone.run(() => {
        this.#endDrag(true);
        this.#cleanup();
      });
    }
  }
}
