# ngx-virtual-dnd

Angular drag-and-drop library optimized for virtual scrolling. Handles thousands of items efficiently by only rendering visible elements.

Inspired by [react-virtualized-dnd](https://github.com/forecast-it/react-virtualized-dnd/).

## Features

- **Virtual Scrolling** - Renders only visible items plus overscan buffer
- **Dynamic Item Heights** - Auto-measured via ResizeObserver with O(log N) lookups
- **Smooth Drag & Drop** - 60fps with RAF throttling
- **Cross-List Support** - Drag between multiple lists with group filtering
- **Auto-Scroll** - Configurable edge scrolling with speed/threshold control
- **Drag Handles** - Restrict drag initiation to specific elements
- **Container Constraints** - Constrain drag preview to container boundaries
- **Axis Locking** - Lock dragging to horizontal or vertical axis
- **Custom Previews** - Template-based drag preview and placeholder customization
- **Keyboard Accessible** - Space to grab, arrows to move, Escape to cancel
- **Touch Support** - Works with mouse and touch, with configurable delay/threshold
- **Angular 21+** - Signals, standalone components, modern patterns

## Installation

```bash
npm install ngx-virtual-dnd
```

## Quick Start

```typescript
import {
  VirtualSortableListComponent,
  DroppableGroupDirective,
  DraggableDirective,
  DragPreviewComponent,
  DropEvent,
  moveItem,
} from 'ngx-virtual-dnd';

@Component({
  imports: [
    VirtualSortableListComponent,
    DroppableGroupDirective,
    DraggableDirective,
    DragPreviewComponent,
  ],
  template: `
    <!-- Item template -->
    <ng-template #itemTpl let-item>
      <div class="item" [vdndDraggable]="item.id" [vdndDraggableData]="item">
        {{ item.name }}
      </div>
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

  onDrop(event: DropEvent): void {
    moveItem(event, {
      'list-1': this.list1,
      'list-2': this.list2,
    });
  }
}
```

**That's it!** `VirtualSortableListComponent` handles placeholder positioning, sticky items during drag, and virtual scroll integration automatically.

## API Overview

The library exports these main pieces (use IDE completion for full details):

**Components:**

- `VirtualSortableListComponent` - High-level component combining droppable, virtual scroll, and placeholder
- `VirtualScrollContainerComponent` - Low-level virtual scroll container
- `VirtualViewportComponent` - Self-contained virtual scroll viewport
- `VirtualContentComponent` - Virtual content for external scroll containers (page-level scroll)
- `DragPreviewComponent` - Renders the dragged item preview (required, supports custom templates)
- `PlaceholderComponent` - Drop position indicator

**Directives:**

- `DraggableDirective` (`vdndDraggable`) - Makes an element draggable (supports drag handles, axis locking, threshold/delay)
- `DroppableDirective` (`vdndDroppable`) - Marks a drop target (supports container constraints, auto-scroll config)
- `DroppableGroupDirective` (`vdndGroup`) - Provides group context to children
- `ScrollableDirective` (`vdndScrollable`) - Marks external scroll container
- `VirtualForDirective` (`*vdndVirtualFor`) - Structural directive for virtual lists
- `ContentHeaderDirective` (`vdndContentHeader`) - Marks a projected header inside `VirtualContentComponent` (auto-measured via ResizeObserver)

**Services:**

- `DragStateService` - Access drag state (isDragging, draggedItem, placeholderIndex, etc.)
- `AutoScrollService` - Controls edge auto-scrolling
- `PositionCalculatorService` - Calculates placeholder positions

**Utilities:**

- `moveItem()` - Move between signal-based lists
- `reorderItems()` - Reorder within a single list
- `applyMove()` - Immutable version (returns new arrays)
- `isNoOpDrop()` - Check if drop would be a no-op
- `insertAt()` / `removeAt()` - Low-level array helpers

**Strategies:**

- `VirtualScrollStrategy` - Interface for custom virtual scroll strategies
- `FixedHeightStrategy` - Fixed `index * itemHeight` math (zero overhead)
- `DynamicHeightStrategy` - Variable heights with auto-measurement and binary search

## Advanced Usage

### Dynamic Item Heights

When items have variable heights, enable `dynamicItemHeight`. Items are auto-measured via ResizeObserver — no manual height tracking needed. The `itemHeight` value serves as the initial estimate for unmeasured items.

**With `VirtualSortableListComponent`:**

```html
<vdnd-sortable-list
  droppableId="list-1"
  group="my-group"
  [items]="list()"
  [itemHeight]="80"
  [dynamicItemHeight]="true"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

**With `VirtualScrollContainerComponent`:**

```html
<vdnd-virtual-scroll
  [items]="items()"
  [itemHeight]="80"
  [dynamicItemHeight]="true"
  [itemIdFn]="getItemId"
  [trackByFn]="trackById"
  [itemTemplate]="itemTpl"
/>
```

**With `VirtualForDirective`:**

```html
<ng-container
  *vdndVirtualFor="
    let item of items();
    itemHeight: 80;
    dynamicItemHeight: true;
    trackBy: trackById;
    droppableId: 'list-1'
  "
>
  <div class="item">{{ item.description }}</div>
</ng-container>
```

Notes:

- `FixedHeightStrategy` is used by default when `dynamicItemHeight` is not set
- Setting `dynamicItemHeight` switches to `DynamicHeightStrategy` with automatic height measurement
- Heights are tracked by `trackBy` key, so they survive reordering
- The `itemHeight` value is used as the initial estimate for items not yet measured
- Inside a viewport component (`vdnd-virtual-viewport` or `vdnd-virtual-content`), `itemHeight`, `dynamicItemHeight`, and `droppableId` are inherited automatically — only `trackBy` is needed on the directive

### Drag Handles

Use `dragHandle` with a CSS selector to restrict where users can initiate a drag:

```html
<div [vdndDraggable]="item.id" dragHandle=".handle">
  <span class="handle">⠿</span>
  <span>{{ item.name }}</span>
</div>
```

Only clicks on elements matching the selector will start a drag. The rest of the element remains interactive.

### Container Constraints

Constrain the drag preview and placeholder to stay within the droppable container:

```html
<vdnd-sortable-list
  droppableId="list-1"
  group="my-group"
  [items]="items()"
  [itemHeight]="50"
  [constrainToContainer]="true"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

Or on the directive directly:

```html
<div vdndDroppable="list-1" [constrainToContainer]="true">...</div>
```

The preview cannot leave the droppable area, and the placeholder snaps to the edges.

### Axis Locking

Lock dragging to a single axis:

```html
<div [vdndDraggable]="item.id" lockAxis="y">{{ item.name }}</div>
```

Values: `'x'` (horizontal only), `'y'` (vertical only), or omit for free movement.

### Drag Threshold & Delay

```html
<div [vdndDraggable]="item.id" [dragThreshold]="10" [dragDelay]="200">{{ item.name }}</div>
```

- `dragThreshold` — minimum distance (px) before drag starts (default: `5`). Prevents accidental drags on click.
- `dragDelay` — delay (ms) after pointer down before drag activates (default: `0`). Useful on touch devices to distinguish scrolling from dragging. Use the `vdnd-drag-pending` CSS class to show visual feedback when the delay passes.

### Custom Drag Preview

Provide a custom template for the drag preview:

```html
<ng-template #preview let-data let-draggableId="draggableId">
  <div class="custom-preview">Dragging: {{ data.name }}</div>
</ng-template>

<vdnd-drag-preview [previewTemplate]="preview" [cursorOffset]="{ x: 16, y: 16 }" />
```

- `previewTemplate` — custom template for the preview. Context provides `$implicit` (the draggable's data), `draggableId`, and `droppableId`.
- `cursorOffset` — offset from cursor in pixels (default: `{ x: 8, y: 8 }`).

Without a custom template, the library clones the dragged element as the preview.

### Auto-Scroll Configuration

Configure auto-scroll behavior when dragging near container edges:

```html
<vdnd-sortable-list
  droppableId="list-1"
  group="my-group"
  [items]="items()"
  [itemHeight]="50"
  [autoScrollConfig]="{ threshold: 80, maxSpeed: 20 }"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

| Option       | Default | Description                          |
| ------------ | ------- | ------------------------------------ |
| `threshold`  | `50`    | Distance from edge (px) to trigger   |
| `maxSpeed`   | `15`    | Maximum scroll speed (px/frame)      |
| `accelerate` | `true`  | Speed up based on distance from edge |

Set `[autoScrollEnabled]="false"` to disable auto-scroll entirely. These options are available on `VirtualSortableListComponent`, `DroppableDirective`, and `ScrollableDirective`.

### Disabling Drag & Drop

Use the `disabled` input to conditionally disable draggables, droppables, or entire lists:

```html
<!-- Disable a single item -->
<div [vdndDraggable]="item.id" [disabled]="!item.canDrag">{{ item.name }}</div>

<!-- Disable an entire list -->
<vdnd-sortable-list
  droppableId="list-1"
  group="my-group"
  [items]="items()"
  [itemHeight]="50"
  [disabled]="isReadOnly()"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

Disabled draggables get the `vdnd-draggable-disabled` CSS class. Disabled droppables get `vdnd-droppable-disabled`.

### Low-Level API

For maximum control, use individual components instead of `VirtualSortableListComponent`:

```typescript
@Component({
  imports: [
    VirtualScrollContainerComponent,
    DroppableGroupDirective,
    DroppableDirective,
    DraggableDirective,
    DragPreviewComponent,
  ],
  template: `
    <ng-template #itemTpl let-item>
      <div class="item" [vdndDraggable]="item.id" [vdndDraggableData]="item">
        {{ item.name }}
      </div>
    </ng-template>

    <div vdndGroup="demo">
      <div vdndDroppable="list-1" (drop)="onDrop($event)">
        <vdnd-virtual-scroll
          droppableId="list-1"
          [items]="items()"
          [itemHeight]="50"
          [itemIdFn]="getItemId"
          [trackByFn]="trackById"
          [itemTemplate]="itemTpl"
        />
      </div>
    </div>
    <vdnd-drag-preview />
  `,
})
export class ListComponent {
  items = signal<Item[]>([]);
}
```

### Page-Level Scroll

Use `VirtualContentComponent` with `vdndScrollable` for page-level scrolling with headers/footers:

```typescript
@Component({
  imports: [
    ScrollableDirective,
    VirtualContentComponent,
    VirtualForDirective,
    DraggableDirective,
    DroppableDirective,
    DroppableGroupDirective,
    DragPreviewComponent,
    ContentHeaderDirective,
  ],
  template: `
    <ion-content [scrollY]="false">
      <div class="scroll-container ion-content-scroll-host" vdndScrollable>
        <div vdndGroup="tasks">
          <vdnd-virtual-content
            [itemHeight]="72"
            vdndDroppable="list-1"
            (drop)="onDrop($event)"
          >
            <!-- Header — auto-measured via ResizeObserver, scrolls with content -->
            <div class="header" vdndContentHeader>Welcome!</div>

            <ng-container
              *vdndVirtualFor="
                let item of items();
                trackBy: trackById
              "
            >
              <div class="item" [vdndDraggable]="item.id">{{ item.name }}</div>
            </ng-container>

          </vdnd-virtual-content>
        </div>

        <!-- Footer — normal sibling in document flow -->
        <div class="footer">Load more</div>
      </div>
    </ion-content>

    <vdnd-drag-preview />
  `,
})
export class PageComponent {
  items = signal<Item[]>([...]);
}
```

Key points:

- `vdndScrollable` marks the scroll container
- `VirtualContentComponent` provides wrapper-based positioning and derives total items from the child `*vdndVirtualFor` automatically
- `vdndContentHeader` marks a projected header — its height is auto-measured via ResizeObserver and used as the content offset (no manual measurement needed)
- `contentOffset` input is available as an escape hatch when the header lives outside the component
- `*vdndVirtualFor` inherits `itemHeight`, `dynamicItemHeight`, and `droppableId` from the parent viewport/droppable — only `trackBy` is required

### Screen Reader Announcements

The library emits events with position data. Implement announcements in your app:

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

## Keyboard Navigation

| Key         | Action                      |
| ----------- | --------------------------- |
| `Tab`       | Navigate to draggable items |
| `Space`     | Start/end drag              |
| `Arrow ↑/↓` | Move item up/down           |
| `Arrow ←/→` | Move to adjacent list       |
| `Escape`    | Cancel drag                 |

ARIA attributes (`aria-grabbed`, `aria-dropeffect`, `tabindex`) are managed automatically.

## CSS Classes

| Class                     | Applied When                |
| ------------------------- | --------------------------- |
| `vdnd-draggable`          | Always on draggable         |
| `vdnd-draggable-dragging` | While being dragged         |
| `vdnd-draggable-disabled` | When disabled               |
| `vdnd-drag-pending`       | After delay, ready to drag  |
| `vdnd-droppable`          | Always on droppable         |
| `vdnd-droppable-active`   | When a draggable is over it |
| `vdnd-droppable-disabled` | When disabled               |

## Events

All event types are importable from `ngx-virtual-dnd`.

| Output        | Event Type       | Emitted By                                           |
| ------------- | ---------------- | ---------------------------------------------------- |
| `(dragStart)` | `DragStartEvent` | `DraggableDirective`                                 |
| `(dragEnd)`   | `DragEndEvent`   | `DraggableDirective`                                 |
| `(drop)`      | `DropEvent`      | `DroppableDirective`, `VirtualSortableListComponent` |

`DragEndEvent` includes a `cancelled` boolean to distinguish drops from cancellations.

## How It Works

Traditional drag-and-drop libraries query sibling DOM elements via `getBoundingClientRect()`. This fails with virtual scrolling because items outside the viewport aren't rendered.

This library uses **element-under-point detection**: temporarily hide the dragged element, use `document.elementFromPoint()` to find what's at the cursor, walk up to find the droppable, and calculate placeholder position mathematically.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Development

```bash
npm start                    # Dev server (localhost:4200)
ng build ngx-virtual-dnd     # Build library (required after lib edits)
npm test                     # Unit tests
npm run e2e                  # E2E tests
```

## AI Agent Skills

Install a skill to teach AI coding assistants how to integrate this library:

```bash
npx skills add gultyayev/angular-vdnd
```

Works with Claude Code, Cursor, Windsurf, GitHub Copilot, and [40+ other agents](https://skills.sh).

## License

MIT
