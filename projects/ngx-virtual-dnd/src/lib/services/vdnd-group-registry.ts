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
  /** The resolved group name this droppable belongs to. */
  readonly group: string;
}

/**
 * App-level membership registry keyed by **group name**.
 *
 * The group name — not any DOM wrapper instance — is the identity of a connection
 * set: every droppable that resolves to the same name belongs to the same group,
 * regardless of where it sits in the tree. This matches the pre-registry
 * `data-droppable-group` DOM-query semantics (a global, layout-independent key) and
 * keeps separate `vdndGroup` wrappers that share a name connected.
 *
 * Members are stored **by element** within each group bucket so a directive only
 * ever removes its own entry — an ID that has since been reassigned to a different
 * droppable can never delete the wrong member.
 *
 * `providedIn: 'root'`: a passive lookup table (no eager feature wiring), consumed
 * by {@link PositionCalculatorService} for cached-rect hit-testing and, later, by
 * cross-list `transferItem()`. Absent any registration the hit-testing path falls
 * back to a DOM query, so the registry is purely additive.
 */
@Injectable({ providedIn: 'root' })
export class VdndGroupRegistry {
  /** group name → (element → member). Element keys keep unregister ownership-safe. */
  readonly #groups = new Map<string, Map<HTMLElement, VdndGroupMember>>();

  /**
   * Register (or update) a droppable member. Called by {@link DroppableDirective}
   * once its resolved group is available and whenever its ID/group changes. When
   * the group changes the caller must unregister the old group first.
   */
  register(member: VdndGroupMember): void {
    let bucket = this.#groups.get(member.group);
    if (!bucket) {
      bucket = new Map<HTMLElement, VdndGroupMember>();
      this.#groups.set(member.group, bucket);
    }
    bucket.set(member.element, member);
  }

  /**
   * Remove a droppable member from a group by its element. Safe to call with an
   * unknown group/element. Keying on the element (not the ID) guarantees a
   * directive removes only the entry it owns.
   */
  unregister(group: string, element: HTMLElement): void {
    const bucket = this.#groups.get(group);
    if (!bucket) {
      return;
    }
    bucket.delete(element);
    if (bucket.size === 0) {
      this.#groups.delete(group);
    }
  }

  /** Look up a single member of a group by its droppable ID. */
  getMember(group: string, id: string): VdndGroupMember | undefined {
    const bucket = this.#groups.get(group);
    if (!bucket) {
      return undefined;
    }
    for (const member of bucket.values()) {
      if (member.id === id) {
        return member;
      }
    }
    return undefined;
  }

  /** Number of registered members in a group (primarily for tests/diagnostics). */
  size(group: string): number {
    return this.#groups.get(group)?.size ?? 0;
  }

  /**
   * Members of `group` sorted in document order, which equals default paint order.
   *
   * Hit-testing relies on this ordering to reproduce the painter's-order tie-break
   * `elementFromPoint` gave for free: when droppables overlap, the last one in
   * document order is painted on top and wins. `querySelectorAll` (the fallback
   * path) already yields document order, so both paths agree.
   */
  getMembersInDocumentOrder(group: string): VdndGroupMember[] {
    const bucket = this.#groups.get(group);
    if (!bucket) {
      return [];
    }
    return [...bucket.values()].sort((a, b) => {
      if (a.element === b.element) return 0;
      const relation = a.element.compareDocumentPosition(b.element);
      if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }
}
