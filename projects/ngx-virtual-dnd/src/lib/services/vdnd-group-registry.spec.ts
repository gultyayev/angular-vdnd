import { signal } from '@angular/core';
import { VdndGroupRegistry } from './vdnd-group-registry';

describe('VdndGroupRegistry', () => {
  let registry: VdndGroupRegistry;

  beforeEach(() => {
    registry = new VdndGroupRegistry();
  });

  function member(id: string, element: HTMLElement, data: unknown = null) {
    return { id, element, data: signal(data) };
  }

  it('registers and looks up members by id', () => {
    const el = document.createElement('div');
    registry.register(member('list-1', el, { name: 'todo' }));

    expect(registry.size).toBe(1);
    expect(registry.getMember('list-1')?.element).toBe(el);
    expect(registry.getMember('list-1')?.data()).toEqual({ name: 'todo' });
  });

  it('replaces an existing member registered under the same id', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    registry.register(member('list-1', first));
    registry.register(member('list-1', second));

    expect(registry.size).toBe(1);
    expect(registry.getMember('list-1')?.element).toBe(second);
  });

  it('unregisters members and tolerates unknown ids', () => {
    const el = document.createElement('div');
    registry.register(member('list-1', el));

    registry.unregister('list-1');
    expect(registry.getMember('list-1')).toBeUndefined();
    expect(registry.size).toBe(0);

    // Unknown id is a no-op, not an error.
    expect(() => registry.unregister('missing')).not.toThrow();
  });

  it('returns members in document order regardless of registration order', () => {
    const container = document.createElement('div');
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    container.append(a, b, c);
    document.body.appendChild(container);

    // Register out of document order.
    registry.register(member('c', c));
    registry.register(member('a', a));
    registry.register(member('b', b));

    expect(registry.getMembersInDocumentOrder().map((m) => m.id)).toEqual(['a', 'b', 'c']);

    document.body.removeChild(container);
  });

  it('preserves paint order for nested droppables (child after parent)', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);

    registry.register(member('child', child));
    registry.register(member('parent', parent));

    // A nested droppable paints on top of its ancestor → must sort last so
    // the geometric hit-test's "last match wins" tie-break selects it.
    expect(registry.getMembersInDocumentOrder().map((m) => m.id)).toEqual(['parent', 'child']);

    document.body.removeChild(parent);
  });
});
