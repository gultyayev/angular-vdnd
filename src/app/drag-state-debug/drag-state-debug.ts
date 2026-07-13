import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { DragStateService } from 'ngx-virtual-dnd';

/**
 * Hidden mirror of DragStateService for E2E synchronization.
 *
 * The drop outcome of a drag is computed from the last drag state the scheduler
 * processed, not from the raw pointer position. E2E tests poll this element
 * (settleDragPosition/waitForActiveDroppable in the Playwright page objects) to know
 * the scheduler has processed the release coordinates before calling mouse.up().
 * The main demo exposes the same data through its visible debug panel; this component
 * provides it on demo pages without one.
 */
@Component({
  selector: 'app-drag-state-debug',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe],
  template: `<pre data-testid="drag-state-debug" hidden>{{ debugState() | json }}</pre>`,
})
export class DragStateDebugComponent {
  readonly #dragState = inject(DragStateService);

  readonly debugState = computed(() => ({
    isDragging: this.#dragState.isDragging(),
    activeDroppable: this.#dragState.activeDroppableId(),
    placeholderIndex: this.#dragState.placeholderIndex(),
    cursorPosition: this.#dragState.cursorPosition(),
  }));
}
