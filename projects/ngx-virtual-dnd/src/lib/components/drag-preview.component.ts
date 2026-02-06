import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DragStateService } from '../services/drag-state.service';

/**
 * Context provided to the drag preview template.
 */
export interface DragPreviewContext<T = unknown> {
  /** The data associated with the dragged item */
  $implicit: T;
  /** The draggable ID */
  draggableId: string;
  /** The source droppable ID */
  droppableId: string;
}

/**
 * Renders a preview of the dragged item that follows the cursor.
 *
 * This component should be placed at the root of your application (or at least
 * outside of any scrollable containers) to ensure the preview is always visible.
 *
 * @example
 * ```html
 * <vdnd-drag-preview>
 *   <ng-template let-data let-id="draggableId">
 *     <div class="drag-preview">{{ data.name }}</div>
 *   </ng-template>
 * </vdnd-drag-preview>
 * ```
 */
@Component({
  selector: 'vdnd-drag-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    @if (isVisible()) {
      <div
        class="vdnd-drag-preview"
        data-testid="vdnd-drag-preview"
        [style.position]="'fixed'"
        [style.left.px]="0"
        [style.top.px]="0"
        [style.transform]="transform()"
        [style.will-change]="'transform'"
        [style.width.px]="dimensions().width"
        [style.height.px]="dimensions().height"
        [style.pointer-events]="'none'"
        [style.z-index]="1000"
        [style.opacity]="0.9"
      >
        @if (previewTemplate()) {
          <ng-container *ngTemplateOutlet="previewTemplate()!; context: templateContext()">
          </ng-container>
        } @else if (clonedElement()) {
          <div class="vdnd-drag-preview-clone" #cloneContainer></div>
        } @else {
          <div class="vdnd-drag-preview-default">
            {{ dragState.draggedItem()?.draggableId }}
          </div>
        }
      </div>
    }
  `,
  styles: `
    .vdnd-drag-preview {
      box-sizing: border-box;
    }

    .vdnd-drag-preview-clone {
      width: 100%;
      height: 100%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      overflow: hidden;
    }

    .vdnd-drag-preview-default {
      padding: 8px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
  `,
})
export class DragPreviewComponent<T = unknown> {
  protected readonly dragState = inject(DragStateService);

  /** Optional custom template for the preview */
  previewTemplate = input<TemplateRef<DragPreviewContext<T>>>();

  /** Offset from cursor to preview (to avoid cursor being on top of preview) */
  cursorOffset = input<{ x: number; y: number }>({ x: 8, y: 8 });

  /** Reference to the clone container element (cannot use ES private with viewChild) */
  private readonly cloneContainer = viewChild<ElementRef<HTMLElement>>('cloneContainer');

  /** The cloned element from drag state (used when no custom template is provided) */
  protected readonly clonedElement = computed(() => {
    if (this.previewTemplate()) {
      return null; // Custom template takes precedence
    }
    return this.dragState.draggedItem()?.clonedElement ?? null;
  });

  constructor() {
    // Effect to insert the cloned element into the container
    effect(() => {
      const container = this.cloneContainer()?.nativeElement;
      const clone = this.clonedElement();

      if (!container) {
        return;
      }

      // Clear previous content and append the prepared clone element.
      // Avoid cloning again: ElementCloneService already creates a styled/sanitized clone.
      container.innerHTML = '';
      if (clone) {
        container.appendChild(clone);
      }
    });
  }

  /** Whether the preview is visible */
  protected readonly isVisible = computed(() => {
    return this.dragState.isDragging() && this.dragState.cursorPosition() !== null;
  });

  /** Position of the preview */
  protected readonly position = computed(() => {
    const cursor = this.dragState.cursorPosition();
    const grabOffset = this.dragState.grabOffset();
    const fallbackOffset = this.cursorOffset();
    const initialPosition = this.dragState.initialPosition();
    const lockAxis = this.dragState.lockAxis();

    if (!cursor) {
      return { x: 0, y: 0 };
    }

    // Use grab offset if available (preserves grab position), otherwise fall back to cursorOffset input
    const offset = grabOffset ?? fallbackOffset;

    let x = cursor.x - offset.x;
    let y = cursor.y - offset.y;

    // Apply axis locking if configured
    if (lockAxis && initialPosition) {
      if (lockAxis === 'x') {
        // Lock X axis: x stays at initial position
        x = initialPosition.x - offset.x;
      } else if (lockAxis === 'y') {
        // Lock Y axis: y stays at initial position
        y = initialPosition.y - offset.y;
      }
    }

    return { x, y };
  });

  /** Transform-based positioning for better performance (avoid layout from left/top). */
  protected readonly transform = computed(() => {
    const { x, y } = this.position();
    return `translate3d(${x}px, ${y}px, 0)`;
  });

  /** Dimensions of the preview */
  protected readonly dimensions = computed(() => {
    const item = this.dragState.draggedItem();

    if (!item) {
      return { width: 100, height: 50 };
    }

    return {
      width: item.width,
      height: item.height,
    };
  });

  /** Template context */
  protected readonly templateContext = computed((): DragPreviewContext<T> => {
    const item = this.dragState.draggedItem();

    return {
      $implicit: (item?.data ?? null) as T,
      draggableId: item?.draggableId ?? '',
      droppableId: item?.droppableId ?? '',
    };
  });
}
