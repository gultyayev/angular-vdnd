import { Injectable, OnDestroy } from '@angular/core';

/**
 * Service that manages a shared overlay container appended to `document.body`.
 *
 * Elements placed inside the overlay container escape any ancestor CSS `transform`,
 * `perspective`, or `filter` that would create a new containing block for
 * `position: fixed` children. This ensures viewport-relative positioning works
 * correctly regardless of where the consuming component sits in the DOM tree.
 *
 * Mirrors the strategy used by Angular CDK's `OverlayContainer`.
 */
@Injectable({
  providedIn: 'root',
})
export class OverlayContainerService implements OnDestroy {
  #containerElement: HTMLElement | null = null;

  /**
   * Returns the shared overlay container element, lazily creating it on first access.
   * Returns `null` in non-browser environments (SSR).
   */
  getContainerElement(): HTMLElement | null {
    if (typeof document === 'undefined') {
      return null;
    }

    if (!this.#containerElement) {
      this.#containerElement = document.createElement('div');
      this.#containerElement.classList.add('vdnd-overlay-container');
      document.body.appendChild(this.#containerElement);
    }

    return this.#containerElement;
  }

  ngOnDestroy(): void {
    this.#containerElement?.remove();
    this.#containerElement = null;
  }
}
