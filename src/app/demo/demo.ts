import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  applyMove,
  DraggableDirective,
  DragPreviewComponent,
  DragStateService,
  DropEvent,
  DroppableDirective,
  DroppableGroupDirective,
  isNoOpDrop,
  moveItem,
  VirtualScrollContainerComponent,
  VirtualSortableListComponent,
} from 'ngx-virtual-dnd';

interface Item {
  id: string;
  name: string;
}

/**
 * Demo component showcasing the ngx-virtual-dnd library.
 */
@Component({
  selector: 'app-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JsonPipe,
    RouterLink,
    DragPreviewComponent,
    DraggableDirective,
    DroppableDirective,
    DroppableGroupDirective,
    VirtualScrollContainerComponent,
    VirtualSortableListComponent,
  ],
  templateUrl: './demo.html',
  styleUrl: './demo.scss',
})
export class DemoComponent {
  readonly #dragState = inject(DragStateService);

  /** Number of items to generate */
  readonly itemCount = signal(100);

  /** Axis lock setting for drag operations */
  readonly lockAxis = signal<'x' | 'y' | null>(null);

  /** Whether drag-and-drop is enabled */
  readonly dragEnabled = signal(true);

  /** Delay in milliseconds before drag starts */
  readonly dragDelay = signal(0);

  /** Whether to use drag handle (only handle initiates drag) */
  readonly useDragHandle = signal(false);

  /** Whether to use the simplified API (VirtualSortableListComponent + moveItem) */
  readonly useSimplifiedApi = signal(false);

  /** Constrain drag preview and placeholder to container boundaries */
  readonly constrainToContainer = signal(false);

  /** Whether settings panel is expanded */
  readonly settingsExpanded = signal(true);

  /** Whether debug panel is expanded */
  readonly debugExpanded = signal(true);

  /** List 1 items */
  readonly list1 = signal<Item[]>([]);

  /** List 2 items */
  readonly list2 = signal<Item[]>([]);

  /** IDs of items that should always be rendered (dragged item needs to stay for reference) */
  readonly stickyIds = computed(() => {
    const draggedItem = this.#dragState.draggedItem();
    return draggedItem ? [draggedItem.draggableId] : [];
  });

  /** Debug state for display */
  readonly debugState = computed(() => {
    const state = this.#dragState.state();
    return {
      isDragging: state.isDragging,
      draggedItemId: state.draggedItem?.draggableId ?? null,
      sourceDroppable: state.sourceDroppableId,
      activeDroppable: state.activeDroppableId,
      placeholder: state.placeholderId,
      placeholderIndex: state.placeholderIndex,
    };
  });

  constructor() {
    this.regenerateItems();
  }

  /** Toggle settings panel */
  toggleSettings(): void {
    this.settingsExpanded.update((v) => !v);
  }

  /** Toggle debug panel */
  toggleDebug(): void {
    this.debugExpanded.update((v) => !v);
  }

  /** Generate items for both lists */
  regenerateItems(): void {
    const count = this.itemCount();
    const half = Math.floor(count / 2);

    const items1: Item[] = [];
    for (let i = 0; i < half; i++) {
      items1.push({
        id: `list1-${i}`,
        name: `Item ${i + 1}`,
      });
    }

    const items2: Item[] = [];
    for (let i = 0; i < count - half; i++) {
      items2.push({
        id: `list2-${i}`,
        name: `Item ${i + 1}`,
      });
    }

    this.list1.set(items1);
    this.list2.set(items2);
  }

  /** Update item count from input */
  updateItemCount(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value > 0) {
      this.itemCount.set(value);
    }
  }

  /** Update axis lock setting from select */
  updateLockAxis(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.lockAxis.set(value === 'x' || value === 'y' ? value : null);
  }

  /** Toggle drag enabled setting */
  toggleDragEnabled(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.dragEnabled.set(checkbox.checked);
  }

  /** Update drag delay from input */
  updateDragDelay(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 0) {
      this.dragDelay.set(value);
    }
  }

  /** Toggle drag handle setting */
  toggleDragHandle(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.useDragHandle.set(checkbox.checked);
  }

  /** Toggle constrain to container setting */
  toggleConstrainToContainer(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.constrainToContainer.set(checkbox.checked);
  }

  /** Handle drop events (verbose API) */
  onDrop(event: DropEvent): void {
    if (isNoOpDrop(event)) {
      return;
    }

    const moved = applyMove(event, {
      'list-1': this.list1(),
      'list-2': this.list2(),
    });

    this.list1.set(moved['list-1']);
    this.list2.set(moved['list-2']);
  }

  /**
   * Handle drop events (simplified API).
   * Uses the moveItem utility - just ONE line of code!
   */
  onDropSimplified(event: DropEvent): void {
    moveItem(event, {
      'list-1': this.list1,
      'list-2': this.list2,
    });
  }

  /** Track by function for items */
  readonly trackById = (_index: number, item: Item): string => {
    return item.id;
  };

  /** Get item ID */
  readonly getItemId = (item: Item): string => {
    return item.id;
  };
}
