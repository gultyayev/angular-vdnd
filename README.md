# ngx-virtual-dnd

An Angular drag-and-drop library optimized for virtual scrolling. Handles thousands of items efficiently by only rendering visible elements while maintaining smooth drag operations.

Inspired by [react-virtualized-dnd](https://github.com/forecast-it/react-virtualized-dnd/).

## Features

- **Virtual Scrolling** - Renders only visible items plus an overscan buffer
- **Smooth Drag & Drop** - 60fps drag operations with RAF throttling
- **Cross-List Support** - Drag items between multiple lists with group filtering
- **Auto-Scroll** - Automatically scrolls when dragging near container edges
- **Axis Locking** - Constrain dragging to horizontal or vertical axis
- **Touch Support** - Works with both mouse and touch events
- **Keyboard Accessible** - Space to activate, Escape to cancel, Tab navigation
- **Angular 21+** - Built with signals, standalone components, and modern patterns

## Installation

```bash
npm install ngx-virtual-dnd
```

**Peer Dependencies:** Angular 21+

## Quick Start

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import {
  VirtualScrollContainerComponent,
  DraggableDirective,
  DroppableDirective,
  DragPreviewComponent,
  PlaceholderComponent,
  DragStateService,
  DropEvent,
  END_OF_LIST,
} from 'ngx-virtual-dnd';

interface Item {
  id: string;
  name: string;
}

@Component({
  selector: 'app-list',
  imports: [
    VirtualScrollContainerComponent,
    DraggableDirective,
    DroppableDirective,
    DragPreviewComponent,
    PlaceholderComponent,
  ],
  template: `
    <div class="list" vdndDroppable="my-list" vdndDroppableGroup="demo" (drop)="onDrop($event)">
      <vdnd-virtual-scroll
        [items]="itemsWithPlaceholder()"
        [itemHeight]="50"
        [stickyItemIds]="stickyIds()"
        [itemIdFn]="getItemId"
        [trackByFn]="trackById"
      >
        <ng-template let-item let-index="index">
          @if (item.isPlaceholder) {
            <vdnd-placeholder [height]="50" />
          } @else {
            <div
              class="item"
              vdndDraggable="{{ item.id }}"
              vdndDraggableGroup="demo"
              [vdndDraggableData]="item"
            >
              {{ item.name }}
            </div>
          }
        </ng-template>
      </vdnd-virtual-scroll>
    </div>

    <vdnd-drag-preview />
  `,
})
export class ListComponent {
  readonly #dragState = inject(DragStateService);

  items = signal<Item[]>([
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    // ... more items
  ]);

  // Keep dragged item rendered during scroll
  stickyIds = computed(() => {
    const item = this.#dragState.draggedItem();
    return item ? [item.draggableId] : [];
  });

  // Insert placeholder into list
  itemsWithPlaceholder = computed(() => {
    const items = this.items();
    const activeDroppable = this.#dragState.activeDroppableId();
    const placeholderIndex = this.#dragState.placeholderIndex();

    if (activeDroppable !== 'my-list' || placeholderIndex === null) {
      return items;
    }

    const result = [...items];
    result.splice(placeholderIndex, 0, { id: 'placeholder', isPlaceholder: true } as any);
    return result;
  });

  onDrop(event: DropEvent): void {
    const sourceIndex = event.source.index;
    const destIndex = event.destination.index;

    this.items.update((items) => {
      const newItems = [...items];
      const [removed] = newItems.splice(sourceIndex, 1);
      const adjustedIndex = sourceIndex < destIndex ? destIndex - 1 : destIndex;
      newItems.splice(adjustedIndex, 0, removed);
      return newItems;
    });
  }

  readonly getItemId = (item: Item): string => item.id;
  readonly trackById = (_: number, item: Item): string => item.id;
}
```

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md) - How the library works
- [API Reference](./docs/API.md) - Components, directives, and services
- [Usage Guide](./docs/USAGE.md) - Detailed examples
- [Algorithm](./docs/ALGORITHM.md) - Core positioning algorithm

## Project Structure

```
/projects/ngx-virtual-dnd/    # Reusable library (npm: ngx-virtual-dnd)
/src/                         # Demo application
/e2e/                         # Playwright E2E tests
/docs/                        # Documentation
```

## Development

```bash
# Install dependencies
npm install

# Start demo app (http://localhost:4200)
npm start

# Build library (required after editing library files)
ng build ngx-virtual-dnd

# Run unit tests
npm test

# Run E2E tests
npm run e2e

# Run E2E tests with UI
npm run e2e:ui

# Lint
npm run lint

# Storybook
npm run storybook
```

### Library Development

The demo app imports from `dist/ngx-virtual-dnd`. After editing any file in `/projects/ngx-virtual-dnd/`:

1. Rebuild the library: `ng build ngx-virtual-dnd`
2. Restart the dev server if running

## Key Concepts

### Why Virtual Scroll + DnD is Hard

Traditional drag-and-drop libraries (like Angular CDK) query sibling DOM elements via `getBoundingClientRect()`. This fails with virtual scrolling because items outside the viewport aren't rendered.

### The Solution

This library uses **element-under-point detection** instead of DOM sibling queries:

1. Temporarily hide the dragged element
2. Use `document.elementFromPoint()` to find what's at the cursor
3. Walk up the DOM to find the droppable/draggable parent
4. Calculate placeholder position mathematically

This works because only the visible item at the cursor position needs to exist in the DOM.

### Placeholder Index

The placeholder index is calculated using the **preview center position**, providing intuitive UX where the placeholder appears where the preview visually is.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT
