# Angular Virtual DnD Architecture

This document describes the architecture for the Angular virtual scroll + drag-and-drop library.

## Project Structure

```
/projects/ngx-virtual-dnd/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── virtual-scroll-container.component.ts  # Low-level virtual scroll
│   │   │   ├── virtual-sortable-list.component.ts     # High-level sortable list
│   │   │   ├── virtual-viewport.component.ts          # Self-contained viewport
│   │   │   ├── virtual-content.component.ts           # For external scroll containers
│   │   │   ├── drag-preview.component.ts              # Dragged item preview
│   │   │   ├── drag-placeholder.component.ts          # Internal placeholder
│   │   │   └── placeholder.component.ts               # Consumer placeholder
│   │   ├── directives/
│   │   │   ├── draggable.directive.ts                 # Makes elements draggable
│   │   │   ├── droppable.directive.ts                 # Marks drop targets
│   │   │   ├── droppable-group.directive.ts           # Group context provider
│   │   │   ├── scrollable.directive.ts                # Marks scroll containers
│   │   │   └── virtual-for.directive.ts               # Structural directive
│   │   ├── services/
│   │   │   ├── drag-state.service.ts                  # Central state management
│   │   │   ├── position-calculator.service.ts         # Position calculations
│   │   │   ├── auto-scroll.service.ts                 # Edge auto-scrolling
│   │   │   ├── keyboard-drag.service.ts               # Keyboard navigation
│   │   │   └── element-clone.service.ts               # Clone for preview
│   │   ├── tokens/
│   │   │   ├── scroll-container.token.ts              # Scroll container DI
│   │   │   └── virtual-viewport.token.ts              # Viewport DI
│   │   ├── utils/
│   │   │   └── drop-helpers.ts                        # moveItem, reorderItems, etc.
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

### 5. KeyboardDragService

**Purpose:** Handles keyboard-initiated drag operations for accessibility.

**Key Features:**

- Document-level keyboard listeners during drag (since dragged element is hidden)
- Arrow key navigation between items and lists
- Focus restoration after drag ends

**Methods:**

```typescript
startDrag(element, draggableId, groupName, data?): void
moveUp(): void
moveDown(): void
moveToLeft(): void
moveToRight(): void
drop(): void
cancel(): void
```

**Keyboard Flow:**

1. User presses Space on focused draggable
2. Document-level listeners capture arrow keys
3. Arrow up/down: move within current list
4. Arrow left/right: move to adjacent list
5. Space: complete drop
6. Escape: cancel and restore

## Core Components

### 1. VirtualSortableListComponent (High-Level)

**Purpose:** All-in-one component that combines droppable, virtual scroll, and placeholder functionality. This is the **recommended** entry point for most use cases.

**Selector:** `vdnd-sortable-list`

**Key Features:**

- Automatically handles placeholder insertion
- Manages sticky items for dragged elements
- Integrates virtual scrolling with drag-and-drop
- Wraps VirtualScrollContainerComponent and DroppableDirective

**Inputs:**

```typescript
droppableId = input.required<string>();
group = input.required<string>();
items = input.required<T[]>();
itemHeight = input.required<number>();
itemIdFn = input.required<(item: T) => string>();
itemTemplate = input.required<TemplateRef<VirtualScrollItemContext<T>>>();
// Optional
trackByFn = input<(index: number, item: T) => string | number>();
containerHeight = input<number>();
overscan = input<number>(3);
disabled = input<boolean>(false);
autoScrollEnabled = input<boolean>(true);
autoScrollConfig = input<Partial<AutoScrollConfig>>({});
```

**Outputs:**

```typescript
drop = output<DropEvent>();
dragEnter = output<DragEnterEvent>();
dragLeave = output<DragLeaveEvent>();
dragOver = output<DragOverEvent>();
visibleRangeChange = output<VisibleRangeChange>();
scrollPositionChange = output<number>();
```

### 2. VirtualScrollContainerComponent (Low-Level)

**Purpose:** Renders only visible items with proper spacers for scrolling. Use when you need more control than VirtualSortableListComponent provides.

**Selector:** `vdnd-virtual-scroll`

**Inputs:**

```typescript
items = input.required<T[]>();
itemHeight = input.required<number>();
itemIdFn = input.required<(item: T) => string>();
itemTemplate = input.required<TemplateRef<VirtualScrollItemContext<T>>>();
// Optional
trackByFn = input<(index: number, item: T) => string | number>();
containerHeight = input<number>(); // Uses CSS height if null
overscan = input<number>(3);
stickyItemIds = input<string[]>([]);
droppableId = input<string>(); // For auto placeholder insertion
autoStickyDraggedItem = input<boolean>(true);
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

### 1. DroppableGroupDirective

**Selector:** `[vdndGroup]`

**Purpose:** Provides group context to child draggable and droppable directives, reducing boilerplate.

**Inputs:**

```typescript
group = input.required<string>({ alias: 'vdndGroup' });
```

**Key Features:**

- Uses Angular's DI to provide group context via `VDND_GROUP_TOKEN`
- Child draggables/droppables inherit group automatically
- Eliminates repetitive `vdndDraggableGroup`/`vdndDroppableGroup` attributes

### 2. DraggableDirective

**Selector:** `[vdndDraggable]`

**Inputs:**

```typescript
vdndDraggable = input.required<string>(); // Draggable ID
vdndDraggableGroup = input<string>(); // Group name (inherited from parent if omitted)
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
  '[class.vdnd-drag-pending]': 'isPending()',
  '[style.display]': 'isDragging() ? "none" : null',  // Hide during drag
  '[attr.aria-grabbed]': 'isDragging()',
  '[tabindex]': 'disabled() ? -1 : 0',
}
```

**Key Features:**

- Pointer events (mouse/touch) with threshold detection
- Drag delay support (hold-to-drag)
- Axis locking (horizontal/vertical only)
- requestAnimationFrame throttling for smooth drags
- Source index calculated BEFORE element hidden
- Placeholder index calculated via mathematical position
- Full keyboard support (Space, arrows, Escape)

### 3. DroppableDirective

**Selector:** `[vdndDroppable]`

**Inputs:**

```typescript
vdndDroppable = input.required<string>(); // Droppable ID
vdndDroppableGroup = input<string>(); // Group name (inherited from parent if omitted)
vdndDroppableData = input<unknown>(); // Optional metadata
disabled = input<boolean>(false);
autoScrollEnabled = input<boolean>(true);
autoScrollConfig = input<Partial<AutoScrollConfig>>({});
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

### 4. ScrollableDirective

**Selector:** `[vdndScrollable]`

**Purpose:** Marks an external scroll container for use with VirtualForDirective.

**Provides:** `VDND_SCROLL_CONTAINER` token with scroll position and container dimensions.

### 5. VirtualForDirective

**Selector:** `*vdndVirtualFor`

**Purpose:** Structural directive for virtual scrolling with maximum flexibility.

**Inputs (via microsyntax):**

```typescript
vdndVirtualForOf = input.required<T[]>();
vdndVirtualForItemHeight = input.required<number>();
vdndVirtualForTrackBy = input.required<(index: number, item: T) => unknown>();
vdndVirtualForOverscan = input<number>(3);
vdndVirtualForDroppableId = input<string>();
```

**Key Features:**

- True view recycling for performance
- Automatic placeholder insertion when droppableId is set
- Works with any scroll container via VDND_SCROLL_CONTAINER token
- Supports wrapper-based positioning (VirtualContentComponent) or absolute positioning

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

- `VirtualSortableListComponent` - High-level sortable list (recommended)
- `VirtualScrollContainerComponent` - Low-level virtual scroll
- `VirtualViewportComponent` - Self-contained viewport
- `VirtualContentComponent` - For external scroll containers
- `DragPreviewComponent` - Dragged item preview
- `PlaceholderComponent` - Consumer placeholder
- `DragPlaceholderComponent` - Internal placeholder

### Directives

- `DroppableGroupDirective` - Group context provider
- `DraggableDirective` - Makes elements draggable
- `DroppableDirective` - Marks drop targets
- `ScrollableDirective` - Marks scroll containers
- `VirtualForDirective` - Structural directive for virtual lists

### Services

- `DragStateService` - Central state management
- `PositionCalculatorService` - Position calculations
- `AutoScrollService` - Edge auto-scrolling
- `KeyboardDragService` - Keyboard navigation
- `ElementCloneService` - Clone for preview

### Tokens

- `VDND_GROUP_TOKEN` - Group context injection
- `VDND_SCROLL_CONTAINER` - Scroll container injection
- `VDND_VIRTUAL_VIEWPORT` - Virtual viewport injection

### Utilities

- `moveItem()` - Move between signal-based lists
- `reorderItems()` - Reorder within a single list
- `applyMove()` - Immutable version
- `isNoOpDrop()` - Check if drop is no-op
- `insertAt()` / `removeAt()` - Array helpers

### Types

- All event interfaces (`DragStartEvent`, `DragMoveEvent`, `DropEvent`, `DragEndEvent`, etc.)
- Configuration interfaces (`AutoScrollConfig`)
- State interfaces (`DragState`, `DraggedItem`, `CursorPosition`, `GrabOffset`)
- Context interfaces (`VirtualScrollItemContext`, `VirtualForContext`, `DragPreviewContext`, `VdndGroupContext`, `VdndScrollContainer`, `VdndVirtualViewport`)
- Constants (`END_OF_LIST`, `INITIAL_DRAG_STATE`)
