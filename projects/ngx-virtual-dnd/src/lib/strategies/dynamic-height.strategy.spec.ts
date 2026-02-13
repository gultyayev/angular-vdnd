import { DynamicHeightStrategy } from './dynamic-height.strategy';

describe('DynamicHeightStrategy', () => {
  it('does not bump version when excluded index is unchanged', () => {
    const strategy = new DynamicHeightStrategy(50);
    strategy.setItemKeys(['a', 'b', 'c']);

    strategy.setExcludedIndex(1);
    const versionAfterFirstSet = strategy.version();

    strategy.setExcludedIndex(1);

    expect(strategy.version()).toBe(versionAfterFirstSet);
  });

  it('does not bump version when item keys are unchanged', () => {
    const strategy = new DynamicHeightStrategy(50);

    strategy.setItemKeys(['a', 'b', 'c']);
    const versionAfterFirstSet = strategy.version();

    strategy.setItemKeys(['a', 'b', 'c']);

    expect(strategy.version()).toBe(versionAfterFirstSet);
  });

  it('forgets measured heights for removed keys', () => {
    const strategy = new DynamicHeightStrategy(50);
    strategy.setItemKeys(['a']);
    strategy.setMeasuredHeight('a', 80);
    expect(strategy.getItemHeight(0)).toBe(80);

    strategy.setItemKeys([]);
    strategy.setItemKeys(['a']);

    expect(strategy.getItemHeight(0)).toBe(50);
  });
});
