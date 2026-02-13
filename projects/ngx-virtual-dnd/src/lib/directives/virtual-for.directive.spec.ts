import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { VirtualForDirective } from './virtual-for.directive';
import { VirtualViewportComponent } from '../components/virtual-viewport.component';

interface TestItem {
  id: string;
  key: string;
  label: string;
  parts: string[];
}

class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

@Component({
  template: `
    <vdnd-virtual-viewport [itemHeight]="50" style="height: 200px;">
      <ng-container *vdndVirtualFor="let item of items(); trackBy: trackByFn">
        <div class="item" [attr.data-id]="item.id">
          <span class="label">{{ item.label }}</span>
          <div class="parts">
            @for (part of item.parts; track part) {
              <span class="part">{{ part }}</span>
            }
          </div>
        </div>
      </ng-container>
    </vdnd-virtual-viewport>
  `,
  imports: [VirtualViewportComponent, VirtualForDirective],
})
class TestHostComponent {
  readonly items = signal<TestItem[]>([]);
  readonly trackByFn = (_index: number, item: TestItem): string => item.key;
}

describe('VirtualForDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
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
    });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should render item views for unique trackBy keys', () => {
    component.items.set([
      { id: 'item-1', key: 'a', label: 'A', parts: ['a1'] },
      { id: 'item-2', key: 'b', label: 'B', parts: ['b1', 'b2'] },
      { id: 'item-3', key: 'c', label: 'C', parts: ['c1'] },
    ]);

    fixture.detectChanges();

    const renderedItems = fixture.debugElement.queryAll(By.css('.item'));
    expect(renderedItems.length).toBe(3);
  });

  it('should not throw when trackBy keys collide', () => {
    component.items.set([
      { id: 'item-1', key: 'a', label: 'A1', parts: ['a'] },
      { id: 'item-2', key: 'b', label: 'B', parts: ['b'] },
      { id: 'item-3', key: 'c', label: 'C', parts: ['c'] },
      { id: 'item-4', key: 'a', label: 'A2', parts: ['a', 'a2'] },
    ]);

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('should not throw when replacing the full item list repeatedly', () => {
    component.items.set([
      { id: 'item-1', key: '1', label: 'One', parts: ['1a'] },
      { id: 'item-2', key: '2', label: 'Two', parts: ['2a', '2b'] },
      { id: 'item-3', key: '3', label: 'Three', parts: ['3a'] },
      { id: 'item-4', key: '4', label: 'Four', parts: ['4a', '4b', '4c'] },
    ]);
    fixture.detectChanges();

    component.items.set([
      { id: 'item-10', key: '10', label: 'Ten', parts: ['10a', '10b'] },
      { id: 'item-11', key: '11', label: 'Eleven', parts: ['11a'] },
      { id: 'item-12', key: '12', label: 'Twelve', parts: ['12a', '12b', '12c'] },
      { id: 'item-13', key: '13', label: 'Thirteen', parts: ['13a'] },
      { id: 'item-14', key: '14', label: 'Fourteen', parts: ['14a', '14b'] },
    ]);

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('should reconcile nested @for content when list shape changes', () => {
    component.items.set([
      { id: 'item-a', key: 'a', label: 'Alpha', parts: ['p1', 'p2', 'p3'] },
      { id: 'item-b', key: 'b', label: 'Beta', parts: ['q1'] },
      { id: 'item-c', key: 'c', label: 'Gamma', parts: ['r1', 'r2'] },
    ]);
    fixture.detectChanges();

    component.items.set([
      { id: 'item-x', key: 'x', label: 'Xray', parts: ['x1'] },
      { id: 'item-y', key: 'y', label: 'Yankee', parts: ['y1', 'y2', 'y3', 'y4'] },
      { id: 'item-z', key: 'z', label: 'Zulu', parts: [] },
      { id: 'item-w', key: 'w', label: 'Whiskey', parts: ['w1', 'w2'] },
    ]);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.debugElement.queryAll(By.css('.item')).length).toBeGreaterThan(0);
    expect(fixture.debugElement.queryAll(By.css('.part')).length).toBeGreaterThan(0);
  });
});
