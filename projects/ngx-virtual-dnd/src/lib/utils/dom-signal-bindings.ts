import { NgZone, type WritableSignal } from '@angular/core';

export function bindRafThrottledScrollTopSignal(options: {
  element: HTMLElement;
  ngZone: NgZone;
  scrollTop: WritableSignal<number>;
  thresholdPx?: number;
}): () => void {
  const { element, ngZone, scrollTop, thresholdPx = 5 } = options;

  let pendingRaf: number | null = null;
  let lastCommittedScrollTop = element.scrollTop;

  const onScroll = () => {
    if (pendingRaf !== null) {
      return;
    }

    const currentScrollTop = element.scrollTop;
    if (Math.abs(currentScrollTop - lastCommittedScrollTop) < thresholdPx) {
      return;
    }

    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = null;
      const finalScrollTop = element.scrollTop;
      if (Math.abs(finalScrollTop - lastCommittedScrollTop) >= thresholdPx) {
        lastCommittedScrollTop = finalScrollTop;
        scrollTop.set(finalScrollTop);
      }
    });
  };

  ngZone.runOutsideAngular(() => {
    element.addEventListener('scroll', onScroll, { passive: true });
  });

  scrollTop.set(lastCommittedScrollTop);

  return () => {
    if (pendingRaf !== null) {
      cancelAnimationFrame(pendingRaf);
      pendingRaf = null;
    }
    element.removeEventListener('scroll', onScroll);
  };
}

export function bindResizeObserverHeightSignal(options: {
  element: HTMLElement;
  ngZone: NgZone;
  height: WritableSignal<number>;
  minDeltaPx?: number;
}): () => void {
  const { element, ngZone, height, minDeltaPx = 1 } = options;

  if (typeof ResizeObserver === 'undefined') {
    height.set(element.clientHeight);
    return () => undefined;
  }

  let observer: ResizeObserver | null = null;

  ngZone.runOutsideAngular(() => {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextHeight = entry.contentRect.height;
        if (Math.abs(nextHeight - height()) > minDeltaPx) {
          height.set(nextHeight);
        }
      }
    });
    observer.observe(element);
  });

  height.set(element.clientHeight);

  return () => {
    observer?.disconnect();
    observer = null;
  };
}
