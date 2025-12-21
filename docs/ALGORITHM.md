# Virtual Scroll + Drag-and-Drop Algorithm

This document explains the core algorithm used to combine virtual scrolling with drag-and-drop functionality, based on analysis of the react-virtualized-dnd reference implementation.

## The Core Problem

Angular CDK's drag-drop module calculates drop positions by querying sibling DOM elements via `getBoundingClientRect()`. This fundamentally breaks with virtual scrolling because:

1. Items outside the viewport are not rendered (unmounted)
2. DOM queries return nothing for unmounted items
3. The internal position model becomes stale when items are virtualized away

## The Solution Architecture

The React library solves this through three key mechanisms:

### 1. Element-Under-Point Detection (Not DOM Sibling Queries)

Instead of querying siblings for position calculation, the library:

```
1. Temporarily disables pointer-events on the dragged element
2. Uses document.elementFromPoint(cursorX, cursorY) to find what's underneath
3. Walks up the DOM tree to find the droppable/draggable parent
4. Uses the found element's ID as the insertion point
```

This approach works because:

- It only needs ONE element to exist at the cursor position
- Virtual scroll ensures items at cursor position ARE rendered (they're visible)
- The placeholder ID is semantic (item ID), not positional (array index)

### 2. Sticky Elements (Preventing Dragged Item Unmounting)

When an item is being dragged, its ID is marked as "sticky":

```javascript
// In Droppable render
stickyElems={draggedElemId ? [draggedElemId] : []}
```

The virtual scroll container always renders sticky elements regardless of scroll position:

```javascript
// In VirtualizedScrollBar.getListToRender()
if (stickyElems.find((id) => id === child.props.draggableId)) {
  this.stickyElems.push(child); // Always render
}
```

This prevents the dragged item from disappearing when scrolling during drag.

### 3. Placeholder Insertion by ID (Not by Index)

The placeholder system works by ID, not array position:

```javascript
// In Droppable.pushPlaceholder()
listToRender.forEach((elem, index) => {
  if (elem.props.draggableId === this.state.placeholder) {
    // Insert placeholder BEFORE this element
    listToRender.splice(index, 0, placeholderDiv);
  }
});
```

Drop position is determined by finding which draggable ID the cursor is over.

## Position Calculation Flow

### During Drag Move:

```
1. Cursor moves to position (x, y)

2. Find droppable under cursor:
   - Set dragged.style.pointerEvents = 'none'
   - element = document.elementFromPoint(x, y)
   - Walk up DOM to find element with 'droppablegroup' attribute
   - Set dragged.style.pointerEvents = 'all'

3. Find draggable under cursor:
   - Same technique, look for 'draggableid' attribute

4. Dispatch move event with:
   - Source: { draggableId, droppableId } (the item being dragged)
   - Target droppable: droppable element found
   - Target draggable: draggable ID found (becomes placeholder)
   - Cursor position: (x, y)

5. Context receives move event:
   - Updates state.placeholder = targetDraggableId
   - Updates state.droppableActive = targetDroppableId

6. Droppable receives placeholder update:
   - If targeting this droppable, show placeholder before item with matching ID
```

### On Drop:

```
1. Drag ends (mouseup/touchend)

2. DragDropContext.onDragEnd() fires

3. Callback provides:
   - source: { draggableId, droppableId } - where item came from
   - destinationId: target droppable ID
   - placeholderId: ID of item to insert before (or "END_OF_LIST")
   - targetSection: (optional) section header target

4. Consumer updates data:
   - Find source item in source list
   - Find insertion index in target list:
     - If "END_OF_LIST": insert at end
     - If "header": insert at beginning
     - Otherwise: find index of item with placeholderId
   - Remove from source, insert into target
```

## Virtual Scroll Algorithm

### Fixed Height Items (VirtualizedScrollBar)

```javascript
function getListToRender(list) {
  const elemHeight = 50; // Fixed height
  const containerHeight = props.containerHeight;
  const maxVisible = Math.floor(containerHeight / elemHeight);
  const overScan = 3;

  // Find first visible element
  let firstVisible = 0;
  for (let i = 0; i < list.length; i++) {
    if ((i + 1) * elemHeight >= scrollOffset) {
      firstVisible = i;
      break;
    }
  }

  // Calculate range with overscan
  const start = Math.max(0, firstVisible - overScan);
  const end = Math.min(list.length - 1, firstVisible + maxVisible + overScan);

  return list.slice(start, end + 1);
}
```

### Spacer Calculation

Virtual scroll uses spacer divs to maintain correct scroll height:

```
Total height = itemCount * itemHeight

Above spacer = unrenderedAboveCount * itemHeight
Below spacer = unrenderedBelowCount * itemHeight
Rendered items = (end - start + 1) items
```

## Auto-Scroll During Drag

When cursor is near container edge during drag:

```javascript
function onMoveScroll(x, y, droppable) {
  const scrollThreshold = Math.max(50, screenWidth * 0.05);
  const containerBounds = droppable.getBoundingClientRect();

  const nearBottom = containerBounds.bottom - y <= scrollThreshold;
  const nearTop = y - containerBounds.top <= scrollThreshold;

  if (nearBottom) {
    scrollDirection = 'down';
    scrollSpeed = 15; // pixels per frame
  } else if (nearTop) {
    scrollDirection = 'up';
    scrollSpeed = -15;
  }

  requestAnimationFrame(() => autoScroll());
}
```

## Edge Cases

### 1. Dragged Item Gets Virtualized

**Problem:** If you scroll while dragging, the source item may leave viewport.

**Solution:** "Sticky elements" - the dragged item's ID is passed to the virtual scroll container, which always renders it regardless of scroll position.

### 2. Drop Target is Off-Screen

**Problem:** When dragging to top/bottom of list, target may not be rendered.

**Solution:** Auto-scroll brings targets into view. When cursor is at very end, `placeholderId = "END_OF_LIST"` is used.

### 3. Fast Scrolling During Drag

**Problem:** Placeholder might flicker or jump.

**Solution:**

- Debounce scroll handlers
- Only update state when scroll difference exceeds threshold
- Use requestAnimationFrame for smooth updates

### 4. Multiple Droppable Zones

**Supported:** Yes, through the `dragAndDropGroup` system.

Each group has its own event namespace:

```javascript
{
    moveEvent: 'groupName-MOVE',
    endEvent: 'groupName-END',
    // etc.
}
```

Components subscribe only to their group's events.

### 5. Cross-Container Drag

**Supported:** Yes. The placeholder system uses droppable IDs:

- `droppableActive` tracks which container is currently targeted
- Placeholder only renders in the active droppable
- Drop event provides both source and destination droppable IDs

## Key Insight: Why This Works

The traditional approach fails because it asks "what position in the list corresponds to Y=500px?" and needs ALL items in DOM to answer.

This approach asks "what item is at Y=500px right now?" and only needs the VISIBLE items in DOM to answer.

The placeholder is semantic ("insert before item-42") not positional ("insert at index 42"). When the list scrolls, item-42's visual position changes, but the semantic meaning stays stable.

## Angular Implementation Considerations

For Angular, the same principles apply but with Angular-specific patterns:

1. **State Management:** Use signals instead of React state
2. **Change Detection:** Use OnPush strategy, only update on meaningful changes
3. **Event System:** Use RxJS subjects or Angular's EventEmitter
4. **Template Rendering:** Use `@for` with track, conditionally render sticky elements
5. **Pointer Events:** Same document.elementFromPoint technique works

The core algorithm remains the same - the innovation is in HOW you find drop targets, not WHAT framework you use.
