import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { DragStateService } from '../services/drag-state.service';
import { AutoScrollService, AutoScrollConfig } from '../services/auto-scroll.service';
import {
  DragEnterEvent,
  DragLeaveEvent,
  DragOverEvent,
  DropEvent,
  END_OF_LIST,
} from '../models/drag-drop.models';

/**
 * Marks an element as a valid drop target within the virtual scroll drag-and-drop system.
 *
 * @example
 * ```html
 * <div
 *   vdndDroppable="list-1"
 *   vdndDroppableGroup="my-group"
 *   (drop)="onDrop($event)">
 *   <!-- Draggable items here -->
 * </div>
 * ```
 */
@Directive({
  selector: '[vdndDroppable]',
  host: {
    '[attr.data-droppable-id]': 'vdndDroppable()',
    '[attr.data-droppable-group]': 'vdndDroppableGroup()',
    '[class.vdnd-droppable]': 'true',
    '[class.vdnd-droppable-active]': 'isActive()',
    '[class.vdnd-droppable-disabled]': 'disabled()',
  },
})
export class DroppableDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly dragState = inject(DragStateService);
  private readonly autoScroll = inject(AutoScrollService);

  /** Unique identifier for this droppable */
  vdndDroppable = input.required<string>();

  /** Drag-and-drop group name */
  vdndDroppableGroup = input.required<string>();

  /** Optional data associated with this droppable */
  vdndDroppableData = input<unknown>();

  /** Whether this droppable is disabled */
  disabled = input<boolean>(false);

  /** Enable auto-scroll when dragging near edges */
  autoScrollEnabled = input<boolean>(true);

  /** Auto-scroll configuration */
  autoScrollConfig = input<Partial<AutoScrollConfig>>({});

  /** Emits when a dragged item enters this droppable */
  dragEnter = output<DragEnterEvent>();

  /** Emits when a dragged item leaves this droppable */
  dragLeave = output<DragLeaveEvent>();

  /** Emits while a dragged item is over this droppable */
  dragOver = output<DragOverEvent>();

  /** Emits when an item is dropped on this droppable */
  drop = output<DropEvent>();

  /** Whether this droppable is currently being targeted */
  readonly isActive = computed(() => {
    const activeId = this.dragState.activeDroppableId();
    return activeId === this.vdndDroppable() && !this.disabled();
  });

  /** The current placeholder ID when this droppable is active */
  readonly placeholderId = computed(() => {
    if (!this.isActive()) {
      return null;
    }
    return this.dragState.placeholderId();
  });

  /** Track previous active state for enter/leave events */
  private wasActive = false;

  /** Track previous placeholder for over events */
  private previousPlaceholder: string | null = null;

  ngOnInit(): void {
    // Register with auto-scroll service
    if (this.autoScrollEnabled()) {
      this.autoScroll.registerContainer(
        this.vdndDroppable(),
        this.elementRef.nativeElement,
        this.autoScrollConfig()
      );
    }
  }

  constructor() {
    // React to state changes and emit appropriate events
    effect(() => {
      const active = this.isActive();
      const placeholder = this.placeholderId();
      const draggedItem = this.dragState.draggedItem();
      const cursorPosition = this.dragState.cursorPosition();
      const isDragging = this.dragState.isDragging();

      // Handle drag end (drop)
      if (!isDragging && this.wasActive && draggedItem === null) {
        // Drag ended while we were active - this is a drop
        this.handleDrop();
      }

      // Handle enter/leave
      if (active && !this.wasActive) {
        // Entered
        if (draggedItem) {
          this.dragEnter.emit({
            droppableId: this.vdndDroppable(),
            draggedItem,
          });
        }
      } else if (!active && this.wasActive) {
        // Left
        const lastDraggedItem = this.dragState.draggedItem();
        if (lastDraggedItem) {
          this.dragLeave.emit({
            droppableId: this.vdndDroppable(),
            draggedItem: lastDraggedItem,
          });
        }
      }

      // Handle over (placeholder changed)
      if (active && placeholder !== this.previousPlaceholder) {
        if (draggedItem && cursorPosition) {
          this.dragOver.emit({
            droppableId: this.vdndDroppable(),
            draggedItem,
            placeholderId: placeholder,
            position: cursorPosition,
          });
        }
      }

      this.wasActive = active;
      this.previousPlaceholder = placeholder;
    });
  }

  ngOnDestroy(): void {
    // Clean up if this droppable is destroyed while being active
    if (this.isActive()) {
      this.dragState.setActiveDroppable(null);
    }

    // Unregister from auto-scroll
    this.autoScroll.unregisterContainer(this.vdndDroppable());
  }

  /**
   * Handle a drop on this droppable.
   */
  private handleDrop(): void {
    const state = this.dragState.getStateSnapshot();

    if (!state.draggedItem || state.activeDroppableId !== this.vdndDroppable()) {
      return;
    }

    const sourceDroppableId = state.sourceDroppableId ?? '';
    const placeholderId = state.placeholderId ?? END_OF_LIST;

    // Calculate indices
    const sourceIndex = this.getItemIndex(state.draggedItem.draggableId, sourceDroppableId);
    const destinationIndex = this.getDestinationIndex(placeholderId);

    this.drop.emit({
      source: {
        draggableId: state.draggedItem.draggableId,
        droppableId: sourceDroppableId,
        index: sourceIndex,
        data: state.draggedItem.data,
      },
      destination: {
        droppableId: this.vdndDroppable(),
        placeholderId,
        index: destinationIndex,
        data: this.vdndDroppableData(),
      },
    });
  }

  /**
   * Get the index of an item in a droppable.
   * This is a simplified implementation - in practice, the consumer would track this.
   */
  private getItemIndex(draggableId: string, droppableId: string): number {
    // Find all draggables in the source droppable
    const droppable = document.querySelector(`[data-droppable-id="${droppableId}"]`);
    if (!droppable) {
      return 0;
    }

    const draggables = droppable.querySelectorAll('[data-draggable-id]');
    for (let i = 0; i < draggables.length; i++) {
      if (draggables[i].getAttribute('data-draggable-id') === draggableId) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Get the destination index based on the placeholder.
   */
  private getDestinationIndex(placeholderId: string): number {
    if (placeholderId === END_OF_LIST) {
      // Count items in this droppable
      const draggables = this.elementRef.nativeElement.querySelectorAll('[data-draggable-id]');
      return draggables.length;
    }

    // Find the index of the placeholder item
    const draggables = this.elementRef.nativeElement.querySelectorAll('[data-draggable-id]');
    for (let i = 0; i < draggables.length; i++) {
      if (draggables[i].getAttribute('data-draggable-id') === placeholderId) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Get the element reference (for external use).
   */
  getElement(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  /**
   * Manually scroll this droppable.
   */
  scrollBy(delta: number): void {
    this.elementRef.nativeElement.scrollTop += delta;
  }

  /**
   * Get the current scroll position.
   */
  getScrollTop(): number {
    return this.elementRef.nativeElement.scrollTop;
  }

  /**
   * Get the scroll height.
   */
  getScrollHeight(): number {
    return this.elementRef.nativeElement.scrollHeight;
  }
}
