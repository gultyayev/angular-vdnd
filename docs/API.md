# ngx-virtual-dnd API Reference

This document describes the public API of the ngx-virtual-dnd library.

## Components

### VirtualSortableListComponent

High-level component that combines droppable, virtual scroll, and placeholder functionality into a single, easy-to-use component. This is the **recommended** way to use the library for most use cases.

#### Selector

`vdnd-sortable-list`

#### Inputs

| Input               | Type                                           | Required | Default | Description                                        |
| ------------------- | ---------------------------------------------- | -------- | ------- | -------------------------------------------------- |
| `droppableId`       | `string`                                       | Yes      | -       | Unique identifier for this droppable list          |
| `group`             | `string`                                       | Yes      | -       | Drag-and-drop group name                           |
| `items`             | `T[]`                                          | Yes      | -       | Array of items to render                           |
| `itemHeight`        | `number`                                       | Yes      | -       | Height of each item in pixels                      |
| `itemIdFn`          | `(item: T) => string`                          | Yes      | -       | Function to get unique ID from item                |
| `itemTemplate`      | `TemplateRef<VirtualScrollItemContext<T>>`     | Yes      | -       | Template for rendering each item                   |
| `trackByFn`         | `(index: number, item: T) => string \| number` | No       | -       | Track-by function (derived from itemIdFn if omit)  |
| `droppableData`     | `unknown`                                      | No       | -       | Optional data associated with this droppable       |
| `disabled`          | `boolean`                                      | No       | `false` | Whether this sortable list is disabled             |
| `containerHeight`   | `number`                                       | No       | -       | Height of container (omit to auto-detect from CSS) |
| `overscan`          | `number`                                       | No       | `3`     | Number of items to render above/below viewport     |
| `autoScrollEnabled` | `boolean`                                      | No       | `true`  | Enable auto-scroll when dragging near edges        |
| `autoScrollConfig`  | `Partial<AutoScrollConfig>`                    | No       | `{}`    | Auto-scroll configuration                          |

#### Outputs

| Output                 | Type                               | Description                        |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| `drop`                 | `EventEmitter<DropEvent>`          | Emits when an item is dropped      |
| `dragEnter`            | `EventEmitter<DragEnterEvent>`     | Emits when drag enters             |
| `dragLeave`            | `EventEmitter<DragLeaveEvent>`     | Emits when drag leaves             |
| `dragOver`             | `EventEmitter<DragOverEvent>`      | Emits while dragging over          |
| `visibleRangeChange`   | `EventEmitter<VisibleRangeChange>` | Emits when visible range changes   |
| `scrollPositionChange` | `EventEmitter<number>`             | Emits when scroll position changes |

#### Usage Notes

- Handles placeholder insertion automatically
- Manages sticky items for dragged elements
- Wraps VirtualScrollContainerComponent and DroppableDirective internally

---

### VirtualScrollContainerComponent

A virtual scroll container that only renders visible items. Use this when you need more control than `VirtualSortableListComponent` provides.

#### Selector

`vdnd-virtual-scroll`

#### Inputs

| Input                   | Type                                           | Required | Default | Description                                         |
| ----------------------- | ---------------------------------------------- | -------- | ------- | --------------------------------------------------- |
| `items`                 | `T[]`                                          | Yes      | -       | Array of items to render                            |
| `itemHeight`            | `number`                                       | Yes      | -       | Height of each item in pixels                       |
| `itemIdFn`              | `(item: T) => string`                          | Yes      | -       | Function to get unique ID from item                 |
| `itemTemplate`          | `TemplateRef<VirtualScrollItemContext<T>>`     | Yes      | -       | Template for rendering each item                    |
| `trackByFn`             | `(index: number, item: T) => string \| number` | No       | -       | Track-by function for rendering                     |
| `containerHeight`       | `number`                                       | No       | -       | Height of container (omit to auto-detect from CSS)  |
| `overscan`              | `number`                                       | No       | `3`     | Number of items to render above/below viewport      |
| `stickyItemIds`         | `string[]`                                     | No       | `[]`    | IDs of items to always render (e.g., dragged items) |
| `droppableId`           | `string`                                       | No       | -       | Droppable ID for auto placeholder insertion         |
| `autoStickyDraggedItem` | `boolean`                                      | No       | `true`  | Automatically keep dragged item in render list      |
| `scrollContainerId`     | `string`                                       | No       | -       | ID for auto-scroll registration                     |
| `autoScrollEnabled`     | `boolean`                                      | No       | `true`  | Enable auto-scroll when dragging near edges         |
| `autoScrollConfig`      | `Partial<AutoScrollConfig>`                    | No       | `{}`    | Auto-scroll configuration                           |

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
- When `droppableId` is set and `autoStickyDraggedItem` is true, the component automatically handles placeholder insertion

---

### VirtualViewportComponent

A self-contained virtual scroll viewport component. Use for standard virtual scrolling without drag-and-drop integration.

#### Selector

`vdnd-virtual-viewport`

#### Usage Notes

- Provides the `VDND_VIRTUAL_VIEWPORT` token for child directives
- Use with `VirtualForDirective` for full control over rendering

---

### VirtualContentComponent

Virtual content component for external scroll containers (page-level scroll). Use when you need virtual scrolling within a page that has headers/footers that scroll with content.

#### Selector

`vdnd-virtual-content`

#### Inputs

| Input           | Type     | Required | Default | Description                                       |
| --------------- | -------- | -------- | ------- | ------------------------------------------------- |
| `itemHeight`    | `number` | Yes      | -       | Height of each item in pixels                     |
| `totalItems`    | `number` | Yes      | -       | Total number of items                             |
| `contentOffset` | `number` | No       | `0`     | Offset from top of scroll container (for headers) |

#### Usage Notes

- Must be used inside a container with `vdndScrollable` directive
- Set explicit height on the component matching `totalItems * itemHeight`
- Use `contentOffset` to account for headers above the list

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

A visual placeholder indicating where a dropped item will be inserted. Intended for use inside item templates.

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

### DragPlaceholderComponent

Internal placeholder component used by virtual scroll containers. Renders empty space where an item will be dropped.

#### Selector

`vdnd-drag-placeholder`

#### Inputs

| Input        | Type     | Required | Default | Description      |
| ------------ | -------- | -------- | ------- | ---------------- |
| `itemHeight` | `number` | Yes      | -       | Height in pixels |

#### Usage Notes

- Used internally by `VirtualScrollContainerComponent`
- Consumers typically use `PlaceholderComponent` in templates instead

---

## Directives

### DroppableGroupDirective

Provides a group context to child draggable and droppable directives. When applied to a parent element, child directives can inherit the group name automatically.

#### Selector

`[vdndGroup]`

#### Inputs

| Input       | Type     | Required | Default | Description                              |
| ----------- | -------- | -------- | ------- | ---------------------------------------- |
| `vdndGroup` | `string` | Yes      | -       | Group name inherited by child directives |

#### Usage

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

---

### DraggableDirective

Makes an element draggable.

#### Selector

`[vdndDraggable]`

#### Inputs

| Input                | Type                 | Required | Default | Description                                        |
| -------------------- | -------------------- | -------- | ------- | -------------------------------------------------- |
| `vdndDraggable`      | `string`             | Yes      | -       | Unique identifier for this draggable               |
| `vdndDraggableGroup` | `string`             | No\*     | -       | Drag-and-drop group name (\*inherited from parent) |
| `vdndDraggableData`  | `unknown`            | No       | -       | Data associated with this item                     |
| `disabled`           | `boolean`            | No       | `false` | Whether dragging is disabled                       |
| `dragHandle`         | `string`             | No       | -       | CSS selector for drag handle                       |
| `dragThreshold`      | `number`             | No       | `5`     | Minimum distance before drag starts (px)           |
| `dragDelay`          | `number`             | No       | `0`     | Hold delay before drag starts (ms)                 |
| `lockAxis`           | `'x' \| 'y' \| null` | No       | `null`  | Constrain drag to single axis                      |

\* Group can be inherited from parent `DroppableGroupDirective` (`vdndGroup`)

#### Outputs

| Output      | Type                           | Description            |
| ----------- | ------------------------------ | ---------------------- |
| `dragStart` | `EventEmitter<DragStartEvent>` | Emits when drag starts |
| `dragMove`  | `EventEmitter<DragMoveEvent>`  | Emits during drag      |
| `dragEnd`   | `EventEmitter<DragEndEvent>`   | Emits when drag ends   |

#### Host Classes

| Class                     | Condition                  |
| ------------------------- | -------------------------- |
| `vdnd-draggable`          | Always                     |
| `vdnd-draggable-dragging` | While being dragged        |
| `vdnd-draggable-disabled` | When disabled              |
| `vdnd-drag-pending`       | After delay, ready to drag |

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
- **Arrow Up/Down**: Move item up/down in list
- **Arrow Left/Right**: Move to adjacent list
- **Escape**: Cancel drag

---

### DroppableDirective

Marks an element as a valid drop target.

#### Selector

`[vdndDroppable]`

#### Inputs

| Input                | Type                        | Required | Default | Description                                        |
| -------------------- | --------------------------- | -------- | ------- | -------------------------------------------------- |
| `vdndDroppable`      | `string`                    | Yes      | -       | Unique identifier for this droppable               |
| `vdndDroppableGroup` | `string`                    | No\*     | -       | Drag-and-drop group name (\*inherited from parent) |
| `vdndDroppableData`  | `unknown`                   | No       | -       | Data associated with this droppable                |
| `disabled`           | `boolean`                   | No       | `false` | Whether dropping is disabled                       |
| `autoScrollEnabled`  | `boolean`                   | No       | `true`  | Enable auto-scroll near edges                      |
| `autoScrollConfig`   | `Partial<AutoScrollConfig>` | No       | `{}`    | Auto-scroll configuration                          |

\* Group can be inherited from parent `DroppableGroupDirective` (`vdndGroup`)

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

### ScrollableDirective

Marks an element as a scroll container. Required for `VirtualContentComponent` and `VirtualForDirective` to work properly.

#### Selector

`[vdndScrollable]`

#### Inputs

| Input               | Type                        | Required | Default | Description                   |
| ------------------- | --------------------------- | -------- | ------- | ----------------------------- |
| `scrollContainerId` | `string`                    | No       | -       | ID for auto-scroll service    |
| `autoScrollEnabled` | `boolean`                   | No       | `true`  | Enable auto-scroll near edges |
| `autoScrollConfig`  | `Partial<AutoScrollConfig>` | No       | `{}`    | Auto-scroll configuration     |

#### Usage Notes

- Provides the `VDND_SCROLL_CONTAINER` token for child components/directives
- Use on the scrollable element when virtual content is separate from scroll container

---

### VirtualForDirective

Structural directive for virtual scrolling within custom scroll containers. Provides maximum flexibility for advanced use cases.

#### Selector

`*vdndVirtualFor`

#### Inputs (via microsyntax)

| Input                       | Type                                  | Required | Default | Description                             |
| --------------------------- | ------------------------------------- | -------- | ------- | --------------------------------------- |
| `vdndVirtualForOf`          | `T[]`                                 | Yes      | -       | Array of items to iterate over          |
| `vdndVirtualForItemHeight`  | `number`                              | Yes      | -       | Height of each item in pixels           |
| `vdndVirtualForTrackBy`     | `(index: number, item: T) => unknown` | Yes      | -       | Track-by function for efficient updates |
| `vdndVirtualForOverscan`    | `number`                              | No       | `3`     | Items to render outside visible area    |
| `vdndVirtualForDroppableId` | `string`                              | No       | -       | Droppable ID for placeholder support    |

#### Template Context

```typescript
interface VirtualForContext<T> {
  $implicit: T; // Item data
  index: number; // Item's index in the original array
  first: boolean; // Whether this is the first visible item
  last: boolean; // Whether this is the last visible item
  count: number; // Total item count
}
```

#### Usage

```html
<div vdndScrollable style="overflow: auto; height: 400px">
  <ng-container
    *vdndVirtualFor="
    let item of items();
    itemHeight: 50;
    trackBy: trackById;
    droppableId: 'list-1'
  "
  >
    <div class="item">{{ item.name }}</div>
  </ng-container>
</div>
```

---

## Services

### DragStateService

Central service for managing drag-and-drop state. Singleton (`providedIn: 'root'`).

#### Signals

| Signal                | Type                             | Description                       |
| --------------------- | -------------------------------- | --------------------------------- |
| `state`               | `Signal<DragState>`              | Complete state object             |
| `isDragging`          | `Signal<boolean>`                | Whether drag is in progress       |
| `draggedItem`         | `Signal<DraggedItem \| null>`    | Currently dragged item            |
| `draggedItemId`       | `Signal<string \| null>`         | ID of dragged item                |
| `sourceDroppableId`   | `Signal<string \| null>`         | Source droppable ID               |
| `sourceIndex`         | `Signal<number \| null>`         | Original index in source          |
| `activeDroppableId`   | `Signal<string \| null>`         | Currently hovered droppable       |
| `placeholderId`       | `Signal<string \| null>`         | Current placeholder ID            |
| `placeholderIndex`    | `Signal<number \| null>`         | Current placeholder index         |
| `cursorPosition`      | `Signal<CursorPosition \| null>` | Current cursor position           |
| `grabOffset`          | `Signal<GrabOffset \| null>`     | Offset from cursor to element     |
| `initialPosition`     | `Signal<CursorPosition \| null>` | Position when drag started        |
| `lockAxis`            | `Signal<'x' \| 'y' \| null>`     | Axis movement is locked to        |
| `isKeyboardDrag`      | `Signal<boolean>`                | Whether drag started via keyboard |
| `keyboardTargetIndex` | `Signal<number \| null>`         | Target index during keyboard nav  |

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

### KeyboardDragService

Service for handling keyboard-based drag operations. Used internally by DraggableDirective.

#### Methods

| Method        | Parameters                               | Description                    |
| ------------- | ---------------------------------------- | ------------------------------ |
| `startDrag`   | `element, draggableId, groupName, data?` | Start keyboard drag            |
| `moveUp`      | -                                        | Move item up in current list   |
| `moveDown`    | -                                        | Move item down in current list |
| `moveToLeft`  | -                                        | Move to adjacent list (left)   |
| `moveToRight` | -                                        | Move to adjacent list (right)  |
| `drop`        | -                                        | Complete the drop operation    |
| `cancel`      | -                                        | Cancel keyboard drag           |

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
  isKeyboardDrag: boolean; // Whether drag started via keyboard
  keyboardTargetIndex: number | null; // Target index during keyboard nav
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
  sourceIndex: number; // 0-indexed position in source list
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
  targetIndex: number | null; // Current placeholder index
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

### DropSource

```typescript
interface DropSource {
  draggableId: string;
  droppableId: string;
  index: number;
  data?: unknown;
}
```

### DropDestination

```typescript
interface DropDestination {
  droppableId: string;
  placeholderId: string;
  index: number;
  data?: unknown;
}
```

### DropEvent

```typescript
interface DropEvent {
  source: DropSource;
  destination: DropDestination;
}
```

### DragEndEvent

```typescript
interface DragEndEvent {
  draggableId: string;
  droppableId: string;
  cancelled: boolean;
  data?: unknown;
  sourceIndex: number; // Original 0-indexed position
  destinationIndex: number | null; // Final position (null if cancelled)
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

### PlaceholderContext

```typescript
interface PlaceholderContext {
  $implicit: number; // Height in pixels
  height: number; // Height in pixels (explicit property)
}
```

Context for custom placeholder templates in `PlaceholderComponent`.

### VdndGroupContext

```typescript
interface VdndGroupContext {
  readonly group: Signal<string>;
}
```

Context provided by `DroppableGroupDirective` to child directives.

### VdndScrollContainer

```typescript
interface VdndScrollContainer {
  scrollTop: Signal<number>;
  containerHeight: Signal<number>;
  element: HTMLElement;
}
```

Context provided by `ScrollableDirective` for virtual scrolling.

### VdndVirtualViewport

```typescript
interface VdndVirtualViewport {
  setRenderStartIndex(index: number): void;
}
```

Context provided by `VirtualViewportComponent` / `VirtualContentComponent`.

---

## Tokens

### VDND_GROUP_TOKEN

```typescript
const VDND_GROUP_TOKEN: InjectionToken<VdndGroupContext>;
```

Injection token for the group context from `DroppableGroupDirective`.

### VDND_SCROLL_CONTAINER

```typescript
const VDND_SCROLL_CONTAINER: InjectionToken<VdndScrollContainer>;
```

Injection token for scroll container context from `ScrollableDirective`.

### VDND_VIRTUAL_VIEWPORT

```typescript
const VDND_VIRTUAL_VIEWPORT: InjectionToken<VdndVirtualViewport>;
```

Injection token for virtual viewport context.

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
  isKeyboardDrag: false,
  keyboardTargetIndex: null,
};
```

Initial state for the drag state service.

---

## Utility Functions

### moveItem

Moves an item between signal-based lists based on a drop event. Handles both same-list reordering and cross-list moves.

```typescript
function moveItem<T>(event: DropEvent, lists: Record<string, WritableSignal<T[]>>): void;
```

**Usage:**

```typescript
readonly list1 = signal<Item[]>([...]);
readonly list2 = signal<Item[]>([...]);

onDrop(event: DropEvent): void {
  moveItem(event, {
    'list-1': this.list1,
    'list-2': this.list2,
  });
}
```

### reorderItems

Reorders items within a single signal-based list.

```typescript
function reorderItems<T>(event: DropEvent, list: WritableSignal<T[]>): void;
```

**Usage:**

```typescript
readonly items = signal<Item[]>([...]);

onDrop(event: DropEvent): void {
  reorderItems(event, this.items);
}
```

### applyMove

Applies a move operation immutably, returning new array objects. Useful for state management patterns that require immutable updates.

```typescript
function applyMove<T>(event: DropEvent, lists: Record<string, T[]>): Record<string, T[]>;
```

**Usage:**

```typescript
onDrop(event: DropEvent): void {
  const { 'list-1': list1, 'list-2': list2 } = applyMove(event, {
    'list-1': this.list1,
    'list-2': this.list2,
  });
  // Use returned arrays with your state management
}
```

### isNoOpDrop

Checks if a drop event represents a no-op (item dropped in its original position).

```typescript
function isNoOpDrop(event: DropEvent): boolean;
```

**Usage:**

```typescript
onDrop(event: DropEvent): void {
  if (isNoOpDrop(event)) {
    return; // No action needed
  }
  moveItem(event, this.lists);
}
```

### insertAt

Creates a new list with the item inserted at the specified index.

```typescript
function insertAt<T>(list: T[], item: T, index: number): T[];
```

### removeAt

Creates a new list with the item at the specified index removed.

```typescript
function removeAt<T>(list: T[], index: number): T[];
```
