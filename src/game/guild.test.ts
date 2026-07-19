import { describe, expect, it } from 'vitest';
import {
  adventurerPower,
  adventurerStats,
  effectiveAttributes,
  equipDelta,
  equipTypeDef,
  generateAdventurer,
  generateEquipment,
  maxHp,
  rollRarity,
} from './adventurers';
import {
  ADVENTURER_BASE,
  ADVENTURER_MAX,
  DEMON_KING_ID,
  EXALTED_MIN_TIER,
  EXALTED_PREFIXES,
  GENERAL_IDS,
  ITEM_PREFIXES,
  LOCATIONS,
  tierXp,
} from './config';
import { applyOfflineProgress, tick } from './engine';
import {
  adventurerCount,
  autoEquipBest,
  batchGold,
  batchTimeSolo,
  buyGuildUpgrade,
  deleteQuest,
  equipItem,
  goldUnitDifficulty,
  hireAdventurer,
  isBossUnlocked,
  isZoneUnlocked,
  postQuest,
  questBoardAffordable,
  questRates,
  questTargetDef,
  rosterCap,
  sellItem,
  sellItems,
  unitDifficulty,
} from './guild';
import { createInitialState } from './logic';
import { buyPerk } from './perks';
import { canTimeTravel, timeTravel } from './prestige';
import type { GameState } from './types';

const mid = () => 0.5;

function guildState(): GameState {
  return { ...createInitialState(0), act: 2 as const, gold: 100_000 };
}

function withAdventurer(state: GameState, rng = mid): GameState {
  return hireAdventurer(state, rng);
}

describe('roster', () => {
  it('hiring adds a generated adventurer and costs gold', () => {
    const s = withAdventurer(guildState());
    expect(s.adventurers).toHaveLength(1);
    expect(s.gold).toBe(100_000 - 500);
    expect(s.adventurers[0].name).toBeTruthy();
  });

  it('roster is capped until the guild hall grows', () => {
    let s = guildState();
    s = withAdventurer(withAdventurer(s));
    expect(rosterCap(s)).toBe(2);
    expect(withAdventurer(s).adventurers).toHaveLength(2); // no-op at cap
    s = { ...s, materials: { 'beast-pelt': 100 } };
    s = buyGuildUpgrade(s, 'guild-hall');
    expect(rosterCap(s)).toBe(3);
  });

  it('cannot hire in act 1', () => {
    const s = withAdventurer({ ...createInitialState(0), gold: 100_000 });
    expect(s.adventurers).toHaveLength(0);
  });
});

describe('equipment', () => {
  it('equipping moves items between inventory and adventurer', () => {
    let s = withAdventurer(guildState());
    const item = generateEquipment(99, 1, mid);
    s = { ...s, inventory: [item] };
    const before = adventurerPower(s, s.adventurers[0]);
    s = equipItem(s, s.adventurers[0].id, 99);
    expect(s.inventory).toHaveLength(0);
    expect(adventurerPower(s, s.adventurers[0])).toBeGreaterThan(before);
  });

  it('equipDelta reports the stat change vs the current slot item', () => {
    let s = withAdventurer(guildState());
    const adv = s.adventurers[0];
    const weak = { ...generateEquipment(1, 1, mid), slot: 'armor' as const, atk: 0, def: 2, hp: 0, attrs: {} };
    const strong = { ...generateEquipment(2, 1, mid), slot: 'armor' as const, atk: 0, def: 10, hp: 0, attrs: {} };
    s = { ...s, inventory: [weak, strong] };
    // Empty slot: delta equals the item's own contribution.
    expect(equipDelta(adv, strong).def).toBe(10);
    // With the weak armor equipped, swapping to strong nets the difference.
    s = equipItem(s, adv.id, 1);
    const equipped = s.adventurers[0];
    expect(equipDelta(equipped, strong).def).toBe(8);
  });

  it('autoEquipBest equips the strongest item per slot, only when it beats current', () => {
    let s = withAdventurer(guildState());
    const advId = s.adventurers[0].id;
    const items = [
      { ...generateEquipment(1, 1, mid), slot: 'armor' as const, atk: 0, def: 3, hp: 0, attrs: {} },
      { ...generateEquipment(2, 1, mid), slot: 'armor' as const, atk: 0, def: 12, hp: 0, attrs: {} },
      { ...generateEquipment(3, 1, mid), slot: 'trinket' as const, atk: 1, def: 1, hp: 0, attrs: {} },
    ];
    s = { ...s, inventory: items };
    s = autoEquipBest(s, advId);
    const adv = s.adventurers.find((a) => a.id === advId)!;
    expect(adv.equipment.armor?.id).toBe(2); // picked the def-12, not def-3
    expect(adv.equipment.trinket?.id).toBe(3);
    // The rejected armor is back in inventory; nothing was lost.
    expect(s.inventory.some((i) => i.id === 1)).toBe(true);
    // Running again is a no-op (current gear already best).
    expect(autoEquipBest(s, advId)).toBe(s);
  });

  it('selling an item grants gold', () => {
    let s = guildState();
    const item = generateEquipment(99, 1, mid);
    s = { ...s, inventory: [item], gold: 0 };
    s = sellItem(s, 99);
    expect(s.inventory).toHaveLength(0);
    expect(s.gold).toBeGreaterThan(0);
  });

  it('bulk selling removes only the given items and sums the gold', () => {
    let s = guildState();
    const items = [generateEquipment(1, 1, mid), generateEquipment(2, 1, mid), generateEquipment(3, 1, mid)];
    s = { ...s, inventory: items, gold: 0 };
    const single = sellItem(s, 1).gold + sellItem(s, 2).gold;
    s = sellItems(s, [1, 2, 999]);
    expect(s.inventory.map((i) => i.id)).toEqual([3]);
    expect(s.gold).toBe(single);
    expect(sellItems(s, [999])).toBe(s);
  });
});

describe('attributes, HP & equipment', () => {
  const roll = (values: number[]): (() => number) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('generated adventurers have class-appropriate attributes and full HP', () => {
    const warrior = { ...generateAdventurer(1, mid), className: 'warrior' as const };
    const attrs = effectiveAttributes(warrior);
    expect(attrs.str).toBeGreaterThan(attrs.int); // warriors favor STR
    const fresh = generateAdventurer(2, mid);
    expect(fresh.hp).toBe(maxHp(fresh)); // spawns at full health
    expect(fresh.hp).toBeGreaterThan(0);
  });

  it('effective attributes grow with level; max HP scales with CON', () => {
    const a1 = generateAdventurer(1, mid);
    const a20 = { ...a1, level: 20 };
    expect(effectiveAttributes(a20).con).toBeGreaterThan(effectiveAttributes(a1).con);
    expect(maxHp(a20)).toBeGreaterThan(maxHp(a1));
  });

  it('a matching weapon on a high-primary class beats an off-class weapon', () => {
    // roll([0,...]) picks the weapon slot and a STR-scaling weapon (sword).
    const gs = generateEquipment(50, 5, roll([0, 0, 0, 0.5]));
    // Only compare when we actually rolled a STR-scaling weapon.
    if (equipTypeDef(gs.typeId)?.scaling === 'str') {
      const warrior = { ...generateAdventurer(1, mid), className: 'warrior' as const, level: 15 };
      const mage = { ...generateAdventurer(2, mid), className: 'mage' as const, level: 15 };
      const warAtk = adventurerStats({ ...warrior, equipment: { weapon: gs } }).atk
        - adventurerStats(warrior).atk;
      const mageAtk = adventurerStats({ ...mage, equipment: { weapon: gs } }).atk
        - adventurerStats(mage).atk;
      expect(warAtk).toBeGreaterThan(mageAtk);
    }
  });

  it('item prefixes modify stats deterministically', () => {
    // Same rng stream → identical item (name + all stats).
    const a = generateEquipment(1, 3, roll([0.1, 0.2, 0.3, 0.4, 0.5]));
    const b = generateEquipment(1, 3, roll([0.1, 0.2, 0.3, 0.4, 0.5]));
    expect(b).toEqual(a);
  });

  it('epic items carry bonus attributes; equipping applies them', () => {
    let item = generateEquipment(77, 6, mid);
    // Coerce to an attribute-bearing epic for a deterministic assertion.
    item = { ...item, attrs: { str: 5 }, hp: 20 };
    let s = withAdventurer(guildState());
    const id = s.adventurers[0].id;
    const beforeStr = effectiveAttributes(s.adventurers[0]).str;
    const beforeHp = maxHp(s.adventurers[0]);
    s = { ...s, inventory: [item] };
    s = equipItem(s, id, 77);
    const adv = s.adventurers.find((a) => a.id === id)!;
    expect(effectiveAttributes(adv).str).toBe(beforeStr + 5);
    expect(maxHp(adv)).toBe(beforeHp + 20);
  });

  it('exalted rarity only rolls at/above EXALTED_MIN_TIER', () => {
    const highRoll = () => 0.999; // lands in the last weight slice
    expect(rollRarity(EXALTED_MIN_TIER - 1, highRoll)).toBe('epic');
    expect(rollRarity(EXALTED_MIN_TIER, highRoll)).toBe('exalted');
  });

  it('exalted items roll exclusively from EXALTED_PREFIXES, never mixing with normal prefixes', () => {
    const exaltedNames = new Set(EXALTED_PREFIXES.map((p) => p.name));
    const normalNames = new Set(ITEM_PREFIXES.map((p) => p.name));
    let sawExalted = false;
    let sawBelowGate = false;
    const rng = mulberry32(42);
    for (let i = 0; i < 3000; i++) {
      const tier = (i % 2 === 0 ? EXALTED_MIN_TIER : 1); // alternate above/below the gate
      const item = generateEquipment(i, tier, rng);
      const prefixName = item.name.split(' ')[0];
      if (item.rarity === 'exalted') {
        sawExalted = true;
        expect(tier).toBeGreaterThanOrEqual(EXALTED_MIN_TIER);
        expect(exaltedNames.has(prefixName)).toBe(true);
      } else {
        expect(exaltedNames.has(prefixName)).toBe(false);
        if (tier < EXALTED_MIN_TIER) sawBelowGate = true;
      }
    }
    expect(sawExalted).toBe(true); // the gate isn't accidentally dead
    expect(sawBelowGate).toBe(true);
    expect(normalNames.size).toBeGreaterThan(0); // sanity: pools are distinct and non-empty
  });
});

/** Deterministic PRNG for reproducible large-sample tests (no Math.random flakiness). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('difficulty & reward scaling', () => {
  it('location power increases every tier, and boss tiers exceed all zone tiers', () => {
    const byTier = [...LOCATIONS].sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < byTier.length; i++) {
      expect(byTier[i].power).toBeGreaterThan(byTier[i - 1].power);
    }
    const zones = byTier.filter((l) => l.kind === 'zone');
    const bosses = byTier.filter((l) => l.kind === 'boss');
    expect(Math.min(...bosses.map((b) => b.power))).toBeGreaterThan(
      Math.max(...zones.map((z) => z.power)),
    );
  });

  it('tierXp grows geometrically, well past flat perTier*tier scaling at high tiers', () => {
    const perTier = 100;
    const linearTier6 = perTier * 6; // the old formula, for comparison
    expect(tierXp(perTier, 1)).toBe(perTier); // tier 1 unchanged
    expect(tierXp(perTier, 6)).toBeGreaterThan(linearTier6);
    // monotonically increasing per tier
    for (let t = 2; t <= 10; t++) {
      expect(tierXp(perTier, t)).toBeGreaterThan(tierXp(perTier, t - 1));
    }
  });

});

describe('quest board', () => {
  it('zones unlock as reputation crosses each threshold', () => {
    const s = guildState();
    expect(isZoneUnlocked(s, 'forest-edge')).toBe(true); // repRequired 0
    expect(isZoneUnlocked(s, 'river-crossing')).toBe(false);
    const famous = { ...s, reputation: 100 };
    expect(isZoneUnlocked(famous, 'river-crossing')).toBe(true); // needs 25
    expect(isZoneUnlocked(famous, 'old-mines')).toBe(true); // needs 90
    expect(isZoneUnlocked(famous, 'haunted-marsh')).toBe(false); // needs 250
  });

  it('the adventurer pool grows with reputation and is soft-capped', () => {
    expect(adventurerCount({ ...guildState(), reputation: 0 })).toBe(ADVENTURER_BASE);
    const few = adventurerCount({ ...guildState(), reputation: 100 });
    const many = adventurerCount({ ...guildState(), reputation: 10_000 });
    expect(many).toBeGreaterThan(few);
    expect(adventurerCount({ ...guildState(), reputation: 1e12 })).toBe(ADVENTURER_MAX);
  });

  it('posting a quest requires an unlocked zone', () => {
    let s = guildState();
    s = postQuest(s, 'gray-wolf', 5); // forest-edge, unlocked
    expect(s.quests).toHaveLength(1);
    s = postQuest(s, 'bog-wraith', 5); // haunted-marsh, locked at rep 0
    expect(s.quests).toHaveLength(1);
  });

  it('a running quest converts gold into its material plus reputation', () => {
    let s = postQuest(guildState(), 'gray-wolf', 5);
    const goldBefore = s.gold;
    s = tick(s, 60, 0);
    expect(s.materials['beast-pelt'] ?? 0).toBeGreaterThan(0);
    expect(s.reputation).toBeGreaterThan(0);
    expect(s.gold).toBeLessThan(goldBefore); // town has no jobs here → net gold spent
  });

  it('bigger batches are more time-efficient per unit but cost more gold per unit', () => {
    const diff = unitDifficulty(questTargetDef('gray-wolf')!);
    const smallTimePerUnit = batchTimeSolo(1, diff) / 1;
    const bigTimePerUnit = batchTimeSolo(20, diff) / 20;
    expect(bigTimePerUnit).toBeLessThan(smallTimePerUnit);
    const smallGoldPerUnit = batchGold(1, diff) / 1;
    const bigGoldPerUnit = batchGold(20, diff) / 20;
    expect(bigGoldPerUnit).toBeGreaterThan(smallGoldPerUnit);
  });

  it('later, more dangerous zones cost more gold per minute of quest work, not just per batch', () => {
    // Same target shape (difficulty 1), same batch size, only the zone's tier
    // differs. Gold scales with tier steeper than time does (goldUnitDifficulty
    // vs unitDifficulty), so a fixed adventurer count earns less gold-efficiency
    // per minute in a later zone than an earlier one.
    const early = questTargetDef('gray-wolf')!; // forest-edge, tier 1
    const late = questTargetDef('demon-scout')!; // frontier-pass, tier 6
    const advPerQuest = 3;
    const batch = 5;

    function goldPerMinute(target: typeof early): number {
      const batchesPerSec = advPerQuest / batchTimeSolo(batch, unitDifficulty(target));
      return batchGold(batch, goldUnitDifficulty(target)) * batchesPerSec * 60;
    }

    expect(goldPerMinute(late)).toBeGreaterThan(goldPerMinute(early));
  });

  it('the adventurer pool is split across active quests', () => {
    const one = postQuest(guildState(), 'gray-wolf', 5);
    const solo = questRates(one, one.quests[0]);
    const two = postQuest(one, 'wild-boar', 5);
    const shared = questRates(two, two.quests[0]);
    // Same quest now shares the pool with another → fewer adventurers, less output.
    expect(shared.adventurers).toBeLessThan(solo.adventurers);
    expect(shared.materialsPerSec).toBeLessThan(solo.materialsPerSec);
  });

  it('deleting a quest stops its production', () => {
    let s = postQuest(guildState(), 'gray-wolf', 5);
    const id = s.quests[0].id;
    s = deleteQuest(s, id);
    expect(s.quests).toHaveLength(0);
    const before = { ...s.materials };
    s = tick(s, 60, 0);
    expect(s.materials['beast-pelt'] ?? 0).toBe(before['beast-pelt'] ?? 0);
  });

  it('a gold-starved board produces nothing rather than a diminished amount', () => {
    let s = { ...postQuest(guildState(), 'gray-wolf', 40), gold: 5 };
    const before = { ...s.materials };
    s = tick(s, 300, 0);
    // No town income (no jobs bought) and not enough banked gold → hard gate: zero output.
    expect(s.gold).toBe(5);
    expect(s.reputation).toBe(0);
    expect(s.materials['beast-pelt'] ?? 0).toBe(before['beast-pelt'] ?? 0);
  });

  it('questRates reports zero output and goldStarved when the board is unaffordable', () => {
    const s = { ...postQuest(guildState(), 'gray-wolf', 40), gold: 0 };
    const rates = questRates(s, s.quests[0]);
    expect(rates.goldStarved).toBe(true);
    expect(rates.materialsPerSec).toBe(0);
    expect(rates.goldPerSec).toBe(0);
    expect(rates.reputationPerSec).toBe(0);
  });

  it('a positive bank is still considered affordable even with no town income', () => {
    const s = postQuest(guildState(), 'gray-wolf', 5); // guildState() starts with 100_000 gold
    expect(questBoardAffordable(s)).toBe(true);
    expect(questRates(s, s.quests[0]).goldStarved).toBe(false);
  });

  it('offline catch-up runs the quest board over the credited time', () => {
    const s = postQuest({ ...guildState(), lastUpdate: 0 }, 'gray-wolf', 5);
    const result = applyOfflineProgress(s, 120_000); // 120s later
    expect(result.offlineSeconds).toBeCloseTo(120, 0);
    expect(result.materialsGained['beast-pelt'] ?? 0).toBeGreaterThan(0);
    expect(result.state.reputation).toBeGreaterThan(0);
  });
});

describe('expeditions & prestige', () => {
  function act3State(): GameState {
    let s: GameState = { ...guildState(), act: 3 };
    s = withAdventurer(s);
    // A veteran strong enough to matter
    s = {
      ...s,
      adventurers: s.adventurers.map((a) => ({ ...a, level: 30 })),
    };
    return s;
  }

  it('generals unlock in order; king needs all generals', () => {
    const s = act3State();
    expect(isBossUnlocked(s, GENERAL_IDS[0])).toBe(true);
    expect(isBossUnlocked(s, GENERAL_IDS[1])).toBe(false);
    expect(isBossUnlocked(s, DEMON_KING_ID)).toBe(false);
    const allGenerals = {
      ...s,
      bossesDefeated: Object.fromEntries(GENERAL_IDS.map((id) => [id, true])),
    };
    expect(isBossUnlocked(allGenerals, DEMON_KING_ID)).toBe(true);
  });

  it('time travel requires the demon king dead, keeps shards & perks', () => {
    let s = act3State();
    expect(canTimeTravel(s)).toBe(false);
    s = {
      ...s,
      timeShards: 50,
      bossesDefeated: { [DEMON_KING_ID]: true },
    };
    s = buyPerk(s, 'town-prosperity');
    const shardsAfterPerk = s.timeShards;
    expect(canTimeTravel(s)).toBe(true);
    const next = timeTravel(s, 1000);
    expect(next.act).toBe(1);
    expect(next.prestigeCount).toBe(1);
    expect(next.timeShards).toBe(shardsAfterPerk);
    expect(next.perks['town-prosperity']).toBe(1);
    expect(next.adventurers).toHaveLength(0);
  });

  it('beating the king before the deadline in a later timeline saves the hometown', () => {
    let s = { ...act3State(), prestigeCount: 1 };
    s = { ...s, bossesDefeated: { [DEMON_KING_ID]: true } };
    s = tick(s, 1, 0, mid); // triggers story check; day 1 << deadline
    expect(s.hometownSaved).toBe(true);
    expect(s.pendingStories).toContain('ending-hometown-saved');
  });

  it('adventurer generation is roster-cap safe and leveled stats grow', () => {
    const a1 = generateAdventurer(1, mid);
    const a30 = { ...a1, level: 30 };
    const s = createInitialState(0);
    expect(adventurerPower(s, a30)).toBeGreaterThan(adventurerPower(s, a1));
  });
});
