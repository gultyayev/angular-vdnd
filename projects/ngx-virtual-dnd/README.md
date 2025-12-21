# ngx-virtual-dnd

A performant drag-and-drop library for Angular that works seamlessly with virtual scrolling. Built for large lists where traditional drag-and-drop solutions fail due to DOM virtualization.

## Features

- Drag-and-drop with virtual scroll support
- Automatic scrolling when dragging near container edges
- Multiple droppable containers with group-based restrictions
- Mouse and touch support
- Accessible with ARIA attributes and keyboard support
- Signal-based state management
- No external dependencies (except Angular)

## Installation

```bash
npm install ngx-virtual-dnd
```

## Requirements

- Angular 21+

## Quick Start

```typescript
import {
  DragPreviewComponent,
  DraggableDirective,
  DroppableDirective,
  VirtualScrollContainerComponent,
  PlaceholderComponent,
  DropEvent,
} from 'ngx-virtual-dnd';

@Component({
  imports: [
    DragPreviewComponent,
    DraggableDirective,
    DroppableDirective,
    VirtualScrollContainerComponent,
    PlaceholderComponent,
  ],
  template: `
    <!-- Item template -->
    <ng-template #itemTpl let-item>
      <div
        class="item"
        vdndDraggable="{{ item.id }}"
        vdndDraggableGroup="my-group"
        [vdndDraggableData]="item"
      >
        {{ item.name }}
      </div>
    </ng-template>

    <!-- Droppable container with virtual scroll -->
    <div vdndDroppable="list-1" vdndDroppableGroup="my-group" (drop)="onDrop($event)">
      <vdnd-virtual-scroll
        [items]="items()"
        [itemHeight]="50"
        [containerHeight]="400"
        [itemIdFn]="getItemId"
        [trackByFn]="trackById"
        [itemTemplate]="itemTpl"
      >
      </vdnd-virtual-scroll>
    </div>

    <!-- Drag preview (place at root level) -->
    <vdnd-drag-preview>
      <ng-template let-data>
        <div class="preview">{{ data?.name }}</div>
      </ng-template>
    </vdnd-drag-preview>
  `,
})
export class MyComponent {
  items = signal<Item[]>([]);

  getItemId = (item: Item) => item.id;
  trackById = (index: number, item: Item) => item.id;

  onDrop(event: DropEvent): void {
    // Handle the drop - reorder or move between lists
  }
}
```

## API Reference

### DraggableDirective

Makes an element draggable.

```html
<div
  vdndDraggable="unique-id"
  vdndDraggableGroup="group-name"
  [vdndDraggableData]="data"
  [disabled]="false"
  [dragHandle]=".handle"
  [dragThreshold]="5"
  (dragStart)="onDragStart($event)"
  (dragMove)="onDragMove($event)"
  (dragEnd)="onDragEnd($event)"
></div>
```

| Input                | Type      | Description                                      |
| -------------------- | --------- | ------------------------------------------------ |
| `vdndDraggable`      | `string`  | Unique identifier for the draggable              |
| `vdndDraggableGroup` | `string`  | Group name for restricting drop targets          |
| `vdndDraggableData`  | `unknown` | Optional data attached to the draggable          |
| `disabled`           | `boolean` | Whether dragging is disabled                     |
| `dragHandle`         | `string`  | CSS selector for drag handle element             |
| `dragThreshold`      | `number`  | Minimum distance before drag starts (default: 5) |

| Output      | Type             | Description                  |
| ----------- | ---------------- | ---------------------------- |
| `dragStart` | `DragStartEvent` | Emitted when drag starts     |
| `dragMove`  | `DragMoveEvent`  | Emitted during drag movement |
| `dragEnd`   | `DragEndEvent`   | Emitted when drag ends       |

### DroppableDirective

Marks an element as a valid drop target.

```html
<div
  vdndDroppable="list-id"
  vdndDroppableGroup="group-name"
  [vdndDroppableData]="data"
  [disabled]="false"
  [autoScrollEnabled]="true"
  [autoScrollConfig]="{ threshold: 50, maxSpeed: 15 }"
  (dragEnter)="onDragEnter($event)"
  (dragLeave)="onDragLeave($event)"
  (dragOver)="onDragOver($event)"
  (drop)="onDrop($event)"
></div>
```

| Input                | Type               | Description                                   |
| -------------------- | ------------------ | --------------------------------------------- |
| `vdndDroppable`      | `string`           | Unique identifier for the droppable           |
| `vdndDroppableGroup` | `string`           | Group name (must match draggable group)       |
| `vdndDroppableData`  | `unknown`          | Optional data attached to the droppable       |
| `disabled`           | `boolean`          | Whether dropping is disabled                  |
| `autoScrollEnabled`  | `boolean`          | Enable auto-scroll near edges (default: true) |
| `autoScrollConfig`   | `AutoScrollConfig` | Auto-scroll configuration                     |

| Output      | Type             | Description                                     |
| ----------- | ---------------- | ----------------------------------------------- |
| `dragEnter` | `DragEnterEvent` | Emitted when a draggable enters                 |
| `dragLeave` | `DragLeaveEvent` | Emitted when a draggable leaves                 |
| `dragOver`  | `DragOverEvent`  | Emitted while hovering with placeholder updates |
| `drop`      | `DropEvent`      | Emitted when an item is dropped                 |

### VirtualScrollContainerComponent

A virtual scroll container that only renders visible items.

```html
<vdnd-virtual-scroll
  [items]="items()"
  [itemHeight]="50"
  [containerHeight]="400"
  [overscan]="3"
  [stickyItemIds]="stickyIds()"
  [itemIdFn]="getItemId"
  [trackByFn]="trackById"
  [itemTemplate]="itemTpl"
  (visibleRangeChange)="onRangeChange($event)"
  (scrollPositionChange)="onScroll($event)"
>
</vdnd-virtual-scroll>
```

| Input             | Type                                 | Description                                       |
| ----------------- | ------------------------------------ | ------------------------------------------------- |
| `items`           | `T[]`                                | Array of items to render                          |
| `itemHeight`      | `number`                             | Height of each item in pixels                     |
| `containerHeight` | `number`                             | Height of the container in pixels                 |
| `overscan`        | `number`                             | Items to render above/below viewport (default: 3) |
| `stickyItemIds`   | `string[]`                           | IDs of items that should always be rendered       |
| `itemIdFn`        | `(item: T) => string`                | Function to get unique ID from item               |
| `trackByFn`       | `(index: number, item: T) => string` | Track-by function for the loop                    |
| `itemTemplate`    | `TemplateRef`                        | Template for rendering each item                  |

### DragPreviewComponent

Renders a preview that follows the cursor during drag.

```html
<vdnd-drag-preview [cursorOffset]="{ x: 8, y: 8 }">
  <ng-template let-data let-id="draggableId" let-droppableId="droppableId">
    <div class="preview">{{ data?.name }}</div>
  </ng-template>
</vdnd-drag-preview>
```

### PlaceholderComponent

A visual placeholder indicating where the item will be inserted.

```html
<vdnd-placeholder [height]="50"></vdnd-placeholder>
```

### DragStateService

Central service for accessing drag state. Inject to build custom integrations.

```typescript
@Injectable({ providedIn: 'root' })
export class DragStateService {
  readonly isDragging: Signal<boolean>;
  readonly draggedItem: Signal<DraggedItem | null>;
  readonly sourceDroppableId: Signal<string | null>;
  readonly activeDroppableId: Signal<string | null>;
  readonly placeholderId: Signal<string | null>;
  readonly cursorPosition: Signal<CursorPosition | null>;
}
```

## Event Types

### DropEvent

```typescript
interface DropEvent {
  source: {
    draggableId: string;
    droppableId: string;
    index: number;
    data?: unknown;
  };
  destination: {
    droppableId: string;
    placeholderId: string;
    index: number;
    data?: unknown;
  };
}
```

### AutoScrollConfig

```typescript
interface AutoScrollConfig {
  threshold: number; // Distance from edge to start scrolling (default: 50)
  maxSpeed: number; // Maximum scroll speed in px/frame (default: 15)
  accelerate: boolean; // Accelerate based on distance from edge (default: true)
}
```

## CSS Classes

The library adds CSS classes for styling drag states:

| Class                     | Element   | Applied When                |
| ------------------------- | --------- | --------------------------- |
| `vdnd-draggable`          | Draggable | Always                      |
| `vdnd-draggable-dragging` | Draggable | While being dragged         |
| `vdnd-draggable-disabled` | Draggable | When disabled               |
| `vdnd-droppable`          | Droppable | Always                      |
| `vdnd-droppable-active`   | Droppable | When a draggable is over it |
| `vdnd-droppable-disabled` | Droppable | When disabled               |

## How It Works

1. **Virtual Scrolling**: Only items in the visible viewport (plus overscan) are rendered. This allows lists with thousands of items to perform well.

2. **Sticky Items**: During drag, the dragged item is marked as "sticky" so it remains rendered even when scrolled out of view.

3. **Position Detection**: Uses `document.elementFromPoint()` with temporarily hidden drag preview to detect what's under the cursor.

4. **Auto-scroll**: When dragging near container edges, the container automatically scrolls to reveal more items.

5. **Group-based Restrictions**: Draggables can only be dropped on droppables with the same group name.

## License

MIT
