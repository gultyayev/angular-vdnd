import { TestBed } from '@angular/core/testing';
import { PositionCalculatorService } from './position-calculator.service';

describe('PositionCalculatorService', () => {
  let service: PositionCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PositionCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateDropIndex', () => {
    it('should calculate index 0 when cursor is at top of container', () => {
      const index = service.calculateDropIndex(
        0,    // scrollTop
        100,  // cursorY
        100,  // containerTop
        50,   // itemHeight
        10    // totalItems
      );
      expect(index).toBe(0);
    });

    it('should calculate correct index based on cursor position', () => {
      const index = service.calculateDropIndex(
        0,    // scrollTop
        200,  // cursorY (100px into content = 2 items)
        100,  // containerTop
        50,   // itemHeight
        10    // totalItems
      );
      expect(index).toBe(2);
    });

    it('should account for scroll offset', () => {
      const index = service.calculateDropIndex(
        100,  // scrollTop (scrolled down 2 items)
        150,  // cursorY (50px into viewport)
        100,  // containerTop
        50,   // itemHeight
        10    // totalItems
      );
      // relativeY = 150 - 100 + 100 = 150
      // index = floor(150 / 50) = 3
      expect(index).toBe(3);
    });

    it('should clamp index to 0 when cursor is above container', () => {
      const index = service.calculateDropIndex(
        0,    // scrollTop
        50,   // cursorY (above containerTop)
        100,  // containerTop
        50,   // itemHeight
        10    // totalItems
      );
      expect(index).toBe(0);
    });

    it('should clamp index to totalItems when cursor is below all items', () => {
      const index = service.calculateDropIndex(
        0,    // scrollTop
        700,  // cursorY (way below)
        100,  // containerTop
        50,   // itemHeight
        10    // totalItems
      );
      expect(index).toBe(10);
    });

    it('should handle edge case of very large scroll offset', () => {
      const index = service.calculateDropIndex(
        5000, // scrollTop
        150,  // cursorY
        100,  // containerTop
        50,   // itemHeight
        200   // totalItems
      );
      // relativeY = 150 - 100 + 5000 = 5050
      // index = floor(5050 / 50) = 101
      expect(index).toBe(101);
    });
  });

  describe('getNearEdge', () => {
    const containerRect = {
      top: 100,
      bottom: 500,
      left: 100,
      right: 600,
    } as DOMRect;

    it('should detect near top edge', () => {
      const result = service.getNearEdge({ x: 300, y: 120 }, containerRect, 50);
      expect(result.top).toBe(true);
      expect(result.bottom).toBe(false);
      expect(result.left).toBe(false);
      expect(result.right).toBe(false);
    });

    it('should detect near bottom edge', () => {
      const result = service.getNearEdge({ x: 300, y: 480 }, containerRect, 50);
      expect(result.top).toBe(false);
      expect(result.bottom).toBe(true);
      expect(result.left).toBe(false);
      expect(result.right).toBe(false);
    });

    it('should detect near left edge', () => {
      const result = service.getNearEdge({ x: 120, y: 300 }, containerRect, 50);
      expect(result.top).toBe(false);
      expect(result.bottom).toBe(false);
      expect(result.left).toBe(true);
      expect(result.right).toBe(false);
    });

    it('should detect near right edge', () => {
      const result = service.getNearEdge({ x: 580, y: 300 }, containerRect, 50);
      expect(result.top).toBe(false);
      expect(result.bottom).toBe(false);
      expect(result.left).toBe(false);
      expect(result.right).toBe(true);
    });

    it('should detect multiple edges (corner)', () => {
      const result = service.getNearEdge({ x: 120, y: 120 }, containerRect, 50);
      expect(result.top).toBe(true);
      expect(result.left).toBe(true);
      expect(result.bottom).toBe(false);
      expect(result.right).toBe(false);
    });

    it('should detect no edges when in center', () => {
      const result = service.getNearEdge({ x: 350, y: 300 }, containerRect, 50);
      expect(result.top).toBe(false);
      expect(result.bottom).toBe(false);
      expect(result.left).toBe(false);
      expect(result.right).toBe(false);
    });
  });

  describe('isInsideContainer', () => {
    const containerRect = {
      top: 100,
      bottom: 500,
      left: 100,
      right: 600,
    } as DOMRect;

    it('should return true when position is inside container', () => {
      expect(service.isInsideContainer({ x: 300, y: 300 }, containerRect)).toBe(true);
    });

    it('should return true when position is on edge', () => {
      expect(service.isInsideContainer({ x: 100, y: 100 }, containerRect)).toBe(true);
      expect(service.isInsideContainer({ x: 600, y: 500 }, containerRect)).toBe(true);
    });

    it('should return false when position is outside container (left)', () => {
      expect(service.isInsideContainer({ x: 50, y: 300 }, containerRect)).toBe(false);
    });

    it('should return false when position is outside container (right)', () => {
      expect(service.isInsideContainer({ x: 650, y: 300 }, containerRect)).toBe(false);
    });

    it('should return false when position is outside container (top)', () => {
      expect(service.isInsideContainer({ x: 300, y: 50 }, containerRect)).toBe(false);
    });

    it('should return false when position is outside container (bottom)', () => {
      expect(service.isInsideContainer({ x: 300, y: 550 }, containerRect)).toBe(false);
    });
  });

  describe('DOM element finding', () => {
    let container: HTMLElement;
    let droppable: HTMLElement;
    let draggable: HTMLElement;

    beforeEach(() => {
      // Set up test DOM
      container = document.createElement('div');
      droppable = document.createElement('div');
      droppable.setAttribute('data-droppable-id', 'test-droppable');
      droppable.setAttribute('data-droppable-group', 'test-group');

      draggable = document.createElement('div');
      draggable.setAttribute('data-draggable-id', 'test-draggable');

      droppable.appendChild(draggable);
      container.appendChild(droppable);
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should find droppable parent element', () => {
      const result = service.getDroppableParent(draggable, 'test-group');
      expect(result).toBe(droppable);
    });

    it('should return null if droppable not found', () => {
      const result = service.getDroppableParent(draggable, 'wrong-group');
      expect(result).toBeNull();
    });

    it('should find draggable parent element', () => {
      const inner = document.createElement('span');
      draggable.appendChild(inner);

      const result = service.getDraggableParent(inner);
      expect(result).toBe(draggable);
    });

    it('should return null if draggable not found', () => {
      const orphan = document.createElement('div');
      container.appendChild(orphan);

      const result = service.getDraggableParent(orphan);
      expect(result).toBeNull();
    });

    it('should get draggable ID from element', () => {
      const id = service.getDraggableId(draggable);
      expect(id).toBe('test-draggable');
    });

    it('should get droppable ID from element', () => {
      const id = service.getDroppableId(droppable);
      expect(id).toBe('test-droppable');
    });
  });
});
