import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CursorPosition, GrabOffset } from '../models/drag-drop.models';
import type { VirtualScrollStrategy } from '../models/virtual-scroll-strategy';
import { DragIndexCalculatorService } from './drag-index-calculator.service';
import { PositionCalculatorService } from './position-calculator.service';

class MockStrategy implements VirtualScrollStrategy {
  readonly #version = signal(0);
  readonly version = this.#version.asReadonly();
  readonly #itemCount: number;

  constructor(
    private readonly offsetMap: number[],
    private readonly indexAtOffset: (offset: number) => number,
    itemCount?: number,
  ) {
    this.#itemCount = itemCount ?? Math.max(0, offsetMap.length - 1);
  }

  getTotalHeight(itemCount: number): number {
    return itemCount * 50;
  }

  getFirstVisibleIndex(scrollTop: number): number {
    return Math.floor(scrollTop / 50);
  }

  getVisibleCount(startIndex: number, containerHeight: number): number {
    void startIndex;
    return Math.ceil(containerHeight / 50);
  }

  getOffsetForIndex(index: number): number {
    return this.offsetMap[index] ?? this.offsetMap[this.offsetMap.length - 1] ?? 0;
  }

  getItemHeight(index: number): number {
    void index;
    return 50;
  }

  setMeasuredHeight(key: unknown, height: number): void {
    void key;
    void height;
    // no-op for mock
  }

  setItemKeys(keys: unknown[]): void {
    void keys;
    // no-op for mock
  }

  setExcludedIndex(index: number | null): void {
    void index;
    // no-op for mock
  }

  findIndexAtOffset(offset: number): number {
    return this.indexAtOffset(offset);
  }

  getItemCount(): number {
    return this.#itemCount;
  }
}

describe('DragIndexCalculatorService', () => {
  let service: DragIndexCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DragIndexCalculatorService, PositionCalculatorService],
    });
    service = TestBed.inject(DragIndexCalculatorService);
  });

  function createDroppable(id: string, itemCount = 5, constrained = false): HTMLElement {
    const droppable = document.createElement('div');
    droppable.setAttribute('data-droppable-id', id);
    droppable.setAttribute('data-droppable-group', 'test-group');
    if (constrained) {
      droppable.setAttribute('data-constrain-to-container', '');
    }

    for (let i = 0; i < itemCount; i++) {
      const child = document.createElement('div');
      child.setAttribute('data-draggable-id', `item-${i}`);
      droppable.appendChild(child);
    }

    jest.spyOn(droppable, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 300,
      height: 500,
      top: 0,
      right: 300,
      bottom: 500,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    return droppable;
  }

  function calculateIndex(args: {
    strategy: VirtualScrollStrategy;
    position: CursorPosition;
    previousPosition?: CursorPosition | null;
    grabOffset: GrabOffset | null;
    draggedItemHeight: number;
    sourceDroppableId: string | null;
    sourceIndex: number | null;
    itemCount?: number;
    constrained?: boolean;
  }): number {
    const droppable = createDroppable('list-1', args.itemCount ?? 5, args.constrained ?? false);
    service.registerStrategy('list-1', args.strategy);

    return service.calculatePlaceholderIndex({
      droppableElement: droppable,
      position: args.position,
      previousPosition: args.previousPosition ?? null,
      grabOffset: args.grabOffset,
      draggedItemHeight: args.draggedItemHeight,
      sourceDroppableId: args.sourceDroppableId,
      sourceIndex: args.sourceIndex,
    }).index;
  }

  it('applies same-list +1 when strategy does not yet exclude source index', () => {
    const strategy = new MockStrategy([0, 50, 100, 150, 200, 250], (offset) =>
      Math.floor(offset / 50),
    );

    const index = calculateIndex({
      strategy,
      position: { x: 10, y: 100 }, // center = 125 -> visual index 2
      grabOffset: null,
      draggedItemHeight: 50,
      sourceDroppableId: 'list-1',
      sourceIndex: 1,
    });

    expect(index).toBe(3);
  });

  it('does not double-adjust when strategy already excludes source index', () => {
    const strategy = new MockStrategy([0, 50, 50, 100, 150, 200], (offset) => {
      if (offset < 50) return 0;
      if (offset < 100) return 2;
      if (offset < 150) return 3;
      if (offset < 200) return 4;
      return 5;
    });

    const index = calculateIndex({
      strategy,
      position: { x: 10, y: 100 }, // center = 125 -> logical index 3
      grabOffset: null,
      draggedItemHeight: 50,
      sourceDroppableId: 'list-1',
      sourceIndex: 1,
    });

    expect(index).toBe(3);
  });

  it('allows constrained drag with tall preview to drop at top and bottom edges', () => {
    const strategy = new MockStrategy(
      [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600],
      (offset) => Math.floor(offset / 50),
    );
    const draggedItemHeight = 240;
    const grabOffset = { x: 20, y: 120 };

    const topIndex = calculateIndex({
      strategy,
      position: { x: 20, y: 121 }, // clamped top: preview top = 1px
      grabOffset,
      draggedItemHeight,
      sourceDroppableId: null,
      sourceIndex: null,
      itemCount: 12,
      constrained: true,
    });

    const bottomIndex = calculateIndex({
      strategy,
      position: { x: 20, y: 379 }, // clamped bottom: preview bottom = 499px
      grabOffset,
      draggedItemHeight,
      sourceDroppableId: null,
      sourceIndex: null,
      itemCount: 12,
      constrained: true,
    });

    expect(topIndex).toBe(0);
    expect(bottomIndex).toBe(12);
  });

  it('uses preview bounds in constrained mode so tall items can move above short first item', () => {
    const itemHeight = 65;
    const offsets = [0, 65, 130, 195, 260, 325, 390, 455, 520, 585, 650, 715, 780];
    const strategy = new MockStrategy(offsets, (offset) => Math.floor(offset / itemHeight));
    const draggedItemHeight = 130;
    const grabOffset = { x: 20, y: 65 };

    const index = calculateIndex({
      strategy,
      position: { x: 20, y: 105 }, // preview top = 40, center = 105 (would be index 1 by center)
      grabOffset,
      draggedItemHeight,
      sourceDroppableId: null,
      sourceIndex: null,
      itemCount: 12,
      constrained: true,
    });

    expect(index).toBe(0);
  });

  it('uses top boundary when moving up with dynamic heights', () => {
    const itemHeight = 65;
    const offsets = [0, 65, 130, 195, 260, 325];
    const strategy = new MockStrategy(offsets, (offset) => Math.floor(offset / itemHeight));

    const index = calculateIndex({
      strategy,
      position: { x: 20, y: 105 }, // preview top = 40, center = 105
      previousPosition: { x: 20, y: 115 }, // moving up
      grabOffset: { x: 20, y: 65 },
      draggedItemHeight: 130,
      sourceDroppableId: null,
      sourceIndex: null,
      itemCount: 5,
      constrained: false,
    });

    expect(index).toBe(0);
  });

  it('uses bottom boundary when moving down with dynamic heights', () => {
    const strategy = new MockStrategy([0, 200, 260, 320], (offset) => {
      if (offset < 200) return 0;
      if (offset < 260) return 1;
      if (offset < 320) return 2;
      return 3;
    });

    const index = calculateIndex({
      strategy,
      position: { x: 20, y: 180 }, // preview top = 150, center = 180, bottom = 210
      previousPosition: { x: 20, y: 170 }, // moving down
      grabOffset: { x: 20, y: 30 },
      draggedItemHeight: 60,
      sourceDroppableId: null,
      sourceIndex: null,
      itemCount: 3,
      constrained: false,
    });

    expect(index).toBe(1);
  });

  it('uses registered strategy item count for direct virtualized lists', () => {
    const droppable = createDroppable('list-direct', 3);
    const strategy = new MockStrategy([0, 50, 100, 150], (offset) => Math.floor(offset / 50), 100);
    service.registerStrategy('list-direct', strategy);

    const totalCount = service.getTotalItemCount({
      droppableElement: droppable,
      isSameList: false,
      draggedItemHeight: 50,
    });

    expect(totalCount).toBe(100);
  });
});
