/**
 * Normalize a placeholder index into the final same-list insertion index.
 *
 * Same-list drags render a placeholder in a list with the source item hidden, so placeholder
 * indexes after the source include a +1 hidden-source adjustment. Drop consumers receive the
 * post-removal insertion index, which subtracts that adjustment.
 */
export function normalizeDropDestinationIndex(args: {
  sourceIndex: number;
  placeholderIndex: number;
  sourceDroppableId: string | null;
  activeDroppableId: string | null;
}): number;
export function normalizeDropDestinationIndex(args: {
  sourceIndex: number;
  placeholderIndex: number | null;
  sourceDroppableId: string | null;
  activeDroppableId: string | null;
}): number | null;
export function normalizeDropDestinationIndex({
  sourceIndex,
  placeholderIndex,
  sourceDroppableId,
  activeDroppableId,
}: {
  sourceIndex: number;
  placeholderIndex: number | null;
  sourceDroppableId: string | null;
  activeDroppableId: string | null;
}): number | null {
  if (placeholderIndex === null || activeDroppableId === null) {
    return null;
  }

  if (
    sourceDroppableId !== null &&
    sourceDroppableId === activeDroppableId &&
    sourceIndex < placeholderIndex
  ) {
    return placeholderIndex - 1;
  }

  return placeholderIndex;
}
