import { createHeightStrategy, loadDynamicHeightStrategy } from './height-strategy-loader';
import { FixedHeightStrategy } from '../strategies/fixed-height.strategy';
import { DynamicHeightStrategy } from '../strategies/dynamic-height.strategy';

describe('height-strategy-loader', () => {
  it('creates a fixed-height strategy synchronously when dynamic is false', () => {
    const strategy = createHeightStrategy(40, false);

    expect(strategy).toBeInstanceOf(FixedHeightStrategy);
    expect(strategy.measuresHeight).toBe(false);
    expect(strategy.getOffsetForIndex(3)).toBe(120);
  });

  it('stands in with a fixed-height estimate before the dynamic chunk resolves', () => {
    // Runs before any await of loadDynamicHeightStrategy(): the dynamic chunk
    // has not resolved yet, so the estimate stand-in is returned.
    const strategy = createHeightStrategy(50, true);

    // The stand-in is behaviourally identical to a freshly-constructed dynamic
    // strategy with no measurements: every row reports the estimate.
    expect(strategy.getOffsetForIndex(2)).toBe(100);
    expect(strategy.measuresHeight).toBe(false);
  });

  it('resolves the dynamic-height strategy constructor', async () => {
    const ctor = await loadDynamicHeightStrategy();

    expect(ctor).toBe(DynamicHeightStrategy);
  });

  it('upgrades to the measuring strategy once the chunk has loaded', async () => {
    await loadDynamicHeightStrategy();

    const strategy = createHeightStrategy(50, true);

    expect(strategy).toBeInstanceOf(DynamicHeightStrategy);
    expect(strategy.measuresHeight).toBe(true);
  });
});
