import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DraggableDirective } from './draggable.directive';
import { DroppableDirective } from './droppable.directive';
import { DragStateService } from '../services/drag-state.service';
import { PositionCalculatorService } from '../services/position-calculator.service';
import { AutoScrollService } from '../services/auto-scroll.service';
import { ElementCloneService } from '../services/element-clone.service';
import { DragStartEvent, DragMoveEvent, DragEndEvent } from '../models/drag-drop.models';

// Test host component
@Component({
  template: `
    <div
      vdndDroppable="test-list"
      vdndDroppableGroup="test-group"
      style="height: 400px; overflow: auto;"
    >
      <div
        vdndDraggable="test-item"
        vdndDraggableGroup="test-group"
        [vdndDraggableData]="itemData"
        [disabled]="disabled()"
        [dragHandle]="dragHandle()"
        [dragThreshold]="dragThreshold()"
        [dragDelay]="dragDelay()"
        [lockAxis]="lockAxis()"
        style="height: 50px; width: 200px;"
        (dragStart)="onDragStart($event)"
        (dragMove)="onDragMove($event)"
        (dragEnd)="onDragEnd($event)"
      >
        <span class="handle">Handle</span>
        <span class="content">Content</span>
        <button>Button</button>
        <input type="text" />
      </div>
    </div>
  `,
  imports: [DraggableDirective, DroppableDirective],
})
class TestHostComponent {
  itemData = { id: 1, name: 'Test Item' };
  disabled = signal(false);
  dragHandle = signal<string | undefined>(undefined);
  dragThreshold = signal(5);
  dragDelay = signal(0);
  lockAxis = signal<'x' | 'y' | null>(null);

  dragStartEvents: DragStartEvent[] = [];
  dragMoveEvents: DragMoveEvent[] = [];
  dragEndEvents: DragEndEvent[] = [];

  onDragStart(event: DragStartEvent): void {
    this.dragStartEvents.push(event);
  }

  onDragMove(event: DragMoveEvent): void {
    this.dragMoveEvents.push(event);
  }

  onDragEnd(event: DragEndEvent): void {
    this.dragEndEvents.push(event);
  }
}

describe('DraggableDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let draggableEl: DebugElement;
  let draggableNative: HTMLElement;
  let directive: DraggableDirective;
  let dragStateService: DragStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        DragStateService,
        PositionCalculatorService,
        AutoScrollService,
        ElementCloneService,
      ],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    draggableEl = fixture.debugElement.query(By.directive(DraggableDirective));
    draggableNative = draggableEl.nativeElement;
    directive = draggableEl.injector.get(DraggableDirective);
    dragStateService = TestBed.inject(DragStateService);
  });

  afterEach(() => {
    dragStateService.endDrag();
    fixture.destroy();
  });

  describe('initialization', () => {
    it('should create the directive', () => {
      expect(directive).toBeTruthy();
    });

    it('should have data-draggable-id attribute', () => {
      expect(draggableNative.getAttribute('data-draggable-id')).toBe('test-item');
    });

    it('should have vdnd-draggable class', () => {
      expect(draggableNative.classList.contains('vdnd-draggable')).toBe(true);
    });

    it('should have tabindex 0 when not disabled', () => {
      expect(draggableNative.getAttribute('tabindex')).toBe('0');
    });

    it('should have aria-grabbed false initially', () => {
      expect(draggableNative.getAttribute('aria-grabbed')).toBe('false');
    });

    it('should not have vdnd-draggable-dragging class initially', () => {
      expect(draggableNative.classList.contains('vdnd-draggable-dragging')).toBe(false);
    });
  });

  describe('disabled state', () => {
    it('should have vdnd-draggable-disabled class when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(draggableNative.classList.contains('vdnd-draggable-disabled')).toBe(true);
    });

    it('should have tabindex -1 when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(draggableNative.getAttribute('tabindex')).toBe('-1');
    });

    it('should not start drag when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      const mousedown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
      });
      draggableNative.dispatchEvent(mousedown);

      expect(dragStateService.isDragging()).toBe(false);
    });
  });

  describe('mousedown handling', () => {
    it('should not start drag on right click', () => {
      const mousedown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 2, // Right click
        bubbles: true,
      });
      draggableNative.dispatchEvent(mousedown);

      expect(dragStateService.isDragging()).toBe(false);
    });

    it('should not start drag when clicking on button', () => {
      const button = draggableNative.querySelector('button')!;
      const mousedown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
      });
      button.dispatchEvent(mousedown);

      expect(dragStateService.isDragging()).toBe(false);
    });

    it('should not start drag when clicking on input', () => {
      const input = draggableNative.querySelector('input')!;
      const mousedown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
      });
      input.dispatchEvent(mousedown);

      expect(dragStateService.isDragging()).toBe(false);
    });

    it('should prevent default on mousedown', () => {
      const mousedown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
        cancelable: true,
      });
      draggableNative.dispatchEvent(mousedown);

      expect(mousedown.defaultPrevented).toBe(true);
    });
  });

  describe('drag handle', () => {
    beforeEach(() => {
      component.dragHandle.set('.handle');
      fixture.detectChanges();
    });

    it('should not start drag when clicking outside handle', () => {
      const content = draggableNative.querySelector('.content')!;
      const mousedown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
      });
      content.dispatchEvent(mousedown);

      expect(dragStateService.isDragging()).toBe(false);
    });
  });

  describe('isDragging computed', () => {
    it('should return false when not dragging', () => {
      expect(directive.isDragging()).toBe(false);
    });

    it('should return false when different element is dragged', () => {
      // Simulate another element being dragged
      dragStateService.startDrag({
        draggableId: 'other-item',
        droppableId: 'test-list',
        element: document.createElement('div'),
        height: 50,
        width: 200,
      });

      expect(directive.isDragging()).toBe(false);

      dragStateService.endDrag();
    });
  });

  describe('drag state via service', () => {
    it('should show dragging class when service indicates this item is dragged', () => {
      // Directly set drag state via service
      dragStateService.startDrag({
        draggableId: 'test-item',
        droppableId: 'test-list',
        element: draggableNative,
        height: 50,
        width: 200,
      });
      fixture.detectChanges();

      expect(directive.isDragging()).toBe(true);
      expect(draggableNative.classList.contains('vdnd-draggable-dragging')).toBe(true);

      dragStateService.endDrag();
    });

    it('should hide element when dragging (display: none)', () => {
      dragStateService.startDrag({
        draggableId: 'test-item',
        droppableId: 'test-list',
        element: draggableNative,
        height: 50,
        width: 200,
      });
      fixture.detectChanges();

      expect(draggableNative.style.display).toBe('none');

      dragStateService.endDrag();
    });

    it('should set aria-grabbed when dragging', () => {
      dragStateService.startDrag({
        draggableId: 'test-item',
        droppableId: 'test-list',
        element: draggableNative,
        height: 50,
        width: 200,
      });
      fixture.detectChanges();

      expect(draggableNative.getAttribute('aria-grabbed')).toBe('true');

      dragStateService.endDrag();
    });

    it('should remove dragging class after drag ends', () => {
      dragStateService.startDrag({
        draggableId: 'test-item',
        droppableId: 'test-list',
        element: draggableNative,
        height: 50,
        width: 200,
      });
      fixture.detectChanges();

      dragStateService.endDrag();
      fixture.detectChanges();

      expect(draggableNative.classList.contains('vdnd-draggable-dragging')).toBe(false);
    });

    it('should restore display after drag ends and drop transition completes', () => {
      dragStateService.startDrag({
        draggableId: 'test-item',
        droppableId: 'test-list',
        element: draggableNative,
        height: 50,
        width: 200,
      });
      fixture.detectChanges();

      dragStateService.endDrag();
      fixture.detectChanges();

      // Item stays hidden during drop-pending phase
      expect(draggableNative.style.display).toBe('none');

      // Simulate what DroppableDirective does after emitting drop event
      dragStateService.completeDropTransition();
      fixture.detectChanges();

      // Now the item should be visible
      expect(draggableNative.style.display).not.toBe('none');
    });
  });

  describe('axis locking input', () => {
    it('should accept null lockAxis', () => {
      component.lockAxis.set(null);
      fixture.detectChanges();
      // No error should occur
      expect(true).toBe(true);
    });

    it('should accept x lockAxis', () => {
      component.lockAxis.set('x');
      fixture.detectChanges();
      // No error should occur
      expect(true).toBe(true);
    });

    it('should accept y lockAxis', () => {
      component.lockAxis.set('y');
      fixture.detectChanges();
      // No error should occur
      expect(true).toBe(true);
    });
  });

  describe('keyboard handling', () => {
    it('should prevent default on space when not disabled', () => {
      const space = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      draggableNative.dispatchEvent(space);

      expect(space.defaultPrevented).toBe(true);
    });

    it('should not prevent default on space when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      const space = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      draggableNative.dispatchEvent(space);

      // When disabled, returns true which doesn't prevent default
      expect(space.defaultPrevented).toBe(false);
    });

    it('should handle escape when not dragging', () => {
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      // Should not throw
      expect(() => draggableNative.dispatchEvent(escape)).not.toThrow();
    });

    it('should cancel drag on escape when dragging', () => {
      dragStateService.startDrag({
        draggableId: 'test-item',
        droppableId: 'test-list',
        element: draggableNative,
        height: 50,
        width: 200,
      });
      fixture.detectChanges();

      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      draggableNative.dispatchEvent(escape);
      fixture.detectChanges();

      expect(dragStateService.isDragging()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on destroy without error', () => {
      expect(() => fixture.destroy()).not.toThrow();
    });
  });
});
