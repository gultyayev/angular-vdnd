import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PlaceholderComponent } from './placeholder.component';

@Component({
  template: `<vdnd-placeholder [height]="height()" />`,
  imports: [PlaceholderComponent],
})
class TestHostComponent {
  height = signal(50);
}

describe('PlaceholderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let placeholderEl: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const placeholderDebug = fixture.debugElement.query(By.directive(PlaceholderComponent));
    placeholderEl = placeholderDebug.nativeElement;
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('initialization', () => {
    it('should create the component', () => {
      const placeholderComponent = fixture.debugElement
        .query(By.directive(PlaceholderComponent))
        .componentInstance;
      expect(placeholderComponent).toBeTruthy();
    });

    it('should have vdnd-placeholder class', () => {
      expect(placeholderEl.classList.contains('vdnd-placeholder')).toBe(true);
    });

    it('should have data-draggable-id attribute set to placeholder', () => {
      expect(placeholderEl.getAttribute('data-draggable-id')).toBe('placeholder');
    });
  });

  describe('height input', () => {
    it('should use default height of 50px', () => {
      expect(placeholderEl.style.height).toBe('50px');
    });

    it('should use custom height from input', () => {
      component.height.set(100);
      fixture.detectChanges();

      expect(placeholderEl.style.height).toBe('100px');
    });

    it('should update height when input changes', () => {
      expect(placeholderEl.style.height).toBe('50px');

      component.height.set(75);
      fixture.detectChanges();

      expect(placeholderEl.style.height).toBe('75px');
    });
  });

  describe('inner content', () => {
    it('should render inner placeholder element', () => {
      const inner = fixture.debugElement.query(By.css('.vdnd-placeholder-inner'));
      expect(inner).not.toBeNull();
    });

    it('should have inner element as a div', () => {
      const inner = fixture.debugElement.query(By.css('.vdnd-placeholder-inner'));
      expect(inner.nativeElement.tagName.toLowerCase()).toBe('div');
    });
  });

  describe('structure', () => {
    it('should have correct DOM structure', () => {
      // Should have the host element with vdnd-placeholder class
      expect(placeholderEl.classList.contains('vdnd-placeholder')).toBe(true);

      // Should have an inner div
      const inner = placeholderEl.querySelector('.vdnd-placeholder-inner');
      expect(inner).not.toBeNull();
    });
  });
});
