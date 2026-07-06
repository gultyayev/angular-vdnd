import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { VirtualViewportComponent } from './virtual-viewport.component';

class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

@Component({
  template: ` <vdnd-virtual-viewport [itemHeight]="50" [autoScrollEnabled]="false" /> `,
  imports: [VirtualViewportComponent],
})
class TestHostComponent {}

describe('VirtualViewportComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: VirtualViewportComponent;
  let originalResizeObserver: typeof ResizeObserver;

  beforeAll(() => {
    originalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterAll(() => {
    global.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideZonelessChangeDetection()],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    component = fixture.debugElement.query(By.directive(VirtualViewportComponent))
      .componentInstance as VirtualViewportComponent;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should update fixed-height content transform when excluded index changes', () => {
    component.setRenderStartIndex(10);
    fixture.detectChanges();

    expect(component.contentTransform()).toBe('translateY(500px)');

    component.strategy.setExcludedIndex(2);
    fixture.detectChanges();

    expect(component.contentTransform()).toBe('translateY(450px)');
  });
});
