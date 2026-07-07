/**
 * Query by an exact attribute value without interpolating consumer data into a CSS selector.
 *
 * CSS attribute selectors need string-specific escaping that differs from `CSS.escape()`.
 * Filtering candidates by attribute presence avoids selector syntax errors for IDs containing
 * quotes, brackets, backslashes, or other selector-sensitive characters.
 */
export function queryByAttribute<T extends Element>(
  root: ParentNode,
  attributeName: string,
  attributeValue: string,
): T | null {
  const candidates = root.querySelectorAll<T>(`[${attributeName}]`);

  for (const candidate of candidates) {
    if (candidate.getAttribute(attributeName) === attributeValue) {
      return candidate;
    }
  }

  return null;
}

export function queryAllByAttribute<T extends Element>(
  root: ParentNode,
  attributeName: string,
  attributeValue: string,
): T[] {
  return Array.from(root.querySelectorAll<T>(`[${attributeName}]`)).filter(
    (candidate) => candidate.getAttribute(attributeName) === attributeValue,
  );
}
