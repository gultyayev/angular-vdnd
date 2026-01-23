import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Renders an empty placeholder that takes up space in the document flow.
 *
 * This component is used internally by virtual scroll containers to show
 * where an item will be dropped. It's rendered inline with items and
 * takes up the same vertical space as an item.
 *
 * The placeholder is just empty space - no borders, no background.
 * Consumers can style it via CSS if desired.
 */
@Component({
  selector: 'vdnd-drag-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'vdnd-drag-placeholder vdnd-drag-placeholder-visible',
    '[style.display]': '"block"',
    '[style.height.px]': 'itemHeight()',
    '[style.pointer-events]': '"none"',
  },
  template: ``,
})
export class DragPlaceholderComponent {
  /** Item height for sizing */
  itemHeight = input.required<number>();
}
