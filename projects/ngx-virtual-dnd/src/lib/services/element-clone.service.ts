import { Injectable } from '@angular/core';

/**
 * Service for cloning DOM elements with their computed styles.
 * Used to create visual copies of dragged elements for the drag preview.
 */
@Injectable({ providedIn: 'root' })
export class ElementCloneService {
  /**
   * CSS properties to copy from source to clone.
   * These are the visual properties that affect appearance.
   */
  private readonly stylesToCopy = [
    'background',
    'backgroundColor',
    'backgroundImage',
    'border',
    'borderRadius',
    'boxShadow',
    'color',
    'font',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'padding',
    'margin',
    'display',
    'flexDirection',
    'alignItems',
    'justifyContent',
    'gap',
    'textAlign',
    'textDecoration',
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'overflow',
    'opacity',
    'transform',
    'boxSizing',
  ];

  /**
   * Clone an element with its computed styles.
   * Returns an HTMLElement ready for use as a drag preview.
   */
  cloneElement(source: HTMLElement): HTMLElement {
    const clone = source.cloneNode(true) as HTMLElement;

    // Apply computed styles as inline styles
    this.applyComputedStyles(source, clone);

    // Handle special elements (canvas, video, etc.)
    this.handleSpecialElements(source, clone);

    // Sanitize the clone for safe use as preview
    this.sanitizeClone(clone);

    return clone;
  }

  /**
   * Apply computed styles from source to target element.
   * Recursively applies to all child elements.
   */
  private applyComputedStyles(source: HTMLElement, target: HTMLElement): void {
    const computed = window.getComputedStyle(source);

    // Copy essential visual properties
    for (const prop of this.stylesToCopy) {
      const value = computed.getPropertyValue(this.camelToKebab(prop));
      if (value) {
        target.style.setProperty(this.camelToKebab(prop), value);
      }
    }

    // Disable animations and transitions on clone
    target.style.animation = 'none';
    target.style.transition = 'none';

    // Recursively apply to children
    const sourceChildren = source.children;
    const targetChildren = target.children;

    for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i++) {
      const sourceChild = sourceChildren[i];
      const targetChild = targetChildren[i];

      if (sourceChild instanceof HTMLElement && targetChild instanceof HTMLElement) {
        this.applyComputedStyles(sourceChild, targetChild);
      }
    }
  }

  /**
   * Handle special elements that require extra processing.
   */
  private handleSpecialElements(source: HTMLElement, clone: HTMLElement): void {
    // Handle canvas elements - copy current content
    const sourceCanvases = source.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');

    sourceCanvases.forEach((srcCanvas, i) => {
      const cloneCanvas = cloneCanvases[i] as HTMLCanvasElement;
      if (cloneCanvas) {
        const ctx = cloneCanvas.getContext('2d');
        if (ctx) {
          cloneCanvas.width = srcCanvas.width;
          cloneCanvas.height = srcCanvas.height;
          ctx.drawImage(srcCanvas, 0, 0);
        }
      }
    });

    // Handle video elements - replace with poster or placeholder
    const videos = clone.querySelectorAll('video');
    videos.forEach((video) => {
      const poster = video.poster;
      if (poster) {
        const img = document.createElement('img');
        img.src = poster;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        video.replaceWith(img);
      } else {
        // Create a placeholder
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
          width: 100%;
          height: 100%;
          background: #333;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        `;
        placeholder.textContent = 'Video';
        video.replaceWith(placeholder);
      }
    });

    // Handle iframes - replace with placeholder
    const iframes = clone.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const placeholder = document.createElement('div');
      const iframeStyles = window.getComputedStyle(iframe);
      placeholder.style.width = iframeStyles.width;
      placeholder.style.height = iframeStyles.height;
      placeholder.style.background = '#f0f0f0';
      placeholder.style.border = '1px solid #ddd';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.color = '#999';
      placeholder.textContent = 'Embedded content';
      iframe.replaceWith(placeholder);
    });
  }

  /**
   * Sanitize the clone to prevent interaction issues.
   */
  private sanitizeClone(clone: HTMLElement): void {
    // Remove draggable directive attributes
    clone.removeAttribute('vdndDraggable');
    clone.removeAttribute('data-draggable-id');
    clone.removeAttribute('data-droppable-id');

    // Remove Angular-specific attributes
    const angularAttrs = Array.from(clone.attributes).filter(
      (attr) => attr.name.startsWith('ng-') || attr.name.startsWith('_ng')
    );
    angularAttrs.forEach((attr) => clone.removeAttribute(attr.name));

    // Process all descendant elements
    const allElements = clone.querySelectorAll('*');
    allElements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;

      // Remove event-related attributes
      const attrs = Array.from(el.attributes);
      attrs.forEach((attr) => {
        if (
          attr.name.startsWith('on') ||
          attr.name.startsWith('(') ||
          attr.name.startsWith('ng-') ||
          attr.name.startsWith('_ng')
        ) {
          el.removeAttribute(attr.name);
        }
      });

      // Remove draggable attributes from children too
      el.removeAttribute('vdndDraggable');
      el.removeAttribute('data-draggable-id');
      el.removeAttribute('data-droppable-id');
    });

    // Disable interactive elements
    const interactiveElements = clone.querySelectorAll(
      'button, input, textarea, select, a, [contenteditable]'
    );
    interactiveElements.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.pointerEvents = 'none';
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('disabled', 'true');
      }
    });

    // Remove focus styling classes that might interfere
    clone.classList.remove('vdnd-draggable-dragging');
    clone.classList.remove('vdnd-draggable-disabled');
  }

  /**
   * Convert camelCase to kebab-case for CSS properties.
   */
  private camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }
}
