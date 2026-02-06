# Architecture Analysis: CDK Patterns vs ngx-virtual-dnd

## Executive Summary

The `DraggableDirective` at **1,017 LOC** is the largest file in the library and mixes 6 distinct concerns. Angular CDK solves this same problem with a **Ref pattern** that separates framework-agnostic DOM logic from Angular directive wiring. This analysis compares the two approaches and proposes concrete improvements.

## Current State: ngx-virtual-dnd

### File Size Distribution

| File                                    | LOC        | Role                                                                 |
| --------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `draggable.directive.ts`                | 1,017      | Pointer + keyboard events, drag lifecycle, hit-testing orchestration |
| `virtual-scroll-container.component.ts` | 626        | Virtual render + sticky items + auto-scroll integration              |
| `virtual-for.directive.ts`              | 608        | View recycling, placeholder positioning                              |
| `droppable.directive.ts`                | 373        | Drop target registration, events                                     |
| `position-calculator.service.ts`        | 301        | DOM hit-testing, geometry                                            |
| `drag-state.service.ts`                 | 268        | Central signal state                                                 |
| `auto-scroll.service.ts`                | 259        | RAF-based edge scrolling                                             |
| `element-clone.service.ts`              | 221        | Element cloning for preview                                          |
| `drag-index-calculator.service.ts`      | 186        | Placeholder math                                                     |
| `keyboard-drag.service.ts`              | 147        | Keyboard navigation state                                            |
| **Total**                               | **~6,043** |                                                                      |

### DraggableDirective: 6 Concerns in One File

1. **Pointer event handling** (lines 201-356) — mousedown/touchstart, threshold detection, delay timer, RAF-throttled move
2. **Keyboard event handling** (lines 358-689) — Space/Enter activate/drop, Arrow keys navigate, document-level listeners
3. **Drag lifecycle start** (lines 694-791) — grab offset, element cloning, source index calc, initial placeholder, state registration
4. **Drag position updates** (lines 829-905) — axis locking, droppable detection, placeholder recalculation, event emission
5. **Drag end/cancel** (lines 910-948) — same-list index adjustment, state cleanup, event emission
6. **Cleanup & utilities** (lines 950-1017) — event listener removal, parent resolution, position extraction

### What's Already Good

The services follow **single-responsibility principle** well:

- `DragStateService` — pure signal state, no side effects
- `PositionCalculatorService` — stateless DOM geometry (zero dependencies)
- `AutoScrollService` — focused RAF loop
- `DragIndexCalculatorService` — pure math
- `ElementCloneService` — isolated cloning
- `KeyboardDragService` — keyboard state wrapper

**Zero circular dependencies.** Clean unidirectional flow from directives → services.

---

## Angular CDK Architecture

### The Ref Pattern (Drag-Drop)

CDK's central insight is a **two-layer architecture**:

| Layer                           | Class              | LOC    | Responsibility                                         |
| ------------------------------- | ------------------ | ------ | ------------------------------------------------------ |
| **Ref** (framework-agnostic)    | `DragRef`          | ~1,850 | All pointer/DOM/positioning logic                      |
|                                 | `DropListRef`      | ~1,100 | Container sorting, hit-testing, auto-scroll            |
|                                 | `PreviewRef`       | ~173   | Preview element creation/styling                       |
|                                 | `DragDropRegistry` | ~336   | Global singleton: pointer events, active drag tracking |
| **Directive** (Angular adapter) | `CdkDrag`          | ~617   | Input sync, event translation, lifecycle, DI           |
|                                 | `CdkDropList`      | ~500   | Wraps DropListRef with Angular bindings                |

**Key ratio:** `DragRef` is **3x the size** of `CdkDrag`. The Ref does the heavy lifting; the directive is a thin adapter that:

1. Creates the Ref instance
2. Syncs Angular inputs → Ref properties (in `beforeStarted` callback)
3. Translates Ref's RxJS subjects → Angular `@Output` EventEmitters
4. Resolves content queries (handle, preview, placeholder templates)
5. Manages Angular lifecycle (init/destroy)

### Three-Tier Pointer Separation

```
DragDropRegistry (global)          ← document-level mousemove/touchmove/mouseup/touchend
    ↓ pointerMove / pointerUp (RxJS Subjects)
DragRef (per-item)                 ← threshold, axis lock, boundary constraints, preview positioning
    ↓ notifications
DropListRef (per-container)        ← sorting, hit-testing, auto-scroll
```

Individual `DragRef` instances do **not** each bind global move/up listeners. The registry centralizes this.

### The Strategy Pattern (Virtual Scroll)

CDK virtual scroll uses **dependency injection polymorphism**:

```
VIRTUAL_SCROLL_STRATEGY (InjectionToken)
           ↓
VirtualScrollStrategy (interface: 8 methods)
           ↓
FixedSizeVirtualScrollStrategy (249 LOC) — or custom implementation
```

The viewport delegates "what to render" decisions entirely to the pluggable strategy. The strategy calls back into the viewport to set rendered range, total size, and content offset. This creates a **bidirectional feedback loop**:

```
User scrolls → Viewport.onContentScrolled() → Strategy.onContentScrolled()
     → Strategy calculates range → Viewport.setRenderedRange() → CdkVirtualForOf renders
```

### Pluggable Sort Strategies

CDK also makes sort behavior pluggable via `DropListSortStrategy` interface:

- `SingleAxisSortStrategy` — CSS-transform-based reordering (vertical/horizontal)
- `MixedSortStrategy` — DOM-move-based reordering (wrapping/grid layouts)

---

## Gap Analysis

### Where ngx-virtual-dnd Falls Short

| Concern             | CDK Approach                                  | ngx-virtual-dnd Approach                         | Impact                                                     |
| ------------------- | --------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Pointer handling    | Centralized in `DragDropRegistry` + `DragRef` | Inline in `DraggableDirective`                   | Every directive instance binds its own global listeners    |
| Framework coupling  | `DragRef` is testable with bare DOM           | All logic lives in Angular directive             | Unit testing requires full Angular TestBed                 |
| Keyboard vs Pointer | Would be separate concerns in Ref             | Mixed together in one directive                  | 330 lines of keyboard code interleaved with pointer code   |
| Preview management  | Dedicated `PreviewRef` class                  | Delegated to `ElementCloneService` + inline code | Clone creation separated but positioning logic scattered   |
| Sort strategy       | Pluggable via interface                       | Hardcoded in `DragIndexCalculatorService`        | Can't swap between fixed-size and variable-size strategies |

### Where ngx-virtual-dnd Is Better

| Aspect                           | Advantage                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signals over RxJS**            | CDK uses RxJS Subjects/Observables for state; ngx-virtual-dnd uses Angular signals — more modern, less boilerplate, no subscription management |
| **Service granularity**          | CDK's `DragRef` at 1,850 LOC is even larger than the 1,017-line directive. ngx-virtual-dnd already extracted 7 focused services                |
| **No Ref indirection overhead**  | Direct signal reads are cheaper than Ref→Observable→Directive event translation                                                                |
| **Virtual scroll is integrated** | CDK's drag-drop and virtual scroll are completely separate modules with no integration. ngx-virtual-dnd's entire purpose is combining them     |

---

## Recommended Improvements

### 1. Extract a `DragRef` — Separate DOM Logic from Angular Wiring

**Priority: High** | **Impact: Reduces directive to ~350 LOC** | **Risk: Medium (refactor, no behavior change)**

Split `DraggableDirective` into:

```
DraggableDirective (~350 LOC)          DragRef (~500 LOC)
├─ Angular inputs/outputs               ├─ Pointer event binding/unbinding
├─ Host bindings                         ├─ Drag threshold detection
├─ Input → DragRef sync                  ├─ RAF-throttled position updates
├─ DragRef event → output emit           ├─ Drag start/update/end lifecycle
└─ Lifecycle (create/destroy DragRef)    ├─ Axis locking
                                         ├─ Hit-testing orchestration
                                         └─ Emits events via callbacks/signals
```

**Key difference from CDK:** Use signals instead of RxJS. The DragRef wouldn't need `NgZone` — it would accept callbacks or expose signals that the directive reads.

```typescript
// Sketch of the pattern
class DragRef {
  readonly #state: DragStateService;
  readonly #positionCalc: PositionCalculatorService;

  // Callbacks instead of RxJS Subjects
  onDragStart: ((event: DragStartEvent) => void) | null = null;
  onDragMove: ((event: DragMoveEvent) => void) | null = null;
  onDragEnd: ((event: DragEndEvent) => void) | null = null;

  startTracking(element: HTMLElement, position: CursorPosition): void { ... }
  updatePosition(position: CursorPosition): void { ... }
  endDrag(cancelled: boolean): void { ... }
  destroy(): void { ... }
}
```

Benefits:

- Directive becomes a thin adapter (testable with minimal setup)
- DragRef is testable with bare DOM elements
- Pointer logic is reusable outside Angular (e.g., web component wrapper)

### 2. Extract Keyboard Drag into a Separate Handler

**Priority: High** | **Impact: Removes ~330 LOC from directive** | **Risk: Low**

The keyboard drag code (lines 358-689) is almost entirely self-contained. It shares only:

- `#effectiveGroup()` — read-only
- `#dragState` / `#keyboardDrag` — injected services
- `dragStart` / `dragEnd` — output emitters

Extract to `KeyboardDragHandler` (or fold into existing `KeyboardDragService`):

```typescript
class KeyboardDragHandler {
  // Receives dependencies via constructor, not DI
  constructor(
    private dragState: DragStateService,
    private keyboardDrag: KeyboardDragService,
    private positionCalc: PositionCalculatorService,
    private indexCalc: DragIndexCalculatorService,
    private elementClone: ElementCloneService,
  ) {}

  activate(element: HTMLElement, config: KeyboardDragConfig): void { ... }
  handleKeyDown(event: KeyboardEvent): void { ... }  // The big switch statement
  complete(): DragEndEvent { ... }
  cancel(): DragEndEvent { ... }
  destroy(): void { ... }
}
```

This eliminates the duplicated key handling between host bindings (lines 398-437) and document listener (lines 649-689).

### 3. Centralize Global Event Listeners (Registry Pattern)

**Priority: Medium** | **Impact: Cleaner resource management** | **Risk: Low**

Currently each `DraggableDirective` instance binds its own `document.addEventListener('mousemove', ...)` when a drag starts. With CDK's registry pattern:

```typescript
@Injectable({ providedIn: 'root' })
class DragEventRegistry {
  readonly #activeDragRef = signal<DragRef | null>(null);

  // Bound ONCE, not per-draggable
  #globalMoveListener: (() => void) | null = null;
  #globalUpListener: (() => void) | null = null;

  registerDrag(ref: DragRef): void {
    this.#activeDragRef.set(ref);
    if (!this.#globalMoveListener) {
      this.#bindGlobalListeners();
    }
  }

  unregisterDrag(): void {
    this.#activeDragRef.set(null);
    this.#unbindGlobalListeners();
  }
}
```

Since only one drag can be active at a time, there's no reason for per-instance global listeners.

### 4. Virtual Scroll Strategy Pattern

**Priority: Low** | **Impact: Extensibility** | **Risk: Medium**

The current `DragIndexCalculatorService` hardcodes fixed-height item assumptions. If variable-height items are ever needed, a strategy pattern would help:

```typescript
interface PlaceholderStrategy {
  calculateIndex(params: PlaceholderParams): PlaceholderResult;
  getTotalItemCount(params: ItemCountParams): number;
}

class FixedHeightPlaceholderStrategy implements PlaceholderStrategy { ... }
// Future: class VariableHeightPlaceholderStrategy implements PlaceholderStrategy { ... }
```

**Not urgent** — the library currently only supports fixed-height items, and YAGNI applies. But the interface boundary is worth defining now so the service doesn't accumulate more hardcoded assumptions.

### 5. Eliminate Duplicated Keyboard Event Handling

**Priority: High** | **Impact: ~40 LOC reduction, eliminates bug surface** | **Risk: Low**

Lines 398-437 (host binding handlers) and lines 649-689 (document-level `#onKeyboardDragKeyDown`) handle the **exact same keys** with the **exact same logic**. The host bindings fire when the element is visible (before drag starts); the document listener fires when the element is hidden. These should share a single dispatch table:

```typescript
readonly #keyboardActions: Record<string, () => void> = {
  ' ': () => this.#completeKeyboardDrag(),
  'Enter': () => this.#completeKeyboardDrag(),
  'Escape': () => this.#cancelKeyboardDrag(),
  'ArrowUp': () => this.#keyboardDrag.moveUp(),
  'ArrowDown': () => this.#keyboardDrag.moveDown(),
  'ArrowLeft': () => this.#moveToAdjacentDroppable('left'),
  'ArrowRight': () => this.#moveToAdjacentDroppable('right'),
  'Tab': () => this.#cancelKeyboardDrag(),
};
```

---

## Proposed File Structure (After Refactor)

```
lib/
├── core/
│   ├── drag-ref.ts                    (~500 LOC) NEW — framework-agnostic drag logic
│   ├── keyboard-drag-handler.ts       (~200 LOC) NEW — keyboard drag orchestration
│   └── drag-event-registry.ts         (~100 LOC) NEW — global listener management
├── directives/
│   ├── draggable.directive.ts         (~350 LOC) SHRUNK — thin Angular adapter
│   ├── droppable.directive.ts         (373 LOC) unchanged
│   ├── droppable-group.directive.ts   (51 LOC) unchanged
│   ├── scrollable.directive.ts        (174 LOC) unchanged
│   └── virtual-for.directive.ts       (608 LOC) unchanged
├── services/
│   ├── drag-state.service.ts          (268 LOC) unchanged
│   ├── position-calculator.service.ts (301 LOC) unchanged
│   ├── auto-scroll.service.ts         (259 LOC) unchanged
│   ├── element-clone.service.ts       (221 LOC) unchanged
│   ├── keyboard-drag.service.ts       (147 LOC) unchanged
│   ├── drag-index-calculator.service.ts (186 LOC) unchanged
│   └── overlay-container.service.ts   (41 LOC) unchanged
└── ...
```

**Net effect:** The 1,017-LOC directive becomes a ~350-LOC directive + ~500-LOC DragRef + ~200-LOC KeyboardDragHandler. No file exceeds 600 LOC, and each has a single clear responsibility.

---

## Implementation Priority

| #   | Change                                               | Effort  | Value  | Do It?                     |
| --- | ---------------------------------------------------- | ------- | ------ | -------------------------- |
| 1   | Extract keyboard handling into `KeyboardDragHandler` | Small   | High   | **Yes — quick win**        |
| 2   | Eliminate duplicated key dispatch                    | Trivial | Medium | **Yes — do with #1**       |
| 3   | Extract `DragRef` for pointer logic                  | Medium  | High   | **Yes — core improvement** |
| 4   | Centralize global listeners (Registry)               | Small   | Medium | **Yes — do with #3**       |
| 5   | Virtual scroll strategy interface                    | Small   | Low    | **Later — when needed**    |

Recommended order: **#1 + #2 → #3 + #4 → #5**

---

## What NOT to Copy from CDK

1. **RxJS-based state** — CDK's `DragRef` uses RxJS Subjects for events. Signals are better for Angular 19+. Keep the signal architecture.
2. **Ref constructor injection** — CDK passes `NgZone`, `ViewportRuler`, `Renderer2` into Ref constructors. This makes Refs semi-Angular-coupled anyway. Use plain callbacks instead.
3. **Separate drag-drop and virtual scroll** — CDK has zero integration between these modules. The whole point of ngx-virtual-dnd is combining them. Don't separate what should be together.
4. **DragDrop factory service** — CDK has a `DragDrop` service just for creating Refs. It's deprecated. Skip it.
