# Angular Virtual DnD Architecture

This document describes the architecture for the Angular virtual scroll + drag-and-drop library.

## Project Structure

```
/projects/ngx-virtual-dnd/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── virtual-scroll-container.component.ts
│   │   │   ├── drag-preview.component.ts
│   │   │   └── placeholder.component.ts
│   │   ├── directives/
│   │   │   ├── droppable.directive.ts
│   │   │   └── draggable.directive.ts
│   │   ├── services/
│   │   │   ├── drag-state.service.ts
│   │   │   ├── position-calculator.service.ts
│   │   │   ├── auto-scroll.service.ts
│   │   │   └── element-clone.service.ts
│   │   ├── models/
│   │   │   └── drag-drop.models.ts
│   │   └── index.ts
│   └── public-api.ts
├── package.json
└── ng-package.json
```

## Key Architectural Decisions

These decisions are fundamental to understanding how the library works:

### 1. Placeholder Index Uses Preview CENTER

The center of the drag preview determines placeholder position, providing intuitive UX where the placeholder appears where the preview visually is (not the top-left corner).

### 2. Same-List Adjustment Applied Once

When dragging within the same list, the hidden item shifts all items below it up visually. We apply a single +1 adjustment when `visualIndex >= sourceIndex` to compensate.

### 3. No Scroll Compensation Layers

Uses raw `scrollTop` directly. The virtual scroll container handles spacer adjustments internally - no additional compensation needed in drag calculations.

### 4. Gap Prevention

The dragged item is hidden with `display: none`. Virtual scroll's `totalHeight` computation subtracts 1 during drag, and spacers adjust automatically - no empty space remains.

### 5. Consumer Simplicity

The library handles all complexity. Consumers only provide data and handle drop events - no leaky abstractions requiring consumer-side compensation.

## Core Services

### 1. DragStateService

**Purpose:** Central coordinator for all drag-and-drop state. Single source of truth.

**Key Features:**

- Singleton service (`providedIn: 'root'`)
- Uses signals for reactive state management
- Coordinates communication between draggables, droppables, and scroll containers

**State Interface:**

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

interface DraggedItem {
  draggableId: string;
  droppableId: string;
  element: HTMLElement;
  clonedElement?: HTMLElement;
  height: number;
  width: number;
  data?: unknown;
}

interface CursorPosition {
  x: number;
  y: number;
}

interface GrabOffset {
  x: number;
  y: number;
}
```

**Computed Signals:**

```typescript
readonly state = this.#state.asReadonly();
readonly isDragging = computed(() => this.#state().isDragging);
readonly draggedItem = computed(() => this.#state().draggedItem);
readonly draggedItemId = computed(() => this.#state().draggedItem?.draggableId ?? null);
readonly sourceDroppableId = computed(() => this.#state().sourceDroppableId);
readonly sourceIndex = computed(() => this.#state().sourceIndex);
readonly activeDroppableId = computed(() => this.#state().activeDroppableId);
readonly placeholderId = computed(() => this.#state().placeholderId);
readonly placeholderIndex = computed(() => this.#state().placeholderIndex);
readonly cursorPosition = computed(() => this.#state().cursorPosition);
readonly grabOffset = computed(() => this.#state().grabOffset);
readonly initialPosition = computed(() => this.#state().initialPosition);
readonly lockAxis = computed(() => this.#state().lockAxis);
```

**Methods:**

```typescript
startDrag(item, initialPosition?, grabOffset?, lockAxis?, activeDroppableId?, placeholderId?, placeholderIndex?, sourceIndex?): void
updateDragPosition({ cursorPosition, activeDroppableId, placeholderId, placeholderIndex }): void
setActiveDroppable(droppableId: string | null): void
setPlaceholder(placeholderId: string | null): void
endDrag(): void
cancelDrag(): void
isDroppableActive(droppableId: string): boolean
getStateSnapshot(): DragState
```

### 2. PositionCalculatorService

**Purpose:** Encapsulates all DOM tree traversal and geometric calculations.

**Key Methods:**

```typescript
findDroppableAtPoint(x, y, draggedElement, groupName): HTMLElement | null
getDroppableParent(element, groupName): HTMLElement | null
getDraggableParent(element): HTMLElement | null
getDraggableId(element): string | null
getDroppableId(element): string | null
calculateDropIndex(scrollTop, cursorY, containerTop, itemHeight, totalItems): number
getNearEdge(position, containerRect, threshold): { top, bottom, left, right }
isInsideContainer(position, containerRect): boolean
```

**Implementation Details:**

- Temporarily hides dragged element to use `elementFromPoint` effectively
- Respects group names for filtering
- Limits DOM traversal to 15 levels (prevents runaway loops)
- Uses data attributes for element identification

### 3. AutoScrollService

**Purpose:** Handles auto-scrolling when dragging near container edges.

**Configuration:**

```typescript
interface AutoScrollConfig {
  threshold: number; // Distance from edge to start scrolling (default: 50px)
  maxSpeed: number; // Maximum scroll speed in pixels/frame (default: 15)
  accelerate: boolean; // Scale speed by distance from edge (default: true)
}
```

**Key Features:**

- Container registration/unregistration
- Animation frame ticking (runs outside Angular zone for performance)
- Cursor distance-based acceleration
- Placeholder recalculation callback on scroll
- Boundary checking (won't scroll past min/max)

**Methods:**

```typescript
registerContainer(id: string, element: HTMLElement, config?: Partial<AutoScrollConfig>): void
unregisterContainer(id: string): void
startMonitoring(onScroll?: () => void): void
stopMonitoring(): void
isScrolling(): boolean
getScrollDirection(): { x: number; y: number }
```

**Algorithm:**

```
1. Check if cursor near any registered container edge
2. Calculate scroll direction and distance from edge
3. Apply acceleration if configured (speed scales with proximity to edge)
4. Scroll container using scrollBy({ behavior: 'instant' })
5. Invoke placeholder recalculation callback (runs in Angular zone)
```

### 4. ElementCloneService

**Purpose:** Clone elements with computed styles for drag preview.

**Features:**

- Copies 35+ CSS properties (colors, fonts, borders, spacing, flexbox, etc.)
- Recursive style application to children
- Handles special elements:
  - Canvas: Copies current pixel content
  - Video: Replaces with poster image or placeholder
  - Iframe: Replaces with styled placeholder
- Sanitizes clone:
  - Removes draggable directive attributes
  - Removes Angular-specific attributes (`ng-*`, `_ng*`)
  - Disables interactive elements (button, input, link)
  - Disables animations and transitions

**Methods:**

```typescript
cloneElement(source: HTMLElement): HTMLElement
```

## Core Components

### 1. VirtualScrollContainerComponent

**Purpose:** Renders only visible items with proper spacers for scrolling.

**Selector:** `vdnd-virtual-scroll`

**Inputs:**

```typescript
items = input.required<T[]>();
itemHeight = input.required<number>();
containerHeight = input<number | null>(null); // Optional - uses CSS height if null
overscan = input<number>(3);
stickyItemIds = input<string[]>([]);
itemIdFn = input.required<(item: T) => string>();
trackByFn = input.required<(index: number, item: T) => string | number>();
itemTemplate = input<TemplateRef<VirtualScrollItemContext<T>>>();
```

**Outputs:**

```typescript
visibleRangeChange = output<VisibleRangeChange>();
scrollPositionChange = output<number>();
```

**Template Context:**

```typescript
interface VirtualScrollItemContext<T> {
  $implicit: T;
  index: number;
  isSticky: boolean;
}
```

**Algorithm:**

```typescript
// Calculate visible range
const firstVisible = Math.floor(scrollTop / itemHeight);
const lastVisible = Math.ceil((scrollTop + containerHeight) / itemHeight);

// Add overscan buffer
const start = Math.max(0, firstVisible - overscan);
const end = Math.min(items.length - 1, lastVisible + overscan);

// Always include sticky items (dragged items)
stickyItemIds.forEach((id) => {
  const index = items.findIndex((item) => itemIdFn(item) === id);
  if (index >= 0 && (index < start || index > end)) {
    // Add to rendered items at original position
  }
});

// Adjust for hidden dragged item
if (draggedItemId) {
  totalHeight = (items.length - 1) * itemHeight;
  // Spacers adjusted for missing item
}
```

### 2. DragPreviewComponent

**Purpose:** Renders the dragged item clone that follows the cursor.

**Selector:** `vdnd-drag-preview`

**Features:**

- Fixed positioning (always visible above scrollable areas)
- Follows cursor with grab offset preservation
- Supports custom template or auto-cloned element
- Applies axis locking to preview position
- High z-index (1000) for visibility

**Position Calculation:**

```typescript
let x = cursor.x - offset.x;
let y = cursor.y - offset.y;

// Apply axis locking
if (lockAxis === 'x') y = initialPosition.y - offset.y; // Horizontal only
if (lockAxis === 'y') x = initialPosition.x - offset.x; // Vertical only
```

### 3. PlaceholderComponent

**Purpose:** Visual placeholder showing where item will drop.

**Selector:** `vdnd-placeholder`

**Inputs:**

```typescript
height = input<number>(50);
```

**Features:**

- Dashed border with light background
- Configurable height via input
- Data attribute: `[data-draggable-id]="placeholder"`
- OnPush change detection

## Core Directives

### 1. DraggableDirective

**Selector:** `[vdndDraggable]`

**Inputs:**

```typescript
vdndDraggable = input.required<string>(); // Draggable ID
vdndDraggableGroup = input.required<string>(); // Group name
vdndDraggableData = input<unknown>(); // Optional metadata
disabled = input<boolean>(false);
dragHandle = input<string>(); // CSS selector for handle
dragThreshold = input<number>(5); // Min distance before drag
dragDelay = input<number>(0); // Hold delay before drag
lockAxis = input<'x' | 'y' | null>(null); // Axis constraint
```

**Outputs:**

```typescript
dragStart = output<DragStartEvent>();
dragMove = output<DragMoveEvent>();
dragEnd = output<DragEndEvent>();
```

**Host Bindings:**

```typescript
host: {
  '[class.vdnd-draggable]': 'true',
  '[class.vdnd-draggable-dragging]': 'isDragging()',
  '[style.display]': 'isDragging() ? "none" : null',  // Hide during drag
  '[attr.aria-grabbed]': 'isDragging()',
}
```

**Key Features:**

- Pointer events (mouse/touch) with threshold detection
- Drag delay support (hold-to-drag)
- Axis locking (horizontal/vertical only)
- requestAnimationFrame throttling for smooth drags
- Source index calculated BEFORE element hidden
- Placeholder index calculated via mathematical position

### 2. DroppableDirective

**Selector:** `[vdndDroppable]`

**Inputs:**

```typescript
vdndDroppable = input.required<string>(); // Droppable ID
vdndDroppableGroup = input.required<string>(); // Group name
vdndDroppableData = input<unknown>(); // Optional metadata
disabled = input<boolean>(false);
autoScrollEnabled = input<boolean>(true);
autoScrollConfig = input<Partial<AutoScrollConfig>>({});
scrollableHost = input<HTMLElement | null>(null); // Custom scroll container
```

**Outputs:**

```typescript
dragEnter = output<DragEnterEvent>();
dragLeave = output<DragLeaveEvent>();
dragOver = output<DragOverEvent>();
drop = output<DropEvent>();
```

**Host Bindings:**

```typescript
host: {
  '[attr.data-droppable-id]': 'vdndDroppable()',
  '[attr.data-droppable-group]': 'vdndDroppableGroup()',
  '[class.vdnd-droppable-active]': 'isActive()',
  '[class.vdnd-droppable-disabled]': 'disabled()',
}
```

**Key Features:**

- Effect-based reactive event emission
- Tracks enter/leave state transitions
- Caches drag state for drop handling (state clears before effect fires)
- Auto-scroll registration
- Scrollability detection (checks overflow and content size)

## Data Flow

### Drag Start Flow

```
1. User mousedown/touchstart on draggable
   └─> DraggableDirective.onPointerDown()

2. If threshold/delay satisfied:
   └─> ElementCloneService.cloneElement()
   └─> Calculate sourceIndex (BEFORE display:none)
   └─> PositionCalculatorService.findDroppableAtPoint()

3. DragStateService.startDrag({
     draggedItem,
     initialPosition,
     grabOffset,
     lockAxis,
     activeDroppableId,
     placeholderIndex,
     sourceIndex
   })

4. AutoScrollService.startMonitoring(recalculatePlaceholder)

5. DragPreview appears, original element hidden
```

### Drag Move Flow

```
1. mousemove/touchmove event (throttled via RAF)
   └─> DraggableDirective.#updateDrag()

2. PositionCalculatorService.findDroppableAtPoint()
   └─> Returns droppable element or null

3. Calculate placeholder index mathematically:
   └─> visualIndex = (cursorY - containerTop + scrollTop) / itemHeight
   └─> if sameList && visualIndex >= sourceIndex: placeholderIndex = visualIndex + 1

4. DragStateService.updateDragPosition({
     cursorPosition,
     activeDroppableId,
     placeholderId,
     placeholderIndex
   })

5. DroppableDirective effect() reacts:
   └─> Emits dragEnter/dragLeave on active state transition
   └─> Emits dragOver when placeholder changes

6. Consumer's computed() inserts placeholder into list
```

### Drop Flow

```
1. mouseup/touchend or ESC key
   └─> DraggableDirective.#endDrag()

2. DragStateService.endDrag() - clears state

3. DroppableDirective effect() detects isDragging=false:
   └─> Retrieves cached state
   └─> Calculates final indices
   └─> Emits drop event

4. Consumer handles DropEvent:
   └─> Remove from source list at source.index
   └─> Insert into destination list at destination.index
   └─> Signal update triggers re-render

5. AutoScrollService.stopMonitoring()
```

## Event Model

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

## Change Detection Strategy

All components use `OnPush` change detection:

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

State changes trigger updates through signals:

- Computed signals derive from the main state signal
- Components read signals in templates (automatic tracking)
- No manual change detection needed

## Performance Considerations

1. **Virtual Scrolling:** Only renders visible items + overscan buffer
2. **RAF Throttling:** Cursor tracking uses requestAnimationFrame
3. **Zone Optimization:** Pointer events run outside Angular zone
4. **Computed Signals:** Derived state memoized, recalculates only when dependencies change
5. **TrackBy Functions:** All `@for` loops use proper tracking for minimal DOM updates
6. **Minimal Re-renders:** Only affected items re-render when placeholder moves

## Public API Surface

### Components

- `VirtualScrollContainerComponent`
- `DragPreviewComponent`
- `PlaceholderComponent`

### Directives

- `DroppableDirective`
- `DraggableDirective`

### Services

- `DragStateService` (for advanced use cases)
- `PositionCalculatorService`
- `AutoScrollService`
- `ElementCloneService`

### Types

- All event interfaces (`DragStartEvent`, `DragMoveEvent`, `DropEvent`, etc.)
- Configuration interfaces (`AutoScrollConfig`)
- State interfaces (`DragState`, `DraggedItem`, `CursorPosition`, `GrabOffset`)
- Constants (`END_OF_LIST`, `INITIAL_DRAG_STATE`)
