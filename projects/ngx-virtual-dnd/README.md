# ngx-virtual-dnd

A performant drag-and-drop library for Angular that works seamlessly with virtual scrolling. Built for large lists where traditional drag-and-drop solutions fail due to DOM virtualization.

## Features

- Drag-and-drop with virtual scroll support
- Automatic scrolling when dragging near container edges
- Multiple droppable containers with group-based restrictions
- Mouse and touch support
- Accessible with ARIA attributes and keyboard support
- Signal-based state management
- Simplified high-level API with `VirtualSortableListComponent`
- Group inheritance with `DroppableGroupDirective`
- Utility functions for drop handling (`moveItem`, `reorderItems`)
- **External scroll container support** via `vdndScrollable` directive
- No external dependencies (except Angular)

## Installation

```bash
npm install ngx-virtual-dnd
```

## Requirements

- Angular 21+

## Quick Start (Simplified API)

The easiest way to get started is with the high-level `VirtualSortableListComponent`:

```typescript
import {
  DragPreviewComponent,
  DraggableDirective,
  VirtualSortableListComponent,
  DroppableGroupDirective,
  PlaceholderComponent,
  DropEvent,
  moveItem,
} from 'ngx-virtual-dnd';

@Component({
  imports: [
    DragPreviewComponent,
    DraggableDirective,
    VirtualSortableListComponent,
    DroppableGroupDirective,
    PlaceholderComponent,
  ],
  template: `
    <!-- Item template -->
    <ng-template #itemTpl let-item let-isPlaceholder="isPlaceholder">
      @if (isPlaceholder) {
        <vdnd-placeholder [height]="50"></vdnd-placeholder>
      } @else {
        <div class="item" vdndDraggable="{{ item.id }}" [vdndDraggableData]="item">
          {{ item.name }}
        </div>
      }
    </ng-template>

    <!-- Use vdndGroup to set group for all children -->
    <div vdndGroup="my-group">
      <!-- Sortable list - handles placeholder and sticky items automatically! -->
      <vdnd-sortable-list
        droppableId="list-1"
        group="my-group"
        [items]="list1()"
        [itemHeight]="50"
        [containerHeight]="400"
        [itemIdFn]="getItemId"
        [itemTemplate]="itemTpl"
        (drop)="onDrop($event)"
      >
      </vdnd-sortable-list>

      <vdnd-sortable-list
        droppableId="list-2"
        group="my-group"
        [items]="list2()"
        [itemHeight]="50"
        [containerHeight]="400"
        [itemIdFn]="getItemId"
        [itemTemplate]="itemTpl"
        (drop)="onDrop($event)"
      >
      </vdnd-sortable-list>
    </div>

    <vdnd-drag-preview></vdnd-drag-preview>
  `,
})
export class MyComponent {
  list1 = signal<Item[]>([]);
  list2 = signal<Item[]>([]);

  getItemId = (item: Item) => item.id;

  // One-liner drop handler using moveItem utility!
  onDrop(event: DropEvent): void {
    moveItem(event, {
      'list-1': this.list1,
      'list-2': this.list2,
    });
  }
}
```

## Quick Start (Low-Level API)

For more control, use the individual directives and components:

```typescript
import {
  DragPreviewComponent,
  DraggableDirective,
  DroppableDirective,
  VirtualScrollContainerComponent,
  PlaceholderComponent,
  DropEvent,
  DragStateService,
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
    <!-- Item template with manual placeholder handling -->
    <ng-template #itemTpl let-item>
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

    <!-- Droppable container with virtual scroll -->
    <div vdndDroppable="list-1" vdndDroppableGroup="my-group" (drop)="onDrop($event)">
      <vdnd-virtual-scroll
        [items]="itemsWithPlaceholder()"
        [itemHeight]="50"
        [containerHeight]="400"
        [stickyItemIds]="stickyIds()"
        [itemIdFn]="getItemId"
        [trackByFn]="trackById"
        [itemTemplate]="itemTpl"
      >
      </vdnd-virtual-scroll>
    </div>

    <vdnd-drag-preview></vdnd-drag-preview>
  `,
})
export class MyComponent {
  private dragState = inject(DragStateService);
  items = signal<Item[]>([]);

  // Must manually compute sticky IDs
  stickyIds = computed(() => {
    const draggedItem = this.dragState.draggedItem();
    return draggedItem ? [draggedItem.draggableId] : [];
  });

  // Must manually insert placeholder
  itemsWithPlaceholder = computed(() => {
    // ... placeholder insertion logic
  });

  getItemId = (item: Item) => item.id;
  trackById = (index: number, item: Item) => item.id;

  onDrop(event: DropEvent): void {
    // Manual drop handling logic
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

### VirtualForDirective with Custom Scroll Containers

For advanced use cases where you need virtual scrolling inside an external scroll container (e.g., a custom scrollable div, a framework-provided scroll host), use the `vdndScrollable` directive with `*vdndVirtualFor`:

```html
<div vdndScrollable style="overflow: auto; height: 400px;">
  <ng-container
    *vdndVirtualFor="
    let item of items();
    itemHeight: 50;
    trackBy: trackById;
    droppableId: 'list-1';
    let isPlaceholder = isPlaceholder
  "
  >
    @if (isPlaceholder) {
    <vdnd-placeholder [height]="50"></vdnd-placeholder>
    } @else {
    <div vdndDraggable="{{ item.id }}" vdndDraggableGroup="my-group">{{ item.name }}</div>
    }
  </ng-container>
</div>
```

The `vdndScrollable` directive marks the element as the scroll container and provides it to `*vdndVirtualFor` via dependency injection.

#### ScrollableDirective

Marks an element as a scroll container for virtual scrolling.

```html
<div
  vdndScrollable
  [scrollContainerId]="'my-scroll-container'"
  [autoScrollEnabled]="true"
  [autoScrollConfig]="{ threshold: 50, maxSpeed: 15 }"
  style="overflow: auto; height: 400px;"
>
  <!-- content with *vdndVirtualFor -->
</div>
```

| Input               | Type               | Description                                   |
| ------------------- | ------------------ | --------------------------------------------- |
| `scrollContainerId` | `string`           | Optional ID for auto-scroll registration      |
| `autoScrollEnabled` | `boolean`          | Enable auto-scroll near edges (default: true) |
| `autoScrollConfig`  | `AutoScrollConfig` | Auto-scroll configuration                     |

#### VirtualForDirective

A structural directive for virtual scrolling within custom scroll containers.

```html
<ng-container
  *vdndVirtualFor="
  let item of items();
  itemHeight: 50;
  trackBy: trackById;
  overscan: 3;
  droppableId: 'list-1';
  autoPlaceholder: true;
  let index = index;
  let isPlaceholder = isPlaceholder
"
>
  <!-- item template -->
</ng-container>
```

| Input             | Type                                  | Description                                   |
| ----------------- | ------------------------------------- | --------------------------------------------- |
| `of`              | `T[]`                                 | Array of items to iterate over                |
| `itemHeight`      | `number`                              | Height of each item in pixels                 |
| `trackBy`         | `(index: number, item: T) => unknown` | Track-by function for efficient updates       |
| `overscan`        | `number`                              | Items to render outside viewport (default: 3) |
| `droppableId`     | `string`                              | Droppable ID for auto-placeholder support     |
| `autoPlaceholder` | `boolean`                             | Auto-insert placeholder (default: true)       |

| Context Variable | Type      | Description                                  |
| ---------------- | --------- | -------------------------------------------- |
| `$implicit`      | `T`       | The item data                                |
| `index`          | `number`  | Item index (-1 for placeholders)             |
| `first`          | `boolean` | Whether this is the first visible item       |
| `last`           | `boolean` | Whether this is the last visible item        |
| `count`          | `number`  | Total item count                             |
| `isPlaceholder`  | `boolean` | Whether this is an auto-inserted placeholder |

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

### VirtualSortableListComponent

A high-level component that combines droppable, virtual scroll, and placeholder functionality. **Recommended for most use cases.**

```html
<vdnd-sortable-list
  droppableId="list-1"
  group="my-group"
  [items]="items()"
  [itemHeight]="50"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  [placeholderTemplate]="placeholderTpl"
  (drop)="onDrop($event)"
>
</vdnd-sortable-list>
```

| Input                 | Type                  | Description                              |
| --------------------- | --------------------- | ---------------------------------------- |
| `droppableId`         | `string`              | Unique identifier for this list          |
| `group`               | `string`              | Drag-and-drop group name                 |
| `items`               | `T[]`                 | Array of items to render                 |
| `itemHeight`          | `number`              | Height of each item in pixels            |
| `itemIdFn`            | `(item: T) => string` | Function to get unique ID from item      |
| `itemTemplate`        | `TemplateRef`         | Template for rendering each item         |
| `trackByFn`           | `Function`            | Optional track-by (defaults to itemIdFn) |
| `placeholderTemplate` | `TemplateRef`         | Optional custom placeholder template     |
| `containerHeight`     | `number`              | Optional explicit container height       |
| `disabled`            | `boolean`             | Whether this list is disabled            |

| Output               | Type                 | Description                        |
| -------------------- | -------------------- | ---------------------------------- |
| `drop`               | `DropEvent`          | Emitted when an item is dropped    |
| `dragEnter`          | `DragEnterEvent`     | Emitted when a draggable enters    |
| `dragLeave`          | `DragLeaveEvent`     | Emitted when a draggable leaves    |
| `visibleRangeChange` | `VisibleRangeChange` | Emitted when visible range changes |

### DroppableGroupDirective

Provides group context to child draggables and droppables, eliminating repetitive `vdndDraggableGroup` and `vdndDroppableGroup` attributes.

```html
<!-- Without group directive (verbose) -->
<div vdndDroppable="list-1" vdndDroppableGroup="my-group">
  <div vdndDraggable="item-1" vdndDraggableGroup="my-group">Item 1</div>
  <div vdndDraggable="item-2" vdndDraggableGroup="my-group">Item 2</div>
</div>

<!-- With group directive (concise) -->
<div vdndGroup="my-group">
  <div vdndDroppable="list-1">
    <div vdndDraggable="item-1">Item 1</div>
    <div vdndDraggable="item-2">Item 2</div>
  </div>
</div>
```

### Drop Utilities

Utility functions for common drop handling patterns:

```typescript
import { moveItem, reorderItems, applyMove, isNoOpDrop } from 'ngx-virtual-dnd';

// Move items between signal-based lists
moveItem(event, {
  'list-1': this.list1,
  'list-2': this.list2,
});

// Reorder within a single list
reorderItems(event, this.items);

// Immutable version (returns new arrays)
const updated = applyMove(event, {
  'list-1': this.list1(),
  'list-2': this.list2(),
});

// Check if drop is a no-op (same position)
if (isNoOpDrop(event)) return;
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

### Custom Scroll Container (Advanced)

For advanced use cases, you can implement your own scroll container by providing the `VDND_SCROLL_CONTAINER` token:

```typescript
import { VDND_SCROLL_CONTAINER, VdndScrollContainer } from 'ngx-virtual-dnd';

@Directive({
  selector: '[myCustomScrollable]',
  providers: [{ provide: VDND_SCROLL_CONTAINER, useExisting: MyCustomScrollableDirective }],
})
export class MyCustomScrollableDirective implements VdndScrollContainer {
  readonly #elementRef = inject(ElementRef<HTMLElement>);
  readonly #scrollTop = signal(0);
  readonly #containerHeight = signal(0);

  get nativeElement(): HTMLElement {
    return this.#elementRef.nativeElement;
  }

  scrollTop(): number {
    return this.#scrollTop();
  }

  containerHeight(): number {
    return this.#containerHeight();
  }

  scrollTo(options: ScrollToOptions): void {
    this.nativeElement.scrollTo(options);
  }

  // Set up scroll listeners and resize observers to update signals...
}
```

The `VdndScrollContainer` interface requires:

| Method/Property     | Type                                 | Description                                |
| ------------------- | ------------------------------------ | ------------------------------------------ |
| `nativeElement`     | `HTMLElement`                        | The scrollable DOM element                 |
| `scrollTop()`       | `number`                             | Current scroll position (must be reactive) |
| `containerHeight()` | `number`                             | Container height (must be reactive)        |
| `scrollTo()`        | `(options: ScrollToOptions) => void` | Scroll to a position                       |

**Important:** The `scrollTop()` and `containerHeight()` methods must be backed by signals so that changes trigger re-computation in `*vdndVirtualFor`.

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
