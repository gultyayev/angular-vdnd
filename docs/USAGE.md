# ngx-virtual-dnd Usage Guide

This guide shows how to use the ngx-virtual-dnd library to implement virtual scrolling with drag-and-drop functionality.

## Installation

```bash
npm install ngx-virtual-dnd
```

## Basic Setup

### 1. Import Components

```typescript
import { Component } from '@angular/core';
import {
  VirtualScrollContainerComponent,
  DraggableDirective,
  DroppableDirective,
  DragPreviewComponent,
  PlaceholderComponent,
  DropEvent,
} from 'ngx-virtual-dnd';

@Component({
  selector: 'app-list',
  imports: [
    VirtualScrollContainerComponent,
    DraggableDirective,
    DroppableDirective,
    DragPreviewComponent,
    PlaceholderComponent,
  ],
  template: `...`,
})
export class ListComponent {}
```

### 2. Create a Basic Sortable List

```typescript
import { Component, signal } from '@angular/core';
import {
  VirtualScrollContainerComponent,
  DraggableDirective,
  DroppableDirective,
  DragPreviewComponent,
  PlaceholderComponent,
  DragStateService,
  DropEvent,
  END_OF_LIST,
} from 'ngx-virtual-dnd';

interface Item {
  id: string;
  name: string;
}

@Component({
  selector: 'app-sortable-list',
  imports: [
    VirtualScrollContainerComponent,
    DraggableDirective,
    DroppableDirective,
    DragPreviewComponent,
    PlaceholderComponent,
  ],
  template: `
    <div class="list" vdndDroppable="my-list" vdndDroppableGroup="my-group" (drop)="onDrop($event)">
      <vdnd-virtual-scroll
        [items]="itemsWithPlaceholder()"
        [itemHeight]="50"
        [containerHeight]="400"
        [stickyItemIds]="stickyIds()"
        [itemIdFn]="getItemId"
        [trackByFn]="trackById"
      >
        <ng-template let-item let-index="index">
          @if (item.isPlaceholder) {
            <vdnd-placeholder [height]="50"></vdnd-placeholder>
          } @else {
            <div
              class="item"
              vdndDraggable="{{ item.id }}"
              vdndDraggableGroup="my-group"
              [vdndDraggableData]="item"
            >
              {{ item.name }}
            </div>
          }
        </ng-template>
      </vdnd-virtual-scroll>
    </div>

    <vdnd-drag-preview>
      <ng-template let-data>
        <div class="preview">{{ data?.name }}</div>
      </ng-template>
    </vdnd-drag-preview>
  `,
})
export class SortableListComponent {
  private readonly dragState: DragStateService;

  items = signal<Item[]>([
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    // ... more items
  ]);

  // IDs of items that should always be rendered (dragged items)
  stickyIds = computed(() => {
    const draggedItem = this.dragState.draggedItem();
    return draggedItem ? [draggedItem.draggableId] : [];
  });

  // Insert placeholder into the list
  itemsWithPlaceholder = computed(() => {
    const items = this.items();
    const activeDroppable = this.dragState.activeDroppableId();
    const placeholderId = this.dragState.placeholderId();

    if (activeDroppable !== 'my-list' || !placeholderId) {
      return items;
    }

    const result = [];
    if (placeholderId === END_OF_LIST) {
      result.push(...items);
      result.push({ isPlaceholder: true, id: 'placeholder' });
    } else {
      for (const item of items) {
        if (item.id === placeholderId) {
          result.push({ isPlaceholder: true, id: 'placeholder' });
        }
        result.push(item);
      }
    }
    return result;
  });

  constructor(dragState: DragStateService) {
    this.dragState = dragState;
  }

  onDrop(event: DropEvent): void {
    const item = event.source.data as Item;
    const sourceIndex = event.source.index;
    const destIndex = event.destination.index;

    // Reorder the items
    this.items.update((items) => {
      const newItems = [...items];
      newItems.splice(sourceIndex, 1);
      const adjustedIndex = sourceIndex < destIndex ? destIndex - 1 : destIndex;
      newItems.splice(adjustedIndex, 0, item);
      return newItems;
    });
  }

  readonly getItemId = (item: Item | { isPlaceholder: true; id: string }): string => item.id;
  readonly trackById = (index: number, item: Item | { isPlaceholder: true; id: string }): string =>
    item.id;
}
```

## Multiple Lists

```typescript
@Component({
  template: `
    <div class="lists-container">
      <div
        class="list"
        vdndDroppable="list-1"
        vdndDroppableGroup="kanban"
        (drop)="onDrop($event, 'list1')">
        <!-- Items for list 1 -->
      </div>

      <div
        class="list"
        vdndDroppable="list-2"
        vdndDroppableGroup="kanban"
        (drop)="onDrop($event, 'list2')">
        <!-- Items for list 2 -->
      </div>
    </div>
  `,
})
export class KanbanComponent {
  list1 = signal<Item[]>([...]);
  list2 = signal<Item[]>([...]);

  onDrop(event: DropEvent, targetList: 'list1' | 'list2'): void {
    const item = event.source.data as Item;
    const sourceList = event.source.droppableId === 'list-1' ? 'list1' : 'list2';

    // Remove from source
    if (sourceList === 'list1') {
      this.list1.update(items => items.filter(i => i.id !== item.id));
    } else {
      this.list2.update(items => items.filter(i => i.id !== item.id));
    }

    // Add to destination
    const insertAt = event.destination.index;
    if (targetList === 'list1') {
      this.list1.update(items => {
        const newItems = [...items];
        newItems.splice(insertAt, 0, item);
        return newItems;
      });
    } else {
      this.list2.update(items => {
        const newItems = [...items];
        newItems.splice(insertAt, 0, item);
        return newItems;
      });
    }
  }
}
```

## Drag Handle

```html
<div class="item" vdndDraggable="item-1" vdndDraggableGroup="my-group" dragHandle=".handle">
  <span class="handle">☰</span>
  <span class="content">Item content</span>
</div>
```

## Custom Drag Preview

```html
<vdnd-drag-preview>
  <ng-template let-data let-id="draggableId" let-source="droppableId">
    <div class="custom-preview">
      <div class="preview-header">Moving from {{ source }}</div>
      <div class="preview-content">{{ data?.name }}</div>
    </div>
  </ng-template>
</vdnd-drag-preview>
```

## Custom Placeholder

```html
<ng-template let-item>
  @if (item.isPlaceholder) {
  <div class="my-placeholder">Drop here</div>
  } @else {
  <!-- Regular item -->
  }
</ng-template>
```

## Auto-scroll Configuration

```html
<div
  vdndDroppable="my-list"
  vdndDroppableGroup="my-group"
  [autoScrollConfig]="{ threshold: 80, maxSpeed: 20, accelerate: true }"
></div>
```

## Disabling Drag/Drop

```html
<!-- Disable specific draggable -->
<div vdndDraggable="item-1" [disabled]="isLocked()"></div>

<!-- Disable entire droppable -->
<div vdndDroppable="my-list" [disabled]="!canEdit()"></div>
```

## Styling

```css
/* Droppable container */
.vdnd-droppable {
  border: 2px solid #ccc;
}

.vdnd-droppable-active {
  border-color: #4caf50;
  background-color: rgba(76, 175, 80, 0.1);
}

/* Draggable item */
.vdnd-draggable {
  cursor: grab;
}

.vdnd-draggable-dragging {
  opacity: 0.5;
}

.vdnd-draggable-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Placeholder */
:host ::ng-deep .vdnd-placeholder-inner {
  border: 2px dashed #999;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}
```

## Performance Tips

### 1. Use Track-By Functions

Always provide a `trackByFn` to prevent unnecessary re-renders:

```typescript
readonly trackById = (index: number, item: Item): string => item.id;
```

### 2. Minimize Placeholder Calculations

Cache the placeholder insertion logic:

```typescript
itemsWithPlaceholder = computed(() => {
  // Only recalculates when items, activeDroppable, or placeholder changes
  return this.insertPlaceholder(this.items());
});
```

### 3. Use OnPush Change Detection

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

### 4. Reasonable Item Heights

Fixed item heights perform better than variable heights. If you need variable heights, consider setting a reasonable `itemHeight` that represents the average.

## Handling Large Lists (10,000+ items)

The virtual scroll automatically handles large lists efficiently:

```typescript
items = signal<Item[]>(
  Array.from({ length: 10000 }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i + 1}`,
  })),
);
```

The library only renders items in the visible viewport plus an overscan buffer, ensuring smooth performance regardless of list size.

## Accessibility

The library includes basic accessibility support:

- Draggable items have `tabindex="0"` for keyboard focus
- `aria-grabbed` is set during drag
- `aria-dropeffect="move"` indicates drop action

For full keyboard support, you may want to implement additional handlers for arrow key navigation.

## Troubleshooting

### Items not showing

- Ensure `itemHeight` and `containerHeight` are set correctly
- Check that `trackByFn` and `itemIdFn` return unique values

### Placeholder in wrong position

- Verify the placeholder ID matches item IDs exactly
- Check that `END_OF_LIST` is handled for drops at the end

### Dragged item disappears during scroll

- Ensure `stickyItemIds` includes the dragged item's ID
- Check that the ID matches what's returned by `itemIdFn`

### Auto-scroll not working

- Verify `autoScrollEnabled` is `true` (default)
- Ensure the droppable container has proper dimensions
- Check that the cursor is within the threshold distance of edges
