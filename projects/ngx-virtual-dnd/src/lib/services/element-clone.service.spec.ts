import { TestBed } from '@angular/core/testing';
import { ElementCloneService } from './element-clone.service';

describe('ElementCloneService', () => {
  let service: ElementCloneService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ElementCloneService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('cloneElement', () => {
    it('should clone element structure', () => {
      const source = document.createElement('div');
      source.innerHTML = '<span>Hello</span><span>World</span>';

      const clone = service.cloneElement(source);

      expect(clone.children.length).toBe(2);
      expect(clone.textContent).toBe('HelloWorld');
    });

    it('should copy computed background color', () => {
      const source = document.createElement('div');
      source.style.backgroundColor = 'rgb(255, 0, 0)';
      document.body.appendChild(source);

      const clone = service.cloneElement(source);

      expect(clone.style.backgroundColor).toBe('rgb(255, 0, 0)');

      document.body.removeChild(source);
    });

    it('should copy computed font styles', () => {
      const source = document.createElement('div');
      source.style.fontSize = '16px';
      source.style.fontWeight = 'bold';
      document.body.appendChild(source);

      const clone = service.cloneElement(source);

      expect(clone.style.fontSize).toBe('16px');
      expect(clone.style.fontWeight).toBe('bold');

      document.body.removeChild(source);
    });

    it('should disable animations and transitions on clone', () => {
      const source = document.createElement('div');
      source.style.transition = 'all 0.3s ease';
      source.style.animation = 'fade 1s';
      document.body.appendChild(source);

      const clone = service.cloneElement(source);

      expect(clone.style.animation).toBe('none');
      expect(clone.style.transition).toBe('none');

      document.body.removeChild(source);
    });

    it('should remove draggable attributes', () => {
      const source = document.createElement('div');
      source.setAttribute('vdndDraggable', 'item-1');
      source.setAttribute('data-draggable-id', 'item-1');
      source.setAttribute('data-droppable-id', 'list-1');

      const clone = service.cloneElement(source);

      expect(clone.hasAttribute('vdndDraggable')).toBe(false);
      expect(clone.hasAttribute('data-draggable-id')).toBe(false);
      expect(clone.hasAttribute('data-droppable-id')).toBe(false);
    });

    it('should disable interactive elements', () => {
      const source = document.createElement('div');
      source.innerHTML = `
        <button>Click me</button>
        <input type="text" />
        <a href="#">Link</a>
      `;

      const clone = service.cloneElement(source);

      const button = clone.querySelector('button') as HTMLButtonElement;
      const input = clone.querySelector('input') as HTMLInputElement;
      const link = clone.querySelector('a') as HTMLAnchorElement;

      expect(button.style.pointerEvents).toBe('none');
      expect(button.getAttribute('tabindex')).toBe('-1');
      expect(button.getAttribute('aria-hidden')).toBe('true');

      expect(input.style.pointerEvents).toBe('none');
      expect(link.style.pointerEvents).toBe('none');
    });

    it('should recursively copy styles to child elements', () => {
      const source = document.createElement('div');
      const child = document.createElement('span');
      child.style.color = 'rgb(0, 0, 255)';
      source.appendChild(child);
      document.body.appendChild(source);

      const clone = service.cloneElement(source);
      const clonedChild = clone.querySelector('span') as HTMLSpanElement;

      expect(clonedChild.style.color).toBe('rgb(0, 0, 255)');

      document.body.removeChild(source);
    });

    it('should remove Angular-specific attributes', () => {
      const source = document.createElement('div');
      source.setAttribute('ng-reflect-value', 'test');
      source.setAttribute('_ngcontent-abc-123', '');

      const clone = service.cloneElement(source);

      expect(clone.hasAttribute('ng-reflect-value')).toBe(false);
      expect(clone.hasAttribute('_ngcontent-abc-123')).toBe(false);
    });

    it('should remove vdnd-draggable-dragging class', () => {
      const source = document.createElement('div');
      source.classList.add('item', 'vdnd-draggable-dragging', 'vdnd-draggable-disabled');

      const clone = service.cloneElement(source);

      expect(clone.classList.contains('item')).toBe(true);
      expect(clone.classList.contains('vdnd-draggable-dragging')).toBe(false);
      expect(clone.classList.contains('vdnd-draggable-disabled')).toBe(false);
    });

    it('should handle elements with no children', () => {
      const source = document.createElement('span');
      source.textContent = 'Simple text';
      source.style.padding = '10px';
      document.body.appendChild(source);

      const clone = service.cloneElement(source);

      expect(clone.textContent).toBe('Simple text');
      expect(clone.style.padding).toBe('10px');

      document.body.removeChild(source);
    });
  });

  describe('special elements handling', () => {
    it('should replace video elements with poster image', () => {
      const source = document.createElement('div');
      const video = document.createElement('video');
      video.poster = 'https://example.com/poster.jpg';
      source.appendChild(video);

      const clone = service.cloneElement(source);
      const img = clone.querySelector('img') as HTMLImageElement;

      expect(clone.querySelector('video')).toBeNull();
      expect(img).not.toBeNull();
      expect(img.src).toBe('https://example.com/poster.jpg');
    });

    it('should replace video without poster with placeholder', () => {
      const source = document.createElement('div');
      const video = document.createElement('video');
      source.appendChild(video);

      const clone = service.cloneElement(source);

      expect(clone.querySelector('video')).toBeNull();
    });

    it('should replace iframes with placeholder', () => {
      const source = document.createElement('div');
      const iframe = document.createElement('iframe');
      iframe.style.width = '300px';
      iframe.style.height = '200px';
      source.appendChild(iframe);
      document.body.appendChild(source);

      const clone = service.cloneElement(source);

      expect(clone.querySelector('iframe')).toBeNull();

      document.body.removeChild(source);
    });
  });
});
