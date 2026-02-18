# API Reference

All exports are from `'ngx-virtual-dnd'`.

## Components

### VirtualSortableListComponent

**Selector:** `vdnd-sortable-list`

High-level component combining droppable, virtual scroll, and placeholder. Default choice for most use cases.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `droppableId` | `string` | - | Yes | Unique ID for this droppable container |
| `items` | `T[]` | - | Yes | Array of items to render |
| `itemHeight` | `number` | - | Yes | Item height in pixels (exact for fixed, estimate for dynamic) |
| `itemIdFn` | `(item: T) => string` | - | Yes | Function returning unique ID for each item |
| `itemTemplate` | `TemplateRef<VirtualScrollItemContext<T>>` | - | Yes | Template for rendering each item |
| `group` | `string` | `undefined` | No | Group name for cross-list drag (must match `vdndGroup`) |
| `dynamicItemHeight` | `boolean` | `false` | No | Enable auto-measured variable heights |
| `trackByFn` | `(index: number, item: T) => string \| number` | `undefined` | No | Track-by function for change detection |
| `droppableData` | `unknown` | `undefined` | No | Custom data attached to this droppable (available in `DropDestination.data`) |
| `disabled` | `boolean` | `false` | No | Disable drag and drop for this list |
| `containerHeight` | `number` | `undefined` | No | Fixed container height in pixels (otherwise uses CSS height) |
| `overscan` | `number` | `3` | No | Number of items to render beyond visible viewport |
| `autoScrollEnabled` | `boolean` | `true` | No | Enable edge auto-scrolling during drag |
| `autoScrollConfig` | `Partial<AutoScrollConfig>` | `{}` | No | Auto-scroll configuration |
| `constrainToContainer` | `boolean` | `false` | No | Clamp drag preview to container boundaries |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `drop` | `DropEvent` | Item dropped into this list |

---

### VirtualScrollContainerComponent

**Selector:** `vdnd-virtual-scroll`

Low-level virtual scroll container. Use with `DroppableDirective` for custom layouts.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `items` | `T[]` | - | Yes | Array of items to render |
| `itemHeight` | `number` | - | Yes | Item height in pixels |
| `itemIdFn` | `(item: T) => string` | - | Yes | Function returning unique ID for each item |
| `itemTemplate` | `TemplateRef<VirtualScrollItemContext<T>>` | - | Yes | Template for rendering each item |
| `droppableId` | `string` | `undefined` | No | Droppable ID (for placeholder positioning during drag) |
| `scrollContainerId` | `string` | `undefined` | No | ID for auto-scroll registration |
| `autoScrollEnabled` | `boolean` | `true` | No | Enable edge auto-scrolling |
| `autoScrollConfig` | `Partial<AutoScrollConfig>` | `{}` | No | Auto-scroll configuration |
| `dynamicItemHeight` | `boolean` | `false` | No | Enable auto-measured variable heights |
| `containerHeight` | `number` | `undefined` | No | Fixed container height in pixels |
| `overscan` | `number` | `3` | No | Items to render beyond visible viewport |
| `stickyItemIds` | `string[]` | `[]` | No | Item IDs to keep rendered regardless of scroll position |
| `trackByFn` | `(index: number, item: T) => string \| number` | `undefined` | No | Track-by function |
| `autoStickyDraggedItem` | `boolean` | `true` | No | Auto-stick dragged item during drag |

**Outputs:** None

**Public Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `scrollTo` | `(position: number) => void` | Scroll to absolute position |
| `scrollToIndex` | `(index: number) => void` | Scroll to item by index |
| `scrollBy` | `(delta: number) => void` | Scroll by relative delta |
| `getScrollTop` | `() => number` | Get current scroll position |
| `getScrollHeight` | `() => number` | Get total scroll height |

---

### VirtualViewportComponent

**Selector:** `vdnd-virtual-viewport`

Self-contained virtual scroll viewport with GPU-accelerated positioning. Provides `VDND_VIRTUAL_VIEWPORT` and `VDND_SCROLL_CONTAINER` tokens.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `itemHeight` | `number` | - | Yes | Item height in pixels |
| `dynamicItemHeight` | `boolean` | `false` | No | Enable dynamic heights |
| `contentOffset` | `number` | `0` | No | Offset for content positioning |
| `scrollContainerId` | `string` | `undefined` | No | ID for auto-scroll registration |
| `autoScrollEnabled` | `boolean` | `true` | No | Enable edge auto-scrolling |
| `autoScrollConfig` | `Partial<AutoScrollConfig>` | `{}` | No | Auto-scroll configuration |

**Outputs:** None

---

### VirtualContentComponent

**Selector:** `vdnd-virtual-content`

Virtual content for external scroll containers (page-level scroll). Provides `VDND_VIRTUAL_VIEWPORT` and `VDND_SCROLL_CONTAINER` tokens.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `itemHeight` | `number` | - | Yes | Item height in pixels |
| `contentOffset` | `number` | `0` | No | Manual content offset (overridden by `vdndContentHeader` auto-measurement) |
| `dynamicItemHeight` | `boolean` | `false` | No | Enable dynamic heights |

**Outputs:** None

---

### DragPreviewComponent

**Selector:** `vdnd-drag-preview`

Renders the dragged item preview. Teleports to body-level overlay to escape ancestor CSS transforms.

**Required** — place once in your template.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `previewTemplate` | `TemplateRef<DragPreviewContext<T>>` | `undefined` | No | Custom preview template |
| `cursorOffset` | `{ x: number; y: number }` | `{ x: 8, y: 8 }` | No | Offset from cursor in pixels |

**Outputs:** None

---

### PlaceholderComponent

**Selector:** `vdnd-placeholder`

Drop position indicator. Automatically rendered inside `VirtualSortableListComponent` and `VirtualScrollContainerComponent`.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `height` | `number` | `50` | No | Placeholder height in pixels |
| `template` | `TemplateRef<PlaceholderContext>` | `undefined` | No | Custom placeholder template |

**Outputs:** None

---

### DragPlaceholderComponent

**Selector:** `vdnd-drag-placeholder`

Placeholder shown at the drag source position during drag. Automatically rendered by virtual scroll components.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `itemHeight` | `number` | - | Yes | Height of the placeholder in pixels |

**Outputs:** None

---

## Directives

### DraggableDirective

**Selector:** `[vdndDraggable]`

Makes an element draggable via mouse, touch, or keyboard.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `vdndDraggable` | `string` | - | Yes | Unique draggable ID (within its droppable) |
| `vdndDraggableGroup` | `string` | `undefined` | No | Group name for cross-list drag |
| `vdndDraggableData` | `unknown` | `undefined` | No | Custom data (available in events and preview template) |
| `disabled` | `boolean` | `false` | No | Disable dragging |
| `dragHandle` | `string` | `undefined` | No | CSS selector restricting drag initiation area |
| `dragThreshold` | `number` | `5` | No | Minimum distance (px) before drag starts |
| `dragDelay` | `number` | `0` | No | Delay (ms) after pointer down before drag activates |
| `lockAxis` | `'x' \| 'y' \| null` | `null` | No | Lock movement to horizontal or vertical axis |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `dragStart` | `DragStartEvent` | Drag operation started |
| `dragEnd` | `DragEndEvent` | Drag operation ended (includes `cancelled` flag) |

---

### DroppableDirective

**Selector:** `[vdndDroppable]`

Marks an element as a drop target.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `vdndDroppable` | `string` | - | Yes | Unique droppable ID |
| `vdndDroppableGroup` | `string` | `undefined` | No | Group name (or inherit from parent `vdndGroup`) |
| `vdndDroppableData` | `unknown` | `undefined` | No | Custom data (available in `DropDestination.data`) |
| `disabled` | `boolean` | `false` | No | Disable dropping |
| `autoScrollEnabled` | `boolean` | `true` | No | Enable edge auto-scrolling |
| `autoScrollConfig` | `Partial<AutoScrollConfig>` | `{}` | No | Auto-scroll configuration |
| `constrainToContainer` | `boolean` | `false` | No | Clamp drag to container boundaries |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `drop` | `DropEvent` | Item dropped into this droppable |

---

### DroppableGroupDirective

**Selector:** `[vdndGroup]`

Provides group context to child droppables for cross-list drag.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `vdndGroup` | `string` | - | Yes | Group name |

**Outputs:** None

---

### ScrollableDirective

**Selector:** `[vdndScrollable]`

Marks an external scroll container for page-level scroll. Provides `VDND_SCROLL_CONTAINER` token.

**Inputs:**

| Input | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `scrollContainerId` | `string` | `undefined` | No | ID for auto-scroll registration |
| `autoScrollEnabled` | `boolean` | `true` | No | Enable edge auto-scrolling |
| `autoScrollConfig` | `Partial<AutoScrollConfig>` | `{}` | No | Auto-scroll configuration |

**Outputs:** None

---

### VirtualForDirective

**Selector:** `[vdndVirtualFor][vdndVirtualForOf]` (used as `*vdndVirtualFor`)

Structural directive for rendering virtual list items inside a viewport component.

**Microsyntax:**

```html
*vdndVirtualFor="let item of items(); trackBy: trackById; itemHeight: 50; overscan: 3"
```

**Inputs:**

| Input | Microsyntax Key | Type | Default | Required | Description |
|-------|----------------|------|---------|----------|-------------|
| `vdndVirtualForOf` | `of` | `T[]` | - | Yes | Array of items |
| `vdndVirtualForTrackBy` | `trackBy` | `(index: number, item: T) => unknown` | - | Yes | Track-by function |
| `vdndVirtualForItemHeight` | `itemHeight` | `number` | inherited | No | Item height (inherited from parent viewport) |
| `vdndVirtualForOverscan` | `overscan` | `number` | `3` | No | Overscan buffer |
| `vdndVirtualForDroppableId` | `droppableId` | `string` | inherited | No | Droppable ID (inherited from parent) |
| `vdndVirtualForDynamicItemHeight` | `dynamicItemHeight` | `boolean` | `false` | No | Enable dynamic heights (inherited from parent viewport) |

**Template Context (`VirtualForContext<T>`):**

| Variable | Type | Description |
|----------|------|-------------|
| `$implicit` | `T` | Current item |
| `index` | `number` | Item index in the full list |
| `first` | `boolean` | Is first visible item |
| `last` | `boolean` | Is last visible item |
| `count` | `number` | Total item count |

---

### ContentHeaderDirective

**Selector:** `[vdndContentHeader]`

Marks a projected header inside `VirtualContentComponent`. Height is auto-measured via ResizeObserver and used as content offset.

**Inputs:** None
**Outputs:** None

---

## Events

### DragStartEvent

```typescript
interface DragStartEvent {
  draggableId: string;
  droppableId: string;
  data?: unknown;
  position: CursorPosition;
  sourceIndex: number;
}
```

### DropEvent

```typescript
interface DropEvent {
  source: DropSource;
  destination: DropDestination;
}

interface DropSource {
  draggableId: string;
  droppableId: string;
  index: number;
  data?: unknown;
}

interface DropDestination {
  droppableId: string;
  placeholderId: string;
  index: number;
  data?: unknown;
}
```

### DragEndEvent

```typescript
interface DragEndEvent {
  draggableId: string;
  droppableId: string;
  cancelled: boolean;
  data?: unknown;
  sourceIndex: number;
  destinationIndex: number | null;
}
```

---

## Utilities

```typescript
function moveItem<T>(
  event: DropEvent,
  lists: Record<string, WritableSignal<T[]>>,
): void;

function reorderItems<T>(
  event: DropEvent,
  list: WritableSignal<T[]>,
): void;

function applyMove<T>(
  event: DropEvent,
  lists: Record<string, T[]>,
): Record<string, T[]>;

function isNoOpDrop(event: DropEvent): boolean;

function insertAt<T>(list: T[], item: T, index: number): T[];

function removeAt<T>(list: T[], index: number): T[];
```

---

## Services

### DragStateService

**Injectable:** `providedIn: 'root'` (singleton)

**Readonly Signals:**

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
| `initialPosition` | `Signal<CursorPosition \| null>` |
| `lockAxis` | `Signal<'x' \| 'y' \| null>` |
| `isKeyboardDrag` | `Signal<boolean>` |
| `keyboardTargetIndex` | `Signal<number \| null>` |
| `wasCancelled` | `Signal<boolean>` |

### AutoScrollService

**Injectable:** `providedIn: 'root'` (singleton)

Controls edge auto-scrolling during drag operations. Usually configured via component inputs rather than used directly.

**Key Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `registerContainer` | `(id, element, config?) => void` | Register a scroll container for auto-scroll |
| `unregisterContainer` | `(id) => void` | Unregister a scroll container |
| `startMonitoring` | `(onScroll?) => void` | Start monitoring cursor position for auto-scroll |
| `stopMonitoring` | `() => void` | Stop monitoring |
| `isScrolling` | `() => boolean` | Whether auto-scroll is currently active |
| `getScrollDirection` | `() => { x: number; y: number }` | Current scroll direction |

### PositionCalculatorService

**Injectable:** `providedIn: 'root'` (singleton)

Internal service for DOM hit-testing and drop position calculation. Exported for advanced customization.

**Key Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `findDroppableAtPoint` | `(x, y, draggedElement, groupName) => HTMLElement \| null` | Find droppable element at cursor position |
| `findDraggableAtPoint` | `(x, y, draggedElement) => HTMLElement \| null` | Find draggable element at cursor position |
| `getDroppableId` | `(element) => string \| null` | Get droppable ID from element's data attribute |
| `calculateDropIndex` | `(droppable, cursorY, draggedItem, sourceDroppableId) => { ... }` | Calculate drop target index |

### ElementCloneService

**Injectable:** `providedIn: 'root'` (singleton)

Internal service for cloning DOM elements for drag previews. Exported for advanced customization.

**Key Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `cloneElement` | `(source: HTMLElement) => HTMLElement` | Deep-clone an element for use as drag preview |

### KeyboardDragService

**Injectable:** `providedIn: 'root'` (singleton)

Internal service for keyboard drag state management. Exported for advanced customization.

### OverlayContainerService

**Injectable:** `providedIn: 'root'` (singleton)

Internal service for managing the body-level overlay container used by `DragPreviewComponent`. Exported for advanced customization.

---

## Configuration Types

### AutoScrollConfig

```typescript
interface AutoScrollConfig {
  threshold: number;   // Distance from edge to start scrolling (px). Default: 50
  maxSpeed: number;    // Maximum scroll speed (px/frame). Default: 15
  accelerate: boolean; // Accelerate based on distance from edge. Default: true
}
```

### DragPreviewContext

```typescript
interface DragPreviewContext<T = unknown> {
  $implicit: T;
  draggableId: string;
  droppableId: string;
}
```

### PlaceholderContext

```typescript
interface PlaceholderContext {
  $implicit: number; // height in pixels
  height: number;    // height in pixels
}
```

### VirtualScrollItemContext

```typescript
interface VirtualScrollItemContext<T> {
  $implicit: T;
  index: number;
  isSticky: boolean;
}
```

### VirtualForContext

```typescript
interface VirtualForContext<T> {
  $implicit: T;
  index: number;
  first: boolean;
  last: boolean;
  count: number;
}
```

### DraggedItem

```typescript
interface DraggedItem {
  draggableId: string;
  droppableId: string;
  element: HTMLElement;
  clonedElement?: HTMLElement;
  height: number;
  width: number;
  data?: unknown;
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
  isKeyboardDrag: boolean;
  keyboardTargetIndex: number | null;
}
```

---

## Strategies

### VirtualScrollStrategy (Interface)

```typescript
interface VirtualScrollStrategy {
  readonly version: Signal<number>;
  getTotalHeight(itemCount: number): number;
  getFirstVisibleIndex(scrollTop: number): number;
  getVisibleCount(startIndex: number, containerHeight: number): number;
  getOffsetForIndex(index: number): number;
  getItemHeight(index: number): number;
  setMeasuredHeight(key: unknown, height: number): void;
  setItemKeys(keys: unknown[]): void;
  setExcludedIndex(index: number | null): void;
  findIndexAtOffset(offset: number): number;
  getItemCount(): number;
}
```

### FixedHeightStrategy

```typescript
class FixedHeightStrategy implements VirtualScrollStrategy {
  constructor(itemHeight: number);
}
```

Used by default when `dynamicItemHeight` is not set. Zero overhead — pure `index * itemHeight` math.

### DynamicHeightStrategy

```typescript
class DynamicHeightStrategy implements VirtualScrollStrategy {
  constructor(estimatedHeight: number);
}
```

Used when `dynamicItemHeight` is `true`. Auto-measures items via ResizeObserver. Uses prefix sums and binary search for O(log N) lookups.

---

## Tokens

### VDND_SCROLL_CONTAINER

```typescript
const VDND_SCROLL_CONTAINER: InjectionToken<VdndScrollContainer>;

interface VdndScrollContainer {
  readonly nativeElement: HTMLElement;
  scrollTop(): number;
  containerHeight(): number;
  scrollTo(options: ScrollToOptions): void;
}
```

Provided by: `VirtualViewportComponent`, `VirtualContentComponent`, `ScrollableDirective`

### VDND_VIRTUAL_VIEWPORT

```typescript
const VDND_VIRTUAL_VIEWPORT: InjectionToken<VdndVirtualViewport>;

interface VdndVirtualViewport {
  scrollTop(): number;
  containerHeight(): number;
  itemHeight(): number;
  contentOffset(): number;
  readonly nativeElement: HTMLElement;
  setRenderStartIndex(index: number): void;
  getOffsetForIndex(index: number): number;
  readonly strategy: VirtualScrollStrategy | null;
}
```

Provided by: `VirtualViewportComponent`, `VirtualContentComponent`

### VDND_GROUP_TOKEN

```typescript
const VDND_GROUP_TOKEN: InjectionToken<VdndGroupContext>;

interface VdndGroupContext {
  readonly group: Signal<string>;
}
```

Provided by: `DroppableGroupDirective`

---

## Constants

```typescript
const INITIAL_DRAG_STATE: DragState;
// All fields null/false — represents idle state

const END_OF_LIST = 'END_OF_LIST';
// Placeholder ID used when dropping at the end of a list
```

---

## CSS Classes

| Class | Applied To | Condition |
|-------|-----------|-----------|
| `vdnd-draggable` | `[vdndDraggable]` elements | Always |
| `vdnd-draggable-dragging` | `[vdndDraggable]` elements | While being dragged (element has `display: none`) |
| `vdnd-draggable-disabled` | `[vdndDraggable]` elements | When `disabled` is `true` |
| `vdnd-drag-pending` | `[vdndDraggable]` elements | After `dragDelay` passes, before drag starts |
| `vdnd-droppable` | `[vdndDroppable]` elements | Always |
| `vdnd-droppable-active` | `[vdndDroppable]` elements | When a compatible draggable is hovering |
| `vdnd-droppable-disabled` | `[vdndDroppable]` elements | When `disabled` is `true` |
| `vdnd-sortable-list` | `<vdnd-sortable-list>` | Always (host class) |
| `vdnd-virtual-scroll` | `<vdnd-virtual-scroll>` | Always (host class) |
| `vdnd-virtual-viewport` | `<vdnd-virtual-viewport>` | Always (host class) |
| `vdnd-virtual-content` | `<vdnd-virtual-content>` | Always (host class) |
| `vdnd-scrollable` | `[vdndScrollable]` elements | Always (host class) |
| `vdnd-placeholder` | `<vdnd-placeholder>` | Always (host class) |
| `vdnd-drag-placeholder` | Drag placeholder element | Always during drag |
| `vdnd-drag-placeholder-visible` | Drag placeholder element | While visible |
| `vdnd-overlay-container` | Body-level `<div>` | Always (created for drag preview teleport) |
