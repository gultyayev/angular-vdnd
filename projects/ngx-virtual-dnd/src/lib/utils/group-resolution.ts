import { computed, isDevMode, type Signal } from '@angular/core';
import type { VdndGroupContext } from '../directives/droppable-group.directive';

/**
 * Configuration options for creating an effective group signal.
 */
export interface GroupResolutionOptions {
  /** The explicit group input signal */
  explicitGroup: Signal<string | undefined>;
  /** The parent group context injected via VDND_GROUP_TOKEN (may be null) */
  parentGroup: VdndGroupContext | null;
  /** The element ID signal for warning messages */
  elementId: Signal<string>;
  /** The type of element ('draggable' or 'droppable') for warning messages */
  elementType: 'draggable' | 'droppable';
}

/**
 * State tracker for group resolution to avoid repeated warnings.
 */
interface GroupResolutionState {
  hasWarnedMissingGroup: boolean;
}

/**
 * Creates a computed signal that resolves the effective group name for a draggable or droppable.
 *
 * Resolution order:
 * 1. Explicit group input (vdndDraggableGroup or vdndDroppableGroup)
 * 2. Inherited group from parent vdndGroup directive
 * 3. null (with dev-mode warning)
 *
 * @example
 * ```typescript
 * readonly #effectiveGroup = createEffectiveGroupSignal({
 *   explicitGroup: this.vdndDraggableGroup,
 *   parentGroup: this.#parentGroup,
 *   elementId: this.vdndDraggable,
 *   elementType: 'draggable',
 * });
 * ```
 */
export function createEffectiveGroupSignal(options: GroupResolutionOptions): Signal<string | null> {
  const { explicitGroup, parentGroup, elementId, elementType } = options;

  // State object to track whether we've warned (mutable closure state)
  const state: GroupResolutionState = { hasWarnedMissingGroup: false };

  return computed((): string | null => {
    const explicit = explicitGroup();
    if (explicit) return explicit;

    const inherited = parentGroup?.group();
    if (inherited) return inherited;

    if (isDevMode() && !state.hasWarnedMissingGroup) {
      const directive = elementType === 'draggable' ? 'vdndDraggable' : 'vdndDroppable';
      const groupInput = elementType === 'draggable' ? 'vdndDraggableGroup' : 'vdndDroppableGroup';
      const action = elementType === 'draggable' ? 'Drag' : 'Dropping';

      console.warn(
        `[ngx-virtual-dnd] [${directive}="${elementId()}"] requires a group. ` +
          `Either set ${groupInput} or wrap in a vdndGroup directive. ` +
          `${action} will be disabled for this element.`,
      );
      state.hasWarnedMissingGroup = true;
    }

    return null;
  });
}
