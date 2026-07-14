import { inject, Injectable, isDevMode, NgZone } from '@angular/core';
import { queryAllByAttribute, queryByAttribute } from '../utils/attribute-selectors';

/**
 * Snapshot of the candidate droppables for an active drag session.
 * Rects are cached so per-pointermove hit-testing is pure geometry, avoiding the
 * forced layout flush that `document.elementFromPoint` (plus the pointer-events
 * style write it required) imposed on the hottest drag loop.
 */
interface DragSessionSnapshot {
  groupName: string;
  /** Candidate droppables in document order (document order === default paint order). */
  candidates: HTMLElement[];
  /**
   * Nearest `.vdnd-scrollable` ancestor per candidate (parallel to `candidates`), or null
   * when the candidate is not inside one. Cached rects are clipped to this ancestor so a
   * droppable scrolled out of its clipping container does not hit-test over its full extent.
   */
  scrollables: (HTMLElement | null)[];
  /** Cached, clip-adjusted bounding rects, parallel to `candidates`. */
  rects: DOMRect[];
  /** When true, rects are re-read on the next hit-test (set on scroll/resize/element resize). */
  dirty: boolean;
  /** Bound scroll/resize listener used to mark rects dirty. */
  onViewportChange: () => void;
  /** Observes candidate resizes so container-only layout changes invalidate cached rects. */
  resizeObserver: ResizeObserver | null;
}

/**
 * Service for calculating drop positions and finding elements at cursor positions.
 * This is the core algorithm that makes virtual scroll + drag-and-drop work together.
 */
@Injectable({
  providedIn: 'root',
})
export class PositionCalculatorService {
  readonly #ngZone = inject(NgZone);

  /** Data attribute used to identify droppable elements */
  readonly #DROPPABLE_ID_ATTR = 'data-droppable-id';

  /** Data attribute used to identify droppable groups */
  readonly #DROPPABLE_GROUP_ATTR = 'data-droppable-group';

  /** Data attribute reflecting a droppable's disabled state (present === disabled) */
  readonly #DROPPABLE_DISABLED_ATTR = 'data-droppable-disabled';

  /** Data attribute used to identify draggable elements */
  readonly #DRAGGABLE_ID_ATTR = 'data-draggable-id';

  /** Class marking a scrollable (clipping) container, used to clip candidate rects. */
  readonly #SCROLLABLE_CLASS = 'vdnd-scrollable';

  /** Maximum DOM levels to traverse when looking for parent elements */
  readonly #MAX_PARENT_TRAVERSAL = 15;

  /** Reusable result object for getNearEdge (avoids per-frame allocation) */
  readonly #nearEdgeResult = { top: false, bottom: false, left: false, right: false };

  /** Active drag session rect snapshot, or null when no drag is in progress. */
  #session: DragSessionSnapshot | null = null;

  /**
   * Begin a drag session: snapshot the candidate droppables for `groupName` and
   * their rects once, then watch for viewport changes (scroll/resize) that would
   * invalidate those rects. While a session is active, `findDroppableAtPoint`
   * runs as pure geometry against the cached rects instead of `elementFromPoint`.
   *
   * Safe to call repeatedly — a new call replaces any previous session.
   */
  beginDragSession(groupName: string): void {
    this.endDragSession();

    const onViewportChange = () => {
      if (this.#session) {
        this.#session.dirty = true;
      }
    };

    const candidates = this.#queryDroppables(groupName);
    const scrollables = candidates.map((el) => this.#scrollableAncestor(el));

    this.#session = {
      groupName,
      candidates,
      scrollables,
      rects: candidates.map((el, i) => this.#snapshotRect(el, scrollables[i])),
      dirty: false,
      onViewportChange,
      resizeObserver: null,
    };

    // Capture-phase scroll catches scrolling on any ancestor scroller (scroll does
    // not bubble); resize covers viewport changes. A ResizeObserver on the candidates
    // catches container-only layout changes that fire neither scroll nor resize. All
    // three only mark rects dirty — the actual re-read is deferred to the next hit-test.
    if (typeof window !== 'undefined') {
      this.#ngZone.runOutsideAngular(() => {
        window.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
        window.addEventListener('resize', onViewportChange, { passive: true });
        this.#observeCandidateResizes();
      });
    }
  }

  /**
   * Re-snapshot the candidate droppable *list* (not just their rects) for the active
   * session, so droppables mounted or unmounted mid-drag become visible to hit-testing.
   * The candidate set is frozen at {@link beginDragSession}; `DroppableDirective` calls
   * this from its init/destroy lifecycle so a conditionally-rendered list added during a
   * drag becomes a valid target.
   *
   * @param groupName - When provided, the refresh is skipped unless it matches the active
   *   session's group (a droppable from an unrelated group need not disturb the snapshot).
   *   Omit to force a refresh of the current session regardless of group.
   */
  refreshCandidates(groupName?: string): void {
    const session = this.#session;
    if (!session || (groupName !== undefined && groupName !== session.groupName)) {
      return;
    }

    session.candidates = this.#queryDroppables(session.groupName);
    session.scrollables = session.candidates.map((el) => this.#scrollableAncestor(el));
    session.rects = session.candidates.map((el, i) =>
      this.#snapshotRect(el, session.scrollables[i]),
    );
    session.dirty = false;

    if (typeof window !== 'undefined') {
      this.#ngZone.runOutsideAngular(() => this.#observeCandidateResizes());
    }
  }

  /**
   * End the current drag session and detach viewport listeners.
   * Safe to call when no session is active.
   */
  endDragSession(): void {
    const session = this.#session;
    if (!session) {
      return;
    }
    this.#session = null;
    session.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', session.onViewportChange, { capture: true });
      window.removeEventListener('resize', session.onViewportChange);
    }
  }

  /**
   * (Re)bind the session's ResizeObserver to the current candidate set. A candidate
   * resizing (e.g. a sibling list expanding, or a container reflow that fires no window
   * scroll/resize) marks the cached rects dirty so they are re-read on the next hit-test.
   * Runs inside `runOutsideAngular` (callers wrap the call).
   */
  #observeCandidateResizes(): void {
    const session = this.#session;
    if (!session || typeof ResizeObserver === 'undefined') {
      return;
    }
    session.resizeObserver?.disconnect();
    session.resizeObserver ??= new ResizeObserver(() => {
      if (this.#session) {
        this.#session.dirty = true;
      }
    });
    for (const candidate of session.candidates) {
      session.resizeObserver.observe(candidate);
    }
  }

  /**
   * Mark the cached droppable rects as stale so they are re-read on the next
   * hit-test. Called explicitly from the autoscroll recalculation path, where the
   * scroll event has not yet fired but the container has already moved.
   */
  invalidateDroppableRects(): void {
    if (this.#session) {
      this.#session.dirty = true;
    }
  }

  /**
   * Find the droppable element at a given point.
   *
   * Uses pure geometric hit-testing against snapshotted droppable rects. When a
   * drag session is active (see {@link beginDragSession}) the rects are cached and
   * reused across frames; otherwise a one-shot DOM query is performed. The
   * `draggedElement` parameter is retained for API compatibility but no longer
   * needs to be hidden — geometry does not depend on cursor occlusion.
   *
   * @param x - Cursor X coordinate
   * @param y - Cursor Y coordinate
   * @param _draggedElement - The element being dragged (unused; kept for compatibility)
   * @param groupName - The drag-and-drop group name to filter by
   * @returns The droppable element, or null if none found
   */
  findDroppableAtPoint(
    x: number,
    y: number,
    _draggedElement: HTMLElement,
    groupName: string,
  ): HTMLElement | null {
    const session = this.#session;
    if (session && session.groupName === groupName) {
      if (session.dirty) {
        for (let i = 0; i < session.candidates.length; i++) {
          session.rects[i] = this.#snapshotRect(session.candidates[i], session.scrollables[i]);
        }
        session.dirty = false;
      }
      return this.#hitTest(x, y, session.candidates, session.rects);
    }

    // No active session: one-shot geometric query (still avoids elementFromPoint).
    const candidates = this.#queryDroppables(groupName);
    const rects = candidates.map((el) => this.#snapshotRect(el, this.#scrollableAncestor(el)));
    return this.#hitTest(x, y, candidates, rects);
  }

  /**
   * Look up a droppable element by its ID.
   *
   * When a drag session is active, searches the cached candidate list (O(n), avoids a DOM
   * query). Falls back to `document.querySelector` when no session is active.
   *
   * Intended for the autoscroll scroll-only fast path, where the active droppable is already
   * known and only the placeholder index needs recalculation.
   */
  getDroppableById(id: string): HTMLElement | null {
    if (this.#session) {
      for (const candidate of this.#session.candidates) {
        if (candidate.getAttribute(this.#DROPPABLE_ID_ATTR) === id) {
          return candidate;
        }
      }
      return null;
    }

    if (typeof document === 'undefined') {
      return null;
    }
    return queryByAttribute<HTMLElement>(document, this.#DROPPABLE_ID_ATTR, id);
  }

  /**
   * Query all droppable elements belonging to a group, in document order.
   *
   * All group members are included — the disabled check happens per-frame in
   * {@link #hitTest} rather than here, because a droppable can be disabled or
   * re-enabled mid-drag (e.g. a consumer disabling incompatible targets from a
   * `(dragStart)` handler, which fires AFTER the candidate snapshot is captured).
   */
  #queryDroppables(groupName: string): HTMLElement[] {
    if (typeof document === 'undefined') {
      return [];
    }
    return queryAllByAttribute<HTMLElement>(document, this.#DROPPABLE_GROUP_ATTR, groupName);
  }

  /**
   * Whether a droppable element is currently disabled (reflected via the
   * `data-droppable-disabled` attribute by `DroppableDirective`). Read live on each
   * hit-test / navigation step so disabled↔enabled transitions during an active drag
   * take effect immediately. Disabled droppables are excluded from all drag-time
   * candidate sets — pointer hit-testing and keyboard cross-list navigation.
   */
  #isDroppableDisabled(el: HTMLElement): boolean {
    return el.hasAttribute(this.#DROPPABLE_DISABLED_ATTR);
  }

  /**
   * Geometric hit-test: return the last candidate (in document order) whose rect
   * contains the point. "Last in document order" reproduces the painter's-order
   * tie-break that `elementFromPoint` provided for free — a nested or later
   * overlapping droppable is painted on top of an earlier/ancestor one.
   *
   * Currently-disabled candidates are skipped here (not filtered from the snapshot) so
   * that toggling `disabled` mid-drag takes effect on the very next frame. The check is
   * a cheap `hasAttribute` read that does not force layout, keeping the loop hot.
   */
  #hitTest(x: number, y: number, candidates: HTMLElement[], rects: DOMRect[]): HTMLElement | null {
    let match: HTMLElement | null = null;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      // Skip candidates removed from the DOM mid-drag: their cached rect is stale and
      // would otherwise linger until a scroll/resize fires. `isConnected` is a cheap
      // property read (no layout), keeping the loop hot.
      if (!candidate.isConnected || this.#isDroppableDisabled(candidate)) {
        continue;
      }
      const r = rects[i];
      // Clipped-away candidates get an empty (zero-area) rect; `right > left` guards them out.
      if (
        r.right > r.left &&
        r.bottom > r.top &&
        x >= r.left &&
        x <= r.right &&
        y >= r.top &&
        y <= r.bottom
      ) {
        match = candidate;
      }
    }
    return match;
  }

  /**
   * Nearest `.vdnd-scrollable` ancestor of a candidate, excluding the candidate itself
   * (clipping a rect by itself is a no-op). Returns null when there is no scrollable
   * clipping container. Resolved once per candidate snapshot and cached on the session.
   */
  #scrollableAncestor(el: HTMLElement): HTMLElement | null {
    return el.parentElement?.closest<HTMLElement>(`.${this.#SCROLLABLE_CLASS}`) ?? null;
  }

  /**
   * Bounding rect of a candidate, intersected with its scrollable ancestor's rect so a
   * droppable scrolled (or reflowed) out of its clipping container hit-tests only over the
   * part actually visible inside the viewport. When fully clipped away the intersection is
   * an empty rect that contains no point.
   */
  #snapshotRect(el: HTMLElement, scrollable: HTMLElement | null): DOMRect {
    const rect = el.getBoundingClientRect();
    if (!scrollable) {
      return rect;
    }
    const clip = scrollable.getBoundingClientRect();
    const top = Math.max(rect.top, clip.top);
    const left = Math.max(rect.left, clip.left);
    const right = Math.min(rect.right, clip.right);
    const bottom = Math.min(rect.bottom, clip.bottom);
    return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  }

  /**
   * Find the draggable element at a given point.
   *
   * @param x - Cursor X coordinate
   * @param y - Cursor Y coordinate
   * @param draggedElement - The element being dragged (will be temporarily hidden)
   * @returns The draggable element, or null if none found
   */
  findDraggableAtPoint(x: number, y: number, draggedElement: HTMLElement): HTMLElement | null {
    const isHidden = draggedElement.offsetParent === null;

    let originalPointerEvents: string | undefined;
    if (!isHidden) {
      originalPointerEvents = draggedElement.style.pointerEvents;
      draggedElement.style.pointerEvents = 'none';
    }

    try {
      const elementAtPoint = document.elementFromPoint(x, y);
      if (!elementAtPoint) {
        return null;
      }

      return this.getDraggableParent(elementAtPoint as HTMLElement);
    } finally {
      if (!isHidden) {
        draggedElement.style.pointerEvents = originalPointerEvents!;
      }
    }
  }

  /**
   * Walk up the DOM tree to find a droppable parent element.
   *
   * @param element - Starting element
   * @param groupName - The drag-and-drop group name to filter by
   * @returns The droppable parent element, or null if none found
   */
  getDroppableParent(element: HTMLElement, groupName: string): HTMLElement | null {
    let current: HTMLElement | null = element;
    let count = 0;

    while (current && current.tagName !== 'BODY' && count < this.#MAX_PARENT_TRAVERSAL) {
      const foundGroup = current.getAttribute(this.#DROPPABLE_GROUP_ATTR);

      if (foundGroup && foundGroup === groupName) {
        return current;
      }

      current = current.parentElement;
      count++;
    }

    return null;
  }

  /**
   * Walk up the DOM tree to find a draggable parent element.
   *
   * @param element - Starting element
   * @returns The draggable parent element, or null if none found
   */
  getDraggableParent(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;
    let count = 0;

    while (current && current.tagName !== 'BODY' && count < this.#MAX_PARENT_TRAVERSAL) {
      const draggableId = current.getAttribute(this.#DRAGGABLE_ID_ATTR);

      if (draggableId) {
        return current;
      }

      current = current.parentElement;
      count++;
    }

    return null;
  }

  /**
   * Get the draggable ID from an element.
   */
  getDraggableId(element: HTMLElement): string | null {
    return element.getAttribute(this.#DRAGGABLE_ID_ATTR);
  }

  /**
   * Get the droppable ID from an element.
   */
  getDroppableId(element: HTMLElement): string | null {
    return element.getAttribute(this.#DROPPABLE_ID_ATTR);
  }

  /**
   * Calculate the drop index based on mathematical position.
   *
   * This is an alternative approach that doesn't require the target element
   * to be in the DOM. Useful when the target might be virtualized away.
   *
   * @param scrollTop - Current scroll position of the container
   * @param cursorY - Cursor Y position (viewport-relative)
   * @param containerTop - Top position of the container (viewport-relative)
   * @param itemHeight - Height of each item
   * @param totalItems - Total number of items in the list
   * @returns The calculated drop index
   */
  calculateDropIndex(
    scrollTop: number,
    cursorY: number,
    containerTop: number,
    itemHeight: number,
    totalItems: number,
  ): number {
    // Calculate the position relative to the container's content
    const relativeY = cursorY - containerTop + scrollTop;

    // Calculate which item index this corresponds to
    const index = Math.floor(relativeY / itemHeight);

    // Clamp to valid range
    return Math.max(0, Math.min(index, totalItems));
  }

  /**
   * Check if a point is within a specific threshold of a container's edge.
   *
   * @param position - Current cursor position
   * @param containerRect - Container's bounding rect
   * @param threshold - Distance from edge to trigger (in pixels)
   * @returns Object indicating which edges are near
   */
  getNearEdge(
    position: { x: number; y: number },
    containerRect: DOMRect,
    threshold: number,
  ): { top: boolean; bottom: boolean; left: boolean; right: boolean } {
    this.#nearEdgeResult.top = position.y - containerRect.top <= threshold;
    this.#nearEdgeResult.bottom = containerRect.bottom - position.y <= threshold;
    this.#nearEdgeResult.left = position.x - containerRect.left <= threshold;
    this.#nearEdgeResult.right = containerRect.right - position.x <= threshold;
    return this.#nearEdgeResult;
  }

  /**
   * Determine if the cursor is inside a container.
   */
  isInsideContainer(position: { x: number; y: number }, containerRect: DOMRect): boolean {
    return (
      position.x >= containerRect.left &&
      position.x <= containerRect.right &&
      position.y >= containerRect.top &&
      position.y <= containerRect.bottom
    );
  }

  /**
   * Find an adjacent droppable in the specified direction (left or right).
   * Used for cross-list keyboard navigation.
   *
   * @param currentDroppableId - The ID of the current droppable
   * @param direction - 'left' or 'right'
   * @param groupName - The drag-and-drop group name
   * @returns Object with droppable info, or null if none found
   */
  findAdjacentDroppable(
    currentDroppableId: string,
    direction: 'left' | 'right',
    groupName: string,
  ): { element: HTMLElement; id: string; itemCount: number } | null {
    // Include disabled droppables when establishing left-to-right order and locating the
    // current container — otherwise a container disabled mid-drag (its own index becomes
    // -1) would trap the drag with no reachable neighbour. Disabled droppables are skipped
    // as *targets* during the outward scan below instead.
    const allDroppables = queryAllByAttribute<HTMLElement>(
      document,
      this.#DROPPABLE_GROUP_ATTR,
      groupName,
    );

    if (allDroppables.length <= 1) {
      return null;
    }

    // Get bounding rects, IDs, and disabled state, sorted by X position
    const droppableInfos: { element: HTMLElement; id: string; rect: DOMRect; disabled: boolean }[] =
      [];

    allDroppables.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const id = htmlEl.getAttribute(this.#DROPPABLE_ID_ATTR);
      if (id) {
        droppableInfos.push({
          element: htmlEl,
          id,
          rect: htmlEl.getBoundingClientRect(),
          disabled: this.#isDroppableDisabled(htmlEl),
        });
      }
    });

    // Sort by X position (left to right)
    droppableInfos.sort((a, b) => a.rect.left - b.rect.left);

    // Find current droppable index (among all, including a now-disabled current container)
    const currentIndex = droppableInfos.findIndex((d) => d.id === currentDroppableId);
    if (currentIndex === -1) {
      return null;
    }

    // Scan outward in the requested direction, skipping disabled droppables, until the
    // first enabled neighbour (or run off the end of the list).
    const step = direction === 'left' ? -1 : 1;
    for (let i = currentIndex + step; i >= 0 && i < droppableInfos.length; i += step) {
      const target = droppableInfos[i];
      if (target.disabled) {
        continue;
      }
      return {
        element: target.element,
        id: target.id,
        itemCount: this.#getDroppableItemCount(target.element),
      };
    }

    return null;
  }

  /**
   * Whether the droppable with the given ID is currently disabled. A droppable that cannot
   * be found is reported as disabled (treat missing as not a valid target). Used to
   * revalidate a keyboard drag's active target at drop time, since it may have been disabled
   * after the drag navigated into it.
   */
  isDroppableDisabledById(id: string): boolean {
    const element = this.getDroppableById(id);
    return element === null || this.#isDroppableDisabled(element);
  }

  /**
   * Get the total item count in a droppable.
   * Uses spacer height and data attributes if available, otherwise counts DOM elements.
   */
  #getDroppableItemCount(droppableElement: HTMLElement): number {
    const virtualScroll = droppableElement.querySelector('vdnd-virtual-scroll');
    if (virtualScroll) {
      const configuredHeight = virtualScroll.getAttribute('data-item-height');

      if (!configuredHeight) {
        if (isDevMode()) {
          console.error(
            '[ngx-virtual-dnd] vdnd-virtual-scroll requires data-item-height attribute ' +
              'for keyboard navigation. Cross-list keyboard drag will not work correctly.',
          );
        }
        // Short-circuit: return 0 to prevent navigation to this droppable
        return 0;
      }

      // Prefer spacer height over scrollHeight for accuracy
      const spacer = virtualScroll.querySelector(
        '.vdnd-virtual-scroll-spacer',
      ) as HTMLElement | null;
      const totalHeight = spacer
        ? parseFloat(spacer.style.height) || 0
        : (virtualScroll as HTMLElement).scrollHeight;

      const itemHeight = parseInt(configuredHeight, 10);
      return Math.floor(totalHeight / itemHeight);
    }
    // Fallback for non-virtual scroll: DOM count is valid
    return droppableElement.querySelectorAll(`[${this.#DRAGGABLE_ID_ATTR}]`).length;
  }
}
