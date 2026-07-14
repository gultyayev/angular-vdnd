import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  DraggableDirective,
  DragPreviewComponent,
  DropEvent,
  DroppableDirective,
  DroppableGroupDirective,
  isNoOpDrop,
  moveItem,
} from 'ngx-virtual-dnd';
import { DragStateDebugComponent } from '../drag-state-debug/drag-state-debug';
import { TopBarComponent } from '../top-bar/top-bar';

interface SimpleItem {
  id: string;
  label: string;
}

/**
 * Minimal demo exercising a droppable that mounts mid-drag: the target list is not
 * rendered until the first drag begins (mounted from the `(dragStart)` handler). It
 * verifies that a conditionally-rendered droppable becomes a valid drop target even though
 * the drag session's candidate snapshot was frozen at drag start — `DroppableDirective`
 * refreshes the snapshot after its first render.
 */
@Component({
  selector: 'app-mid-drag-mount-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TopBarComponent,
    DraggableDirective,
    DroppableDirective,
    DroppableGroupDirective,
    DragPreviewComponent,
    DragStateDebugComponent,
  ],
  template: `
    <app-top-bar />
    <vdnd-drag-preview />
    <app-drag-state-debug />

    <div class="mount-counts">
      <span data-testid="list-a-count">{{ listA().length }}</span>
      <span data-testid="list-b-count">{{ listB().length }}</span>
    </div>

    <div class="mount-demo" vdndGroup="mount-group">
      <div class="mount-column">
        <h2>Source</h2>
        <div class="mount-list" vdndDroppable="list-a" (drop)="onDrop($event)">
          @for (item of listA(); track item.id) {
            <div
              class="mount-item"
              [vdndDraggable]="item.id"
              [vdndDraggableData]="item"
              (dragStart)="onDragStart()"
            >
              {{ item.label }}
            </div>
          }
        </div>
      </div>

      <div class="mount-column">
        <h2>Target (mounts during drag)</h2>
        <!-- Not rendered until the first drag begins, so its droppable mounts mid-drag.
             Latched visible afterwards so a drop isn't cancelled by unmounting the target. -->
        @if (showTarget()) {
          <div class="mount-list mount-list-target" vdndDroppable="list-b" (drop)="onDrop($event)">
            @for (item of listB(); track item.id) {
              <div
                class="mount-item"
                [vdndDraggable]="item.id"
                [vdndDraggableData]="item"
                (dragStart)="onDragStart()"
              >
                {{ item.label }}
              </div>
            }
            @if (listB().length === 0) {
              <div class="mount-empty">Drop here</div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .mount-demo {
        display: flex;
        gap: 24px;
        padding: 24px;
      }

      .mount-column {
        flex: 1;
      }

      .mount-list {
        min-height: 320px;
        padding: 12px;
        border: 2px dashed #b0b0c0;
        border-radius: 8px;
        background: #f6f6fa;
      }

      .mount-list-target {
        border-color: #6b8cff;
        background: #eef2ff;
      }

      .mount-item {
        padding: 12px 16px;
        margin-bottom: 8px;
        background: #fff;
        border: 1px solid #d0d0dc;
        border-radius: 6px;
        cursor: grab;
      }

      .mount-empty {
        padding: 12px 16px;
        color: #888;
        text-align: center;
      }
    `,
  ],
})
export class MidDragMountDemoComponent {
  readonly listA = signal<SimpleItem[]>(
    Array.from({ length: 5 }, (_, i) => ({ id: `item-a-${i}`, label: `Item A${i}` })),
  );
  readonly listB = signal<SimpleItem[]>([]);

  /**
   * Latched true when the first drag begins so the target droppable mounts mid-drag. Kept
   * true afterwards: unmounting the target on drag end would race (and cancel) the drop.
   */
  readonly showTarget = signal(false);

  onDragStart(): void {
    this.showTarget.set(true);
  }

  onDrop(event: DropEvent): void {
    if (isNoOpDrop(event)) {
      return;
    }
    moveItem(event, {
      'list-a': this.listA,
      'list-b': this.listB,
    });
  }
}
