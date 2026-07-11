import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AutoScrollService } from '../services/auto-scroll.service';
import { provideVdndAutoScroll } from './auto-scroll.provider';

describe('provideVdndAutoScroll', () => {
  it('makes AutoScrollService injectable when added to providers', () => {
    TestBed.configureTestingModule({ providers: [provideVdndAutoScroll()] });

    expect(TestBed.inject(AutoScrollService)).toBeInstanceOf(AutoScrollService);
  });

  it('leaves AutoScrollService absent without the provider', () => {
    TestBed.configureTestingModule({ providers: [] });

    // Not providedIn:'root' anymore — resolves to the supplied default (null).
    const resolved = TestBed.inject(Injector).get(AutoScrollService, null);

    expect(resolved).toBeNull();
  });
});
