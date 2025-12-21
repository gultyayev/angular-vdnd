import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A simple placeholder component that indicates where a dropped item will be inserted.
 *
 * @example
 * ```html
 * <vdnd-placeholder [height]="50"></vdnd-placeholder>
 * ```
 */
@Component({
  selector: 'vdnd-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'vdnd-placeholder',
    '[style.height.px]': 'height()',
    '[attr.data-draggable-id]': '"placeholder"',
  },
  template: `
    <div class="vdnd-placeholder-inner"></div>
  `,
  styles: `
    :host {
      display: block;
      box-sizing: border-box;
    }

    .vdnd-placeholder-inner {
      width: 100%;
      height: 100%;
      border: 2px dashed #999;
      border-radius: 4px;
      background-color: rgba(0, 0, 0, 0.05);
    }
  `,
})
export class PlaceholderComponent {
  /** Height of the placeholder in pixels */
  height = input<number>(50);
}
