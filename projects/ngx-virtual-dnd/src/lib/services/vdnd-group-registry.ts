import { Injectable, type Signal } from '@angular/core';

/**
 * A droppable participating in a drag-and-drop group.
 *
 * The registry keeps the live element plus a reactive `data` view so consumers of
 * the group (geometric hit-testing today, cross-list `transferItem()` later) read
 * from a single membership source instead of re-querying the DOM.
 */
export interface VdndGroupMember {
  /** Consumer-supplied droppable ID (`data-droppable-id`). */
  readonly id: string;
  /** The droppable host element. */
  readonly element: HTMLElement;
  /** Reactive view of the droppable's associated data. */
  readonly data: Signal<unknown>;
}

/**
 * Membership registry for a single `vdndGroup` subtree.
 *
 * Provided by {@link DroppableGroupDirective} on its element injector — **never**
 * `providedIn: 'root'` — so every droppable/draggable under a given `vdndGroup`
 * resolves the same instance and shares one authoritative candidate set. This is
 * the keystone the 4.0 refactor's perf (cached-rect hit-testing) and DX
 * (`transferItem()`) both consume.
 *
 * Absent a `vdndGroup` wrapper the registry does not exist; callers must fall back
 * to a DOM query (`data-droppable-group`) so explicit-group usage keeps working.
 */
@Injectable()
export class VdndGroupRegistry {
  readonly #members = new Map<string, VdndGroupMember>();

  /**
   * Register (or replace) a droppable member by ID. Called by
   * {@link DroppableDirective} once its ID input is available and whenever the ID
   * changes.
   */
  register(member: VdndGroupMember): void {
    this.#members.set(member.id, member);
  }

  /**
   * Remove a droppable member by ID. Called on directive teardown or ID change.
   * Safe to call with an unknown ID.
   */
  unregister(id: string): void {
    this.#members.delete(id);
  }

  /** Look up a single member by its droppable ID. */
  getMember(id: string): VdndGroupMember | undefined {
    return this.#members.get(id);
  }

  /** Number of registered members (primarily for tests/diagnostics). */
  get size(): number {
    return this.#members.size;
  }

  /**
   * Members sorted in document order, which equals default paint order.
   *
   * Hit-testing relies on this ordering to reproduce the painter's-order
   * tie-break `elementFromPoint` gave for free: when droppables overlap, the last
   * one in document order is painted on top and wins. `querySelectorAll` (the
   * fallback path) already yields document order, so both paths agree.
   */
  getMembersInDocumentOrder(): VdndGroupMember[] {
    return [...this.#members.values()].sort((a, b) => {
      if (a.element === b.element) return 0;
      const relation = a.element.compareDocumentPosition(b.element);
      if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }
}
