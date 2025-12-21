import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  TemplateRef,
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
        [style.position]="'fixed'"
        [style.left.px]="position().x"
        [style.top.px]="position().y"
        [style.width.px]="dimensions().width"
        [style.height.px]="dimensions().height"
        [style.pointer-events]="'none'"
        [style.z-index]="1000"
        [style.opacity]="0.9">
        @if (previewTemplate()) {
          <ng-container
            *ngTemplateOutlet="previewTemplate()!; context: templateContext()">
          </ng-container>
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

  /** Whether the preview is visible */
  protected readonly isVisible = computed(() => {
    return this.dragState.isDragging() && this.dragState.cursorPosition() !== null;
  });

  /** Position of the preview */
  protected readonly position = computed(() => {
    const cursor = this.dragState.cursorPosition();
    const offset = this.cursorOffset();

    if (!cursor) {
      return { x: 0, y: 0 };
    }

    return {
      x: cursor.x - offset.x,
      y: cursor.y - offset.y,
    };
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
