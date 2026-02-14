---
name: ngx-virtual-dnd
description: Integrate the ngx-virtual-dnd drag-and-drop library optimized for virtual scrolling in Angular 21+ applications. Covers sortable lists, cross-list drag, virtual scrolling, dynamic heights, keyboard accessibility, custom previews, page-level scrolling, and all configuration options. Triggers on drag-and-drop implementation, virtual scroll lists, sortable UI, or reorderable collections.
metadata:
  author: gultyayev
---

# ngx-virtual-dnd

Angular drag-and-drop library optimized for virtual scrolling. Renders only visible items — handles thousands efficiently.

## Installation

```bash
npm install ngx-virtual-dnd
```

Requires **Angular 21+** and **TypeScript 5.9+**.

All imports come from `'ngx-virtual-dnd'`.

## Quick Start

The fastest way to add drag-and-drop to a list: use `VirtualSortableListComponent` (handles virtual scroll, placeholders, and sticky items automatically) with `DragPreviewComponent` (renders the dragged item preview — always required).

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    VirtualSortableListComponent,
    DroppableGroupDirective,
    DraggableDirective,
    DragPreviewComponent,
  ],
  template: `
    <!-- Item template: the root element MUST have [vdndDraggable] -->
    <ng-template #itemTpl let-item>
      <div class="item" [vdndDraggable]="item.id" [vdndDraggableData]="item">
        {{ item.name }}
      </div>
    </ng-template>

    <!-- Wrap lists in a group for cross-list drag -->
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

**Single-list (no cross-list drag):** Omit `DroppableGroupDirective`, `vdndGroup`, and the `group` input.

## Drop Event Handling

Every `(drop)` handler receives a `DropEvent` with `source` and `destination`:

```typescript
interface DropEvent {
  source: { draggableId: string; droppableId: string; index: number; data?: unknown };
  destination: { droppableId: string; placeholderId: string; index: number; data?: unknown };
}
```

### Utility functions

| Function | Use When |
|----------|----------|
| `moveItem(event, lists)` | Cross-list drag with signal-based lists. Pass a `Record<string, WritableSignal<T[]>>` mapping droppable IDs to signals. Handles same-list reorder and cross-list moves. |
| `reorderItems(event, list)` | Single-list reorder with a signal-based list. |
| `applyMove(event, lists)` | Immutable pattern (NgRx, etc.). Pass `Record<string, T[]>`, returns new `Record<string, T[]>`. |
| `isNoOpDrop(event)` | Returns `true` if drop would result in no change (same list, same index). Use to skip unnecessary updates. |
| `insertAt(list, item, index)` | Low-level: returns new array with item inserted at index. |
| `removeAt(list, index)` | Low-level: returns new array with item removed at index. |

**Signal-based (most common):**

```typescript
onDrop(event: DropEvent): void {
  moveItem(event, {
    'list-1': this.list1,
    'list-2': this.list2,
  });
}
```

**Single list:**

```typescript
onDrop(event: DropEvent): void {
  reorderItems(event, this.items);
}
```

**Immutable (NgRx/store):**

```typescript
onDrop(event: DropEvent): void {
  if (isNoOpDrop(event)) return;
  const updated = applyMove(event, {
    'list-1': this.list1(),
    'list-2': this.list2(),
  });
  this.store.dispatch(listsUpdated({ lists: updated }));
}
```

## Choosing a Virtual Scroll Approach

| Approach | Component | When to Use |
|----------|-----------|-------------|
| **High-level** | `VirtualSortableListComponent` | Default choice. Combines droppable + virtual scroll + placeholder. Least code. |
| **Low-level** | `VirtualScrollContainerComponent` + `DroppableDirective` | Need direct control over the droppable container (custom wrapping, separate scroll/drop zones). |
| **Page-level scroll** | `VirtualContentComponent` + `ScrollableDirective` | List scrolls with the page (or an external scroll container like Ionic `ion-content`). Headers/footers in document flow. |

All three support dynamic item heights, auto-scroll, and cross-list drag.

## Low-Level API

For maximum control, compose the primitives yourself:

```typescript
import {
  VirtualScrollContainerComponent,
  DroppableGroupDirective,
  DroppableDirective,
  DraggableDirective,
  DragPreviewComponent,
  DropEvent,
  moveItem,
} from 'ngx-virtual-dnd';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  items = signal<Item[]>([...]);
  getItemId = (item: Item) => item.id;
  trackById = (index: number, item: Item) => item.id;

  onDrop(event: DropEvent): void {
    reorderItems(event, this.items);
  }
}
```

`VirtualScrollContainerComponent` also provides programmatic scroll methods: `scrollTo(position)`, `scrollToIndex(index)`, `scrollBy(delta)`, `getScrollTop()`, `getScrollHeight()`.

## Page-Level Scroll

Use `VirtualContentComponent` + `ScrollableDirective` when the list scrolls with the page rather than inside a fixed container:

```typescript
import {
  ScrollableDirective,
  VirtualContentComponent,
  VirtualForDirective,
  DraggableDirective,
  DroppableDirective,
  DroppableGroupDirective,
  DragPreviewComponent,
  ContentHeaderDirective,
  DropEvent,
  reorderItems,
} from 'ngx-virtual-dnd';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    <div class="scroll-container" vdndScrollable>
      <div vdndGroup="tasks">
        <vdnd-virtual-content
          [itemHeight]="72"
          vdndDroppable="list-1"
          (drop)="onDrop($event)"
        >
          <!-- Header: auto-measured via ResizeObserver, scrolls with content -->
          <div class="header" vdndContentHeader>Tasks</div>

          <ng-container
            *vdndVirtualFor="let item of items(); trackBy: trackById"
          >
            <div class="item" [vdndDraggable]="item.id">{{ item.name }}</div>
          </ng-container>
        </vdnd-virtual-content>
      </div>

      <!-- Footer: normal sibling in document flow -->
      <div class="footer">Load more</div>
    </div>

    <vdnd-drag-preview />
  `,
})
export class PageComponent {
  items = signal<Item[]>([...]);
  trackById = (index: number, item: Item) => item.id;

  onDrop(event: DropEvent): void {
    reorderItems(event, this.items);
  }
}
```

Key points:

- `vdndScrollable` marks the scroll container (can be any scrollable element including Ionic `ion-content` scroll host)
- `vdndContentHeader` marks a projected header — its height is auto-measured via ResizeObserver and used as the content offset
- `contentOffset` input on `VirtualContentComponent` is available as an escape hatch when the header lives outside the component
- `*vdndVirtualFor` inherits `itemHeight`, `dynamicItemHeight`, and `droppableId` from the parent viewport/droppable — only `trackBy` is required

## Dynamic Item Heights

When items have variable heights, set `[dynamicItemHeight]="true"`. The `itemHeight` value becomes the initial estimate for unmeasured items. Actual heights are auto-measured via ResizeObserver.

**With `VirtualSortableListComponent`:**

```html
<vdnd-sortable-list
  droppableId="list-1"
  [items]="items()"
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
- `DynamicHeightStrategy` with auto-measurement activates when `dynamicItemHeight` is `true`
- Heights are tracked by `trackBy` key, so they survive reordering
- Inside a viewport component (`vdnd-virtual-viewport` or `vdnd-virtual-content`), `itemHeight`, `dynamicItemHeight`, and `droppableId` are inherited automatically — only `trackBy` is needed

## Configuration

### Drag Handles

Restrict drag initiation to specific elements using a CSS selector:

```html
<div [vdndDraggable]="item.id" dragHandle=".handle">
  <span class="handle">&#x2801;</span>
  <span>{{ item.name }}</span>
</div>
```

Only clicks on elements matching the selector start a drag. The rest of the element remains interactive.

### Axis Locking

Lock dragging to a single axis:

```html
<!-- Vertical only -->
<div [vdndDraggable]="item.id" lockAxis="y">{{ item.name }}</div>

<!-- Horizontal only -->
<div [vdndDraggable]="item.id" lockAxis="x">{{ item.name }}</div>
```

### Drag Threshold & Delay

```html
<div [vdndDraggable]="item.id" [dragThreshold]="10" [dragDelay]="200">
  {{ item.name }}
</div>
```

- `dragThreshold` (default: `5`) — minimum distance in pixels before drag starts. Prevents accidental drags on click.
- `dragDelay` (default: `0`) — delay in milliseconds after pointer down before drag activates. Useful on touch devices to distinguish scrolling from dragging.
- Listen to `(dragReadyChange)` to show visual feedback when the delay passes.

### Container Constraints

Clamp drag preview and placeholder to container boundaries:

```html
<vdnd-sortable-list
  droppableId="list-1"
  [items]="items()"
  [itemHeight]="50"
  [constrainToContainer]="true"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

Or on the directive:

```html
<div vdndDroppable="list-1" [constrainToContainer]="true">...</div>
```

### Auto-Scroll

Configure auto-scroll when dragging near container edges:

```html
<vdnd-sortable-list
  droppableId="list-1"
  [items]="items()"
  [itemHeight]="50"
  [autoScrollConfig]="{ threshold: 80, maxSpeed: 20 }"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

| Option | Default | Description |
|--------|---------|-------------|
| `threshold` | `50` | Distance from edge (px) to start scrolling |
| `maxSpeed` | `15` | Maximum scroll speed (px/frame) |
| `accelerate` | `true` | Speed up based on distance from edge |

Set `[autoScrollEnabled]="false"` to disable auto-scroll entirely. Available on `VirtualSortableListComponent`, `DroppableDirective`, `ScrollableDirective`, and `VirtualViewportComponent`.

### Disabled Elements

```html
<!-- Disable a single item -->
<div [vdndDraggable]="item.id" [disabled]="!item.canDrag">{{ item.name }}</div>

<!-- Disable an entire list -->
<vdnd-sortable-list
  droppableId="list-1"
  [items]="items()"
  [itemHeight]="50"
  [disabled]="isReadOnly()"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
  (drop)="onDrop($event)"
/>
```

Disabled draggables get `vdnd-draggable-disabled`. Disabled droppables get `vdnd-droppable-disabled`.

### Overscan

Control how many items are rendered beyond the visible viewport (default: `3`):

```html
<vdnd-sortable-list [overscan]="5" ... />
<!-- or -->
<vdnd-virtual-scroll [overscan]="5" ... />
<!-- or in microsyntax -->
*vdndVirtualFor="let item of items(); overscan: 5; trackBy: trackById"
```

### Sticky Items

Keep specific items visible regardless of scroll position (e.g., pinned items):

```html
<vdnd-virtual-scroll
  [items]="items()"
  [itemHeight]="50"
  [stickyItemIds]="['pinned-1', 'pinned-2']"
  [itemIdFn]="getItemId"
  [itemTemplate]="itemTpl"
/>
```

The dragged item is automatically sticky during drag (`autoStickyDraggedItem` defaults to `true`).

## Custom Templates

### Custom Drag Preview

```html
<ng-template #preview let-data let-draggableId="draggableId" let-droppableId="droppableId">
  <div class="custom-preview">Dragging: {{ data.name }}</div>
</ng-template>

<vdnd-drag-preview [previewTemplate]="preview" [cursorOffset]="{ x: 16, y: 16 }" />
```

Template context (`DragPreviewContext`):

| Variable | Type | Description |
|----------|------|-------------|
| `$implicit` | `T` (from `vdndDraggableData`) | The dragged item's data |
| `draggableId` | `string` | ID of the dragged item |
| `droppableId` | `string` | ID of the source droppable |

Without a custom template, the library clones the dragged element as the preview.

`cursorOffset` controls the offset from cursor in pixels (default: `{ x: 8, y: 8 }`).

### Custom Placeholder

```html
<ng-template #phTpl let-height>
  <div class="custom-placeholder" [style.height.px]="height">
    Drop here
  </div>
</ng-template>

<vdnd-placeholder [template]="phTpl" />
```

Template context (`PlaceholderContext`):

| Variable | Type | Description |
|----------|------|-------------|
| `$implicit` | `number` | Placeholder height in pixels |
| `height` | `number` | Same as `$implicit` |

## DragStateService

Inject `DragStateService` to read drag state signals for advanced UX (e.g., highlighting valid drop targets, showing instructions):

```typescript
import { DragStateService } from 'ngx-virtual-dnd';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dragState.isDragging()) {
      <div class="drag-overlay">Drop items into a list</div>
    }
  `,
})
export class AppComponent {
  protected readonly dragState = inject(DragStateService);
}
```

Available signals:

| Signal | Type |
|--------|------|
| `isDragging` | `Signal<boolean>` |
| `draggedItem` | `Signal<DraggedItem \| null>` |
| `draggedItemId` | `Signal<string \| null>` |
| `sourceDroppableId` | `Signal<string \| null>` |
| `sourceIndex` | `Signal<number \| null>` |
| `activeDroppableId` | `Signal<string \| null>` |
| `placeholderId` | `Signal<string \| null>` |
| `placeholderIndex` | `Signal<number \| null>` |
| `cursorPosition` | `Signal<CursorPosition \| null>` |
| `grabOffset` | `Signal<GrabOffset \| null>` |
| `lockAxis` | `Signal<'x' \| 'y' \| null>` |
| `isKeyboardDrag` | `Signal<boolean>` |

## Keyboard & Accessibility

### Built-in Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Navigate between draggable items |
| `Space` | Start/end drag |
| `Arrow Up/Down` | Move item up/down in current list |
| `Arrow Left/Right` | Move item to adjacent list |
| `Escape` | Cancel drag |
| `Enter` | Navigate into focused item (when not dragging) |

### ARIA Attributes (Auto-Managed)

| Attribute | Applied To | Value |
|-----------|-----------|-------|
| `aria-grabbed` | Draggable elements | `"true"` when dragging, `"false"` otherwise |
| `aria-dropeffect` | Droppable containers | `"move"` |
| `tabindex` | Draggable elements | `0` (or `-1` when disabled) |

### Screen Reader Announcements

The library emits events with position data but does not announce — implement announcements in your app for full i18n control:

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [vdndDraggable]="item.id"
      (dragStart)="announce('Grabbed ' + item.name + ', position ' + ($event.sourceIndex + 1))"
      (dragEnd)="announceEnd($event)"
    >
      {{ item.name }}
    </div>
    <div aria-live="assertive" class="sr-only">{{ announcement() }}</div>
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

## CSS Classes

| Class | Applied To | Condition |
|-------|-----------|-----------|
| `vdnd-draggable` | Draggable elements | Always |
| `vdnd-draggable-dragging` | Draggable elements | While being dragged |
| `vdnd-draggable-disabled` | Draggable elements | When disabled |
| `vdnd-drag-pending` | Draggable elements | After delay passes, ready to drag |
| `vdnd-droppable` | Droppable containers | Always |
| `vdnd-droppable-active` | Droppable containers | When a draggable is hovering over it |
| `vdnd-droppable-disabled` | Droppable containers | When disabled |
| `vdnd-sortable-list` | `<vdnd-sortable-list>` | Always |
| `vdnd-virtual-scroll` | `<vdnd-virtual-scroll>` | Always |
| `vdnd-virtual-viewport` | `<vdnd-virtual-viewport>` | Always |
| `vdnd-virtual-content` | `<vdnd-virtual-content>` | Always |
| `vdnd-scrollable` | `[vdndScrollable]` elements | Always |
| `vdnd-placeholder` | `<vdnd-placeholder>` | Always |
| `vdnd-drag-placeholder` | Drag placeholder element | Always |
| `vdnd-drag-placeholder-visible` | Drag placeholder element | While visible during drag |
| `vdnd-overlay-container` | Body-level overlay `<div>` | Always (created for drag preview) |

## Events

| Output | Event Type | Emitted By |
|--------|-----------|-----------|
| `(dragStart)` | `DragStartEvent` | `DraggableDirective` |
| `(dragMove)` | `DragMoveEvent` | `DraggableDirective` |
| `(dragEnd)` | `DragEndEvent` | `DraggableDirective` |
| `(dragReadyChange)` | `boolean` | `DraggableDirective` |
| `(dragEnter)` | `DragEnterEvent` | `DroppableDirective`, `VirtualSortableListComponent` |
| `(dragLeave)` | `DragLeaveEvent` | `DroppableDirective`, `VirtualSortableListComponent` |
| `(dragOver)` | `DragOverEvent` | `DroppableDirective`, `VirtualSortableListComponent` |
| `(drop)` | `DropEvent` | `DroppableDirective`, `VirtualSortableListComponent` |
| `(visibleRangeChange)` | `VisibleRangeChange` | `VirtualScrollContainerComponent`, `VirtualSortableListComponent` |
| `(scrollPositionChange)` | `number` | `VirtualScrollContainerComponent`, `VirtualSortableListComponent` |

`DragEndEvent.cancelled` distinguishes drops from cancellations. `DragEndEvent.sourceIndex` and `DragEndEvent.destinationIndex` provide 0-indexed positions for announcements.

## Critical Rules

1. **`<vdnd-drag-preview />` is required.** Place it once in your template (typically at the root). Without it, no drag preview renders.

2. **Group names must match.** The `group` input on `VirtualSortableListComponent` (or `vdndDroppableGroup` on `DroppableDirective`) must match the `vdndGroup` directive value on the parent element. Mismatched names prevent cross-list drag.

3. **Droppable IDs must be unique.** Each `droppableId` / `vdndDroppable` value must be unique across the entire page. Duplicate IDs cause undefined behavior.

4. **Draggable IDs must be unique within a droppable.** Each `vdndDraggable` value must be unique within its parent droppable. Duplicates break placeholder positioning.

5. **`[vdndDraggable]` must be on the template root element.** In item templates, the `[vdndDraggable]` directive must be on the outermost element — not nested inside a wrapper.

6. **Map droppable IDs to signals in `moveItem()`.** The keys in the `lists` record passed to `moveItem()` must exactly match the `droppableId` values.

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `<vdnd-drag-preview />` | Drag starts but nothing follows cursor | Add `<vdnd-drag-preview />` to template |
| Mismatched group names | Can't drag between lists | Ensure `group` input matches `vdndGroup` value |
| Non-unique droppable IDs | Items drop into wrong list | Use unique IDs for each droppable |
| Non-unique draggable IDs | Placeholder jumps or disappears | Ensure IDs are unique within each droppable |
| `[vdndDraggable]` nested inside wrapper | Drag doesn't start or clone is wrong | Move `[vdndDraggable]` to the outermost template element |
| Missing `itemIdFn` | Build error | Provide `[itemIdFn]="(item) => item.id"` |
| Missing `trackByFn` on `VirtualScrollContainerComponent` | Items flicker on reorder | Provide `[trackByFn]="(i, item) => item.id"` |
| `moveItem()` keys don't match droppable IDs | Items vanish on drop | Ensure record keys match `droppableId` values exactly |

## API Reference

For exhaustive input/output tables, event interfaces, type definitions, and function signatures, see the [API reference](references/api-reference.md).
