# ngx-virtual-dnd Usage Guide

This guide shows how to use the ngx-virtual-dnd library to implement virtual scrolling with drag-and-drop functionality.

## Installation

```bash
npm install ngx-virtual-dnd
```

## Quick Start (Recommended)

The easiest way to use the library is with `VirtualSortableListComponent` and the `moveItem` utility:

```typescript
import { Component, signal } from '@angular/core';
import {
  VirtualSortableListComponent,
  DroppableGroupDirective,
  DraggableDirective,
  DragPreviewComponent,
  DropEvent,
  moveItem,
} from 'ngx-virtual-dnd';

interface Item {
  id: string;
  name: string;
}

@Component({
  selector: 'app-sortable-list',
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

    <!-- Wrap lists in a group -->
    <div vdndGroup="my-group">
      <vdnd-sortable-list
        droppableId="my-list"
        group="my-group"
        [items]="items()"
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
export class SortableListComponent {
  items = signal<Item[]>([
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    // ... more items
  ]);

  getItemId = (item: Item) => item.id;

  onDrop(event: DropEvent): void {
    moveItem(event, { 'my-list': this.items });
  }
}
```

**That's it!** The `VirtualSortableListComponent` handles placeholder positioning, sticky items during drag, and virtual scroll integration automatically.

## Multiple Lists

Use `moveItem` with multiple lists for cross-list drag-and-drop:

```typescript
@Component({
  imports: [
    VirtualSortableListComponent,
    DroppableGroupDirective,
    DraggableDirective,
    DragPreviewComponent,
  ],
  template: `
    <ng-template #itemTpl let-item>
      <div class="item" [vdndDraggable]="item.id" [vdndDraggableData]="item">
        {{ item.name }}
      </div>
    </ng-template>

    <div vdndGroup="kanban" class="lists-container">
      <vdnd-sortable-list
        droppableId="list-1"
        group="kanban"
        [items]="list1()"
        [itemHeight]="50"
        [containerHeight]="400"
        [itemIdFn]="getItemId"
        [itemTemplate]="itemTpl"
        (drop)="onDrop($event)"
      />

      <vdnd-sortable-list
        droppableId="list-2"
        group="kanban"
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
export class KanbanComponent {
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

## Low-Level API

For maximum control, use individual components instead of `VirtualSortableListComponent`:

```typescript
import { Component, signal } from '@angular/core';
import {
  VirtualScrollContainerComponent,
  DraggableDirective,
  DroppableDirective,
  DragPreviewComponent,
  DropEvent,
  reorderItems,
} from 'ngx-virtual-dnd';

@Component({
  imports: [
    VirtualScrollContainerComponent,
    DraggableDirective,
    DroppableDirective,
    DragPreviewComponent,
  ],
  template: `
    <ng-template #itemTpl let-item>
      <div
        class="item"
        [vdndDraggable]="item.id"
        vdndDraggableGroup="my-group"
        [vdndDraggableData]="item"
      >
        {{ item.name }}
      </div>
    </ng-template>

    <div vdndDroppable="my-list" vdndDroppableGroup="my-group" (drop)="onDrop($event)">
      <vdnd-virtual-scroll
        [items]="items()"
        [itemHeight]="50"
        [containerHeight]="400"
        [itemIdFn]="getItemId"
        [trackByFn]="trackById"
        [itemTemplate]="itemTpl"
        droppableId="my-list"
      />
    </div>

    <vdnd-drag-preview />
  `,
})
export class LowLevelListComponent {
  items = signal<Item[]>([...]);

  getItemId = (item: Item) => item.id;
  trackById = (index: number, item: Item) => item.id;

  onDrop(event: DropEvent): void {
    reorderItems(event, this.items);
  }
}
```

When using the low-level API:

- Set `droppableId` on `vdnd-virtual-scroll` for automatic placeholder insertion
- The component handles sticky items automatically when `autoStickyDraggedItem` is true (default)
- You must specify `vdndDroppableGroup` on each directive (or use `vdndGroup`)

## Drag Handle

Restrict drag initiation to a specific element within the draggable:

```html
<div class="item" vdndDraggable="item-1" dragHandle=".handle">
  <span class="handle">☰</span>
  <span class="content">Item content</span>
</div>
```

## Custom Drag Preview

Customize the preview that follows the cursor:

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

Style the drop indicator via CSS (the library renders it with `.vdnd-drag-placeholder-visible`):

```css
.vdnd-drag-placeholder-visible {
  background: rgba(0, 0, 0, 0.04);
  border: 2px dashed rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}
```

## Auto-scroll Configuration

Customize auto-scroll behavior when dragging near edges:

```html
<!-- On individual droppable -->
<div
  vdndDroppable="my-list"
  [autoScrollConfig]="{ threshold: 80, maxSpeed: 20, accelerate: true }"
/>

<!-- On VirtualSortableListComponent -->
<vdnd-sortable-list
  droppableId="my-list"
  group="my-group"
  [autoScrollConfig]="{ threshold: 80, maxSpeed: 20, accelerate: true }"
  ...
/>
```

Options:

- `threshold`: Distance from edge to start scrolling (default: 50px)
- `maxSpeed`: Maximum scroll speed in pixels/frame (default: 15)
- `accelerate`: Scale speed by distance from edge (default: true)

## Disabling Drag/Drop

```html
<!-- Disable specific draggable -->
<div vdndDraggable="item-1" [disabled]="isLocked()">...</div>

<!-- Disable entire droppable -->
<vdnd-sortable-list ... [disabled]="!canEdit()" />
```

## Page-Level Scroll

For virtual scrolling within a page that has headers/footers, use `VirtualContentComponent` with `vdndScrollable`:

```typescript
import {
  ScrollableDirective,
  VirtualContentComponent,
  VirtualForDirective,
  DraggableDirective,
  DroppableDirective,
  DroppableGroupDirective,
  DragPreviewComponent,
  DropEvent,
  moveItem,
} from 'ngx-virtual-dnd';

@Component({
  imports: [
    ScrollableDirective,
    VirtualContentComponent,
    VirtualForDirective,
    DraggableDirective,
    DroppableDirective,
    DroppableGroupDirective,
    DragPreviewComponent,
  ],
  template: `
    <div class="scroll-container" vdndScrollable style="overflow: auto; height: 100vh;">
      <!-- Header that scrolls away -->
      <div class="header">Welcome!</div>

      <!-- Virtual list -->
      <div vdndGroup="tasks">
        <vdnd-virtual-content
          [itemHeight]="72"
          [totalItems]="items().length"
          [contentOffset]="headerHeight"
          [style.height.px]="items().length * 72"
          vdndDroppable="list-1"
          (drop)="onDrop($event)"
        >
          <ng-container
            *vdndVirtualFor="
              let item of items();
              itemHeight: 72;
              trackBy: trackById;
              droppableId: 'list-1'
            "
          >
            <div class="item" [vdndDraggable]="item.id">{{ item.name }}</div>
          </ng-container>
        </vdnd-virtual-content>
      </div>

      <!-- Footer -->
      <div class="footer">Load more</div>
    </div>

    <vdnd-drag-preview />
  `,
})
export class PageComponent {
  items = signal<Item[]>([...]);
  headerHeight = 64; // Adjust based on your header

  trackById = (index: number, item: Item) => item.id;

  onDrop(event: DropEvent): void {
    moveItem(event, { 'list-1': this.items });
  }
}
```

Key points:

- `vdndScrollable` marks the scroll container
- `VirtualContentComponent` provides wrapper-based positioning
- `contentOffset` accounts for content above the list (headers)
- Set explicit height on `vdnd-virtual-content` matching total item height

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

.vdnd-drag-pending {
  cursor: grabbing;
}

/* Placeholder */
.vdnd-placeholder {
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

## Keyboard Navigation

The library has full keyboard support:

| Key         | Action                      |
| ----------- | --------------------------- |
| `Tab`       | Navigate to draggable items |
| `Space`     | Start/end drag              |
| `Arrow ↑/↓` | Move item up/down           |
| `Arrow ←/→` | Move to adjacent list       |
| `Escape`    | Cancel drag                 |

ARIA attributes (`aria-grabbed`, `aria-dropeffect`, `tabindex`) are managed automatically.

## Screen Reader Announcements

The library emits events with position data for implementing screen reader announcements:

```typescript
@Component({
  template: `
    <div
      vdndDraggable="item-1"
      (dragStart)="announce('Grabbed ' + item.name + ', position ' + ($event.sourceIndex + 1))"
      (dragEnd)="announceEnd($event)"
    >
      {{ item.name }}
    </div>

    <!-- Live region for announcements -->
    <div aria-live="assertive" class="sr-only">{{ announcement() }}</div>
  `,
  styles: `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
  `,
})
export class MyComponent {
  announcement = signal('');

  announce(msg: string): void {
    this.announcement.set(msg);
  }

  announceEnd(event: DragEndEvent): void {
    this.announce(
      event.cancelled
        ? `Cancelled. Returned to position ${event.sourceIndex + 1}`
        : `Dropped at position ${event.destinationIndex! + 1}`,
    );
  }
}
```

## Troubleshooting

### Items not showing

- Ensure `itemHeight` is set correctly
- If using `containerHeight`, verify it's a positive number
- Check that `itemIdFn` returns unique values for each item

### Placeholder in wrong position

- When using low-level API, set `droppableId` on `vdnd-virtual-scroll`
- Ensure `itemHeight` matches the rendered item height

### Dragged item disappears during scroll

- Use `VirtualSortableListComponent` (handles this automatically)
- Or ensure `autoStickyDraggedItem` is `true` (default) on `vdnd-virtual-scroll`

### Auto-scroll not working

- Verify `autoScrollEnabled` is `true` (default)
- Ensure the container has proper dimensions (not zero height)
- Check that the cursor is within the threshold distance of edges

### Cross-list drag not working

- Ensure all lists use the same group name
- Wrap lists in `vdndGroup` or set `vdndDraggableGroup`/`vdndDroppableGroup` on each element
- Verify each list has a unique `droppableId`

### moveItem not updating lists

- Ensure the droppable IDs in the `lists` object match the actual droppable IDs
- Check that signals are passed (not raw arrays)
- Verify no-op drops aren't being processed: use `isNoOpDrop()` to check
