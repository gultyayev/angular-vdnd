import { TestBed } from '@angular/core/testing';
import { DragStateService } from './drag-state.service';
import {
  DraggedItem,
  CursorPosition,
  GrabOffset,
  INITIAL_DRAG_STATE,
} from '../models/drag-drop.models';

describe('DragStateService', () => {
  let service: DragStateService;

  const createMockDraggedItem = (overrides?: Partial<DraggedItem>): DraggedItem => ({
    draggableId: 'item-1',
    droppableId: 'list-1',
    element: document.createElement('div'),
    height: 50,
    width: 200,
    data: { name: 'Test Item' },
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DragStateService);
  });

  afterEach(() => {
    // Ensure clean state for next test
    service.endDrag();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have isDragging as false initially', () => {
      expect(service.isDragging()).toBe(false);
    });

    it('should have draggedItem as null initially', () => {
      expect(service.draggedItem()).toBeNull();
    });

    it('should have draggedItemId as null initially', () => {
      expect(service.draggedItemId()).toBeNull();
    });

    it('should have sourceDroppableId as null initially', () => {
      expect(service.sourceDroppableId()).toBeNull();
    });

    it('should have sourceIndex as null initially', () => {
      expect(service.sourceIndex()).toBeNull();
    });

    it('should have activeDroppableId as null initially', () => {
      expect(service.activeDroppableId()).toBeNull();
    });

    it('should have placeholderId as null initially', () => {
      expect(service.placeholderId()).toBeNull();
    });

    it('should have placeholderIndex as null initially', () => {
      expect(service.placeholderIndex()).toBeNull();
    });

    it('should have cursorPosition as null initially', () => {
      expect(service.cursorPosition()).toBeNull();
    });

    it('should have grabOffset as null initially', () => {
      expect(service.grabOffset()).toBeNull();
    });

    it('should have initialPosition as null initially', () => {
      expect(service.initialPosition()).toBeNull();
    });

    it('should have lockAxis as null initially', () => {
      expect(service.lockAxis()).toBeNull();
    });

    it('should match INITIAL_DRAG_STATE', () => {
      expect(service.state()).toEqual(INITIAL_DRAG_STATE);
    });
  });

  describe('startDrag', () => {
    it('should set isDragging to true', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);
      expect(service.isDragging()).toBe(true);
    });

    it('should set draggedItem', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);
      expect(service.draggedItem()).toBe(item);
    });

    it('should set draggedItemId from item', () => {
      const item = createMockDraggedItem({ draggableId: 'test-id' });
      service.startDrag(item);
      expect(service.draggedItemId()).toBe('test-id');
    });

    it('should set sourceDroppableId from item.droppableId', () => {
      const item = createMockDraggedItem({ droppableId: 'source-list' });
      service.startDrag(item);
      expect(service.sourceDroppableId()).toBe('source-list');
    });

    it('should set initialPosition when provided', () => {
      const item = createMockDraggedItem();
      const position: CursorPosition = { x: 100, y: 200 };
      service.startDrag(item, position);
      expect(service.initialPosition()).toEqual(position);
      expect(service.cursorPosition()).toEqual(position);
    });

    it('should set grabOffset when provided', () => {
      const item = createMockDraggedItem();
      const offset: GrabOffset = { x: 10, y: 20 };
      service.startDrag(item, undefined, offset);
      expect(service.grabOffset()).toEqual(offset);
    });

    it('should set lockAxis when provided', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, 'y');
      expect(service.lockAxis()).toBe('y');
    });

    it('should set activeDroppableId when provided', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, 'target-list');
      expect(service.activeDroppableId()).toBe('target-list');
    });

    it('should set placeholderId when provided', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, null, 'placeholder-id');
      expect(service.placeholderId()).toBe('placeholder-id');
    });

    it('should set placeholderIndex when provided', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, null, null, 5);
      expect(service.placeholderIndex()).toBe(5);
    });

    it('should set sourceIndex when provided', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, null, null, null, 3);
      expect(service.sourceIndex()).toBe(3);
    });

    it('should set all optional parameters at once', () => {
      const item = createMockDraggedItem();
      const position: CursorPosition = { x: 100, y: 200 };
      const offset: GrabOffset = { x: 10, y: 20 };

      service.startDrag(item, position, offset, 'x', 'list-2', 'item-5', 4, 2);

      expect(service.isDragging()).toBe(true);
      expect(service.draggedItem()).toBe(item);
      expect(service.cursorPosition()).toEqual(position);
      expect(service.initialPosition()).toEqual(position);
      expect(service.grabOffset()).toEqual(offset);
      expect(service.lockAxis()).toBe('x');
      expect(service.activeDroppableId()).toBe('list-2');
      expect(service.placeholderId()).toBe('item-5');
      expect(service.placeholderIndex()).toBe(4);
      expect(service.sourceIndex()).toBe(2);
    });
  });

  describe('updateDragPosition', () => {
    it('should not update if not dragging', () => {
      const update = {
        cursorPosition: { x: 100, y: 200 },
        activeDroppableId: 'list-1',
        placeholderId: 'item-1',
        placeholderIndex: 5,
      };

      service.updateDragPosition(update);

      expect(service.cursorPosition()).toBeNull();
      expect(service.activeDroppableId()).toBeNull();
    });

    it('should update cursorPosition when dragging', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      const newPosition = { x: 150, y: 250 };
      service.updateDragPosition({
        cursorPosition: newPosition,
        activeDroppableId: null,
        placeholderId: null,
        placeholderIndex: null,
      });

      expect(service.cursorPosition()).toEqual(newPosition);
    });

    it('should update activeDroppableId when dragging', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      service.updateDragPosition({
        cursorPosition: { x: 100, y: 200 },
        activeDroppableId: 'new-list',
        placeholderId: null,
        placeholderIndex: null,
      });

      expect(service.activeDroppableId()).toBe('new-list');
    });

    it('should update placeholderId when dragging', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      service.updateDragPosition({
        cursorPosition: { x: 100, y: 200 },
        activeDroppableId: 'list-1',
        placeholderId: 'target-item',
        placeholderIndex: null,
      });

      expect(service.placeholderId()).toBe('target-item');
    });

    it('should update placeholderIndex when dragging', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      service.updateDragPosition({
        cursorPosition: { x: 100, y: 200 },
        activeDroppableId: 'list-1',
        placeholderId: 'item-1',
        placeholderIndex: 7,
      });

      expect(service.placeholderIndex()).toBe(7);
    });

    it('should preserve other state when updating position', () => {
      const item = createMockDraggedItem();
      const offset: GrabOffset = { x: 10, y: 20 };
      service.startDrag(item, { x: 50, y: 50 }, offset, 'y', null, null, null, 3);

      service.updateDragPosition({
        cursorPosition: { x: 100, y: 200 },
        activeDroppableId: 'list-2',
        placeholderId: 'item-5',
        placeholderIndex: 5,
      });

      // These should be preserved
      expect(service.draggedItem()).toBe(item);
      expect(service.grabOffset()).toEqual(offset);
      expect(service.lockAxis()).toBe('y');
      expect(service.sourceIndex()).toBe(3);
      expect(service.initialPosition()).toEqual({ x: 50, y: 50 });
    });
  });

  describe('setActiveDroppable', () => {
    it('should not update if not dragging', () => {
      service.setActiveDroppable('new-list');
      expect(service.activeDroppableId()).toBeNull();
    });

    it('should update activeDroppableId when dragging', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      service.setActiveDroppable('new-list');
      expect(service.activeDroppableId()).toBe('new-list');
    });

    it('should allow setting to null', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, 'initial-list');

      service.setActiveDroppable(null);
      expect(service.activeDroppableId()).toBeNull();
    });
  });

  describe('setPlaceholder', () => {
    it('should not update if not dragging', () => {
      service.setPlaceholder('item-1');
      expect(service.placeholderId()).toBeNull();
    });

    it('should update placeholderId when dragging', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      service.setPlaceholder('target-item');
      expect(service.placeholderId()).toBe('target-item');
    });

    it('should allow setting to null', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, null, 'initial-placeholder');

      service.setPlaceholder(null);
      expect(service.placeholderId()).toBeNull();
    });
  });

  describe('endDrag', () => {
    it('should reset state to initial values', () => {
      const item = createMockDraggedItem();
      service.startDrag(
        item,
        { x: 100, y: 200 },
        { x: 10, y: 20 },
        'x',
        'list-1',
        'item-5',
        5,
        2
      );

      service.endDrag();

      expect(service.state()).toEqual(INITIAL_DRAG_STATE);
    });

    it('should set isDragging to false', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      service.endDrag();

      expect(service.isDragging()).toBe(false);
    });

    it('should set all properties to null', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, { x: 100, y: 200 });

      service.endDrag();

      expect(service.draggedItem()).toBeNull();
      expect(service.draggedItemId()).toBeNull();
      expect(service.sourceDroppableId()).toBeNull();
      expect(service.sourceIndex()).toBeNull();
      expect(service.activeDroppableId()).toBeNull();
      expect(service.placeholderId()).toBeNull();
      expect(service.placeholderIndex()).toBeNull();
      expect(service.cursorPosition()).toBeNull();
      expect(service.grabOffset()).toBeNull();
      expect(service.initialPosition()).toBeNull();
      expect(service.lockAxis()).toBeNull();
    });
  });

  describe('cancelDrag', () => {
    it('should reset state to initial values (same as endDrag)', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, { x: 100, y: 200 });

      service.cancelDrag();

      expect(service.state()).toEqual(INITIAL_DRAG_STATE);
    });

    it('should set isDragging to false', () => {
      const item = createMockDraggedItem();
      service.startDrag(item);

      service.cancelDrag();

      expect(service.isDragging()).toBe(false);
    });
  });

  describe('isDroppableActive', () => {
    it('should return false when not dragging', () => {
      expect(service.isDroppableActive('list-1')).toBe(false);
    });

    it('should return false when droppable is not active', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, 'list-1');

      expect(service.isDroppableActive('list-2')).toBe(false);
    });

    it('should return true when droppable is active', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, 'list-1');

      expect(service.isDroppableActive('list-1')).toBe(true);
    });

    it('should track active droppable changes', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, undefined, undefined, null, 'list-1');

      expect(service.isDroppableActive('list-1')).toBe(true);
      expect(service.isDroppableActive('list-2')).toBe(false);

      service.setActiveDroppable('list-2');

      expect(service.isDroppableActive('list-1')).toBe(false);
      expect(service.isDroppableActive('list-2')).toBe(true);
    });
  });

  describe('getStateSnapshot', () => {
    it('should return current state', () => {
      expect(service.getStateSnapshot()).toEqual(INITIAL_DRAG_STATE);
    });

    it('should return complete state when dragging', () => {
      const item = createMockDraggedItem();
      const position: CursorPosition = { x: 100, y: 200 };
      const offset: GrabOffset = { x: 10, y: 20 };

      service.startDrag(item, position, offset, 'y', 'list-1', 'item-3', 3, 1);

      const snapshot = service.getStateSnapshot();

      expect(snapshot.isDragging).toBe(true);
      expect(snapshot.draggedItem).toBe(item);
      expect(snapshot.sourceDroppableId).toBe('list-1');
      expect(snapshot.sourceIndex).toBe(1);
      expect(snapshot.activeDroppableId).toBe('list-1');
      expect(snapshot.placeholderId).toBe('item-3');
      expect(snapshot.placeholderIndex).toBe(3);
      expect(snapshot.cursorPosition).toEqual(position);
      expect(snapshot.grabOffset).toEqual(offset);
      expect(snapshot.initialPosition).toEqual(position);
      expect(snapshot.lockAxis).toBe('y');
    });

    it('should return a reference to the current state (not a copy)', () => {
      const snapshot1 = service.getStateSnapshot();
      const snapshot2 = service.getStateSnapshot();
      expect(snapshot1).toBe(snapshot2);
    });
  });

  describe('computed signals', () => {
    it('should update draggedItemId when draggedItem changes', () => {
      expect(service.draggedItemId()).toBeNull();

      const item = createMockDraggedItem({ draggableId: 'unique-id' });
      service.startDrag(item);

      expect(service.draggedItemId()).toBe('unique-id');

      service.endDrag();

      expect(service.draggedItemId()).toBeNull();
    });

    it('should derive all signals from single state source', () => {
      const item = createMockDraggedItem();
      service.startDrag(item, { x: 100, y: 200 }, { x: 10, y: 20 }, 'x', 'list-1', 'item-2', 2, 1);

      // All signals should reflect the state
      const state = service.state();
      expect(service.isDragging()).toBe(state.isDragging);
      expect(service.draggedItem()).toBe(state.draggedItem);
      expect(service.sourceDroppableId()).toBe(state.sourceDroppableId);
      expect(service.sourceIndex()).toBe(state.sourceIndex);
      expect(service.activeDroppableId()).toBe(state.activeDroppableId);
      expect(service.placeholderId()).toBe(state.placeholderId);
      expect(service.placeholderIndex()).toBe(state.placeholderIndex);
      expect(service.cursorPosition()).toBe(state.cursorPosition);
      expect(service.grabOffset()).toBe(state.grabOffset);
      expect(service.initialPosition()).toBe(state.initialPosition);
      expect(service.lockAxis()).toBe(state.lockAxis);
    });
  });
});
