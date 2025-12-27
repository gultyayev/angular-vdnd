import { Directive, InjectionToken, input, Signal } from '@angular/core';

/**
 * Token for injecting the group context from a parent directive.
 * Allows child draggables and droppables to inherit the group name automatically.
 */
export const VDND_GROUP_TOKEN = new InjectionToken<VdndGroupContext>('VDND_GROUP_TOKEN');

/**
 * Context provided by the group directive to its children.
 */
export interface VdndGroupContext {
  /** The group name signal */
  readonly group: Signal<string>;
}

/**
 * Provides a group context to child draggable and droppable directives.
 * When applied to a parent element, child directives can inherit the group name
 * automatically without needing to specify it on each element.
 *
 * @example
 * ```html
 * <!-- Without group directive (verbose) -->
 * <div vdndDroppable="list-1" vdndDroppableGroup="my-group">
 *   <div vdndDraggable="item-1" vdndDraggableGroup="my-group">Item 1</div>
 *   <div vdndDraggable="item-2" vdndDraggableGroup="my-group">Item 2</div>
 * </div>
 *
 * <!-- With group directive (concise) -->
 * <div vdndGroup="my-group">
 *   <div vdndDroppable="list-1">
 *     <div vdndDraggable="item-1">Item 1</div>
 *     <div vdndDraggable="item-2">Item 2</div>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[vdndGroup]',
  providers: [
    {
      provide: VDND_GROUP_TOKEN,
      useExisting: DroppableGroupDirective,
    },
  ],
})
export class DroppableGroupDirective implements VdndGroupContext {
  /** The group name that will be inherited by child directives */
  readonly group = input.required<string>({ alias: 'vdndGroup' });
}
