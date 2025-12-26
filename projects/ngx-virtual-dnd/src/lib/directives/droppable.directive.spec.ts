import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DroppableDirective } from './droppable.directive';
import { DragStateService } from '../services/drag-state.service';
import { AutoScrollService, AutoScrollConfig } from '../services/auto-scroll.service';
import { PositionCalculatorService } from '../services/position-calculator.service';
import {
  DragEnterEvent,
  DragLeaveEvent,
  DragOverEvent,
  DropEvent,
  DraggedItem,
} from '../models/drag-drop.models';

// Test host component
@Component({
  template: `
    <div
      vdndDroppable="test-list"
      vdndDroppableGroup="test-group"
      [vdndDroppableData]="listData"
      [disabled]="disabled()"
      [autoScrollEnabled]="autoScrollEnabled()"
      [autoScrollConfig]="autoScrollConfig()"
      style="height: 300px; overflow: auto;"
      (dragEnter)="onDragEnter($event)"
      (dragLeave)="onDragLeave($event)"
      (dragOver)="onDragOver($event)"
      (drop)="onDrop($event)">
      @for (item of items; track item.id) {
        <div
          [attr.data-draggable-id]="item.id"
          style="height: 50px;">
          {{ item.name }}
        </div>
      }
    </div>
  `,
  imports: [DroppableDirective],
})
class TestHostComponent {
  listData = { listId: 'list-1' };
  items = [
    { id: 'item-1', name: 'Item 1' },
    { id: 'item-2', name: 'Item 2' },
    { id: 'item-3', name: 'Item 3' },
  ];
  disabled = signal(false);
  autoScrollEnabled = signal(true);
  autoScrollConfig = signal<Partial<AutoScrollConfig>>({});

  dragEnterEvents: DragEnterEvent[] = [];
  dragLeaveEvents: DragLeaveEvent[] = [];
  dragOverEvents: DragOverEvent[] = [];
  dropEvents: DropEvent[] = [];

  onDragEnter(event: DragEnterEvent): void {
    this.dragEnterEvents.push(event);
  }

  onDragLeave(event: DragLeaveEvent): void {
    this.dragLeaveEvents.push(event);
  }

  onDragOver(event: DragOverEvent): void {
    this.dragOverEvents.push(event);
  }

  onDrop(event: DropEvent): void {
    this.dropEvents.push(event);
  }
}

describe('DroppableDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let droppableEl: DebugElement;
  let droppableNative: HTMLElement;
  let directive: DroppableDirective;
  let dragStateService: DragStateService;
  let autoScrollService: AutoScrollService;

  const createMockDraggedItem = (overrides?: Partial<DraggedItem>): DraggedItem => ({
    draggableId: 'item-1',
    droppableId: 'test-list',
    element: document.createElement('div'),
    height: 50,
    width: 200,
    data: { id: 'item-1', name: 'Item 1' },
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [DragStateService, AutoScrollService, PositionCalculatorService],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    droppableEl = fixture.debugElement.query(By.directive(DroppableDirective));
    droppableNative = droppableEl.nativeElement;
    directive = droppableEl.injector.get(DroppableDirective);
    dragStateService = TestBed.inject(DragStateService);
    autoScrollService = TestBed.inject(AutoScrollService);
  });

  afterEach(() => {
    dragStateService.endDrag();
    fixture.destroy();
  });

  describe('initialization', () => {
    it('should create the directive', () => {
      expect(directive).toBeTruthy();
    });

    it('should have data-droppable-id attribute', () => {
      expect(droppableNative.getAttribute('data-droppable-id')).toBe('test-list');
    });

    it('should have data-droppable-group attribute', () => {
      expect(droppableNative.getAttribute('data-droppable-group')).toBe('test-group');
    });

    it('should have vdnd-droppable class', () => {
      expect(droppableNative.classList.contains('vdnd-droppable')).toBe(true);
    });

    it('should not have vdnd-droppable-active class initially', () => {
      expect(droppableNative.classList.contains('vdnd-droppable-active')).toBe(false);
    });
  });

  describe('disabled state', () => {
    it('should have vdnd-droppable-disabled class when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(droppableNative.classList.contains('vdnd-droppable-disabled')).toBe(true);
    });

    it('should not be active when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      const item = createMockDraggedItem();
      dragStateService.startDrag(item);
      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: 'test-list',
        placeholderId: null,
        placeholderIndex: null,
      });
      fixture.detectChanges();

      expect(directive.isActive()).toBe(false);
      expect(droppableNative.classList.contains('vdnd-droppable-active')).toBe(false);

      dragStateService.endDrag();
    });
  });

  describe('isActive computed', () => {
    it('should return false when not dragging', () => {
      expect(directive.isActive()).toBe(false);
    });

    it('should return true when this droppable is active', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item);
      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: 'test-list',
        placeholderId: null,
        placeholderIndex: null,
      });
      fixture.detectChanges();

      expect(directive.isActive()).toBe(true);

      dragStateService.endDrag();
    });

    it('should return false when different droppable is active', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item);
      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: 'other-list',
        placeholderId: null,
        placeholderIndex: null,
      });
      fixture.detectChanges();

      expect(directive.isActive()).toBe(false);

      dragStateService.endDrag();
    });
  });

  describe('active state class', () => {
    it('should add vdnd-droppable-active class when active', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item);
      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: 'test-list',
        placeholderId: null,
        placeholderIndex: null,
      });
      fixture.detectChanges();

      expect(droppableNative.classList.contains('vdnd-droppable-active')).toBe(true);

      dragStateService.endDrag();
    });

    it('should remove vdnd-droppable-active class when inactive', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item);
      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: 'test-list',
        placeholderId: null,
        placeholderIndex: null,
      });
      fixture.detectChanges();

      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: null,
        placeholderId: null,
        placeholderIndex: null,
      });
      fixture.detectChanges();

      expect(droppableNative.classList.contains('vdnd-droppable-active')).toBe(false);

      dragStateService.endDrag();
    });
  });

  describe('placeholderId computed', () => {
    it('should return null when not active', () => {
      expect(directive.placeholderId()).toBeNull();
    });

    it('should return placeholder ID when active', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item);
      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: 'test-list',
        placeholderId: 'item-2',
        placeholderIndex: 1,
      });
      fixture.detectChanges();

      expect(directive.placeholderId()).toBe('item-2');

      dragStateService.endDrag();
    });
  });

  describe('public methods', () => {
    it('getElement should return native element', () => {
      expect(directive.getElement()).toBe(droppableNative);
    });

    it('scrollBy should adjust scrollTop', () => {
      droppableNative.scrollTop = 0;
      directive.scrollBy(50);
      expect(droppableNative.scrollTop).toBe(50);
    });

    it('getScrollTop should return current scrollTop', () => {
      droppableNative.scrollTop = 100;
      expect(directive.getScrollTop()).toBe(100);
    });

    it('getScrollHeight should return scrollHeight', () => {
      expect(directive.getScrollHeight()).toBe(droppableNative.scrollHeight);
    });
  });

  describe('cleanup on destroy', () => {
    it('should cleanup without error', () => {
      expect(() => fixture.destroy()).not.toThrow();
    });

    it('should clear active droppable if destroyed while active', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item);
      dragStateService.updateDragPosition({
        cursorPosition: { x: 100, y: 100 },
        activeDroppableId: 'test-list',
        placeholderId: null,
        placeholderIndex: null,
      });
      fixture.detectChanges();

      expect(dragStateService.activeDroppableId()).toBe('test-list');

      fixture.destroy();

      expect(dragStateService.activeDroppableId()).toBeNull();

      dragStateService.endDrag();
    });
  });

  describe('auto-scroll integration', () => {
    it('should unregister from auto-scroll on destroy', () => {
      const unregisterSpy = jest.spyOn(autoScrollService, 'unregisterContainer');

      fixture.destroy();

      expect(unregisterSpy).toHaveBeenCalledWith('test-list');
    });
  });
});
