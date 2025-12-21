# Angular Virtual DnD Architecture

This document describes the architecture for the Angular virtual scroll + drag-and-drop library.

## Project Structure

```
/projects/ngx-virtual-dnd/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── virtual-scroll-container.component.ts
│   │   │   └── drag-preview.component.ts
│   │   ├── directives/
│   │   │   ├── droppable.directive.ts
│   │   │   └── draggable.directive.ts
│   │   ├── services/
│   │   │   ├── drag-state.service.ts
│   │   │   └── position-calculator.service.ts
│   │   ├── models/
│   │   │   └── drag-drop.models.ts
│   │   └── index.ts
│   └── public-api.ts
├── package.json
└── ng-package.json
```

## Core Components and Their Responsibilities

### 1. DragStateService

**Purpose:** Central coordinator for all drag-and-drop state.

**Key Features:**

- Singleton service (providedIn: 'root')
- Uses signals for reactive state management
- Coordinates communication between draggables, droppables, and scroll containers

**State:**

```typescript
interface DragState {
  isDragging: boolean;
  draggedItem: DraggedItem | null;
  sourceDroppableId: string | null;
  activeDroppableId: string | null;
  placeholderId: string | null; // ID of item to insert before
  cursorPosition: { x: number; y: number } | null;
}

interface DraggedItem {
  draggableId: string;
  droppableId: string;
  element: HTMLElement;
  height: number;
  width: number;
}
```

**Signals:**

```typescript
readonly state = signal<DragState>(initialState);
readonly isDragging = computed(() => this.state().isDragging);
readonly activeDroppable = computed(() => this.state().activeDroppableId);
readonly placeholder = computed(() => this.state().placeholderId);
```

### 2. VirtualScrollContainerComponent

**Purpose:** Renders only visible items with proper spacers for scrolling.

**Inputs:**

```typescript
items = input.required<T[]>();
itemHeight = input.required<number>();
containerHeight = input.required<number>();
overscan = input<number>(3); // Buffer items above/below viewport
stickyItemIds = input<string[]>([]); // Items to always render
trackBy = input.required<TrackByFunction<T>>();
```

**Outputs:**

```typescript
visibleRangeChange = output<{ start: number; end: number }>();
scrollPositionChange = output<number>();
```

**Template Context:**

```typescript
interface VirtualScrollContext<T> {
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

// Add overscan
const start = Math.max(0, firstVisible - overscan);
const end = Math.min(items.length - 1, lastVisible + overscan);

// Add sticky items (always render regardless of position)
stickyItemIds.forEach((id) => {
  const index = items.findIndex((item) => trackBy(index, item) === id);
  if (index >= 0 && (index < start || index > end)) {
    // Add to rendered items
  }
});
```

### 3. DroppableDirective

**Purpose:** Marks an element as a valid drop target.

**Selector:** `[vdndDroppable]`

**Inputs:**

```typescript
vdndDroppable = input.required<string>(); // Droppable ID
vdndDroppableGroup = input.required<string>(); // Group name
vdndDroppableData = input<unknown>(); // Optional metadata
disabled = input<boolean>(false);
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

### 4. DraggableDirective

**Purpose:** Makes an element draggable.

**Selector:** `[vdndDraggable]`

**Inputs:**

```typescript
vdndDraggable = input.required<string>(); // Draggable ID
vdndDraggableGroup = input.required<string>(); // Group name
vdndDraggableData = input<unknown>(); // Optional metadata
disabled = input<boolean>(false);
dragHandle = input<string>(); // Optional CSS selector for handle
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
  '[attr.data-draggable-id]': 'vdndDraggable()',
  '[class.vdnd-draggable-dragging]': 'isDragging()',
  '[class.vdnd-draggable-disabled]': 'disabled()',
  '[attr.aria-grabbed]': 'isDragging()',
  '[attr.aria-dropeffect]': '"move"',
  '[tabindex]': '0',
  '(mousedown)': 'onPointerDown($event)',
  '(touchstart)': 'onTouchStart($event)',
  '(keydown.space)': 'onKeyboardDrag($event)',
}
```

### 5. PositionCalculatorService

**Purpose:** Encapsulates the drop target detection logic.

**Key Methods:**

```typescript
findDroppableAtPoint(
  x: number,
  y: number,
  draggedElement: HTMLElement,
  groupName: string
): HTMLElement | null;

findDraggableAtPoint(
  x: number,
  y: number,
  draggedElement: HTMLElement
): HTMLElement | null;

getDroppableParent(
  element: HTMLElement,
  groupName: string
): HTMLElement | null;

getDraggableParent(
  element: HTMLElement
): HTMLElement | null;
```

**Implementation:**

```typescript
findDroppableAtPoint(x, y, draggedElement, groupName): HTMLElement | null {
  // Temporarily hide dragged element
  const originalPointerEvents = draggedElement.style.pointerEvents;
  draggedElement.style.pointerEvents = 'none';

  try {
    const elementAtPoint = document.elementFromPoint(x, y);
    if (!elementAtPoint) return null;

    return this.getDroppableParent(elementAtPoint, groupName);
  } finally {
    // Restore pointer events
    draggedElement.style.pointerEvents = originalPointerEvents;
  }
}
```

### 6. DragPreviewComponent

**Purpose:** Renders the dragged item clone that follows the cursor.

**Features:**

- Uses fixed positioning
- Rendered outside virtual scroll container
- Uses portal or overlay technique

```typescript
@Component({
  selector: 'vdnd-drag-preview',
  template: `
    @if (dragState.isDragging()) {
      <div
        class="vdnd-drag-preview"
        [style.left.px]="position().x"
        [style.top.px]="position().y"
        [style.width.px]="dimensions().width"
        [style.height.px]="dimensions().height">
        <ng-container *ngTemplateOutlet="previewTemplate()"></ng-container>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

## Data Flow

### Drag Start Flow

```
1. User mousedown/touchstart on draggable
   └─> DraggableDirective.onPointerDown()

2. If moved beyond threshold:
   └─> DragStateService.startDrag({
         draggableId,
         droppableId,
         element,
         dimensions
       })

3. DragStateService updates state
   └─> isDragging = true
   └─> draggedItem = { ... }

4. DragPreview renders (follows cursor)

5. Droppables subscribe to state
   └─> VirtualScrollContainer adds draggableId to stickyItemIds
```

### Drag Move Flow

```
1. mousemove/touchmove event
   └─> DraggableDirective.onPointerMove()

2. PositionCalculatorService.findDroppableAtPoint()
   └─> Returns droppable element or null

3. PositionCalculatorService.findDraggableAtPoint()
   └─> Returns draggable element or null

4. DragStateService.updateDragPosition({
     cursorPosition: { x, y },
     activeDroppableId,
     placeholderId: draggableAtPoint.id
   })

5. Active Droppable renders placeholder
   └─> Insert before item with matching ID

6. Auto-scroll check
   └─> If cursor near container edge, scroll
```

### Drop Flow

```
1. mouseup/touchend event
   └─> DraggableDirective.onPointerUp()

2. DragStateService.endDrag()

3. DroppableDirective receives drop event
   └─> Emits drop output with:
       - source: { draggableId, droppableId, data }
       - destination: { droppableId, placeholderId, data }

4. Consumer handles data reordering:
   └─> Remove from source list
   └─> Insert into destination list
   └─> Update data model

5. DragStateService resets state
   └─> isDragging = false
   └─> All state cleared
```

## Event Model

### DragStartEvent

```typescript
interface DragStartEvent {
  draggableId: string;
  droppableId: string;
  data: unknown;
  position: { x: number; y: number };
}
```

### DragMoveEvent

```typescript
interface DragMoveEvent {
  draggableId: string;
  sourceDroppableId: string;
  targetDroppableId: string | null;
  placeholderId: string | null;
  position: { x: number; y: number };
}
```

### DropEvent

```typescript
interface DropEvent {
  source: {
    draggableId: string;
    droppableId: string;
    index: number;
    data: unknown;
  };
  destination: {
    droppableId: string;
    placeholderId: string; // "END_OF_LIST" for end
    index: number;
    data: unknown;
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

## Virtual Scroll + Drag Integration

### Keeping Dragged Items Rendered

```typescript
// In parent component
stickyItemIds = computed(() => {
  const draggedId = this.dragState.draggedItem()?.draggableId;
  return draggedId ? [draggedId] : [];
});

// Template
<vdnd-virtual-scroll
  [items]="items()"
  [stickyItemIds]="stickyItemIds()">
```

### Placeholder Rendering

```typescript
// In virtual scroll container
renderItems = computed(() => {
  const items = this.items();
  const placeholderId = this.dragState.placeholder();
  const activeDroppable = this.dragState.activeDroppable();

  if (activeDroppable !== this.droppableId || !placeholderId) {
    return items;
  }

  // Insert placeholder before item with matching ID
  const result = [...items];
  const insertIndex = result.findIndex((item) => this.trackBy(0, item) === placeholderId);

  if (insertIndex >= 0) {
    result.splice(insertIndex, 0, { isPlaceholder: true });
  } else if (placeholderId === 'END_OF_LIST') {
    result.push({ isPlaceholder: true });
  }

  return result;
});
```

## Accessibility

### Keyboard Support

```typescript
// In DraggableDirective
onKeyboardDrag(event: KeyboardEvent) {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    if (!this.isDragging()) {
      this.startKeyboardDrag();
    } else {
      this.completeKeyboardDrag();
    }
  }

  if (this.isDragging()) {
    if (event.key === 'ArrowUp') this.moveUp();
    if (event.key === 'ArrowDown') this.moveDown();
    if (event.key === 'Escape') this.cancelDrag();
  }
}
```

### ARIA Attributes

```html
<div
  vdndDraggable="item-1"
  role="listitem"
  [attr.aria-grabbed]="isDragging()"
  [attr.aria-dropeffect]="'move'"
  [attr.aria-describedby]="'dnd-instructions'"
></div>
```

### Live Regions

```html
<div aria-live="polite" aria-atomic="true" class="visually-hidden">{{ announceMessage() }}</div>
```

## Performance Considerations

1. **Minimal Re-renders:** Only affected items re-render when placeholder moves
2. **Debounced Scroll:** Scroll position updates debounced to prevent jank
3. **RAF for Movement:** Cursor tracking uses requestAnimationFrame
4. **Zone Optimization:** Pointer events run outside Angular zone
5. **Track By:** All ngFor/template for loops use trackBy

## Public API Surface

### Components

- `VirtualScrollContainerComponent`
- `DragPreviewComponent`

### Directives

- `DroppableDirective`
- `DraggableDirective`

### Services

- `DragStateService` (for advanced use cases)

### Types

- All event interfaces
- Configuration interfaces
- State interfaces
