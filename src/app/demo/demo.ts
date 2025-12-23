import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import {
  DragPreviewComponent,
  DraggableDirective,
  DroppableDirective,
  VirtualScrollContainerComponent,
  DropEvent,
  DragStateService,
  PlaceholderComponent,
} from 'ngx-virtual-dnd';

interface Item {
  id: string;
  name: string;
  color: string;
}

/**
 * Demo component showcasing the ngx-virtual-dnd library.
 */
@Component({
  selector: 'app-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JsonPipe,
    DragPreviewComponent,
    DraggableDirective,
    DroppableDirective,
    VirtualScrollContainerComponent,
    PlaceholderComponent,
  ],
  template: `
    <div class="demo-container">
      <h1>Virtual Scroll + Drag & Drop Demo</h1>

      <div class="controls">
        <label>
          Item count:
          <input
            type="number"
            [value]="itemCount()"
            (input)="updateItemCount($event)" />
        </label>
        <label>
          Lock axis:
          <select
            [value]="lockAxis() ?? ''"
            (change)="updateLockAxis($event)"
            data-testid="lock-axis-select">
            <option value="">None</option>
            <option value="x">X (horizontal only)</option>
            <option value="y">Y (vertical only)</option>
          </select>
        </label>
        <button (click)="regenerateItems()">Regenerate Items</button>
      </div>

      <div class="lists-container">
        <!-- Shared item template -->
        <ng-template #itemTpl let-item let-index="index">
          @if (item.isPlaceholder) {
            <vdnd-placeholder [height]="50"></vdnd-placeholder>
          } @else {
            <div
              class="item"
              [style.background]="item.color"
              vdndDraggable="{{ item.id }}"
              vdndDraggableGroup="demo"
              [vdndDraggableData]="item"
              [lockAxis]="lockAxis()">
              {{ item.name }}
            </div>
          }
        </ng-template>

        <!-- List 1 -->
        <div class="list-wrapper">
          <h2>List 1 ({{ list1().length }} items)</h2>
          <div
            class="list"
            vdndDroppable="list-1"
            vdndDroppableGroup="demo"
            (drop)="onDrop($event, 'list1')">
            <vdnd-virtual-scroll
              [items]="list1WithPlaceholder()"
              [itemHeight]="50"
              [containerHeight]="400"
              [stickyItemIds]="stickyIds()"
              [itemIdFn]="getItemId"
              [trackByFn]="trackById"
              [itemTemplate]="itemTpl">
            </vdnd-virtual-scroll>
          </div>
        </div>

        <!-- List 2 -->
        <div class="list-wrapper">
          <h2>List 2 ({{ list2().length }} items)</h2>
          <div
            class="list"
            vdndDroppable="list-2"
            vdndDroppableGroup="demo"
            (drop)="onDrop($event, 'list2')">
            <vdnd-virtual-scroll
              [items]="list2WithPlaceholder()"
              [itemHeight]="50"
              [containerHeight]="400"
              [stickyItemIds]="stickyIds()"
              [itemIdFn]="getItemId"
              [trackByFn]="trackById"
              [itemTemplate]="itemTpl">
            </vdnd-virtual-scroll>
          </div>
        </div>
      </div>

      <!-- Drag Preview (auto-clones the original element by default) -->
      <vdnd-drag-preview></vdnd-drag-preview>

      <div class="debug-panel">
        <h3>Drag State</h3>
        <pre>{{ debugState() | json }}</pre>
      </div>
    </div>
  `,
  styles: `
    .demo-container {
      padding: 20px;
      font-family: sans-serif;
    }

    .controls {
      margin-bottom: 20px;
      display: flex;
      gap: 20px;
      align-items: center;
    }

    .controls input {
      width: 100px;
      padding: 4px;
    }

    .controls button {
      padding: 8px 16px;
      cursor: pointer;
    }

    .controls select {
      padding: 4px 8px;
    }

    .lists-container {
      display: flex;
      gap: 40px;
    }

    .list-wrapper {
      flex: 1;
    }

    .list {
      border: 2px solid #ccc;
      border-radius: 8px;
      overflow: hidden;
    }

    .list.vdnd-droppable-active {
      border-color: #4caf50;
      background-color: rgba(76, 175, 80, 0.1);
    }

    .item {
      height: 48px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid #eee;
      cursor: grab;
      user-select: none;
    }

    .item:hover {
      filter: brightness(0.95);
    }

    .debug-panel {
      margin-top: 20px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .debug-panel pre {
      margin: 0;
      font-size: 12px;
      white-space: pre-wrap;
    }
  `,
})
export class DemoComponent {
  private readonly dragState: DragStateService;

  /** Number of items to generate */
  readonly itemCount = signal(100);

  /** Axis lock setting for drag operations */
  readonly lockAxis = signal<'x' | 'y' | null>(null);

  /** List 1 items */
  readonly list1 = signal<Item[]>([]);

  /** List 2 items */
  readonly list2 = signal<Item[]>([]);

  /** IDs of items that should always be rendered (dragged item needs to stay for reference) */
  readonly stickyIds = computed(() => {
    const draggedItem = this.dragState.draggedItem();
    return draggedItem ? [draggedItem.draggableId] : [];
  });

  /** List 1 with placeholder inserted */
  readonly list1WithPlaceholder = computed(() => {
    return this.insertPlaceholder(this.list1(), 'list-1');
  });

  /** List 2 with placeholder inserted */
  readonly list2WithPlaceholder = computed(() => {
    return this.insertPlaceholder(this.list2(), 'list-2');
  });

  /** Debug state for display */
  readonly debugState = computed(() => {
    const state = this.dragState.state();
    return {
      isDragging: state.isDragging,
      draggedItemId: state.draggedItem?.draggableId ?? null,
      sourceDroppable: state.sourceDroppableId,
      activeDroppable: state.activeDroppableId,
      placeholder: state.placeholderId,
    };
  });

  constructor(dragState: DragStateService) {
    this.dragState = dragState;
    this.regenerateItems();
  }

  /** Generate a random color */
  private randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 80%)`;
  }

  /** Generate items for both lists */
  regenerateItems(): void {
    const count = this.itemCount();
    const half = Math.floor(count / 2);

    const items1: Item[] = [];
    for (let i = 0; i < half; i++) {
      items1.push({
        id: `list1-${i}`,
        name: `List 1 - Item ${i + 1}`,
        color: this.randomColor(),
      });
    }

    const items2: Item[] = [];
    for (let i = 0; i < count - half; i++) {
      items2.push({
        id: `list2-${i}`,
        name: `List 2 - Item ${i + 1}`,
        color: this.randomColor(),
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

  /** Insert placeholder into list if this is the active droppable */
  private insertPlaceholder(items: Item[], droppableId: string): (Item | { isPlaceholder: true; id: string })[] {
    const activeDroppable = this.dragState.activeDroppableId();
    const placeholderIndex = this.dragState.placeholderIndex();

    if (activeDroppable !== droppableId || placeholderIndex === null) {
      return items;
    }

    const result: (Item | { isPlaceholder: true; id: string })[] = [];

    // Use index-based insertion for stable positioning
    const insertAt = Math.max(0, Math.min(placeholderIndex, items.length));

    for (let i = 0; i < items.length; i++) {
      if (i === insertAt) {
        result.push({ isPlaceholder: true, id: 'placeholder' });
      }
      result.push(items[i]);
    }

    // If inserting at end
    if (insertAt >= items.length) {
      result.push({ isPlaceholder: true, id: 'placeholder' });
    }

    return result;
  }

  /** Handle drop events */
  onDrop(event: DropEvent, targetList: 'list1' | 'list2'): void {
    const sourceList = event.source.droppableId === 'list-1' ? 'list1' : 'list2';
    const item = event.source.data as Item;

    if (!item) {
      return;
    }

    // Remove from source
    if (sourceList === 'list1') {
      this.list1.update((items) => items.filter((i) => i.id !== item.id));
    } else {
      this.list2.update((items) => items.filter((i) => i.id !== item.id));
    }

    // Add to destination
    const destIndex = event.destination.index;
    if (targetList === 'list1') {
      this.list1.update((items) => {
        const newItems = [...items];
        newItems.splice(destIndex, 0, item);
        return newItems;
      });
    } else {
      this.list2.update((items) => {
        const newItems = [...items];
        newItems.splice(destIndex, 0, item);
        return newItems;
      });
    }
  }

  /** Track by function for items */
  readonly trackById = (index: number, item: Item | { isPlaceholder: true; id: string }): string => {
    return item.id;
  };

  /** Get item ID */
  readonly getItemId = (item: Item | { isPlaceholder: true; id: string }): string => {
    return item.id;
  };
}
