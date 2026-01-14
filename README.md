# ngx-virtual-dnd

Angular drag-and-drop library optimized for virtual scrolling. Handles thousands of items efficiently by only rendering visible elements.

Inspired by [react-virtualized-dnd](https://github.com/forecast-it/react-virtualized-dnd/).

## Features

- **Virtual Scrolling** - Renders only visible items plus overscan buffer
- **Smooth Drag & Drop** - 60fps with RAF throttling
- **Cross-List Support** - Drag between multiple lists with group filtering
- **Auto-Scroll** - Scrolls when dragging near container edges
- **Keyboard Accessible** - Space to grab, arrows to move, Escape to cancel
- **Touch Support** - Works with mouse and touch
- **Angular 21+** - Signals, standalone components, modern patterns

## Installation

```bash
npm install ngx-virtual-dnd
```

## Quick Start

The fastest way to get started:

```typescript
import {
  VirtualSortableListComponent,
  DroppableGroupDirective,
  DraggableDirective,
  DragPreviewComponent,
  PlaceholderComponent,
  DropEvent,
  moveItem,
} from 'ngx-virtual-dnd';

@Component({
  imports: [
    VirtualSortableListComponent,
    DroppableGroupDirective,
    DraggableDirective,
    DragPreviewComponent,
    PlaceholderComponent,
  ],
  template: `
    <!-- Item template -->
    <ng-template #itemTpl let-item let-isPlaceholder="isPlaceholder">
      @if (isPlaceholder) {
        <vdnd-placeholder [height]="50" />
      } @else {
        <div class="item" vdndDraggable="{{ item.id }}" [vdndDraggableData]="item">
          {{ item.name }}
        </div>
      }
    </ng-template>

    <!-- Lists wrapped in a group -->
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

    <!-- Required: renders the dragged item preview -->
    <vdnd-drag-preview />
  `,
})
export class MyComponent {
  list1 = signal<Item[]>([...]);
  list2 = signal<Item[]>([...]);

  getItemId = (item: Item) => item.id;

  // One-liner drop handler
  onDrop(event: DropEvent): void {
    moveItem(event, {
      'list-1': this.list1,
      'list-2': this.list2,
    });
  }
}
```

**That's it!** The `VirtualSortableListComponent` handles placeholder positioning, sticky items during drag, and virtual scroll integration automatically.

## API Reference

### VirtualSortableListComponent

High-level component combining droppable, virtual scroll, and placeholder handling.

```html
<vdnd-sortable-list
  droppableId="list-1"
  group="my-group"
  [items]="items()"
  [itemHeight]="50"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

| Input                 | Type                  | Required | Description                                     |
| --------------------- | --------------------- | -------- | ----------------------------------------------- |
| `droppableId`         | `string`              | Yes      | Unique ID for this list                         |
| `group`               | `string`              | Yes      | Group name for cross-list drag                  |
| `items`               | `T[]`                 | Yes      | Array of items                                  |
| `itemHeight`          | `number`              | Yes      | Height of each item (px)                        |
| `itemIdFn`            | `(item: T) => string` | Yes      | Function to get unique ID                       |
| `itemTemplate`        | `TemplateRef`         | Yes      | Template for rendering items                    |
| `containerHeight`     | `number`              | No       | Container height (px), auto-detected if omitted |
| `disabled`            | `boolean`             | No       | Disable dropping                                |
| `overscan`            | `number`              | No       | Items to render outside viewport (default: 3)   |
| `placeholderTemplate` | `TemplateRef`         | No       | Custom placeholder template                     |
| `autoScrollEnabled`   | `boolean`             | No       | Enable edge auto-scroll (default: true)         |
| `autoScrollConfig`    | `object`              | No       | `{ threshold, maxSpeed, accelerate }`           |

| Output      | Description                       |
| ----------- | --------------------------------- |
| `drop`      | Emitted when an item is dropped   |
| `dragEnter` | Draggable entered this list       |
| `dragLeave` | Draggable left this list          |
| `dragOver`  | Draggable hovering over this list |

### DraggableDirective

Makes an element draggable.

```html
<div
  vdndDraggable="item-id"
  [vdndDraggableData]="item"
  [vdndDraggableGroup]="groupName"
  [disabled]="false"
  [dragHandle]=".handle"
  [dragThreshold]="5"
  [dragDelay]="0"
  [lockAxis]="'y'"
  (dragStart)="onStart($event)"
  (dragMove)="onMove($event)"
  (dragEnd)="onEnd($event)"
></div>
```

| Input                | Description                                    |
| -------------------- | ---------------------------------------------- |
| `vdndDraggable`      | Unique ID for this draggable                   |
| `vdndDraggableData`  | Data attached to the draggable                 |
| `vdndDraggableGroup` | Group name (auto-inherited from `vdndGroup`)   |
| `disabled`           | Disable dragging                               |
| `dragHandle`         | CSS selector for handle element                |
| `dragThreshold`      | Min distance before drag starts (default: 5px) |
| `dragDelay`          | Delay before drag starts (ms)                  |
| `lockAxis`           | Constrain to `'x'` or `'y'` axis               |

### DroppableDirective

Marks an element as a drop target. Use this for custom layouts or when not using `VirtualSortableListComponent`.

```html
<div
  vdndDroppable="list-id"
  vdndDroppableGroup="group-name"
  [vdndDroppableData]="data"
  [disabled]="false"
  (drop)="onDrop($event)"
></div>
```

### DroppableGroupDirective

Provides group context to child draggables/droppables, reducing repetition.

```html
<!-- Without group directive -->
<div vdndDroppable="list-1" vdndDroppableGroup="my-group">
  <div vdndDraggable="item-1" vdndDraggableGroup="my-group">Item</div>
</div>

<!-- With group directive (cleaner) -->
<div vdndGroup="my-group">
  <div vdndDroppable="list-1">
    <div vdndDraggable="item-1">Item</div>
  </div>
</div>
```

### Drop Utilities

```typescript
import { moveItem, reorderItems, applyMove, isNoOpDrop, insertAt, removeAt } from 'ngx-virtual-dnd';

// Move between signal-based lists (mutates signals)
moveItem(event, {
  'list-1': this.list1,
  'list-2': this.list2,
});

// Reorder within a single list (mutates signal)
reorderItems(event, this.items);

// Immutable version (returns new arrays)
const updated = applyMove(event, {
  'list-1': this.list1(),
  'list-2': this.list2(),
});

// Check if drop would be a no-op (same position)
if (isNoOpDrop(event)) return;

// Low-level array helpers
const newArray = insertAt(array, index, item);
const newArray = removeAt(array, index);
```

### DragStateService

Access drag state for custom integrations.

```typescript
@Injectable({ providedIn: 'root' })
export class DragStateService {
  readonly isDragging: Signal<boolean>;
  readonly draggedItem: Signal<DraggedItem | null>;
  readonly sourceDroppableId: Signal<string | null>;
  readonly activeDroppableId: Signal<string | null>;
  readonly placeholderIndex: Signal<number | null>;
  readonly cursorPosition: Signal<{ x: number; y: number } | null>;
}
```

## Advanced Usage

### Low-Level API

For maximum control, use individual components/directives instead of `VirtualSortableListComponent`:

```typescript
@Component({
  imports: [
    VirtualScrollContainerComponent,
    DroppableDirective,
    DraggableDirective,
    DragPreviewComponent,
    PlaceholderComponent,
  ],
  template: `
    <div vdndDroppable="list-1" vdndDroppableGroup="demo" (drop)="onDrop($event)">
      <vdnd-virtual-scroll
        [items]="itemsWithPlaceholder()"
        [itemHeight]="50"
        [stickyItemIds]="stickyIds()"
        [itemIdFn]="getItemId"
        [trackByFn]="trackById"
        [itemTemplate]="itemTpl"
      />
    </div>
    <vdnd-drag-preview />
  `,
})
export class ListComponent {
  readonly #dragState = inject(DragStateService);
  items = signal<Item[]>([]);

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

    if (activeDroppable !== 'list-1' || placeholderIndex === null) {
      return items;
    }

    const result = [...items];
    result.splice(placeholderIndex, 0, { id: 'placeholder', isPlaceholder: true } as any);
    return result;
  });
}
```

### External Scroll Containers

Use `vdndScrollable` with `*vdndVirtualFor` when you need virtual scrolling inside a custom scroll host (like Ionic's `ion-content`):

```html
<ion-content vdndScrollable class="ion-content-scroll-host">
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
    <vdnd-placeholder [height]="50" />
    } @else {
    <div vdndDraggable="{{ item.id }}">{{ item.name }}</div>
    }
  </ng-container>
</ion-content>
```

The `vdndScrollable` directive:

- Provides scroll container context to child virtual scroll directives
- Supports auto-scroll during drag operations
- Works with any scrollable element (`overflow: auto/scroll`)

### Keyboard Navigation

| Key         | Action                      |
| ----------- | --------------------------- |
| `Tab`       | Navigate to draggable items |
| `Space`     | Start/end drag              |
| `Arrow ↑/↓` | Move item up/down           |
| `Arrow ←/→` | Move to adjacent list       |
| `Escape`    | Cancel drag                 |

ARIA attributes (`aria-grabbed`, `aria-dropeffect`, `tabindex`) are managed automatically.

**Screen Reader Announcements:** The library emits events with position data. Implement announcements in your app:

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
    <div aria-live="assertive" class="sr-only">{{ announcement() }}</div>
  `,
})
export class MyComponent {
  announcement = signal('');

  announce(msg: string) {
    this.announcement.set(msg);
  }

  announceEnd(e: DragEndEvent) {
    this.announce(
      e.cancelled
        ? `Cancelled. Returned to position ${e.sourceIndex + 1}`
        : `Dropped at position ${e.destinationIndex! + 1}`,
    );
  }
}
```

## CSS Classes

| Class                     | Element   | Applied When                |
| ------------------------- | --------- | --------------------------- |
| `vdnd-draggable`          | Draggable | Always                      |
| `vdnd-draggable-dragging` | Draggable | While being dragged         |
| `vdnd-draggable-disabled` | Draggable | When disabled               |
| `vdnd-drag-pending`       | Draggable | After delay, ready to drag  |
| `vdnd-droppable`          | Droppable | Always                      |
| `vdnd-droppable-active`   | Droppable | When a draggable is over it |
| `vdnd-droppable-disabled` | Droppable | When disabled               |

## How It Works

Traditional drag-and-drop libraries query sibling DOM elements via `getBoundingClientRect()`. This fails with virtual scrolling because items outside the viewport aren't rendered.

This library uses **element-under-point detection**: temporarily hide the dragged element, use `document.elementFromPoint()` to find what's at the cursor, walk up to find the droppable, and calculate placeholder position mathematically.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Development

```bash
npm start              # Dev server (localhost:4200)
ng build ngx-virtual-dnd  # Build library (required after lib edits)
npm test               # Unit tests
npm run e2e            # E2E tests
```

## License

MIT
