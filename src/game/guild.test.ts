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
  CRAFT_MAX_RARITY,
  DEMON_KING_ID,
  EQUIP_TIER_RATE,
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
  allocateAdventurers,
  autoEquipBest,
  batchGold,
  batchTimeSolo,
  buyGuildUpgrade,
  canStartCraft,
  craftDurationSeconds,
  craftGoldCost,
  craftMaterialsCost,
  deleteQuest,
  disassembleItem,
  disassembleItems,
  equipItem,
  essenceYield,
  forgeUnlocked,
  goldUnitDifficulty,
  hireAdventurer,
  isBossUnlocked,
  isZoneUnlocked,
  maxCraftableTier,
  postQuest,
  questBatchSummary,
  questBoardAffordable,
  questProgress,
  questRates,
  questRequiredWork,
  questTargetDef,
  rosterCap,
  startCraft,
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

/** postQuest with a single requirement, unlimited repeats, and an effectively
 * uncapped worker cap, for tests that don't care about the repeat/cap/
 * multi-requirement mechanics specifically. */
function post(state: GameState, targetId: string, batchSize: number): GameState {
  return postQuest(state, [{ targetId, batchSize }], ADVENTURER_MAX, 0);
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

  it('disassembling an item grants essence of its own rarity, not gold', () => {
    let s = guildState();
    const item = { ...generateEquipment(99, 1, mid), rarity: 'rare' as const, tier: 3 };
    s = { ...s, inventory: [item], gold: 0 };
    s = disassembleItem(s, 99);
    expect(s.inventory).toHaveLength(0);
    expect(s.gold).toBe(0);
    expect(s.materials['rare-essence']).toBe(essenceYield(item));
    expect(s.materials['rare-essence']).toBeGreaterThan(0);
  });

  it('bulk disassembling removes only the given items and sums essence per rarity', () => {
    let s = guildState();
    const items = [
      { ...generateEquipment(1, 1, mid), rarity: 'common' as const, tier: 1 },
      { ...generateEquipment(2, 1, mid), rarity: 'common' as const, tier: 1 },
      { ...generateEquipment(3, 1, mid), rarity: 'epic' as const, tier: 2 },
    ];
    s = { ...s, inventory: items, materials: {} };
    s = disassembleItems(s, [1, 2, 999]);
    expect(s.inventory.map((i) => i.id)).toEqual([3]);
    expect(s.materials['common-essence']).toBe(essenceYield(items[0]) + essenceYield(items[1]));
    expect(s.materials['epic-essence'] ?? 0).toBe(0); // item 3 wasn't in the batch
    expect(disassembleItems(s, [999])).toBe(s);
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

  it('tier scales stat budget geometrically at EQUIP_TIER_RATE per tier', () => {
    // Fixed rng (mid) → identical slot/type/rarity/prefix roll regardless of
    // tier, isolating the budget's tier scaling from everything else. Compare
    // atk (not hp): prefixes can add a separate flat tier-linear HP bonus on
    // top of the budget (see ITEM_PREFIXES hpPerTier), so only atk/def stay
    // exactly proportional to the geometric budget curve.
    const t1 = generateEquipment(1, 1, mid);
    const t4 = generateEquipment(1, 4, mid); // 3 tiers higher
    expect(t4.slot).toBe(t1.slot);
    expect(t4.typeId).toBe(t1.typeId);
    expect(t4.rarity).toBe(t1.rarity);
    const expectedRatio = Math.pow(1 + EQUIP_TIER_RATE, 4 - 1);
    expect(t4.atk / t1.atk).toBeCloseTo(expectedRatio, 1);
  });

  it('bonus HP now scales off the tier/rarity budget, so even common gear gets some', () => {
    // rng() === 0 throughout: lands on the first armor type (plate) and the
    // lowest rarity (common) — previously that meant hp forced to exactly 0.
    const item = generateEquipment(1, 6, () => 0, 'armor');
    expect(item.rarity).toBe('common');
    expect(item.hp).toBeGreaterThan(0);
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

  it('maxRarity caps the roll by filtering/renormalizing, not clamping', () => {
    const highRoll = () => 0.999; // would land epic/exalted uncapped
    expect(rollRarity(EXALTED_MIN_TIER, highRoll, 'rare')).toBe('rare');
    expect(rollRarity(1, highRoll, 'common')).toBe('common');
    // Low roll still lands common even when higher rarities are allowed.
    expect(rollRarity(EXALTED_MIN_TIER, () => 0, 'rare')).toBe('common');
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
    s = post(s, 'gray-wolf', 5); // forest-edge, unlocked
    expect(s.quests).toHaveLength(1);
    s = post(s, 'bog-wraith', 5); // haunted-marsh, locked at rep 0
    expect(s.quests).toHaveLength(1);
  });

  it('a running quest converts gold into its material plus reputation', () => {
    let s = post(guildState(), 'gray-wolf', 5);
    const goldBefore = s.gold;
    s = tick(s, 60, 0);
    expect(s.materials['beast-pelt'] ?? 0).toBeGreaterThan(0);
    expect(s.reputation).toBeGreaterThan(0);
    expect(s.gold).toBeLessThan(goldBefore); // town has no jobs here → net gold spent
  });

  it('no materials/gold/reputation are granted until a batch actually completes', () => {
    let s = post(guildState(), 'gray-wolf', 5);
    const target = questTargetDef('gray-wolf')!;
    const required = batchTimeSolo(5, unitDifficulty(target));
    const advPerQuest = adventurerCount(s); // one active quest → gets the full pool
    const goldBefore = s.gold;
    // Advance well under the time needed for a single batch.
    s = tick(s, required / advPerQuest / 3, 0);
    expect(s.materials['beast-pelt'] ?? 0).toBe(0);
    expect(s.reputation).toBe(0);
    expect(s.gold).toBe(goldBefore); // nothing spent either — no lump has resolved yet
    expect(s.quests[0].progress).toBeGreaterThan(0); // but the work is accruing
  });

  it('a round resolves in one lump exactly when its required time is reached, carrying the remainder', () => {
    let s = post(guildState(), 'gray-wolf', 5);
    const target = questTargetDef('gray-wolf')!;
    const required = batchTimeSolo(5, unitDifficulty(target));
    const advPerQuest = adventurerCount(s);
    // Cross the round's fixed time threshold, with room to spare left over.
    s = tick(s, required + 1, 0);
    expect(s.materials['beast-pelt']).toBe(5 * advPerQuest); // every assigned adventurer's own repeat
    expect(s.reputation).toBeGreaterThan(0);
    expect(s.quests[0].progress).toBeGreaterThan(0); // leftover work carries into the next round
    expect(s.quests[0].progress).toBeLessThan(required); // but not a whole extra round's worth
  });

  it('questProgress reports live fraction/ETA toward the next completion, distinct from the reference rate', () => {
    let s = post(guildState(), 'gray-wolf', 5);
    const p0 = questProgress(s, s.quests[0]);
    expect(p0.fraction).toBe(0);
    expect(p0.etaSeconds).toBeGreaterThan(0);
    s = tick(s, 2, 0);
    const p1 = questProgress(s, s.quests[0]);
    expect(p1.fraction).toBeGreaterThan(0);
    expect(p1.fraction).toBeLessThan(1);
    expect(p1.etaSeconds).toBeLessThan(p0.etaSeconds);
  });

  it('questBatchSummary reports the full round payout, matching what actually resolves', () => {
    let s = post(guildState(), 'gray-wolf', 5);
    const target = questTargetDef('gray-wolf')!;
    const summary = questBatchSummary(s, s.quests[0])!;
    expect(summary.materials).toEqual([{ materialId: target.materialId, amount: 5 * summary.assigned }]);
    expect(summary.gold).toBeGreaterThan(0);
    expect(summary.reputation).toBeGreaterThan(0);
    expect(summary.timeSeconds).toBeGreaterThan(0);

    // Ticking exactly one round's worth of time credits exactly this summary.
    s = tick(s, summary.timeSeconds + 1, 0);
    expect(s.materials[target.materialId]).toBe(5 * summary.assigned);
    expect(s.reputation).toBeCloseTo(summary.reputation, 5);
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
    const one = post(guildState(), 'gray-wolf', 5);
    const solo = questRates(one, one.quests[0]);
    const two = post(one, 'wild-boar', 5);
    const shared = questRates(two, two.quests[0]);
    // Same quest now shares the pool with another → fewer adventurers, less output.
    expect(shared.adventurers).toBeLessThan(solo.adventurers);
    expect(shared.materialsPerSec['beast-pelt']).toBeLessThan(solo.materialsPerSec['beast-pelt']);
  });

  it('deleting a quest stops its production', () => {
    let s = post(guildState(), 'gray-wolf', 5);
    const id = s.quests[0].id;
    s = deleteQuest(s, id);
    expect(s.quests).toHaveLength(0);
    const before = { ...s.materials };
    s = tick(s, 60, 0);
    expect(s.materials['beast-pelt'] ?? 0).toBe(before['beast-pelt'] ?? 0);
  });

  it('a gold-starved board produces nothing rather than a diminished amount', () => {
    let s = { ...post(guildState(), 'gray-wolf', 40), gold: 5 };
    const before = { ...s.materials };
    s = tick(s, 300, 0);
    // No town income (no jobs bought) and not enough banked gold → hard gate: zero output.
    expect(s.gold).toBe(5);
    expect(s.reputation).toBe(0);
    expect(s.materials['beast-pelt'] ?? 0).toBe(before['beast-pelt'] ?? 0);
  });

  it('questRates reports zero output and goldStarved when the board is unaffordable', () => {
    const s = { ...post(guildState(), 'gray-wolf', 40), gold: 0 };
    const rates = questRates(s, s.quests[0]);
    expect(rates.goldStarved).toBe(true);
    expect(Object.keys(rates.materialsPerSec)).toHaveLength(0);
    expect(rates.goldPerSec).toBe(0);
    expect(rates.reputationPerSec).toBe(0);
  });

  it('a positive bank is still considered affordable even with no town income', () => {
    const s = post(guildState(), 'gray-wolf', 5); // guildState() starts with 100_000 gold
    expect(questBoardAffordable(s)).toBe(true);
    expect(questRates(s, s.quests[0]).goldStarved).toBe(false);
  });

  it('offline catch-up runs the quest board over the credited time', () => {
    const s = post({ ...guildState(), lastUpdate: 0 }, 'gray-wolf', 5);
    const result = applyOfflineProgress(s, 120_000); // 120s later
    expect(result.offlineSeconds).toBeCloseTo(120, 0);
    expect(result.materialsGained['beast-pelt'] ?? 0).toBeGreaterThan(0);
    expect(result.state.reputation).toBeGreaterThan(0);
  });
});

describe('quest worker allocation, repeats & caps', () => {
  it('allocateAdventurers only ever hands out whole numbers, using the full pool', () => {
    // reputation 0 → adventurerCount === ADVENTURER_BASE (3). Three quests,
    // uncapped, so 3 doesn't divide evenly across them.
    let s = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 5 }], ADVENTURER_MAX, 0);
    s = postQuest(s, [{ targetId: 'wild-boar', batchSize: 5 }], ADVENTURER_MAX, 0);
    s = postQuest(s, [{ targetId: 'river-bandit', batchSize: 5 }], ADVENTURER_MAX, 0);
    const allocation = allocateAdventurers(s);
    const values = Object.values(allocation);
    for (const v of values) expect(Number.isInteger(v)).toBe(true);
    expect(values.reduce((a, b) => a + b, 0)).toBe(adventurerCount(s));
    // questRates surfaces the same integer, never a fraction like 1.5.
    for (const q of s.quests) expect(Number.isInteger(questRates(s, q).adventurers)).toBe(true);
  });

  it('a quest capped below its fair share leaves adventurers for the others', () => {
    // Pool of 3; cap the first quest to 1 so the second can claim the rest.
    let s = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 5 }], 1, 0);
    s = postQuest(s, [{ targetId: 'wild-boar', batchSize: 5 }], ADVENTURER_MAX, 0);
    const allocation = allocateAdventurers(s);
    expect(allocation[s.quests[0].id]).toBe(1);
    expect(allocation[s.quests[1].id]).toBe(adventurerCount(s) - 1);
  });

  it('a quest can be starved of adventurers even when gold is plentiful', () => {
    // Cap every quest to a sliver of the pool and post more quests than the
    // pool can reach at all — leftover-round quests get 0 assigned.
    let s = guildState();
    for (let i = 0; i < 10; i++) {
      s = postQuest(s, [{ targetId: 'gray-wolf', batchSize: 1 }], 1, 0);
    }
    const starvedCount = s.quests.filter((q) => questRates(s, q).adventurerStarved).length;
    expect(starvedCount).toBeGreaterThan(0);
    const starved = s.quests.find((q) => questRates(s, q).adventurerStarved)!;
    const rates = questRates(s, starved);
    expect(rates.adventurers).toBe(0);
    expect(Object.keys(rates.materialsPerSec)).toHaveLength(0);
    expect(rates.goldStarved).toBe(false); // it's a workforce shortage, not a money one
  });

  it('postQuest clamps maxAdventurers to at least 1, independent of repeatCount', () => {
    let s = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 5 }], 0, 0); // 0 → floors up to 1
    expect(s.quests[0].maxAdventurers).toBe(1);
    s = postQuest(s, [{ targetId: 'wild-boar', batchSize: 5 }], 50, 3); // not capped by the repeat count
    expect(s.quests[1].maxAdventurers).toBe(50);
    s = postQuest(s, [{ targetId: 'forest-herbs', batchSize: 5 }], 2, 10); // within range → unchanged
    expect(s.quests[2].maxAdventurers).toBe(2);
  });

  it('a quest auto-removes itself once it completes its full repeat count', () => {
    let s = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 1 }], 1, 2); // 2 repeats, 1 worker
    const target = questTargetDef('gray-wolf')!;
    const required = batchTimeSolo(1, unitDifficulty(target));
    // Enough time for well more than 2 batches if it weren't capped.
    s = tick(s, required * 10, 0);
    expect(s.quests).toHaveLength(0); // removed itself
    expect(s.materials['beast-pelt']).toBe(2); // exactly repeatCount batches, not more
  });

  it('more assigned adventurers complete more repeats per round, not a faster round', () => {
    const target = questTargetDef('gray-wolf')!;
    const required = batchTimeSolo(1, unitDifficulty(target));

    // One worker, unlimited repeats: manages exactly 1 repeat in `required` seconds.
    let solo = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 1 }], 1, 0);
    solo = tick(solo, required, 0);
    expect(solo.materials['beast-pelt']).toBe(1);

    // Whole town's worth of workers (ADVENTURER_BASE, all assigned to one
    // quest with matching repeats): the round still takes the very same
    // `required` seconds — but every one of them completes their own repeat
    // when it fills, so ADVENTURER_BASE repeats land at once instead of 1.
    let party = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 1 }], ADVENTURER_BASE, ADVENTURER_BASE);
    party = tick(party, required, 0);
    expect(party.materials['beast-pelt']).toBe(ADVENTURER_BASE);
  });

  it('a big party clears a big repeat count in the same number of rounds a small one would', () => {
    // The scenario from the design brief: 50 adventurers, a 100-repeat quest
    // with a 1-minute round — the whole board should clear in 2 rounds (2
    // minutes), 50 repeats credited per round, not sped up or slowed down by
    // the adventurer count.
    const target = questTargetDef('gray-wolf')!;
    const party = 50;
    let s = { ...guildState(), reputation: 1e12 }; // enough reputation for a 50-strong pool
    expect(adventurerCount(s)).toBeGreaterThanOrEqual(party);
    s = postQuest(s, [{ targetId: 'gray-wolf', batchSize: 1 }], party, 100);
    const required = batchTimeSolo(1, unitDifficulty(target));

    s = tick(s, required, 0); // round 1
    expect(s.quests[0].completedCount).toBe(50);
    expect(s.materials['beast-pelt']).toBe(50);

    s = tick(s, required, 0); // round 2
    expect(s.quests).toHaveLength(0); // exactly 100 repeats done — removed itself
    expect(s.materials['beast-pelt']).toBe(100);
  });

  it('a huge offline dt does not overshoot a finite repeat count', () => {
    const s = postQuest(
      { ...guildState(), lastUpdate: 0 },
      [{ targetId: 'gray-wolf', batchSize: 1 }],
      1,
      3,
    );
    const result = applyOfflineProgress(s, 999_000); // ~999s, plenty for many batches
    expect(result.state.quests).toHaveLength(0);
    expect(result.materialsGained['beast-pelt']).toBe(3);
  });

  it('a fully-repeated quest is excluded from the pool split for its remaining peers', () => {
    // completedCount already at repeatCount → 0 effective cap, so it takes no
    // adventurers away from a sibling quest even while still in the array.
    let s = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 5 }], 5, 2);
    s = { ...s, quests: [{ ...s.quests[0], completedCount: 2 }] };
    s = postQuest(s, [{ targetId: 'wild-boar', batchSize: 5 }], ADVENTURER_MAX, 0);
    const allocation = allocateAdventurers(s);
    expect(allocation[s.quests[0].id]).toBe(0);
    expect(allocation[s.quests[1].id]).toBe(adventurerCount(s));
  });

  it('a multi-requirement quest bundles several targets into one combined payout', () => {
    let s = postQuest(
      guildState(),
      [
        { targetId: 'gray-wolf', batchSize: 5 },
        { targetId: 'forest-herbs', batchSize: 3 },
      ],
      ADVENTURER_MAX,
      0,
    );
    expect(s.quests[0].requirements).toHaveLength(2);
    const wolfTarget = questTargetDef('gray-wolf')!;
    const herbTarget = questTargetDef('forest-herbs')!;
    const expectedWork =
      batchTimeSolo(5, unitDifficulty(wolfTarget)) + batchTimeSolo(3, unitDifficulty(herbTarget));
    expect(questRequiredWork(s.quests[0])).toBeCloseTo(expectedWork, 6);

    const summary = questBatchSummary(s, s.quests[0])!;
    expect(summary.materials).toContainEqual({ materialId: 'beast-pelt', amount: 5 * summary.assigned });
    expect(summary.materials).toContainEqual({ materialId: 'herbs', amount: 3 * summary.assigned });

    // Ticking exactly one combined round's worth of time credits both materials at once.
    s = tick(s, summary.timeSeconds + 1, 0);
    expect(s.materials['beast-pelt']).toBe(5 * summary.assigned);
    expect(s.materials['herbs']).toBe(3 * summary.assigned);
  });

  it('a quest is rejected if any requirement targets a locked zone', () => {
    const s = guildState(); // reputation 0 → only forest-edge is unlocked
    const result = postQuest(
      s,
      [
        { targetId: 'gray-wolf', batchSize: 5 }, // forest-edge, unlocked
        { targetId: 'river-bandit', batchSize: 5 }, // river-crossing, locked
      ],
      ADVENTURER_MAX,
      0,
    );
    expect(result).toBe(s); // rejected outright, no partial quest posted
  });

  it('a quest is rejected if its requirements span more than one zone, even when both are unlocked', () => {
    const s = { ...guildState(), reputation: 100 }; // both forest-edge and river-crossing unlocked
    const result = postQuest(
      s,
      [
        { targetId: 'gray-wolf', batchSize: 5 }, // forest-edge
        { targetId: 'river-bandit', batchSize: 5 }, // river-crossing
      ],
      ADVENTURER_MAX,
      0,
    );
    expect(result).toBe(s); // no cross-zone quests, regardless of unlock state
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

describe('crafting (the Forge)', () => {
  /** Forge purchased, plush with gold and every material a recipe might need. */
  function forgeState(): GameState {
    let s: GameState = {
      ...guildState(),
      materials: {
        'beast-pelt': 1_000,
        timber: 1_000,
        'iron-ore': 1_000,
        'spirit-essence': 1_000,
        crystal: 1_000,
        'demon-ash': 1_000,
      },
    };
    s = buyGuildUpgrade(s, 'forge');
    return s;
  }

  it('forge starts locked and unlocks via the guild upgrade', () => {
    expect(forgeUnlocked(guildState())).toBe(false);
    expect(forgeUnlocked(forgeState())).toBe(true);
  });

  it('max craftable tier tracks the highest reputation-unlocked zone', () => {
    expect(maxCraftableTier(forgeState())).toBe(1); // forest-edge, repRequired 0
    expect(maxCraftableTier({ ...forgeState(), reputation: 30 })).toBe(2); // river-crossing (needs 25)
    expect(maxCraftableTier({ ...forgeState(), reputation: 1e12 })).toBe(6); // frontier-pass
  });

  it('gold and material costs scale with tier and quantity', () => {
    expect(craftGoldCost(1, 10)).toBe(craftGoldCost(1, 1) * 10);
    expect(craftGoldCost(6, 1)).toBeGreaterThan(craftGoldCost(1, 1));

    const one = craftMaterialsCost(1, 1);
    const ten = craftMaterialsCost(1, 10);
    for (const id of Object.keys(one)) expect(ten[id]).toBe(one[id] * 10);

    // Tier 6 pulls in materials tier 1 never touches ("rarer" ingredients).
    expect(Object.keys(craftMaterialsCost(1, 1))).not.toContain('demon-ash');
    expect(Object.keys(craftMaterialsCost(6, 1))).toContain('demon-ash');
  });

  it('tier does not change craft duration\'s use of quantity as a batch discount', () => {
    const solo = craftDurationSeconds(3, 1);
    const bulk = craftDurationSeconds(3, 100);
    expect(bulk).toBeGreaterThan(solo);
    expect(bulk).toBeLessThan(solo * 100); // sublinear — bulk crafting is time-efficient
  });

  it('canStartCraft rejects a locked forge, an over-cap tier, and unaffordable jobs', () => {
    expect(canStartCraft(guildState(), 'weapon', 1, 1)).toBe(false); // forge locked
    const s = forgeState();
    expect(canStartCraft(s, 'weapon', 2, 1)).toBe(false); // tier 2 needs river-crossing unlocked
    expect(canStartCraft(s, 'weapon', 1, 1)).toBe(true);
    expect(canStartCraft({ ...s, gold: 0 }, 'weapon', 1, 1)).toBe(false);
    expect(canStartCraft({ ...s, materials: {} }, 'weapon', 1, 1)).toBe(false);
  });

  it('starting a craft spends gold/materials up front and queues one job', () => {
    const s = startCraft(forgeState(), 'weapon', 1, 10);
    expect(s.crafting).not.toBeNull();
    expect(s.crafting?.slot).toBe('weapon');
    expect(s.crafting?.tier).toBe(1);
    expect(s.crafting?.quantity).toBe(10);
    expect(s.gold).toBe(forgeState().gold - craftGoldCost(1, 10));
    expect(s.materials['beast-pelt']).toBe(1_000 - craftMaterialsCost(1, 10)['beast-pelt']);
  });

  it('only one craft job runs at a time', () => {
    let s = startCraft(forgeState(), 'weapon', 1, 1);
    const busy = s;
    s = startCraft(s, 'armor', 1, 1);
    expect(s).toBe(busy); // unchanged — second start is a no-op
  });

  it('a craft job resolves into inventory once its timer elapses, not before', () => {
    const started = startCraft({ ...forgeState(), reputation: 100 }, 'trinket', 2, 10);
    const duration = craftDurationSeconds(2, 10);

    const early = tick(started, duration / 2, 0, mid);
    expect(early.crafting).not.toBeNull();
    expect(early.inventory).toHaveLength(0);

    const done = tick(early, duration / 2 + 1, 0, mid);
    expect(done.crafting).toBeNull();
    expect(done.inventory).toHaveLength(10);
    for (const item of done.inventory) expect(item.slot).toBe('trinket');
  });

  it('crafted items never exceed CRAFT_MAX_RARITY, even at exalted-eligible tiers', () => {
    expect(CRAFT_MAX_RARITY).toBe('rare'); // sanity: pin the assumption this test relies on
    let s = { ...forgeState(), reputation: 1e12 }; // frontier-pass (tier 6, exalted-eligible) unlocked
    s = startCraft(s, 'weapon', 6, 100);
    const done = tick(s, craftDurationSeconds(6, 100) + 1, 0, mulberry32(7));
    expect(done.inventory).toHaveLength(100);
    for (const item of done.inventory) {
      expect(['common', 'rare']).toContain(item.rarity);
    }
  });

  it('offline catch-up resolves a finished craft job the same as a live tick', () => {
    const started = { ...startCraft(forgeState(), 'armor', 1, 1), lastUpdate: 0 };
    const duration = craftDurationSeconds(1, 1);
    const result = applyOfflineProgress(started, (duration + 5) * 1000);
    expect(result.state.crafting).toBeNull();
    expect(result.equipmentGained).toBe(1);
    expect(result.state.inventory[0].slot).toBe('armor');
  });
});
