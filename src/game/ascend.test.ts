import { describe, expect, it } from 'vitest';
import { ascendEquipment, generateAdventurer, generateEquipment } from './adventurers';
import { RARITY_BONUS_ATTRS, RARITY_MULT } from './config';
import {
  ascendCost,
  ascendItem,
  canAscendItem,
  equipItem,
  exaltedItems,
  findEquipment,
} from './guild';
import { createInitialState } from './logic';
import type { Equipment, GameState } from './types';

const mid = () => 0.5;

function guildState(): GameState {
  return { ...createInitialState(0), act: 2 as const, gold: 100_000 };
}

/** An exalted item, deterministic slot/type via mid rng, forced tier/rarity. */
function exaltedItem(id: number, tier = 6): Equipment {
  return { ...generateEquipment(id, tier, mid), rarity: 'exalted' as const, tier };
}

function withEssence(state: GameState, cost: Record<string, number>): GameState {
  return { ...state, materials: { ...state.materials, ...cost } };
}

describe('ascendCost', () => {
  it('matches the documented tier-6 example exactly', () => {
    expect(ascendCost(6)).toEqual({
      'exalted-essence': 600,
      'epic-essence': 1200,
      'rare-essence': 3000,
      'common-essence': 6000,
    });
  });

  it('scales linearly with tier', () => {
    expect(ascendCost(1)).toEqual({
      'exalted-essence': 100,
      'epic-essence': 200,
      'rare-essence': 500,
      'common-essence': 1000,
    });
    expect(ascendCost(3)).toEqual({
      'exalted-essence': 300,
      'epic-essence': 600,
      'rare-essence': 1500,
      'common-essence': 3000,
    });
  });
});

describe('findEquipment / exaltedItems', () => {
  it('finds an item in the shared inventory', () => {
    const item = exaltedItem(1);
    const s = { ...guildState(), inventory: [item] };
    expect(findEquipment(s, 1)).toEqual({ item });
  });

  it('finds an item equipped on a champion, reporting the wearer', () => {
    const adv = generateAdventurer(1, mid);
    const item = exaltedItem(1);
    let s = { ...guildState(), adventurers: [adv], inventory: [item] };
    s = equipItem(s, adv.id, item.id);
    const found = findEquipment(s, item.id);
    expect(found?.advId).toBe(adv.id);
    expect(found?.item.id).toBe(item.id);
  });

  it('returns null for an unknown item id', () => {
    expect(findEquipment(guildState(), 999)).toBeNull();
  });

  it('lists equipped exalted items ahead of unequipped ones, and excludes other rarities', () => {
    const adv = generateAdventurer(1, mid);
    const equippedExalted = exaltedItem(1);
    const unequippedExalted = exaltedItem(2);
    const rareItem = { ...generateEquipment(3, 1, mid), rarity: 'rare' as const };
    let s = {
      ...guildState(),
      adventurers: [adv],
      inventory: [equippedExalted, unequippedExalted, rareItem],
    };
    s = equipItem(s, adv.id, equippedExalted.id);

    const list = exaltedItems(s);
    expect(list.map((c) => c.item.id)).toEqual([equippedExalted.id, unequippedExalted.id]);
    expect(list[0].advId).toBe(adv.id);
    expect(list[1].advId).toBeUndefined();
  });
});

describe('canAscendItem', () => {
  it('rejects a non-exalted item even with plenty of essence', () => {
    const item = { ...generateEquipment(1, 6, mid), rarity: 'epic' as const, tier: 6 };
    const s = withEssence({ ...guildState(), inventory: [item] }, ascendCost(6));
    expect(canAscendItem(s, item.id)).toBe(false);
  });

  it('rejects an exalted item when any single essence is short', () => {
    const item = exaltedItem(1, 6);
    const cost = ascendCost(6);
    const short = { ...cost, 'common-essence': cost['common-essence'] - 1 };
    const s = withEssence({ ...guildState(), inventory: [item] }, short);
    expect(canAscendItem(s, item.id)).toBe(false);
  });

  it('accepts an exalted item once every essence cost is met', () => {
    const item = exaltedItem(1, 6);
    const s = withEssence({ ...guildState(), inventory: [item] }, ascendCost(6));
    expect(canAscendItem(s, item.id)).toBe(true);
  });

  it('rejects an unknown item id', () => {
    expect(canAscendItem(guildState(), 999)).toBe(false);
  });
});

describe('ascendItem', () => {
  it('upgrades an unequipped item in place, consumes essence, and records the stat', () => {
    const item = exaltedItem(1, 6);
    const cost = ascendCost(6);
    let s = withEssence({ ...guildState(), inventory: [item] }, cost);
    s = ascendItem(s, item.id, mid);

    expect(s.inventory).toHaveLength(1);
    const ascended = s.inventory[0];
    expect(ascended.id).toBe(item.id);
    expect(ascended.slot).toBe(item.slot);
    expect(ascended.typeId).toBe(item.typeId);
    expect(ascended.tier).toBe(item.tier);
    expect(ascended.rarity).toBe('ascendant');
    for (const id of Object.keys(cost)) expect(s.materials[id]).toBe(0);
    expect(s.stats.itemsAscended).toBe(1);
  });

  it('upgrades an equipped item without unequipping it', () => {
    const adv = generateAdventurer(1, mid);
    const item = exaltedItem(1, 6);
    let s = { ...guildState(), adventurers: [adv], inventory: [item] };
    s = equipItem(s, adv.id, item.id);
    s = withEssence(s, ascendCost(6));
    s = ascendItem(s, item.id, mid);

    const wearer = s.adventurers.find((a) => a.id === adv.id)!;
    const equipped = wearer.equipment[item.slot];
    expect(equipped?.id).toBe(item.id);
    expect(equipped?.rarity).toBe('ascendant');
    expect(s.inventory).toHaveLength(0); // never bounced back to inventory
  });

  it('is a no-op without enough essence, and for a non-exalted item', () => {
    const item = exaltedItem(1, 6);
    const short = { ...guildState(), inventory: [item] };
    expect(ascendItem(short, item.id, mid)).toBe(short);

    const epic = { ...generateEquipment(2, 6, mid), rarity: 'epic' as const, tier: 6 };
    const withGold = withEssence({ ...guildState(), inventory: [epic] }, ascendCost(6));
    expect(ascendItem(withGold, epic.id, mid)).toBe(withGold);
  });
});

describe('ascendEquipment', () => {
  it('rolls a much bigger stat budget than the exalted rarity it came from', () => {
    // A constant rng means every weighted roll (rarity, prefix, type, budget
    // variance) always lands on its LAST bucket, regardless of how many
    // times it's called or in what order — and ascendant rolls from the same
    // EXALTED_PREFIXES pool as exalted, so the same prefix (with the same
    // atkMult) applies to both, leaving RARITY_MULT as the only difference
    // between the two budgets — letting the expected ratio be computed
    // exactly instead of just asserting "bigger".
    const rng = () => 0.9999;
    const exalted = generateEquipment(1, 6, rng, 'weapon', 'exalted');
    expect(exalted.rarity).toBe('exalted'); // tier 6 >= EXALTED_MIN_TIER
    const ascended = ascendEquipment(exalted, rng);

    expect(ascended.rarity).toBe('ascendant');
    expect(ascended.slot).toBe(exalted.slot);
    expect(ascended.typeId).toBe(exalted.typeId);
    expect(ascended.tier).toBe(exalted.tier);
    // Same pool, same rng roll → identical prefix, so the name only differs
    // by rarity-specific stats, not by which prefix/base name got rolled.
    expect(ascended.name).toBe(exalted.name);

    const expectedRatio = RARITY_MULT.ascendant / RARITY_MULT.exalted;
    expect(ascended.atk / exalted.atk).toBeCloseTo(expectedRatio, 1);
  });

  it('rolls more bonus attributes than exalted, per RARITY_BONUS_ATTRS', () => {
    // rng() === 0.9 lands past every atkMult/defMult prefix roll boundary
    // reliably enough across a few ids to exercise the bonus-attr loop.
    const rng = () => 0.9;
    const item = generateEquipment(1, 6, rng, 'armor', 'exalted');
    const ascended = ascendEquipment(item, rng);
    const attrCount = (attrs: Partial<Record<string, number>>) =>
      Object.values(attrs).reduce((sum: number, v) => sum + (v ?? 0), 0);
    expect(RARITY_BONUS_ATTRS.ascendant).toBeGreaterThan(RARITY_BONUS_ATTRS.exalted);
    expect(attrCount(ascended.attrs)).toBeGreaterThanOrEqual(attrCount(item.attrs));
  });

  it('leaves the item unchanged if its equipment type is unrecognized', () => {
    const item: Equipment = {
      id: 1,
      slot: 'weapon',
      typeId: 'not-a-real-type',
      rarity: 'exalted',
      tier: 1,
      name: 'Mystery Blade',
      atk: 5,
      def: 0,
      hp: 0,
      attrs: {},
    };
    expect(ascendEquipment(item, mid)).toBe(item);
  });
});
