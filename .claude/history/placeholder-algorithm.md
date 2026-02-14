# Placeholder Index Algorithm — Detailed Design

This document covers the internals of `DragIndexCalculatorService`'s placeholder index calculation. Read this before modifying placeholder behavior.

## Capped Center Probe + Midpoint Refinement

The placeholder index probe uses two complementary mechanisms for dynamic heights:

### Capped Center Probe

`min(center, top + itemHeight/2)` limits how deep the probe reaches. Prevents a tall preview (e.g. 120px among 60px items) from overshooting multiple positions — the center would land 2+ items away, but the cap keeps it within one item of the top edge.

### Midpoint Refinement (Strategy Path Only)

After `findIndexAtOffset` returns an index, checks whether the preview's top edge has passed the target item's midpoint. Only then advances `visualIndex` by 1. Prevents a short preview (e.g. 60px entering a 150px item) from triggering displacement at ~20% overlap — displacement now requires 50% of the target item's actual height.

### Why Both Are Needed

These solve opposite directions of the height mismatch:

- The cap pulls the probe **up** (tall preview → short items)
- Midpoint pushes the index **down** (short preview → tall items)
- Removing either breaks the other's scenario

### Fixed-Height Path

Uses `Math.floor(relativeY / itemHeight)` directly (no refinement needed since all items are the same height).

### Constrained Mode

`constrainToContainer` uses the same capped center probe and midpoint refinement as unconstrained mode. Edge snapping overrides the index to 0 or totalItems when the preview bounds are within 2px of the droppable container edges (needed because clamping prevents the probe from reaching the first/last slot for tall items).

## Same-List Adjustment

When dragging within the same list, apply +1 adjustment when `visualIndex >= sourceIndex` to compensate for the hidden item.

## Virtual Scroll Integration

During same-list drag, `scrollHeight` reflects N-1 items. The `getTotalItemCount()` method adds 1 back for true logical total.

## State Caching in Effects

Cache state snapshots in effects if needed during cleanup (state may be cleared before effect fires):

```typescript
#cachedState: State | null = null;

effect(() => {
  if (this.isActive()) {
    this.#cachedState = this.#service.getStateSnapshot();
  }
});

#handleDrop(): void {
  const state = this.#cachedState; // Use cached, not current state
}
```
