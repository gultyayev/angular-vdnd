import { signal } from '@angular/core';
import { VdndGroupRegistry, type VdndGroupMember } from './vdnd-group-registry';

describe('VdndGroupRegistry', () => {
  let registry: VdndGroupRegistry;

  beforeEach(() => {
    registry = new VdndGroupRegistry();
  });

  function member(
    id: string,
    element: HTMLElement,
    group: string,
    data: unknown = null,
  ): VdndGroupMember {
    return { id, element, group, data: signal(data) };
  }

  it('registers and looks up members by group and id', () => {
    const el = document.createElement('div');
    registry.register(member('list-1', el, 'board', { name: 'todo' }));

    expect(registry.size('board')).toBe(1);
    expect(registry.getMember('board', 'list-1')?.element).toBe(el);
    expect(registry.getMember('board', 'list-1')?.data()).toEqual({ name: 'todo' });
  });

  it('isolates members by group name', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    registry.register(member('a', a, 'groupA'));
    registry.register(member('b', b, 'groupB'));

    // A drag in groupB must not see groupA's droppable.
    expect(registry.getMembersInDocumentOrder('groupB').map((m) => m.id)).toEqual(['b']);
    expect(registry.getMember('groupB', 'a')).toBeUndefined();
  });

  it('merges same-named members from different wrappers', () => {
    // Two separate subtrees both resolving to group "tasks" must connect.
    const wrapper1 = document.createElement('div');
    const wrapper2 = document.createElement('div');
    const list1 = document.createElement('div');
    const list2 = document.createElement('div');
    wrapper1.appendChild(list1);
    wrapper2.appendChild(list2);
    document.body.append(wrapper1, wrapper2);

    registry.register(member('list-1', list1, 'tasks'));
    registry.register(member('list-2', list2, 'tasks'));

    expect(registry.getMembersInDocumentOrder('tasks').map((m) => m.id)).toEqual([
      'list-1',
      'list-2',
    ]);

    document.body.replaceChildren();
  });

  it('unregisters by element without disturbing other members', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    registry.register(member('a', a, 'board'));
    registry.register(member('b', b, 'board'));

    registry.unregister('board', a);

    expect(registry.getMember('board', 'a')).toBeUndefined();
    expect(registry.getMember('board', 'b')?.element).toBe(b);
    expect(registry.size('board')).toBe(1);

    // Unknown group/element is a no-op, not an error.
    expect(() => registry.unregister('missing', a)).not.toThrow();
  });

  it('keeps both members when two droppables swap IDs in one pass', () => {
    // Repro for the ownership-aware-unregister fix: element identity, not the ID,
    // is the key, so re-registering under a swapped ID cannot delete the peer.
    const elA = document.createElement('div');
    const elB = document.createElement('div');
    registry.register(member('a', elA, 'board'));
    registry.register(member('b', elB, 'board'));

    // elA becomes 'b', elB becomes 'a' — group unchanged, so each just re-registers
    // its own element (no unregister needed on a same-group update).
    registry.register(member('b', elA, 'board'));
    registry.register(member('a', elB, 'board'));

    expect(registry.size('board')).toBe(2);
    expect(registry.getMember('board', 'b')?.element).toBe(elA);
    expect(registry.getMember('board', 'a')?.element).toBe(elB);
  });

  it('returns members in document order regardless of registration order', () => {
    const container = document.createElement('div');
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    container.append(a, b, c);
    document.body.appendChild(container);

    registry.register(member('c', c, 'board'));
    registry.register(member('a', a, 'board'));
    registry.register(member('b', b, 'board'));

    expect(registry.getMembersInDocumentOrder('board').map((m) => m.id)).toEqual(['a', 'b', 'c']);

    document.body.removeChild(container);
  });

  it('preserves paint order for nested droppables (child after parent)', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);

    registry.register(member('child', child, 'board'));
    registry.register(member('parent', parent, 'board'));

    // A nested droppable paints on top of its ancestor → must sort last so the
    // geometric hit-test's "last match wins" tie-break selects it.
    expect(registry.getMembersInDocumentOrder('board').map((m) => m.id)).toEqual([
      'parent',
      'child',
    ]);

    document.body.removeChild(parent);
  });

  it('reports an empty list for an unknown group', () => {
    expect(registry.getMembersInDocumentOrder('nope')).toEqual([]);
    expect(registry.size('nope')).toBe(0);
  });
});
