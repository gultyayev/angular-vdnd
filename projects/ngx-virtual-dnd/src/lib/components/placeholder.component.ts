import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Context provided to the custom placeholder template.
 */
export interface PlaceholderContext {
  /** The height of the placeholder in pixels */
  $implicit: number;
  /** The height of the placeholder in pixels (explicit property) */
  height: number;
}

/**
 * A placeholder component that indicates where a dropped item will be inserted.
 *
 * By default, renders as empty/transparent space. Pass a custom template
 * to customize the placeholder appearance.
 *
 * @example
 * ```html
 * <!-- Default: transparent/empty space -->
 * <vdnd-placeholder [height]="50"></vdnd-placeholder>
 *
 * <!-- Custom template with dashed border -->
 * <vdnd-placeholder [height]="50" [template]="customPlaceholder">
 *   <ng-template #customPlaceholder let-height>
 *     <div class="my-placeholder" [style.height.px]="height">
 *       Drop here
 *     </div>
 *   </ng-template>
 * </vdnd-placeholder>
 * ```
 */
@Component({
  selector: 'vdnd-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'vdnd-placeholder',
    '[style.height.px]': 'height()',
    '[attr.data-draggable-id]': '"placeholder"',
  },
  template: `
    @if (template()) {
      <ng-container
        *ngTemplateOutlet="template()!; context: { $implicit: height(), height: height() }"
      >
      </ng-container>
    }
  `,
  styles: `
    :host {
      display: block;
      box-sizing: border-box;
    }
  `,
})
export class PlaceholderComponent {
  /** Height of the placeholder in pixels */
  height = input<number>(50);

  /** Optional custom template for the placeholder content */
  template = input<TemplateRef<PlaceholderContext>>();
}
