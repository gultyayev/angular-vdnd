import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { AutoScrollService, AutoScrollConfig } from './auto-scroll.service';
import { DragStateService } from './drag-state.service';
import { PositionCalculatorService } from './position-calculator.service';

/**
 * Mock requestAnimationFrame to give synchronous control of the tick loop.
 * Each call to `flushRAF()` fires all pending callbacks.
 */
let rafCallbacks = new Map<number, FrameRequestCallback>();
let rafIdCounter = 0;

function mockRAF(cb: FrameRequestCallback): number {
  const id = ++rafIdCounter;
  rafCallbacks.set(id, cb);
  return id;
}

function mockCancelRAF(id: number): void {
  rafCallbacks.delete(id);
}

function flushRAF(): void {
  // Drain the current batch (callbacks may schedule new ones)
  const batch = new Map(rafCallbacks);
  rafCallbacks.clear();
  for (const cb of batch.values()) {
    cb(performance.now());
  }
}

function pendingRAFCount(): number {
  return rafCallbacks.size;
}

describe('AutoScrollService', () => {
  let service: AutoScrollService;
  let dragStateService: DragStateService;
  let mockElement: HTMLElement;

  // Save originals
  const originalRAF = globalThis.requestAnimationFrame;
  const originalCancelRAF = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    // Install RAF mock
    rafCallbacks = new Map();
    rafIdCounter = 0;
    globalThis.requestAnimationFrame = mockRAF as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = mockCancelRAF;

    TestBed.configureTestingModule({
      providers: [AutoScrollService, DragStateService, PositionCalculatorService],
    });
    service = TestBed.inject(AutoScrollService);
    dragStateService = TestBed.inject(DragStateService);

    // Create a mock scrollable element with real-ish scroll properties
    mockElement = document.createElement('div');
    Object.defineProperty(mockElement, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(mockElement, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(mockElement, 'scrollWidth', { value: 400, configurable: true });
    Object.defineProperty(mockElement, 'clientWidth', { value: 200, configurable: true });

    // scrollTop / scrollLeft need to be writable so += works
    let scrollTopVal = 200;
    Object.defineProperty(mockElement, 'scrollTop', {
      get: () => scrollTopVal,
      set: (v: number) => {
        scrollTopVal = v;
      },
      configurable: true,
    });
    let scrollLeftVal = 0;
    Object.defineProperty(mockElement, 'scrollLeft', {
      get: () => scrollLeftVal,
      set: (v: number) => {
        scrollLeftVal = v;
      },
      configurable: true,
    });

    // Container rect: top=100, bottom=500, left=50, right=250
    mockElement.getBoundingClientRect = jest.fn().mockReturnValue({
      top: 100,
      bottom: 500,
      left: 50,
      right: 250,
      height: 400,
      width: 200,
    });
  });

  afterEach(() => {
    service.stopMonitoring();
    service.unregisterContainer('test-container');
    dragStateService.endDrag();
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCancelRAF;
  });

  /** Helper: put the service into a dragging state with the given cursor position. */
  function setupDrag(cursor: { x: number; y: number }): void {
    dragStateService.startDrag(
      {
        draggableId: 'item-1',
        droppableId: 'list-1',
        element: document.createElement('div'),
        height: 50,
        width: 200,
      },
      cursor,
    );
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // registerContainer / unregisterContainer
  // ---------------------------------------------------------------------------
  describe('registerContainer', () => {
    it('should register a container that is used for scrolling', () => {
      // Cursor near bottom edge (y=480, threshold default=50, bottom=500)
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF(); // one tick

      expect(mockElement.scrollTop).toBeGreaterThan(before);
    });

    it('should register with custom config that affects scroll behavior', () => {
      // Custom threshold of 10 — cursor at y=480 is 20px from bottom edge
      // With threshold=10 the cursor is NOT near the edge, so no scroll
      const config: Partial<AutoScrollConfig> = { threshold: 10 };
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement, config);
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBe(before);
    });

    it('should allow registering multiple containers independently', () => {
      const element2 = document.createElement('div');
      Object.defineProperty(element2, 'scrollHeight', { value: 800, configurable: true });
      Object.defineProperty(element2, 'clientHeight', { value: 300, configurable: true });
      let el2ScrollTop = 100;
      Object.defineProperty(element2, 'scrollTop', {
        get: () => el2ScrollTop,
        set: (v: number) => {
          el2ScrollTop = v;
        },
        configurable: true,
      });
      Object.defineProperty(element2, 'scrollWidth', { value: 200, configurable: true });
      Object.defineProperty(element2, 'clientWidth', { value: 200, configurable: true });
      // element2 is at y=600..900
      element2.getBoundingClientRect = jest.fn().mockReturnValue({
        top: 600,
        bottom: 900,
        left: 50,
        right: 250,
        height: 300,
        width: 200,
      });

      // Cursor inside element2's bottom edge (y=880, threshold 50, bottom=900)
      setupDrag({ x: 150, y: 880 });
      service.registerContainer('container-1', mockElement);
      service.registerContainer('container-2', element2);
      service.startMonitoring();

      const before1 = mockElement.scrollTop;
      const before2 = el2ScrollTop;
      flushRAF();

      // container-1 should not scroll (cursor is outside it)
      expect(mockElement.scrollTop).toBe(before1);
      // container-2 should scroll
      expect(el2ScrollTop).toBeGreaterThan(before2);
    });
  });

  describe('unregisterContainer', () => {
    it('should stop a container from being scrolled after unregistration', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.unregisterContainer('test-container');
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBe(before);
    });

    it('should handle unregistering non-existent container without error', () => {
      expect(() => service.unregisterContainer('non-existent')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // startMonitoring / stopMonitoring
  // ---------------------------------------------------------------------------
  describe('startMonitoring', () => {
    it('should start the RAF loop that continues while dragging', () => {
      setupDrag({ x: 150, y: 300 }); // active drag, cursor in center
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      // After start, at least one frame should be pending
      expect(pendingRAFCount()).toBeGreaterThanOrEqual(1);
      flushRAF(); // fires queued tick(s), which schedule more
      // Loop should still be alive
      expect(pendingRAFCount()).toBeGreaterThanOrEqual(1);
    });

    it('should only start once even if called multiple times', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      service.startMonitoring(); // second call should be no-op

      const before = mockElement.scrollTop;
      flushRAF();
      // Should only tick once (not double-speed scroll)
      const afterOne = mockElement.scrollTop;
      expect(afterOne).toBeGreaterThan(before);
      // Flush again to verify normal cadence
      flushRAF();
      const afterTwo = mockElement.scrollTop;
      const delta1 = afterOne - before;
      const delta2 = afterTwo - afterOne;
      // Both deltas should be roughly equal (same speed)
      expect(Math.abs(delta1 - delta2)).toBeLessThan(1);
    });

    it('should accept and store a callback that is invoked on scroll', () => {
      const callback = jest.fn();
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring(callback);

      flushRAF();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('stopMonitoring', () => {
    it('should cancel the RAF loop', () => {
      setupDrag({ x: 150, y: 300 });
      service.startMonitoring();
      const beforeStop = pendingRAFCount();
      expect(beforeStop).toBeGreaterThanOrEqual(1);

      service.stopMonitoring();
      // The service's own RAF should be cancelled (count decreases)
      expect(pendingRAFCount()).toBeLessThan(beforeStop);
    });

    it('should reset isScrolling to false', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(true);

      service.stopMonitoring();
      expect(service.isScrolling()).toBe(false);
    });

    it('should reset scroll direction to zero', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      service.stopMonitoring();
      const dir = service.getScrollDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('should handle stopping when not monitoring', () => {
      expect(() => service.stopMonitoring()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // isScrolling / getScrollDirection
  // ---------------------------------------------------------------------------
  describe('isScrolling', () => {
    it('should return false initially', () => {
      expect(service.isScrolling()).toBe(false);
    });

    it('should return true when scrolling near an edge', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(true);
    });

    it('should return false when cursor is in the center', () => {
      setupDrag({ x: 150, y: 300 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(false);
    });
  });

  describe('getScrollDirection', () => {
    it('should return zero direction initially', () => {
      const dir = service.getScrollDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('should return y=-1 when scrolling up', () => {
      // Cursor near top edge: y=120, top=100, threshold=50 => 20px from edge
      setupDrag({ x: 150, y: 120 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.getScrollDirection().y).toBe(-1);
    });

    it('should return y=1 when scrolling down', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.getScrollDirection().y).toBe(1);
    });

    it('should return x=-1 when scrolling left', () => {
      // Cursor near left edge: x=70, left=50, threshold=50 => 20px from edge
      // Need scrollLeft > 0 for left scroll to occur
      mockElement.scrollLeft = 100;
      setupDrag({ x: 70, y: 300 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.getScrollDirection().x).toBe(-1);
    });

    it('should return x=1 when scrolling right', () => {
      // Cursor near right edge: x=230, right=250, threshold=50 => 20px from edge
      // scrollWidth=400, clientWidth=200, so max scrollLeft=200, current=0
      setupDrag({ x: 230, y: 300 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.getScrollDirection().x).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-scroll behavior (tick loop + performScroll)
  // ---------------------------------------------------------------------------
  describe('auto-scroll behavior', () => {
    it('should stop monitoring automatically when drag ends', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF(); // scrolling active

      expect(service.isScrolling()).toBe(true);

      dragStateService.endDrag();
      flushRAF(); // tick detects !isDragging, calls stopMonitoring

      expect(service.isScrolling()).toBe(false);
    });

    it('should continue monitoring when cursor has no position yet', () => {
      // Start drag without cursor position
      dragStateService.startDrag({
        draggableId: 'item-1',
        droppableId: 'list-1',
        element: document.createElement('div'),
        height: 50,
        width: 200,
      });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      // Tick fires, but cursorPosition is null => schedules another frame
      flushRAF();
      expect(pendingRAFCount()).toBeGreaterThanOrEqual(1); // next frame is scheduled
      expect(service.isScrolling()).toBe(false);
    });

    it('should scroll the element scrollTop when cursor is near bottom edge', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBeGreaterThan(before);
    });

    it('should scroll the element scrollTop upward when cursor is near top edge', () => {
      setupDrag({ x: 150, y: 120 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const before = mockElement.scrollTop; // 200
      flushRAF();

      expect(mockElement.scrollTop).toBeLessThan(before);
    });

    it('should scroll horizontally when cursor is near right edge', () => {
      setupDrag({ x: 230, y: 300 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const before = mockElement.scrollLeft;
      flushRAF();

      expect(mockElement.scrollLeft).toBeGreaterThan(before);
    });

    it('should scroll horizontally left when cursor is near left edge', () => {
      mockElement.scrollLeft = 100;
      setupDrag({ x: 70, y: 300 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const before = mockElement.scrollLeft;
      flushRAF();

      expect(mockElement.scrollLeft).toBeLessThan(before);
    });

    it('should not scroll when cursor is in the center of the container', () => {
      setupDrag({ x: 150, y: 300 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const beforeTop = mockElement.scrollTop;
      const beforeLeft = mockElement.scrollLeft;
      flushRAF();

      expect(mockElement.scrollTop).toBe(beforeTop);
      expect(mockElement.scrollLeft).toBe(beforeLeft);
    });

    it('should reset scroll state when cursor moves from edge to center', () => {
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();
      expect(service.isScrolling()).toBe(true);

      // Move cursor to center
      dragStateService.updateDragPosition({
        cursorPosition: { x: 150, y: 300 },
        activeDroppableId: null,
        placeholderId: null,
        placeholderIndex: null,
      });
      flushRAF();

      expect(service.isScrolling()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Acceleration and speed
  // ---------------------------------------------------------------------------
  describe('scroll speed', () => {
    it('should scroll faster when cursor is closer to the edge', () => {
      // First: cursor 10px from bottom edge (fast)
      setupDrag({ x: 150, y: 490 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const start1 = mockElement.scrollTop;
      flushRAF();
      const delta1 = mockElement.scrollTop - start1;

      service.stopMonitoring();
      // Reset scrollTop
      mockElement.scrollTop = 200;

      // Second: cursor 40px from bottom edge (slow)
      dragStateService.updateDragPosition({
        cursorPosition: { x: 150, y: 460 },
        activeDroppableId: null,
        placeholderId: null,
        placeholderIndex: null,
      });
      service.startMonitoring();

      const start2 = mockElement.scrollTop;
      flushRAF();
      const delta2 = mockElement.scrollTop - start2;

      expect(delta1).toBeGreaterThan(delta2);
    });

    it('should not accelerate when accelerate is false', () => {
      const config: Partial<AutoScrollConfig> = { accelerate: false };
      setupDrag({ x: 150, y: 490 });
      service.registerContainer('test-container', mockElement, config);
      service.startMonitoring();

      const start1 = mockElement.scrollTop;
      flushRAF();
      const delta1 = mockElement.scrollTop - start1;

      service.stopMonitoring();
      mockElement.scrollTop = 200;

      dragStateService.updateDragPosition({
        cursorPosition: { x: 150, y: 460 },
        activeDroppableId: null,
        placeholderId: null,
        placeholderIndex: null,
      });
      service.startMonitoring();

      const start2 = mockElement.scrollTop;
      flushRAF();
      const delta2 = mockElement.scrollTop - start2;

      // Both should scroll at maxSpeed regardless of distance
      expect(delta1).toBe(delta2);
    });

    it('should respect custom maxSpeed', () => {
      const config: Partial<AutoScrollConfig> = { maxSpeed: 5, accelerate: false };
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement, config);
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop - before).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Boundary clamping
  // ---------------------------------------------------------------------------
  describe('boundary checking', () => {
    it('should not scroll past top boundary (scrollTop = 0)', () => {
      mockElement.scrollTop = 0;
      setupDrag({ x: 150, y: 120 }); // near top edge
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      flushRAF();

      expect(mockElement.scrollTop).toBe(0);
    });

    it('should not scroll past bottom boundary (scrollTop = max)', () => {
      // max = scrollHeight(1000) - clientHeight(400) = 600
      mockElement.scrollTop = 600;
      setupDrag({ x: 150, y: 480 }); // near bottom edge
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      flushRAF();

      expect(mockElement.scrollTop).toBe(600);
    });

    it('should not scroll left past 0', () => {
      mockElement.scrollLeft = 0;
      setupDrag({ x: 70, y: 300 }); // near left edge
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      flushRAF();

      expect(mockElement.scrollLeft).toBe(0);
    });

    it('should not scroll right past max scrollLeft', () => {
      // max = scrollWidth(400) - clientWidth(200) = 200
      mockElement.scrollLeft = 200;
      setupDrag({ x: 230, y: 300 }); // near right edge
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      flushRAF();

      expect(mockElement.scrollLeft).toBe(200);
    });

    it('should handle container with no scroll capability', () => {
      const nonScrollableElement = document.createElement('div');
      Object.defineProperty(nonScrollableElement, 'scrollHeight', {
        value: 100,
        configurable: true,
      });
      Object.defineProperty(nonScrollableElement, 'clientHeight', {
        value: 100,
        configurable: true,
      });
      Object.defineProperty(nonScrollableElement, 'scrollWidth', {
        value: 100,
        configurable: true,
      });
      Object.defineProperty(nonScrollableElement, 'clientWidth', {
        value: 100,
        configurable: true,
      });
      let nsScrollTop = 0;
      Object.defineProperty(nonScrollableElement, 'scrollTop', {
        get: () => nsScrollTop,
        set: (v: number) => {
          nsScrollTop = v;
        },
        configurable: true,
      });
      nonScrollableElement.getBoundingClientRect = jest.fn().mockReturnValue({
        top: 100,
        bottom: 200,
        left: 50,
        right: 150,
        height: 100,
        width: 100,
      });

      // Cursor near bottom edge of this non-scrollable container
      setupDrag({ x: 100, y: 190 });
      service.registerContainer('non-scrollable', nonScrollableElement);
      service.startMonitoring();
      flushRAF();

      // scrollTop=0, max=0, direction is down => should not scroll
      expect(nsScrollTop).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple containers
  // ---------------------------------------------------------------------------
  describe('multiple containers', () => {
    it('should only scroll the container that contains the cursor', () => {
      const element2 = document.createElement('div');
      Object.defineProperty(element2, 'scrollHeight', { value: 800, configurable: true });
      Object.defineProperty(element2, 'clientHeight', { value: 400, configurable: true });
      Object.defineProperty(element2, 'scrollWidth', { value: 200, configurable: true });
      Object.defineProperty(element2, 'clientWidth', { value: 200, configurable: true });
      let el2ScrollTop = 100;
      Object.defineProperty(element2, 'scrollTop', {
        get: () => el2ScrollTop,
        set: (v: number) => {
          el2ScrollTop = v;
        },
        configurable: true,
      });
      element2.getBoundingClientRect = jest.fn().mockReturnValue({
        top: 600,
        bottom: 1000,
        left: 50,
        right: 250,
        height: 400,
        width: 200,
      });

      // Cursor is inside container-1's bottom edge, not container-2
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('container-1', mockElement);
      service.registerContainer('container-2', element2);
      service.startMonitoring();

      const before1 = mockElement.scrollTop;
      const before2 = el2ScrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBeGreaterThan(before1);
      expect(el2ScrollTop).toBe(before2);

      service.unregisterContainer('container-2');
    });

    it('should stop after the first matching container (break)', () => {
      // Two containers that overlap (cursor inside both)
      const element2 = document.createElement('div');
      Object.defineProperty(element2, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(element2, 'clientHeight', { value: 400, configurable: true });
      Object.defineProperty(element2, 'scrollWidth', { value: 200, configurable: true });
      Object.defineProperty(element2, 'clientWidth', { value: 200, configurable: true });
      let el2ScrollTop = 200;
      Object.defineProperty(element2, 'scrollTop', {
        get: () => el2ScrollTop,
        set: (v: number) => {
          el2ScrollTop = v;
        },
        configurable: true,
      });
      // Same rect as mockElement so cursor is inside both
      element2.getBoundingClientRect = jest.fn().mockReturnValue({
        top: 100,
        bottom: 500,
        left: 50,
        right: 250,
        height: 400,
        width: 200,
      });

      setupDrag({ x: 150, y: 480 });
      service.registerContainer('container-1', mockElement);
      service.registerContainer('container-2', element2);
      service.startMonitoring();

      const before2 = el2ScrollTop;
      flushRAF();

      // Only container-1 should have scrolled (it was first in iteration order)
      expect(mockElement.scrollTop).toBeGreaterThan(200); // was 200
      expect(el2ScrollTop).toBe(before2);

      service.unregisterContainer('container-2');
    });
  });

  // ---------------------------------------------------------------------------
  // Callback invocation
  // ---------------------------------------------------------------------------
  describe('callback invocation', () => {
    it('should invoke callback when scroll occurs', () => {
      const callback = jest.fn();
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring(callback);

      // startMonitoring fires #tick synchronously (1 call), flushRAF fires another (2 calls)
      flushRAF();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should not invoke callback when no scroll occurs', () => {
      const callback = jest.fn();
      setupDrag({ x: 150, y: 300 }); // center, no edge
      service.registerContainer('test-container', mockElement);
      service.startMonitoring(callback);

      flushRAF();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear callback when monitoring stops', () => {
      const callback = jest.fn();
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring(callback);
      flushRAF();
      callback.mockClear();

      service.stopMonitoring();
      // Restart monitoring without callback, near edge again
      service.startMonitoring();
      flushRAF();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should invoke callback on every tick that causes scroll', () => {
      const callback = jest.fn();
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring(callback);
      // startMonitoring fires #tick synchronously — that's tick 1
      const afterStart = callback.mock.calls.length;

      flushRAF(); // tick 2
      flushRAF(); // tick 3
      flushRAF(); // tick 4

      // Each flushRAF fires exactly 1 additional tick
      expect(callback.mock.calls.length).toBe(afterStart + 3);
    });
  });

  // ---------------------------------------------------------------------------
  // NgZone integration
  // ---------------------------------------------------------------------------
  describe('NgZone integration', () => {
    it('should run tick outside Angular zone', () => {
      const ngZone = TestBed.inject(NgZone);
      const runOutsideAngularSpy = jest.spyOn(ngZone, 'runOutsideAngular');

      service.startMonitoring();

      expect(runOutsideAngularSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge detection directions
  // ---------------------------------------------------------------------------
  describe('edge detection', () => {
    it('should detect cursor near top edge and scroll up', () => {
      setupDrag({ x: 150, y: 120 }); // 20px from top (threshold=50)
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(true);
      expect(service.getScrollDirection().y).toBe(-1);
      expect(mockElement.scrollTop).toBeLessThan(200);
    });

    it('should detect cursor near bottom edge and scroll down', () => {
      setupDrag({ x: 150, y: 480 }); // 20px from bottom (threshold=50)
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(true);
      expect(service.getScrollDirection().y).toBe(1);
      expect(mockElement.scrollTop).toBeGreaterThan(200);
    });

    it('should detect cursor near left edge and scroll left', () => {
      mockElement.scrollLeft = 100;
      setupDrag({ x: 70, y: 300 }); // 20px from left (threshold=50)
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(true);
      expect(service.getScrollDirection().x).toBe(-1);
      expect(mockElement.scrollLeft).toBeLessThan(100);
    });

    it('should detect cursor near right edge and scroll right', () => {
      setupDrag({ x: 230, y: 300 }); // 20px from right (threshold=50)
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(true);
      expect(service.getScrollDirection().x).toBe(1);
      expect(mockElement.scrollLeft).toBeGreaterThan(0);
    });

    it('should not detect edge when cursor is in the center', () => {
      setupDrag({ x: 150, y: 300 });
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(false);
      expect(service.getScrollDirection().x).toBe(0);
      expect(service.getScrollDirection().y).toBe(0);
    });

    it('should respect custom threshold', () => {
      // Default threshold is 50, cursor at y=460 is 40px from bottom => scrolls
      // Custom threshold of 30 means cursor at y=460 is 40px from bottom => NOT within 30px
      const config: Partial<AutoScrollConfig> = { threshold: 30 };
      setupDrag({ x: 150, y: 460 });
      service.registerContainer('test-container', mockElement, config);
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(false);

      service.stopMonitoring();

      // But y=480 is 20px from bottom edge, within threshold of 30
      dragStateService.updateDragPosition({
        cursorPosition: { x: 150, y: 480 },
        activeDroppableId: null,
        placeholderId: null,
        placeholderIndex: null,
      });
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(true);
      expect(service.getScrollDirection().y).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // setCursorOverride
  // ---------------------------------------------------------------------------
  describe('setCursorOverride', () => {
    it('should use override cursor instead of DragState cursor for edge detection', () => {
      // DragState cursor is in the center (no scroll)
      setupDrag({ x: 150, y: 300 });
      service.registerContainer('test-container', mockElement);

      // Override cursor to near bottom edge (should trigger scroll)
      service.setCursorOverride({ x: 150, y: 480 });
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBeGreaterThan(before);
    });

    it('should fall back to DragState cursor when no override is set', () => {
      // DragState cursor is near bottom edge
      setupDrag({ x: 150, y: 480 });
      service.registerContainer('test-container', mockElement);
      // No setCursorOverride call
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBeGreaterThan(before);
    });

    it('should clear override on stopMonitoring', () => {
      // DragState cursor is in the center (no scroll)
      setupDrag({ x: 150, y: 300 });
      service.registerContainer('test-container', mockElement);

      // Override to near edge
      service.setCursorOverride({ x: 150, y: 480 });
      service.startMonitoring();
      flushRAF();
      expect(service.isScrolling()).toBe(true);

      // Stop clears override
      service.stopMonitoring();

      // Restart without override — should fall back to DragState center cursor
      service.startMonitoring();
      flushRAF();

      expect(service.isScrolling()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Cursor outside container
  // ---------------------------------------------------------------------------
  describe('cursor outside container', () => {
    it('should not scroll when cursor is above the container', () => {
      setupDrag({ x: 150, y: 50 }); // above container (top=100)
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBe(before);
      expect(service.isScrolling()).toBe(false);
    });

    it('should not scroll when cursor is below the container', () => {
      setupDrag({ x: 150, y: 550 }); // below container (bottom=500)
      service.registerContainer('test-container', mockElement);
      service.startMonitoring();

      const before = mockElement.scrollTop;
      flushRAF();

      expect(mockElement.scrollTop).toBe(before);
      expect(service.isScrolling()).toBe(false);
    });
  });
});
