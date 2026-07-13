import { normalizeDropDestinationIndex } from './drop-index-normalization';

describe('normalizeDropDestinationIndex', () => {
  it('returns null when there is no placeholder index', () => {
    expect(
      normalizeDropDestinationIndex({
        sourceIndex: 0,
        placeholderIndex: null,
        sourceDroppableId: 'list-1',
        activeDroppableId: 'list-1',
      }),
    ).toBeNull();
  });

  it('returns null when there is no active droppable', () => {
    expect(
      normalizeDropDestinationIndex({
        sourceIndex: 0,
        placeholderIndex: 2,
        sourceDroppableId: 'list-1',
        activeDroppableId: null,
      }),
    ).toBeNull();
  });

  it('subtracts the hidden source adjustment for same-list moves after the source', () => {
    expect(
      normalizeDropDestinationIndex({
        sourceIndex: 1,
        placeholderIndex: 4,
        sourceDroppableId: 'list-1',
        activeDroppableId: 'list-1',
      }),
    ).toBe(3);
  });

  it('leaves cross-list placeholder indexes unchanged', () => {
    expect(
      normalizeDropDestinationIndex({
        sourceIndex: 1,
        placeholderIndex: 4,
        sourceDroppableId: 'list-1',
        activeDroppableId: 'list-2',
      }),
    ).toBe(4);
  });
});
