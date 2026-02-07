/* eslint-disable @typescript-eslint/no-explicit-any */
import { PointerDragHandler, PointerDragCallbacks, PointerDragDeps } from './pointer-drag.handler';

describe('PointerDragHandler', () => {
  let handler: PointerDragHandler;
  let mockNgZone: any;
  let mockCallbacks: PointerDragCallbacks;
  let mockContext: any;
  let isDragging: boolean;

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

  /** Create a MouseEvent with a real target element (JSDOM requires this). */
  const createMouseEvent = (
    type: string,
    x: number,
    y: number,
    button = 0,
    target?: HTMLElement,
  ): MouseEvent => {
    const event = new MouseEvent(type, {
      clientX: x,
      clientY: y,
      button,
      bubbles: true,
      cancelable: true,
    });
    if (target) {
      Object.defineProperty(event, 'target', { value: target });
    }
    return event;
  };

  /** Create a MouseEvent whose target is the draggable element itself. */
  const createMouseDown = (x: number, y: number, button = 0): MouseEvent =>
    createMouseEvent('mousedown', x, y, button, mockContext.element);

  const createTouchEvent = (
    type: string,
    x: number,
    y: number,
    target?: HTMLElement,
  ): TouchEvent => {
    const touch = { clientX: x, clientY: y } as Touch;
    const event = new TouchEvent(type, {
      touches: type === 'touchend' ? [] : [touch],
      changedTouches: [touch],
      bubbles: true,
      cancelable: true,
    });
    if (target) {
      Object.defineProperty(event, 'target', { value: target });
    }
    return event;
  };

  /** Create a TouchEvent whose target is the draggable element itself. */
  const createTouchStart = (x: number, y: number): TouchEvent =>
    createTouchEvent('touchstart', x, y, mockContext.element);

  beforeEach(() => {
    isDragging = false;

    mockNgZone = {
      runOutsideAngular: jest.fn((fn: () => void) => fn()),
    };

    mockCallbacks = {
      onDragStart: jest.fn(() => {
        isDragging = true;
      }),
      onDragMove: jest.fn(),
      onDragEnd: jest.fn(() => {
        isDragging = false;
      }),
      onPendingChange: jest.fn(),
      isDragging: jest.fn(() => isDragging),
    };

    mockContext = {
      element: createElement(),
      groupName: 'test-group',
      disabled: false,
      dragHandle: undefined,
      dragThreshold: 5,
      dragDelay: 0,
    };

    handler = new PointerDragHandler({
      ngZone: mockNgZone,
      callbacks: mockCallbacks,
      getContext: () => mockContext,
    } as PointerDragDeps);
  });

  afterEach(() => {
    handler.destroy();
    jest.restoreAllMocks();
  });

  describe('onPointerDown', () => {
    it('should ignore if disabled', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      mockContext.disabled = true;

      handler.onPointerDown(createMouseDown(150, 220), false);

      expect(addSpy).not.toHaveBeenCalled();
    });

    it('should ignore if no group name', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      mockContext.groupName = null;

      handler.onPointerDown(createMouseDown(150, 220), false);

      expect(addSpy).not.toHaveBeenCalled();
    });

    it('should ignore non-left mouse clicks', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');

      handler.onPointerDown(createMouseDown(150, 220, 2), false);

      expect(addSpy).not.toHaveBeenCalled();
    });

    it('should add document listeners for mouse events', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');

      handler.onPointerDown(createMouseDown(150, 220), false);

      expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should add document listeners for touch events', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');

      handler.onPointerDown(createTouchStart(150, 220), true);

      expect(addSpy).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        expect.objectContaining({ passive: false }),
      );
      expect(addSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function));
    });

    it('should prevent default for mouse events', () => {
      const event = createMouseDown(150, 220);
      const preventSpy = jest.spyOn(event, 'preventDefault');

      handler.onPointerDown(event, false);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('should NOT prevent default for touch events with delay', () => {
      mockContext.dragDelay = 200;
      const event = createTouchStart(150, 220);
      const preventSpy = jest.spyOn(event, 'preventDefault');

      handler.onPointerDown(event, true);

      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('should prevent default for touch events without delay', () => {
      const event = createTouchStart(150, 220);
      const preventSpy = jest.spyOn(event, 'preventDefault');

      handler.onPointerDown(event, true);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('should store start position', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      expect(handler.getStartPosition()).toEqual({ x: 150, y: 220 });
    });

    it('should ignore clicks on interactive elements', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      const button = document.createElement('button');
      mockContext.element.appendChild(button);

      const event = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 220,
        button: 0,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: button });

      handler.onPointerDown(event, false);

      expect(addSpy).not.toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should ignore clicks on no-drag class elements', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      const noDragEl = document.createElement('div');
      noDragEl.classList.add('no-drag');
      mockContext.element.appendChild(noDragEl);

      const event = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 220,
        button: 0,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: noDragEl });

      handler.onPointerDown(event, false);

      expect(addSpy).not.toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should check drag handle', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      mockContext.dragHandle = '.handle';
      const contentEl = document.createElement('span');
      contentEl.className = 'content';
      mockContext.element.appendChild(contentEl);

      const event = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 220,
        button: 0,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: contentEl });

      handler.onPointerDown(event, false);

      expect(addSpy).not.toHaveBeenCalledWith('mousemove', expect.any(Function));
    });
  });

  describe('threshold detection', () => {
    it('should not start drag when movement is below threshold', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Move less than threshold (5px)
      document.dispatchEvent(createMouseEvent('mousemove', 152, 221));

      expect(mockCallbacks.onDragStart).not.toHaveBeenCalled();
    });

    it('should start drag when movement exceeds threshold', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Move more than threshold (5px)
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));

      expect(mockCallbacks.onDragStart).toHaveBeenCalledWith({ x: 160, y: 220 });
    });
  });

  describe('drag delay', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockContext.dragDelay = 200;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should cancel drag if moved before delay fires', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Move past threshold before delay fires
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));

      expect(mockCallbacks.onDragStart).not.toHaveBeenCalled();
    });

    it('should emit pending change when delay fires', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      jest.advanceTimersByTime(200);

      expect(mockCallbacks.onPendingChange).toHaveBeenCalledWith(true);
    });

    it('should start drag after delay fires and movement exceeds threshold', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      jest.advanceTimersByTime(200);

      // Move past threshold after delay
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));

      expect(mockCallbacks.onDragStart).toHaveBeenCalledWith({ x: 160, y: 220 });
    });
  });

  describe('RAF throttling', () => {
    beforeEach(() => {
      jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 1;
      });
    });

    it('should throttle move callbacks through requestAnimationFrame', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Trigger drag start
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));

      expect(mockCallbacks.onDragStart).toHaveBeenCalled();

      // Subsequent move should go through RAF
      document.dispatchEvent(createMouseEvent('mousemove', 170, 230));

      expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
      expect(mockCallbacks.onDragMove).toHaveBeenCalledWith({ x: 170, y: 230 });
    });
  });

  describe('pointer up', () => {
    it('should end drag on pointer up while dragging', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Start drag
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));

      // Pointer up
      document.dispatchEvent(createMouseEvent('mouseup', 160, 220));

      expect(mockCallbacks.onDragEnd).toHaveBeenCalledWith(false);
    });

    it('should not end drag on pointer up if not dragging', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Pointer up without moving past threshold
      document.dispatchEvent(createMouseEvent('mouseup', 150, 220));

      expect(mockCallbacks.onDragEnd).not.toHaveBeenCalled();
    });
  });

  describe('escape key cancellation', () => {
    it('should cancel drag on Escape key', () => {
      jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 1;
      });
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Start drag
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(mockCallbacks.onDragEnd).toHaveBeenCalledWith(true);
    });

    it('should ignore non-Escape keys', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);

      // Start drag
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));

      // Press a non-Escape key
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

      // Should not have called onDragEnd yet (only onDragStart)
      expect(mockCallbacks.onDragEnd).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove all document listeners', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      handler.onPointerDown(createMouseDown(150, 220), false);
      handler.cleanup();

      expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should cancel pending RAF', () => {
      const cancelSpy = jest.spyOn(globalThis, 'cancelAnimationFrame');
      jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(42);

      handler.onPointerDown(createMouseDown(150, 220), false);

      // Start drag then trigger a move (which schedules RAF)
      document.dispatchEvent(createMouseEvent('mousemove', 160, 220));
      document.dispatchEvent(createMouseEvent('mousemove', 170, 230));

      handler.cleanup();

      expect(cancelSpy).toHaveBeenCalled();
    });

    it('should reset start position', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);
      expect(handler.getStartPosition()).toEqual({ x: 150, y: 220 });

      handler.cleanup();
      expect(handler.getStartPosition()).toBeNull();
    });

    it('should clear pending state', () => {
      handler.cleanup();
      expect(mockCallbacks.onPendingChange).toHaveBeenCalledWith(false);
    });
  });

  describe('destroy', () => {
    it('should call cleanup', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      handler.onPointerDown(createMouseDown(150, 220), false);
      handler.destroy();

      expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });
  });

  describe('getStartPosition', () => {
    it('should return null before any pointer down', () => {
      expect(handler.getStartPosition()).toBeNull();
    });

    it('should return the position after pointer down', () => {
      handler.onPointerDown(createMouseDown(150, 220), false);
      expect(handler.getStartPosition()).toEqual({ x: 150, y: 220 });
    });

    it('should return correct position for touch events', () => {
      handler.onPointerDown(createTouchStart(100, 300), true);
      expect(handler.getStartPosition()).toEqual({ x: 100, y: 300 });
    });
  });
});
