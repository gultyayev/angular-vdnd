# ngx-virtual-dnd API Reference

This document describes the public API of the ngx-virtual-dnd library.

## Components

### VirtualScrollContainerComponent

A virtual scroll container that only renders visible items.

#### Selector

`vdnd-virtual-scroll`

#### Inputs

| Input               | Type                                           | Required | Default | Description                                         |
| ------------------- | ---------------------------------------------- | -------- | ------- | --------------------------------------------------- |
| `items`             | `T[]`                                          | Yes      | -       | Array of items to render                            |
| `itemHeight`        | `number`                                       | Yes      | -       | Height of each item in pixels                       |
| `containerHeight`   | `number`                                       | No       | -       | Height of container (omit to auto-detect from CSS)  |
| `overscan`          | `number`                                       | No       | `3`     | Number of items to render above/below viewport      |
| `stickyItemIds`     | `string[]`                                     | No       | `[]`    | IDs of items to always render (e.g., dragged items) |
| `itemIdFn`          | `(item: T) => string`                          | Yes      | -       | Function to get unique ID from item                 |
| `trackByFn`         | `(index: number, item: T) => string \| number` | Yes      | -       | Track-by function for rendering                     |
| `itemTemplate`      | `TemplateRef<VirtualScrollItemContext<T>>`     | Yes      | -       | Template for rendering each item                    |
| `scrollContainerId` | `string`                                       | No       | -       | ID for auto-scroll registration                     |
| `autoScrollEnabled` | `boolean`                                      | No       | `true`  | Enable auto-scroll when dragging near edges         |
| `autoScrollConfig`  | `Partial<AutoScrollConfig>`                    | No       | `{}`    | Auto-scroll configuration                           |

#### Outputs

| Output                 | Type                               | Description                        |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| `visibleRangeChange`   | `EventEmitter<VisibleRangeChange>` | Emits when visible range changes   |
| `scrollPositionChange` | `EventEmitter<number>`             | Emits when scroll position changes |

#### Methods

| Method            | Parameters         | Returns  | Description                     |
| ----------------- | ------------------ | -------- | ------------------------------- |
| `scrollTo`        | `position: number` | `void`   | Scroll to a specific position   |
| `scrollToIndex`   | `index: number`    | `void`   | Scroll to a specific item index |
| `scrollBy`        | `delta: number`    | `void`   | Scroll by a delta amount        |
| `getScrollTop`    | -                  | `number` | Get current scroll position     |
| `getScrollHeight` | -                  | `number` | Get total scrollable height     |

#### Template Context

```typescript
interface VirtualScrollItemContext<T> {
  $implicit: T; // Item data
  index: number; // Item's index in the original array
  isSticky: boolean; // Whether this item is "sticky" (always rendered)
}
```

#### Usage Notes

- If `containerHeight` is omitted, the component uses `ResizeObserver` to detect height from CSS
- This allows setting height via CSS (`height: 100%`, flex, etc.) with automatic adaptation on resize
- Sticky items are always rendered regardless of scroll position (used for dragged items)

---

### DragPreviewComponent

Renders a preview of the dragged item that follows the cursor.

#### Selector

`vdnd-drag-preview`

#### Inputs

| Input             | Type                                 | Required | Default          | Description                        |
| ----------------- | ------------------------------------ | -------- | ---------------- | ---------------------------------- |
| `previewTemplate` | `TemplateRef<DragPreviewContext<T>>` | No       | -                | Custom template for preview        |
| `cursorOffset`    | `{ x: number; y: number }`           | No       | `{ x: 8, y: 8 }` | Fallback offset when no grabOffset |

#### Template Context

```typescript
interface DragPreviewContext<T> {
  $implicit: T; // Item data
  draggableId: string; // Draggable ID
  droppableId: string; // Source droppable ID
}
```

#### Usage Notes

- Place at the root of your application (outside scrollable containers)
- If no template provided, displays a cloned version of the dragged element
- Uses fixed positioning with z-index 1000
- Respects axis locking from the draggable directive

---

### PlaceholderComponent

A visual placeholder indicating where a dropped item will be inserted.

#### Selector

`vdnd-placeholder`

#### Inputs

| Input    | Type     | Required | Default | Description      |
| -------- | -------- | -------- | ------- | ---------------- |
| `height` | `number` | No       | `50`    | Height in pixels |

#### Host Bindings

- `class`: `vdnd-placeholder`
- `data-draggable-id`: `"placeholder"`
- `style.height.px`: bound to `height()` input

---

## Directives

### DraggableDirective

Makes an element draggable.

#### Selector

`[vdndDraggable]`

#### Inputs

| Input                | Type                 | Required | Default | Description                              |
| -------------------- | -------------------- | -------- | ------- | ---------------------------------------- |
| `vdndDraggable`      | `string`             | Yes      | -       | Unique identifier for this draggable     |
| `vdndDraggableGroup` | `string`             | Yes      | -       | Drag-and-drop group name                 |
| `vdndDraggableData`  | `unknown`            | No       | -       | Data associated with this item           |
| `disabled`           | `boolean`            | No       | `false` | Whether dragging is disabled             |
| `dragHandle`         | `string`             | No       | -       | CSS selector for drag handle             |
| `dragThreshold`      | `number`             | No       | `5`     | Minimum distance before drag starts (px) |
| `dragDelay`          | `number`             | No       | `0`     | Hold delay before drag starts (ms)       |
| `lockAxis`           | `'x' \| 'y' \| null` | No       | `null`  | Constrain drag to single axis            |

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

#### Host Attributes

| Attribute           | Value                            |
| ------------------- | -------------------------------- |
| `data-draggable-id` | The draggable ID                 |
| `aria-grabbed`      | `true` when dragging             |
| `aria-dropeffect`   | `"move"`                         |
| `tabindex`          | `0` (or `-1` if disabled)        |
| `style.display`     | `"none"` while dragging (hidden) |

#### Keyboard Support

- **Space**: Activate drag (keyboard mode)
- **Escape**: Cancel drag

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

#### Host Attributes

| Attribute              | Value            |
| ---------------------- | ---------------- |
| `data-droppable-id`    | The droppable ID |
| `data-droppable-group` | The group name   |

---

## Services

### DragStateService

Central service for managing drag-and-drop state. Singleton (`providedIn: 'root'`).

#### Signals

| Signal              | Type                             | Description                   |
| ------------------- | -------------------------------- | ----------------------------- |
| `state`             | `Signal<DragState>`              | Complete state object         |
| `isDragging`        | `Signal<boolean>`                | Whether drag is in progress   |
| `draggedItem`       | `Signal<DraggedItem \| null>`    | Currently dragged item        |
| `draggedItemId`     | `Signal<string \| null>`         | ID of dragged item            |
| `sourceDroppableId` | `Signal<string \| null>`         | Source droppable ID           |
| `sourceIndex`       | `Signal<number \| null>`         | Original index in source      |
| `activeDroppableId` | `Signal<string \| null>`         | Currently hovered droppable   |
| `placeholderId`     | `Signal<string \| null>`         | Current placeholder ID        |
| `placeholderIndex`  | `Signal<number \| null>`         | Current placeholder index     |
| `cursorPosition`    | `Signal<CursorPosition \| null>` | Current cursor position       |
| `grabOffset`        | `Signal<GrabOffset \| null>`     | Offset from cursor to element |
| `initialPosition`   | `Signal<CursorPosition \| null>` | Position when drag started    |
| `lockAxis`          | `Signal<'x' \| 'y' \| null>`     | Axis movement is locked to    |

#### Methods

| Method               | Parameters                                                                | Description               |
| -------------------- | ------------------------------------------------------------------------- | ------------------------- |
| `startDrag`          | `item, initialPosition?, grabOffset?, lockAxis?, activeDroppableId?, ...` | Start a drag operation    |
| `updateDragPosition` | `{ cursorPosition, activeDroppableId, placeholderId, placeholderIndex }`  | Update drag position      |
| `setActiveDroppable` | `droppableId: string \| null`                                             | Set active droppable      |
| `setPlaceholder`     | `placeholderId: string \| null`                                           | Set placeholder position  |
| `endDrag`            | -                                                                         | End drag operation        |
| `cancelDrag`         | -                                                                         | Cancel drag operation     |
| `isDroppableActive`  | `droppableId: string`                                                     | Check if droppable active |
| `getStateSnapshot`   | -                                                                         | Get current state copy    |

---

### PositionCalculatorService

Service for calculating drop positions and DOM traversal.

#### Methods

| Method                 | Parameters                                                 | Returns                        | Description               |
| ---------------------- | ---------------------------------------------------------- | ------------------------------ | ------------------------- |
| `findDroppableAtPoint` | `x, y, draggedElement, groupName`                          | `HTMLElement \| null`          | Find droppable at cursor  |
| `getDroppableParent`   | `element, groupName`                                       | `HTMLElement \| null`          | Find droppable ancestor   |
| `getDraggableParent`   | `element`                                                  | `HTMLElement \| null`          | Find draggable ancestor   |
| `getDraggableId`       | `element`                                                  | `string \| null`               | Get draggable ID          |
| `getDroppableId`       | `element`                                                  | `string \| null`               | Get droppable ID          |
| `calculateDropIndex`   | `scrollTop, cursorY, containerTop, itemHeight, totalItems` | `number`                       | Calculate drop index      |
| `getNearEdge`          | `position, containerRect, threshold`                       | `{ top, bottom, left, right }` | Check if near edges       |
| `isInsideContainer`    | `position, containerRect`                                  | `boolean`                      | Check if inside container |

---

### AutoScrollService

Service for auto-scrolling during drag operations.

#### Methods

| Method                | Parameters                                  | Description                   |
| --------------------- | ------------------------------------------- | ----------------------------- |
| `registerContainer`   | `id: string, element: HTMLElement, config?` | Register scrollable container |
| `unregisterContainer` | `id: string`                                | Unregister container          |
| `startMonitoring`     | `onScroll?: () => void`                     | Start auto-scroll monitoring  |
| `stopMonitoring`      | -                                           | Stop auto-scroll monitoring   |
| `isScrolling`         | -                                           | Check if currently scrolling  |
| `getScrollDirection`  | -                                           | Get current scroll direction  |

---

### ElementCloneService

Service for cloning elements with their computed styles.

#### Methods

| Method         | Parameters            | Returns       | Description               |
| -------------- | --------------------- | ------------- | ------------------------- |
| `cloneElement` | `source: HTMLElement` | `HTMLElement` | Clone element with styles |

---

## Models

### DraggedItem

```typescript
interface DraggedItem {
  draggableId: string; // Unique identifier
  droppableId: string; // Source droppable ID
  element: HTMLElement; // Reference to dragged element
  clonedElement?: HTMLElement; // Cloned element for preview
  height: number; // Height in pixels
  width: number; // Width in pixels
  data?: unknown; // User-provided data
}
```

### DragState

```typescript
interface DragState {
  isDragging: boolean;
  draggedItem: DraggedItem | null;
  sourceDroppableId: string | null;
  sourceIndex: number | null;
  activeDroppableId: string | null;
  placeholderId: string | null;
  placeholderIndex: number | null;
  cursorPosition: CursorPosition | null;
  grabOffset: GrabOffset | null;
  initialPosition: CursorPosition | null;
  lockAxis: 'x' | 'y' | null;
}
```

### CursorPosition

```typescript
interface CursorPosition {
  x: number;
  y: number;
}
```

### GrabOffset

```typescript
interface GrabOffset {
  x: number;
  y: number;
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

### DragEnterEvent

```typescript
interface DragEnterEvent {
  droppableId: string;
  draggedItem: DraggedItem;
}
```

### DragLeaveEvent

```typescript
interface DragLeaveEvent {
  droppableId: string;
  draggedItem: DraggedItem;
}
```

### DragOverEvent

```typescript
interface DragOverEvent {
  droppableId: string;
  draggedItem: DraggedItem;
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

### DragEndEvent

```typescript
interface DragEndEvent {
  draggableId: string;
  droppableId: string;
  cancelled: boolean;
  data?: unknown;
}
```

### AutoScrollConfig

```typescript
interface AutoScrollConfig {
  threshold: number; // Distance from edge to start scrolling (default: 50)
  maxSpeed: number; // Maximum scroll speed in pixels/frame (default: 15)
  accelerate: boolean; // Scale speed by distance from edge (default: true)
}
```

### VisibleRangeChange

```typescript
interface VisibleRangeChange {
  start: number;
  end: number;
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
  sourceIndex: null,
  activeDroppableId: null,
  placeholderId: null,
  placeholderIndex: null,
  cursorPosition: null,
  grabOffset: null,
  initialPosition: null,
  lockAxis: null,
};
```

Initial state for the drag state service.
