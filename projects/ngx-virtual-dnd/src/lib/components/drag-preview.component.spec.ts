import { Component, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DragPreviewComponent, DragPreviewContext } from './drag-preview.component';
import { DragStateService } from '../services/drag-state.service';
import { CursorPosition, DraggedItem, GrabOffset } from '../models/drag-drop.models';

interface TestItemData {
  id: string;
  name: string;
}

// Test host for default/cloned element tests
@Component({
  template: ` <vdnd-drag-preview [cursorOffset]="cursorOffset" /> `,
  imports: [DragPreviewComponent],
})
class DefaultTestHostComponent {
  cursorOffset = { x: 8, y: 8 };
}

// Separate test host for custom template tests
@Component({
  template: `
    <ng-template #customTemplate let-data let-id="draggableId" let-droppableId="droppableId">
      <div class="custom-preview">
        <span class="preview-name">{{ data?.name }}</span>
        <span class="preview-id">{{ id }}</span>
      </div>
    </ng-template>

    <vdnd-drag-preview [previewTemplate]="customTemplate" [cursorOffset]="cursorOffset" />
  `,
  imports: [DragPreviewComponent],
})
class CustomTemplateTestHostComponent {
  readonly customTemplate =
    viewChild.required<TemplateRef<DragPreviewContext<TestItemData>>>('customTemplate');
  cursorOffset = { x: 8, y: 8 };
}

describe('DragPreviewComponent', () => {
  const createMockDraggedItem = (overrides?: Partial<DraggedItem>): DraggedItem => {
    const element = document.createElement('div');
    element.innerHTML = 'Original Element';

    const clonedElement = document.createElement('div');
    clonedElement.innerHTML = 'Cloned Element';
    clonedElement.className = 'cloned-content';

    return {
      draggableId: 'item-1',
      droppableId: 'list-1',
      element,
      clonedElement,
      height: 50,
      width: 200,
      data: { id: 'item-1', name: 'Test Item' } as TestItemData,
      ...overrides,
    };
  };

  describe('with default template', () => {
    let fixture: ComponentFixture<DefaultTestHostComponent>;
    let dragStateService: DragStateService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [DefaultTestHostComponent],
        providers: [DragStateService],
      });

      fixture = TestBed.createComponent(DefaultTestHostComponent);
      dragStateService = TestBed.inject(DragStateService);
      fixture.detectChanges();
      fixture.detectChanges();
    });

    afterEach(() => {
      dragStateService.endDrag();
      fixture.destroy();
    });

    describe('visibility', () => {
      it('should not be visible when not dragging', () => {
        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview).toBeNull();
      });

      it('should be visible when dragging', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview).not.toBeNull();
      });

      it('should not be visible when dragging but cursor position is null', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item);
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview).toBeNull();
      });

      it('should become hidden when drag ends', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        let preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview).not.toBeNull();

        dragStateService.endDrag();
        fixture.detectChanges();
        fixture.detectChanges();

        preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview).toBeNull();
      });
    });

    describe('positioning', () => {
      it('should position based on cursor and grab offset', () => {
        const item = createMockDraggedItem();
        const cursorPosition: CursorPosition = { x: 150, y: 200 };
        const grabOffset: GrabOffset = { x: 10, y: 20 };

        dragStateService.startDrag(item, cursorPosition, grabOffset);
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.left).toBe('140px');
        expect(preview.nativeElement.style.top).toBe('180px');
      });

      it('should use default cursorOffset when no grab offset', () => {
        // Default cursorOffset is { x: 8, y: 8 }
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 }); // No grab offset
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        // Should use default cursorOffset input: (100-8, 100-8) = (92, 92)
        expect(preview.nativeElement.style.left).toBe('92px');
        expect(preview.nativeElement.style.top).toBe('92px');
      });

      it('should update position when cursor moves', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 }, { x: 0, y: 0 });
        fixture.detectChanges();
        fixture.detectChanges();

        let preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.left).toBe('100px');

        dragStateService.updateDragPosition({
          cursorPosition: { x: 200, y: 200 },
          activeDroppableId: null,
          placeholderId: null,
          placeholderIndex: null,
        });
        fixture.detectChanges();
        fixture.detectChanges();

        preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.left).toBe('200px');
        expect(preview.nativeElement.style.top).toBe('200px');
      });
    });

    describe('axis locking', () => {
      it('should lock x axis when configured', () => {
        const item = createMockDraggedItem();
        const initialPosition = { x: 100, y: 100 };
        const grabOffset = { x: 0, y: 0 };

        dragStateService.startDrag(item, initialPosition, grabOffset, 'x');
        fixture.detectChanges();
        fixture.detectChanges();

        dragStateService.updateDragPosition({
          cursorPosition: { x: 200, y: 200 },
          activeDroppableId: null,
          placeholderId: null,
          placeholderIndex: null,
        });
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.left).toBe('100px');
        expect(preview.nativeElement.style.top).toBe('200px');
      });

      it('should lock y axis when configured', () => {
        const item = createMockDraggedItem();
        const initialPosition = { x: 100, y: 100 };
        const grabOffset = { x: 0, y: 0 };

        dragStateService.startDrag(item, initialPosition, grabOffset, 'y');
        fixture.detectChanges();
        fixture.detectChanges();

        dragStateService.updateDragPosition({
          cursorPosition: { x: 200, y: 200 },
          activeDroppableId: null,
          placeholderId: null,
          placeholderIndex: null,
        });
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.left).toBe('200px');
        expect(preview.nativeElement.style.top).toBe('100px');
      });
    });

    describe('dimensions', () => {
      it('should use dragged item dimensions', () => {
        const item = createMockDraggedItem({ width: 250, height: 75 });
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.width).toBe('250px');
        expect(preview.nativeElement.style.height).toBe('75px');
      });
    });

    describe('styling', () => {
      it('should have fixed position', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.position).toBe('fixed');
      });

      it('should have pointer-events none', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.pointerEvents).toBe('none');
      });

      it('should have high z-index', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        const preview = fixture.debugElement.query(By.css('.vdnd-drag-preview'));
        expect(preview.nativeElement.style.zIndex).toBe('1000');
      });
    });

    describe('cloned element', () => {
      it('should use cloned element when no custom template', () => {
        const item = createMockDraggedItem();
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        const cloneContainer = fixture.debugElement.query(By.css('.vdnd-drag-preview-clone'));
        expect(cloneContainer).not.toBeNull();
      });
    });

    describe('default preview', () => {
      it('should show default preview when no template or clone', () => {
        const item = createMockDraggedItem({ clonedElement: undefined });
        dragStateService.startDrag(item, { x: 100, y: 100 });
        fixture.detectChanges();
        fixture.detectChanges();

        const defaultPreview = fixture.debugElement.query(By.css('.vdnd-drag-preview-default'));
        expect(defaultPreview).not.toBeNull();
        expect(defaultPreview.nativeElement.textContent.trim()).toContain('item-1');
      });
    });
  });

  describe('with custom template', () => {
    let fixture: ComponentFixture<CustomTemplateTestHostComponent>;
    let dragStateService: DragStateService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [CustomTemplateTestHostComponent],
        providers: [DragStateService],
      });

      fixture = TestBed.createComponent(CustomTemplateTestHostComponent);
      dragStateService = TestBed.inject(DragStateService);
      fixture.detectChanges();
      fixture.detectChanges();
    });

    afterEach(() => {
      dragStateService.endDrag();
      fixture.destroy();
    });

    it('should render custom template when provided', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item, { x: 100, y: 100 });
      fixture.detectChanges();
      fixture.detectChanges();

      const customPreview = fixture.debugElement.query(By.css('.custom-preview'));
      expect(customPreview).not.toBeNull();
    });

    it('should provide correct context to template', () => {
      const item = createMockDraggedItem({
        draggableId: 'test-id',
        data: { id: 'data-1', name: 'My Item' },
      });
      dragStateService.startDrag(item, { x: 100, y: 100 });
      fixture.detectChanges();
      fixture.detectChanges();

      const previewName = fixture.debugElement.query(By.css('.preview-name'));
      const previewId = fixture.debugElement.query(By.css('.preview-id'));

      expect(previewName.nativeElement.textContent).toBe('My Item');
      expect(previewId.nativeElement.textContent).toBe('test-id');
    });

    it('should use custom template instead of cloned element', () => {
      const item = createMockDraggedItem();
      dragStateService.startDrag(item, { x: 100, y: 100 });
      fixture.detectChanges();
      fixture.detectChanges();

      const cloneContainer = fixture.debugElement.query(By.css('.vdnd-drag-preview-clone'));
      const customPreview = fixture.debugElement.query(By.css('.custom-preview'));

      expect(cloneContainer).toBeNull();
      expect(customPreview).not.toBeNull();
    });
  });
});
