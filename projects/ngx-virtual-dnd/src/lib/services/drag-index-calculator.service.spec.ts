import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CursorPosition, GrabOffset } from '../models/drag-drop.models';
import type { VirtualScrollStrategy } from '../models/virtual-scroll-strategy';
import { DragIndexCalculatorService } from './drag-index-calculator.service';
import { PositionCalculatorService } from './position-calculator.service';

class MockStrategy implements VirtualScrollStrategy {
  readonly #version = signal(0);
  readonly version = this.#version.asReadonly();

  constructor(
    private readonly offsetMap: number[],
    private readonly indexAtOffset: (offset: number) => number,
  ) {}

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
}

describe('DragIndexCalculatorService', () => {
  let service: DragIndexCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DragIndexCalculatorService, PositionCalculatorService],
    });
    service = TestBed.inject(DragIndexCalculatorService);
  });

  function createDroppable(id: string, itemCount = 5): HTMLElement {
    const droppable = document.createElement('div');
    droppable.setAttribute('data-droppable-id', id);
    droppable.setAttribute('data-droppable-group', 'test-group');

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
    grabOffset: GrabOffset | null;
    draggedItemHeight: number;
    sourceDroppableId: string | null;
    sourceIndex: number | null;
  }): number {
    const droppable = createDroppable('list-1');
    service.registerStrategy('list-1', args.strategy);

    return service.calculatePlaceholderIndex({
      droppableElement: droppable,
      position: args.position,
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
});
