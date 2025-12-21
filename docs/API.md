# ngx-virtual-dnd API Reference

This document describes the public API of the ngx-virtual-dnd library.

## Components

### VirtualScrollContainerComponent

A virtual scroll container that only renders visible items.

#### Selector

`vdnd-virtual-scroll`

#### Inputs

| Input             | Type                                           | Required | Default | Description                                         |
| ----------------- | ---------------------------------------------- | -------- | ------- | --------------------------------------------------- |
| `items`           | `T[]`                                          | Yes      | -       | Array of items to render                            |
| `itemHeight`      | `number`                                       | Yes      | -       | Height of each item in pixels                       |
| `containerHeight` | `number`                                       | Yes      | -       | Height of the container in pixels                   |
| `overscan`        | `number`                                       | No       | `3`     | Number of items to render above/below viewport      |
| `stickyItemIds`   | `string[]`                                     | No       | `[]`    | IDs of items to always render (e.g., dragged items) |
| `itemIdFn`        | `(item: T) => string`                          | Yes      | -       | Function to get unique ID from item                 |
| `trackByFn`       | `(index: number, item: T) => string \| number` | Yes      | -       | Track-by function for rendering                     |

#### Outputs

| Output                 | Type                                           | Description                        |
| ---------------------- | ---------------------------------------------- | ---------------------------------- |
| `visibleRangeChange`   | `EventEmitter<{ start: number; end: number }>` | Emits when visible range changes   |
| `scrollPositionChange` | `EventEmitter<number>`                         | Emits when scroll position changes |

#### Methods

| Method            | Parameters         | Returns  | Description                     |
| ----------------- | ------------------ | -------- | ------------------------------- |
| `scrollTo`        | `position: number` | `void`   | Scroll to a specific position   |
| `scrollToIndex`   | `index: number`    | `void`   | Scroll to a specific item index |
| `scrollBy`        | `delta: number`    | `void`   | Scroll by a delta amount        |
| `getScrollTop`    | -                  | `number` | Get current scroll position     |
| `getScrollHeight` | -                  | `number` | Get total scrollable height     |

---

### DragPreviewComponent

Renders a preview of the dragged item that follows the cursor.

#### Selector

`vdnd-drag-preview`

#### Inputs

| Input             | Type                                 | Required | Default          | Description                 |
| ----------------- | ------------------------------------ | -------- | ---------------- | --------------------------- |
| `previewTemplate` | `TemplateRef<DragPreviewContext<T>>` | No       | -                | Custom template for preview |
| `cursorOffset`    | `{ x: number; y: number }`           | No       | `{ x: 8, y: 8 }` | Offset from cursor          |

#### Template Context

```typescript
interface DragPreviewContext<T> {
  $implicit: T; // Item data
  draggableId: string; // Draggable ID
  droppableId: string; // Source droppable ID
}
```

---

### PlaceholderComponent

A visual placeholder indicating where a dropped item will be inserted.

#### Selector

`vdnd-placeholder`

#### Inputs

| Input    | Type     | Required | Default | Description      |
| -------- | -------- | -------- | ------- | ---------------- |
| `height` | `number` | No       | `50`    | Height in pixels |

---

## Directives

### DraggableDirective

Makes an element draggable.

#### Selector

`[vdndDraggable]`

#### Inputs

| Input                | Type      | Required | Default | Description                          |
| -------------------- | --------- | -------- | ------- | ------------------------------------ |
| `vdndDraggable`      | `string`  | Yes      | -       | Unique identifier for this draggable |
| `vdndDraggableGroup` | `string`  | Yes      | -       | Drag-and-drop group name             |
| `vdndDraggableData`  | `unknown` | No       | -       | Data associated with this item       |
| `disabled`           | `boolean` | No       | `false` | Whether dragging is disabled         |
| `dragHandle`         | `string`  | No       | -       | CSS selector for drag handle         |
| `dragThreshold`      | `number`  | No       | `5`     | Minimum distance before drag starts  |

#### Outputs

| Output      | Type                           | Description            |
| ----------- | ------------------------------ | ---------------------- |
| `dragStart` | `EventEmitter<DragStartEvent>` | Emits when drag starts |
| `dragMove`  | `EventEmitter<DragMoveEvent>`  | Emits during drag      |
| `dragEnd`   | `EventEmitter<DragEndEvent>`   | Emits when drag ends   |

#### Host Classes

| Class                     | Condition           |
| ------------------------- | ------------------- |
| `vdnd-draggable`          | Always              |
| `vdnd-draggable-dragging` | While being dragged |
| `vdnd-draggable-disabled` | When disabled       |

---

### DroppableDirective

Marks an element as a valid drop target.

#### Selector

`[vdndDroppable]`

#### Inputs

| Input                | Type                        | Required | Default | Description                          |
| -------------------- | --------------------------- | -------- | ------- | ------------------------------------ |
| `vdndDroppable`      | `string`                    | Yes      | -       | Unique identifier for this droppable |
| `vdndDroppableGroup` | `string`                    | Yes      | -       | Drag-and-drop group name             |
| `vdndDroppableData`  | `unknown`                   | No       | -       | Data associated with this droppable  |
| `disabled`           | `boolean`                   | No       | `false` | Whether dropping is disabled         |
| `autoScrollEnabled`  | `boolean`                   | No       | `true`  | Enable auto-scroll near edges        |
| `autoScrollConfig`   | `Partial<AutoScrollConfig>` | No       | `{}`    | Auto-scroll configuration            |

#### Outputs

| Output      | Type                           | Description                |
| ----------- | ------------------------------ | -------------------------- |
| `dragEnter` | `EventEmitter<DragEnterEvent>` | Emits when drag enters     |
| `dragLeave` | `EventEmitter<DragLeaveEvent>` | Emits when drag leaves     |
| `dragOver`  | `EventEmitter<DragOverEvent>`  | Emits while dragging over  |
| `drop`      | `EventEmitter<DropEvent>`      | Emits when item is dropped |

#### Host Classes

| Class                     | Condition                   |
| ------------------------- | --------------------------- |
| `vdnd-droppable`          | Always                      |
| `vdnd-droppable-active`   | When being targeted by drag |
| `vdnd-droppable-disabled` | When disabled               |

---

## Services

### DragStateService

Central service for managing drag-and-drop state.

#### Signals

| Signal              | Type                             | Description                  |
| ------------------- | -------------------------------- | ---------------------------- |
| `state`             | `Signal<DragState>`              | Complete state object        |
| `isDragging`        | `Signal<boolean>`                | Whether drag is in progress  |
| `draggedItem`       | `Signal<DraggedItem \| null>`    | Currently dragged item       |
| `sourceDroppableId` | `Signal<string \| null>`         | Source droppable ID          |
| `activeDroppableId` | `Signal<string \| null>`         | Currently hovered droppable  |
| `placeholderId`     | `Signal<string \| null>`         | Current placeholder position |
| `cursorPosition`    | `Signal<CursorPosition \| null>` | Current cursor position      |

#### Methods

| Method               | Parameters                                             | Description                  |
| -------------------- | ------------------------------------------------------ | ---------------------------- |
| `startDrag`          | `item: DraggedItem`                                    | Start a drag operation       |
| `updateDragPosition` | `{ cursorPosition, activeDroppableId, placeholderId }` | Update drag position         |
| `setActiveDroppable` | `droppableId: string \| null`                          | Set active droppable         |
| `setPlaceholder`     | `placeholderId: string \| null`                        | Set placeholder position     |
| `endDrag`            | -                                                      | End drag operation           |
| `cancelDrag`         | -                                                      | Cancel drag operation        |
| `isDroppableActive`  | `droppableId: string`                                  | Check if droppable is active |
| `getStateSnapshot`   | -                                                      | Get current state snapshot   |

---

### PositionCalculatorService

Service for calculating drop positions.

#### Methods

| Method                 | Parameters                                                 | Returns                        | Description               |
| ---------------------- | ---------------------------------------------------------- | ------------------------------ | ------------------------- |
| `findDroppableAtPoint` | `x, y, draggedElement, groupName`                          | `HTMLElement \| null`          | Find droppable at cursor  |
| `findDraggableAtPoint` | `x, y, draggedElement`                                     | `HTMLElement \| null`          | Find draggable at cursor  |
| `getDroppableParent`   | `element, groupName`                                       | `HTMLElement \| null`          | Find droppable ancestor   |
| `getDraggableParent`   | `element`                                                  | `HTMLElement \| null`          | Find draggable ancestor   |
| `getDraggableId`       | `element`                                                  | `string \| null`               | Get draggable ID          |
| `getDroppableId`       | `element`                                                  | `string \| null`               | Get droppable ID          |
| `calculateDropIndex`   | `scrollTop, cursorY, containerTop, itemHeight, totalItems` | `number`                       | Calculate drop index      |
| `getNearEdge`          | `position, containerRect, threshold`                       | `{ top, bottom, left, right }` | Check if near edges       |
| `isInsideContainer`    | `position, containerRect`                                  | `boolean`                      | Check if inside container |

---

### AutoScrollService

Service for auto-scrolling during drag.

#### Methods

| Method                | Parameters             | Description                   |
| --------------------- | ---------------------- | ----------------------------- |
| `registerContainer`   | `id, element, config?` | Register scrollable container |
| `unregisterContainer` | `id`                   | Unregister container          |
| `startMonitoring`     | -                      | Start auto-scroll monitoring  |
| `stopMonitoring`      | -                      | Stop auto-scroll monitoring   |
| `isScrolling`         | -                      | Check if currently scrolling  |
| `getScrollDirection`  | -                      | Get current scroll direction  |

---

## Models

### DraggedItem

```typescript
interface DraggedItem {
  draggableId: string;
  droppableId: string;
  element: HTMLElement;
  height: number;
  width: number;
  data?: unknown;
}
```

### DragState

```typescript
interface DragState {
  isDragging: boolean;
  draggedItem: DraggedItem | null;
  sourceDroppableId: string | null;
  activeDroppableId: string | null;
  placeholderId: string | null;
  cursorPosition: CursorPosition | null;
}
```

### DragStartEvent

```typescript
interface DragStartEvent {
  draggableId: string;
  droppableId: string;
  data?: unknown;
  position: CursorPosition;
}
```

### DragMoveEvent

```typescript
interface DragMoveEvent {
  draggableId: string;
  sourceDroppableId: string;
  targetDroppableId: string | null;
  placeholderId: string | null;
  position: CursorPosition;
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
  threshold: number; // Distance from edge to start scrolling
  maxSpeed: number; // Maximum scroll speed in pixels/frame
  accelerate: boolean; // Whether to accelerate based on distance
}
```

---

## Constants

### END_OF_LIST

```typescript
const END_OF_LIST = 'END_OF_LIST';
```

Placeholder ID used when dropping at the end of a list.

### INITIAL_DRAG_STATE

```typescript
const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  draggedItem: null,
  sourceDroppableId: null,
  activeDroppableId: null,
  placeholderId: null,
  cursorPosition: null,
};
```

Initial state for the drag state service.
