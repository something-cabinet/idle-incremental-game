import { describe, expect, it } from 'vitest';
import { OFFLINE_CAP_HOURS } from './config';
import {
  applyOfflineProgress,
  buyGenerator,
  click,
  createInitialState,
  generatorCost,
  productionPerSecond,
  tick,
} from './logic';

describe('core loop', () => {
  it('clicking earns clickPower energy', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 20; i++) s = click(s);
    expect(s.energy).toBe(20);
    expect(s.totalEnergyEarned).toBe(20);
  });

  it('buying a generator spends energy and adds production', () => {
    let s = { ...createInitialState(0), energy: 20 };
    s = buyGenerator(s, 'hamster');
    expect(s.energy).toBe(5); // hamster costs 15
    expect(s.generators.hamster).toBe(1);
    expect(productionPerSecond(s)).toBe(0.5);
  });

  it('buying without funds is a no-op', () => {
    const s = createInitialState(0);
    expect(buyGenerator(s, 'dyson')).toBe(s);
  });

  it('cost grows exponentially with owned count', () => {
    let s = { ...createInitialState(0), energy: 1_000_000 };
    expect(generatorCost(s, 'hamster')).toBe(15);
    s = buyGenerator(s, 'hamster');
    expect(generatorCost(s, 'hamster')).toBe(Math.ceil(15 * 1.15));
  });

  it('tick earns production * dt', () => {
    let s = { ...createInitialState(0), energy: 15 };
    s = buyGenerator(s, 'hamster');
    s = tick(s, 10, 10_000);
    expect(s.energy).toBeCloseTo(5); // 0.5/sec * 10s
    expect(s.lastUpdate).toBe(10_000);
  });
});

describe('offline progress', () => {
  it('credits elapsed time since lastUpdate', () => {
    let s = { ...createInitialState(0), energy: 15 };
    s = buyGenerator(s, 'hamster');
    s = { ...s, lastUpdate: 0 };
    const { offlineEarnings, offlineSeconds } = applyOfflineProgress(s, 3600_000);
    expect(offlineSeconds).toBe(3600);
    expect(offlineEarnings).toBeCloseTo(1800); // 0.5/sec * 1h
  });

  it('caps offline time', () => {
    const s = { ...createInitialState(0), lastUpdate: 0 };
    const { offlineSeconds } = applyOfflineProgress(s, 1000 * 3600_000);
    expect(offlineSeconds).toBe(OFFLINE_CAP_HOURS * 3600);
  });

  it('never credits negative time (clock skew)', () => {
    const s = { ...createInitialState(1000), energy: 0 };
    const { offlineEarnings } = applyOfflineProgress(s, 0);
    expect(offlineEarnings).toBe(0);
  });
});
