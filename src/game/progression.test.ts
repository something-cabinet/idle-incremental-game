import { describe, expect, it } from 'vitest';
import { PRESTIGE_UNLOCK_ENERGY } from './config';
import {
  createInitialState,
  generatorCost,
  normalizeState,
  productionPerSecond,
} from './logic';
import { buyPerk, canBuyPerk, computeModifiers, perkCost, perkLevel } from './perks';
import { canPrestige, performPrestige, prestigeGain } from './prestige';

describe('perks', () => {
  it('buying a perk costs prestige points and raises its level', () => {
    let s = { ...createInitialState(0), prestigePoints: 10 };
    s = buyPerk(s, 'overclock');
    expect(perkLevel(s, 'overclock')).toBe(1);
    expect(s.prestigePoints).toBe(10 - perkCost(createInitialState(0), 'overclock'));
  });

  it('cannot buy a perk without enough points', () => {
    const s = createInitialState(0);
    expect(canBuyPerk(s, 'overclock')).toBe(false);
    expect(buyPerk(s, 'overclock')).toBe(s);
  });

  it('overclock multiplies production', () => {
    let s = { ...createInitialState(0), energy: 15, prestigePoints: 5 };
    s = { ...s, generators: { ...s.generators, hamster: 1 } };
    const before = productionPerSecond(s);
    s = buyPerk(s, 'overclock'); // +10%
    expect(productionPerSecond(s)).toBeCloseTo(before * 1.1);
  });

  it('bulk discount reduces generator cost', () => {
    let s = { ...createInitialState(0), prestigePoints: 10 };
    // Use an expensive generator so the 2% shows past integer rounding.
    const before = generatorCost(s, 'reactor');
    s = buyPerk(s, 'bulk-discount'); // -2%
    expect(computeModifiers(s).costMult).toBeCloseTo(0.98);
    expect(generatorCost(s, 'reactor')).toBeLessThan(before);
  });

  it('respects perk requirements', () => {
    const s = { ...createInitialState(0), prestigePoints: 100 };
    // night-shift requires overclock
    expect(canBuyPerk(s, 'night-shift')).toBe(false);
    const withOverclock = buyPerk(s, 'overclock');
    expect(canBuyPerk(withOverclock, 'night-shift')).toBe(true);
  });
});

describe('prestige', () => {
  it('is locked until the unlock threshold', () => {
    const s = { ...createInitialState(0), totalEnergyEarned: PRESTIGE_UNLOCK_ENERGY - 1 };
    expect(canPrestige(s)).toBe(false);
  });

  it('grants points based on earnings and resets the run', () => {
    const s = {
      ...createInitialState(0),
      energy: 5_000_000,
      totalEnergyEarned: 4_000_000,
      generators: { ...createInitialState(0).generators, hamster: 50 },
    };
    const gain = prestigeGain(s);
    expect(gain).toBeGreaterThan(0);
    const after = performPrestige(s, 1000);
    expect(after.prestigePoints).toBe(gain);
    expect(after.prestigeCount).toBe(1);
    expect(after.energy).toBe(0);
    expect(after.generators.hamster).toBe(0);
    expect(after.lifetimeEnergyEarned).toBe(4_000_000);
  });

  it('keeps perks and settings through a prestige', () => {
    let s = { ...createInitialState(0), prestigePoints: 10, totalEnergyEarned: 4_000_000 };
    s = buyPerk(s, 'overclock');
    s = { ...s, settings: { ...s.settings, numberFormat: 'scientific' } };
    const after = performPrestige(s, 1000);
    expect(perkLevel(after, 'overclock')).toBe(1);
    expect(after.settings.numberFormat).toBe('scientific');
  });

  it('compound-interest perk increases prestige gain', () => {
    // At 400M earned, base gain is 20 pts; +15% -> 23, clear of rounding.
    const base = { ...createInitialState(0), totalEnergyEarned: 400_000_000 };
    const withPerk = { ...base, perks: { 'compound-interest': 1 } };
    expect(prestigeGain(withPerk)).toBeGreaterThan(prestigeGain(base));
  });
});

describe('save migration', () => {
  it('fills missing fields from an old v1 save', () => {
    // Simulate a v1 save that had no perks/prestige/settings fields.
    const old = {
      energy: 42,
      totalEnergyEarned: 42,
      generators: { hamster: 3 },
      clickPower: 1,
      lastUpdate: 5000,
    };
    const s = normalizeState(old);
    expect(s.energy).toBe(42);
    expect(s.generators.hamster).toBe(3);
    expect(s.generators.solar).toBe(0); // filled default
    expect(s.perks).toEqual({});
    expect(s.prestigePoints).toBe(0);
    expect(s.settings.numberFormat).toBe('short');
  });
});
