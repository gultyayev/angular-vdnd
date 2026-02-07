/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  KeyboardDragHandler,
  KeyboardDragCallbacks,
  KeyboardDragDeps,
} from './keyboard-drag.handler';

jest.mock('@angular/core', () => {
  const actual = jest.requireActual('@angular/core');
  return {
    ...actual,
    afterNextRender: jest.fn(),
  };
});

describe('KeyboardDragHandler', () => {
  let handler: KeyboardDragHandler;
  let mockDragState: any;
  let mockKeyboardDrag: any;
  let mockPositionCalculator: any;
  let mockDragIndexCalculator: any;
  let mockElementClone: any;
  let mockNgZone: any;
  let mockEnvInjector: any;
  let mockCallbacks: KeyboardDragCallbacks;
  let mockContext: {
    element: HTMLElement;
    draggableId: string;
    groupName: string | null;
    data: unknown;
  };

  const createElement = (): HTMLElement => {
    const el = document.createElement('div');
    el.getBoundingClientRect = jest.fn().mockReturnValue({
      left: 100,
      top: 200,
      width: 200,
      height: 50,
    });
    return el;
  };

  beforeEach(() => {
    mockDragState = {
      sourceIndex: jest.fn().mockReturnValue(0),
      placeholderIndex: jest.fn().mockReturnValue(2),
      activeDroppableId: jest.fn().mockReturnValue('list-1'),
    };

    mockKeyboardDrag = {
      isActive: jest.fn().mockReturnValue(false),
      startKeyboardDrag: jest.fn(),
      completeKeyboardDrag: jest.fn(),
      cancelKeyboardDrag: jest.fn(),
      moveUp: jest.fn(),
      moveDown: jest.fn(),
      moveToDroppable: jest.fn(),
      targetIndex: jest.fn().mockReturnValue(0),
    };

    mockPositionCalculator = {
      getDroppableParent: jest.fn().mockReturnValue(createElement()),
      getDroppableId: jest.fn().mockReturnValue('list-1'),
      findAdjacentDroppable: jest.fn(),
    };

    mockDragIndexCalculator = {
      getTotalItemCount: jest.fn().mockReturnValue(5),
    };

    mockElementClone = {
      cloneElement: jest.fn().mockReturnValue(createElement()),
    };

    mockNgZone = {
      runOutsideAngular: jest.fn((fn: () => void) => fn()),
    };

    mockEnvInjector = {};

    mockCallbacks = {
      onDragStart: jest.fn(),
      onDragEnd: jest.fn(),
      getParentDroppableId: jest.fn().mockReturnValue('list-1'),
      calculateSourceIndex: jest.fn().mockReturnValue(0),
    };

    mockContext = {
      element: createElement(),
      draggableId: 'item-1',
      groupName: 'test-group',
      data: { name: 'Test' },
    };

    handler = new KeyboardDragHandler({
      dragState: mockDragState,
      keyboardDrag: mockKeyboardDrag,
      positionCalculator: mockPositionCalculator,
      dragIndexCalculator: mockDragIndexCalculator,
      elementClone: mockElementClone,
      ngZone: mockNgZone,
      envInjector: mockEnvInjector,
      callbacks: mockCallbacks,
      getContext: () => mockContext,
    } as KeyboardDragDeps);
  });

  afterEach(() => {
    handler.destroy();
  });

  describe('isActive', () => {
    it('should delegate to keyboardDrag.isActive', () => {
      mockKeyboardDrag.isActive.mockReturnValue(false);
      expect(handler.isActive()).toBe(false);

      mockKeyboardDrag.isActive.mockReturnValue(true);
      expect(handler.isActive()).toBe(true);
    });
  });

  describe('activate', () => {
    it('should start a keyboard drag', () => {
      handler.activate();

      expect(mockElementClone.cloneElement).toHaveBeenCalledWith(mockContext.element);
      expect(mockKeyboardDrag.startKeyboardDrag).toHaveBeenCalledWith(
        expect.objectContaining({
          draggableId: 'item-1',
          droppableId: 'list-1',
          element: mockContext.element,
          height: 50,
          width: 200,
          data: { name: 'Test' },
        }),
        0, // sourceIndex
        5, // totalItemCount
        'list-1', // droppableId
      );
    });

    it('should add document keydown listener', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      handler.activate();

      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      addSpy.mockRestore();
    });

    it('should emit drag start event', () => {
      handler.activate();

      expect(mockCallbacks.onDragStart).toHaveBeenCalledWith(
        expect.objectContaining({
          draggableId: 'item-1',
          droppableId: 'list-1',
          data: { name: 'Test' },
          position: { x: 100, y: 200 },
          sourceIndex: 0,
        }),
      );
    });

    it('should bail out if no group name', () => {
      mockContext.groupName = null;
      handler.activate();

      expect(mockKeyboardDrag.startKeyboardDrag).not.toHaveBeenCalled();
    });

    it('should bail out if no parent droppable', () => {
      mockPositionCalculator.getDroppableParent.mockReturnValue(null);
      handler.activate();

      expect(mockKeyboardDrag.startKeyboardDrag).not.toHaveBeenCalled();
    });

    it('should bail out if droppable has no ID', () => {
      mockPositionCalculator.getDroppableId.mockReturnValue(null);
      handler.activate();

      expect(mockKeyboardDrag.startKeyboardDrag).not.toHaveBeenCalled();
    });
  });

  describe('handleKey', () => {
    beforeEach(() => {
      mockKeyboardDrag.isActive.mockReturnValue(true);
    });

    const createKeyEvent = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key });
      jest.spyOn(event, 'preventDefault');
      return event;
    };

    it('should return false when not active', () => {
      mockKeyboardDrag.isActive.mockReturnValue(false);
      const event = createKeyEvent('ArrowUp');
      expect(handler.handleKey(event)).toBe(false);
    });

    it('should handle Space key (complete)', () => {
      const event = createKeyEvent(' ');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockKeyboardDrag.completeKeyboardDrag).toHaveBeenCalled();
    });

    it('should handle Enter key (complete)', () => {
      const event = createKeyEvent('Enter');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockKeyboardDrag.completeKeyboardDrag).toHaveBeenCalled();
    });

    it('should handle Escape key (cancel)', () => {
      const event = createKeyEvent('Escape');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockKeyboardDrag.cancelKeyboardDrag).toHaveBeenCalled();
    });

    it('should handle Tab key (cancel)', () => {
      const event = createKeyEvent('Tab');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockKeyboardDrag.cancelKeyboardDrag).toHaveBeenCalled();
    });

    it('should handle ArrowUp key', () => {
      const event = createKeyEvent('ArrowUp');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockKeyboardDrag.moveUp).toHaveBeenCalled();
    });

    it('should handle ArrowDown key', () => {
      const event = createKeyEvent('ArrowDown');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockKeyboardDrag.moveDown).toHaveBeenCalled();
    });

    it('should handle ArrowLeft key (cross-list)', () => {
      const adjacent = { element: createElement(), id: 'list-2', itemCount: 3 };
      mockPositionCalculator.findAdjacentDroppable.mockReturnValue(adjacent);

      const event = createKeyEvent('ArrowLeft');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(mockPositionCalculator.findAdjacentDroppable).toHaveBeenCalledWith(
        'list-1',
        'left',
        'test-group',
      );
      expect(mockKeyboardDrag.moveToDroppable).toHaveBeenCalledWith('list-2', 0, 3);
    });

    it('should handle ArrowRight key (cross-list)', () => {
      const adjacent = { element: createElement(), id: 'list-2', itemCount: 3 };
      mockPositionCalculator.findAdjacentDroppable.mockReturnValue(adjacent);

      const event = createKeyEvent('ArrowRight');
      const result = handler.handleKey(event);

      expect(result).toBe(true);
      expect(mockPositionCalculator.findAdjacentDroppable).toHaveBeenCalledWith(
        'list-1',
        'right',
        'test-group',
      );
    });

    it('should return false for unhandled keys', () => {
      const event = createKeyEvent('a');
      const result = handler.handleKey(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should clamp target index to new list size on cross-list move', () => {
      mockKeyboardDrag.targetIndex.mockReturnValue(10);
      const adjacent = { element: createElement(), id: 'list-2', itemCount: 3 };
      mockPositionCalculator.findAdjacentDroppable.mockReturnValue(adjacent);

      handler.handleKey(createKeyEvent('ArrowRight'));

      expect(mockKeyboardDrag.moveToDroppable).toHaveBeenCalledWith('list-2', 3, 3);
    });
  });

  describe('complete', () => {
    it('should emit drag end event with correct data', () => {
      mockDragState.sourceIndex.mockReturnValue(1);
      mockDragState.placeholderIndex.mockReturnValue(3);

      handler.complete();

      expect(mockCallbacks.onDragEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          draggableId: 'item-1',
          droppableId: 'list-1',
          cancelled: false,
          sourceIndex: 1,
          destinationIndex: 3,
        }),
      );
      expect(mockKeyboardDrag.completeKeyboardDrag).toHaveBeenCalled();
    });

    it('should remove document listener', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');
      handler.complete();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe('cancel', () => {
    it('should emit drag end event with cancelled=true', () => {
      mockDragState.sourceIndex.mockReturnValue(1);

      handler.cancel();

      expect(mockCallbacks.onDragEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          draggableId: 'item-1',
          cancelled: true,
          destinationIndex: null,
        }),
      );
      expect(mockKeyboardDrag.cancelKeyboardDrag).toHaveBeenCalled();
    });

    it('should remove document listener', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');
      handler.cancel();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    it('should remove document listener', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');
      handler.destroy();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe('cross-list movement', () => {
    beforeEach(() => {
      mockKeyboardDrag.isActive.mockReturnValue(true);
    });

    it('should not move if no current droppable', () => {
      mockDragState.activeDroppableId.mockReturnValue(null);

      handler.handleKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

      expect(mockPositionCalculator.findAdjacentDroppable).not.toHaveBeenCalled();
    });

    it('should not move if no group name', () => {
      mockContext.groupName = null;

      handler.handleKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

      expect(mockPositionCalculator.findAdjacentDroppable).not.toHaveBeenCalled();
    });

    it('should not move if no adjacent droppable found', () => {
      mockPositionCalculator.findAdjacentDroppable.mockReturnValue(null);

      handler.handleKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

      expect(mockKeyboardDrag.moveToDroppable).not.toHaveBeenCalled();
    });
  });

  describe('document listener lifecycle', () => {
    it('should add listener on activate and remove on complete', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      handler.activate();
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      handler.complete();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('should add listener on activate and remove on cancel', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      handler.activate();
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      handler.cancel();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('should add listener on activate and remove on destroy', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      handler.activate();
      handler.destroy();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
