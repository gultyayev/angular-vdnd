import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Marks an element as the header content for a `vdnd-virtual-content` component.
 *
 * Place this directive on a projected element inside `<vdnd-virtual-content>`.
 * The component will automatically measure the header's height via ResizeObserver
 * and use it as the content offset for virtual scroll calculations.
 *
 * This eliminates the need for manual ResizeObserver boilerplate that was
 * previously required with the `[contentOffset]` input.
 *
 * @example
 * ```html
 * <vdnd-virtual-content [itemHeight]="50">
 *   <div class="page-header" vdndContentHeader>
 *     <h1>My List</h1>
 *   </div>
 *   <ng-container *vdndVirtualFor="let item of items(); trackBy: trackById">
 *     <div>{{ item.name }}</div>
 *   </ng-container>
 * </vdnd-virtual-content>
 * ```
 */
@Directive({
  selector: '[vdndContentHeader]',
})
export class ContentHeaderDirective {
  readonly elementRef = inject(ElementRef<HTMLElement>);
}
