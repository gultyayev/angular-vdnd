# ngx-virtual-dnd

An Angular drag-and-drop library optimized for virtual scrolling. Handles thousands of items efficiently by only rendering visible elements while maintaining smooth drag operations.

Inspired by [react-virtualized-dnd](https://github.com/forecast-it/react-virtualized-dnd/).

## Features

- **Virtual Scrolling** - Renders only visible items plus an overscan buffer
- **Smooth Drag & Drop** - 60fps drag operations with RAF throttling
- **Cross-List Support** - Drag items between multiple lists with group filtering
- **Auto-Scroll** - Automatically scrolls when dragging near container edges
- **Axis Locking** - Constrain dragging to horizontal or vertical axis
- **Touch Support** - Works with both mouse and touch events
- **Keyboard Accessible** - Full keyboard support (Space, Arrow keys, Escape)
- **ARIA Support** - `aria-grabbed` and `aria-dropeffect` attributes
- **Angular 21+** - Built with signals, standalone components, and modern patterns
- **Simplified API** - High-level `VirtualSortableListComponent` for quick setup
- **External Scroll Containers** - `vdndScrollable` directive for custom scroll hosts

## Installation

```bash
npm install ngx-virtual-dnd
```

**Peer Dependencies:** Angular 21+

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
      <vdnd-sortable-list
        droppableId="list-1"
        group="my-group"
        [items]="list1()"
        [itemHeight]="50"
        [containerHeight]="400"
        [itemIdFn]="getItemId"
        [itemTemplate]="itemTpl"
        (drop)="onDrop($event)"
      />

      <vdnd-sortable-list
        droppableId="list-2"
        group="my-group"
        [items]="list2()"
        [itemHeight]="50"
        [containerHeight]="400"
        [itemIdFn]="getItemId"
        [itemTemplate]="itemTpl"
        (drop)="onDrop($event)"
      />
    </div>

    <vdnd-drag-preview />
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
  END_OF_LIST,
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
    <div class="list" vdndDroppable="my-list" vdndDroppableGroup="demo" (drop)="onDrop($event)">
      <vdnd-virtual-scroll
        [items]="itemsWithPlaceholder()"
        [itemHeight]="50"
        [stickyItemIds]="stickyIds()"
        [itemIdFn]="getItemId"
        [trackByFn]="trackById"
      >
        <ng-template let-item let-index="index">
          @if (item.isPlaceholder) {
            <vdnd-placeholder [height]="50" />
          } @else {
            <div
              class="item"
              vdndDraggable="{{ item.id }}"
              vdndDraggableGroup="demo"
              [vdndDraggableData]="item"
            >
              {{ item.name }}
            </div>
          }
        </ng-template>
      </vdnd-virtual-scroll>
    </div>

    <vdnd-drag-preview />
  `,
})
export class ListComponent {
  readonly #dragState = inject(DragStateService);

  items = signal<Item[]>([
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ]);

  // Keep dragged item rendered during scroll
  stickyIds = computed(() => {
    const item = this.#dragState.draggedItem();
    return item ? [item.draggableId] : [];
  });

  // Insert placeholder into list
  itemsWithPlaceholder = computed(() => {
    const items = this.items();
    const activeDroppable = this.#dragState.activeDroppableId();
    const placeholderIndex = this.#dragState.placeholderIndex();

    if (activeDroppable !== 'my-list' || placeholderIndex === null) {
      return items;
    }

    const result = [...items];
    result.splice(placeholderIndex, 0, { id: 'placeholder', isPlaceholder: true } as any);
    return result;
  });

  onDrop(event: DropEvent): void {
    const sourceIndex = event.source.index;
    const destIndex = event.destination.index;

    this.items.update((items) => {
      const newItems = [...items];
      const [removed] = newItems.splice(sourceIndex, 1);
      newItems.splice(destIndex, 0, removed);
      return newItems;
    });
  }

  readonly getItemId = (item: Item): string => item.id;
  readonly trackById = (_: number, item: Item): string => item.id;
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

### DroppableGroupDirective

Provides group context to child draggables and droppables.

```html
<!-- Without group directive (verbose) -->
<div vdndDroppable="list-1" vdndDroppableGroup="my-group">
  <div vdndDraggable="item-1" vdndDraggableGroup="my-group">Item 1</div>
</div>

<!-- With group directive (concise) -->
<div vdndGroup="my-group">
  <div vdndDroppable="list-1">
    <div vdndDraggable="item-1">Item 1</div>
  </div>
</div>
```

### Drop Utilities

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
  readonly placeholderIndex: Signal<number | null>;
  readonly cursorPosition: Signal<CursorPosition | null>;
}
```

## Event Types

### DragStartEvent

```typescript
interface DragStartEvent {
  draggableId: string;
  droppableId: string;
  data?: unknown;
  position: { x: number; y: number };
  sourceIndex: number; // 0-indexed position in source list
}
```

### DragMoveEvent

```typescript
interface DragMoveEvent {
  draggableId: string;
  position: { x: number; y: number };
  targetIndex: number | null; // Current placeholder index (0-indexed)
}
```

### DragEndEvent

```typescript
interface DragEndEvent {
  draggableId: string;
  position: { x: number; y: number };
  cancelled: boolean;
  sourceIndex: number; // Original position (for announcements)
  destinationIndex: number | null; // Final position (null if cancelled)
}
```

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

## Keyboard Accessibility

The library provides full keyboard support for drag-and-drop operations, compliant with WCAG 2.5.7 (Dragging Movements) and WCAG 2.1.1 (Keyboard).

### Keyboard Interaction Model

| Key               | Action                                           |
| ----------------- | ------------------------------------------------ |
| `Tab`             | Navigate to draggable items                      |
| `Space`           | Start drag (while focused on draggable item)     |
| `Arrow ↑` / `↓`   | Move item up/down in the list                    |
| `Arrow ←` / `→`   | Move item to adjacent list (cross-list movement) |
| `Space` / `Enter` | Drop item at current position                    |
| `Escape`          | Cancel drag and return item to original position |

### ARIA Attributes

The library automatically manages these ARIA attributes:

| Attribute         | Element   | Description                                  |
| ----------------- | --------- | -------------------------------------------- |
| `aria-grabbed`    | Draggable | `true` when being dragged, `false` otherwise |
| `aria-dropeffect` | Droppable | Set to `move` on drop target containers      |
| `tabindex`        | Draggable | Set to `0` for keyboard focusability         |

### Screen Reader Announcements

The library emits events with position data (`sourceIndex`, `targetIndex`, `destinationIndex`) that consumers can use to build screen reader announcements. This approach:

- Avoids i18n complexity (consumers control announcement text)
- Allows customization of announcement timing and content
- Works with any screen reader announcement mechanism

**Example: Consumer-Side Announcer**

```typescript
@Component({
  template: `
    <div
      vdndDraggable="item-1"
      (dragStart)="announce('Grabbed ' + item.name)"
      (dragEnd)="announceEnd($event)"
    >
      {{ item.name }}
    </div>
    <div aria-live="assertive" class="visually-hidden">{{ announcement() }}</div>
  `,
})
export class MyComponent {
  announcement = signal('');

  announce(message: string): void {
    this.announcement.set(message);
  }

  announceEnd(event: DragEndEvent): void {
    if (event.cancelled) {
      this.announce(`Cancelled. Returned to position ${event.sourceIndex + 1}`);
    } else {
      this.announce(`Dropped at position ${event.destinationIndex! + 1}`);
    }
  }
}
```

### Virtual Scroll Integration

Keyboard navigation works seamlessly with virtual scrolling:

- **Auto-scroll**: When navigating beyond the visible range, the container automatically scrolls
- **Large lists**: Tested with 10,000+ items without performance degradation
- **Cross-list moves**: Works across multiple virtualized lists

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

### Why Virtual Scroll + DnD is Hard

Traditional drag-and-drop libraries (like Angular CDK) query sibling DOM elements via `getBoundingClientRect()`. This fails with virtual scrolling because items outside the viewport aren't rendered.

### The Solution

This library uses **element-under-point detection** instead of DOM sibling queries:

1. Temporarily hide the dragged element
2. Use `document.elementFromPoint()` to find what's at the cursor
3. Walk up the DOM to find the droppable/draggable parent
4. Calculate placeholder position mathematically

This works because only the visible item at the cursor position needs to exist in the DOM.

### Placeholder Index

The placeholder index is calculated using the **preview center position**, providing intuitive UX where the placeholder appears where the preview visually is.

## Project Structure

```
/projects/ngx-virtual-dnd/    # Reusable library (npm: ngx-virtual-dnd)
/src/                         # Demo application
/e2e/                         # Playwright E2E tests
/docs/                        # Documentation
```

## Development

```bash
# Install dependencies
npm install

# Start demo app (http://localhost:4200)
npm start

# Build library (required after editing library files)
ng build ngx-virtual-dnd

# Run unit tests
npm test

# Run E2E tests
npm run e2e

# Run E2E tests with UI
npm run e2e:ui

# Lint
npm run lint

# Storybook
npm run storybook
```

### Library Development

The demo app imports from `dist/ngx-virtual-dnd`. After editing any file in `/projects/ngx-virtual-dnd/`:

1. Rebuild the library: `ng build ngx-virtual-dnd`
2. Restart the dev server if running

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md) - How the library works
- [API Reference](./docs/API.md) - Components, directives, and services
- [Usage Guide](./docs/USAGE.md) - Detailed examples
- [Algorithm](./docs/ALGORITHM.md) - Core positioning algorithm

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT
