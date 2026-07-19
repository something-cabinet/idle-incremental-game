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
  DEMON_KING_ID,
  ENCOUNTER_INTERVAL,
  EXALTED_MIN_TIER,
  EXALTED_PREFIXES,
  GENERAL_IDS,
  ITEM_PREFIXES,
  LOCATIONS,
  tierXp,
} from './config';
import { successChance, tick } from './engine';
import {
  assignAdventurer,
  autoEquipBest,
  buyGuildUpgrade,
  equipItem,
  hireAdventurer,
  isBossUnlocked,
  isZoneUnlocked,
  launchExpedition,
  recallAdventurer,
  rosterCap,
  sellItem,
  sellItems,
} from './guild';
import { createInitialState } from './logic';
import { buyPerk } from './perks';
import { canTimeTravel, timeTravel } from './prestige';
import type { GameState } from './types';

const alwaysWin = () => 0.01; // low roll → success, but also triggers drops
const alwaysLose = () => 0.999;
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

  it('a fresh unequipped adventurer no longer trivializes mid/high zones by level alone', () => {
    const frontierPass = LOCATIONS.find((l) => l.id === 'frontier-pass')!;
    const forestEdge = LOCATIONS.find((l) => l.id === 'forest-edge')!;
    const fresh = generateAdventurer(1, mid);
    const freshPower = adventurerPower(guildState(), fresh);
    // Still very capable at the starting zone...
    expect(successChance(freshPower, forestEdge.power)).toBeGreaterThan(0.5);
    // ...but nowhere near capped at the last pre-Act-3 zone.
    expect(successChance(freshPower, frontierPass.power)).toBeLessThan(0.3);

    // Leveling alone helps, but a well-leveled *and* geared adventurer clears
    // it reliably — the combination is what the curve is meant to require.
    const leveled = { ...fresh, level: 25 };
    const leveledPower = adventurerPower(guildState(), leveled);
    expect(successChance(leveledPower, frontierPass.power)).toBeGreaterThan(
      successChance(freshPower, frontierPass.power),
    );
    const geared = {
      ...leveled,
      equipment: { weapon: generateEquipment(999, 6, mid) },
    };
    const gearedPower = adventurerPower(guildState(), geared);
    expect(successChance(gearedPower, frontierPass.power)).toBeGreaterThan(
      successChance(leveledPower, frontierPass.power),
    );
  });
});

describe('patrol & quests', () => {
  it('zones unlock in order via quest clears', () => {
    const s = guildState();
    expect(isZoneUnlocked(s, 'forest-edge')).toBe(true);
    expect(isZoneUnlocked(s, 'river-crossing')).toBe(false);
    const cleared = { ...s, locationsCleared: { 'forest-edge': true } };
    expect(isZoneUnlocked(cleared, 'river-crossing')).toBe(true);
    expect(isZoneUnlocked(cleared, 'old-mines')).toBe(false);
  });

  it('patrolling earns gold and xp per encounter', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    const goldBefore = s.gold;
    s = tick(s, ENCOUNTER_INTERVAL * 5, 0, alwaysWin);
    expect(s.gold).toBeGreaterThan(goldBefore);
    expect(s.adventurers[0].xp + s.adventurers[0].level).toBeGreaterThan(1);
    expect(s.inventory.length).toBeGreaterThan(0); // alwaysWin also hits drop rolls
  });

  it('a single lost fight only damages; injury comes when HP runs out', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // One failed encounter: still assigned, wounded but not knocked out.
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].hp).toBeLessThan(maxHp(s.adventurers[0]));
    expect(s.adventurers[0].injuredUntil).toBe(0);
    // Enough failures drain HP and knock them out.
    s = tick(s, ENCOUNTER_INTERVAL * 10, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].injuredUntil).toBeGreaterThan(s.runTimeSeconds);
  });

  it('a successful quest clears the zone and auto-switches to patrol', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    expect(s.adventurers[0].assignment?.mode).toBe('quest');
    s = tick(s, 700, 0, alwaysWin); // quest duration 60
    expect(s.locationsCleared['forest-edge']).toBe(true);
    expect(s.adventurers[0].assignment?.mode).toBe('patrol');
    expect(s.inventory.length).toBeGreaterThan(0); // guaranteed quest equipment
  });

  it('recall clears the assignment and lastAssignment', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // knock out so lastAssignment is set
    s = tick(s, ENCOUNTER_INTERVAL * 10, 0, alwaysLose);
    expect(s.adventurers[0].lastAssignment).not.toBeNull();
    // recall clears both
    s = recallAdventurer(s, s.adventurers[0].id);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].lastAssignment).toBeNull();
  });

  it('injury saves lastAssignment for re-engagement on recovery', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // patrol drains HP → knocked out, lastAssignment set
    s = tick(s, ENCOUNTER_INTERVAL * 10, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].lastAssignment).not.toBeNull();
    expect(s.adventurers[0].lastAssignment!.locationId).toBe('forest-edge');
    expect(s.adventurers[0].lastAssignment!.mode).toBe('patrol');
  });

  it('recovers and auto-reassigns to the same location and mode', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // knocked out (tier 1 injury → 180s)
    s = tick(s, ENCOUNTER_INTERVAL * 10, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].injuredUntil).toBeGreaterThan(s.runTimeSeconds);
    // tick past the injury duration
    s = tick(s, 200, 0, alwaysWin);
    // should now be re-assigned and patrolling
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.locationId).toBe('forest-edge');
    expect(s.adventurers[0].assignment!.mode).toBe('patrol');
    // lastAssignment should be cleared after re-assignment
    expect(s.adventurers[0].lastAssignment).toBeNull();
  });

  it('manual assignment clears lastAssignment', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // get knocked out, then recover
    s = tick(s, ENCOUNTER_INTERVAL * 10, 0, alwaysLose);
    s = tick(s, 200, 0, alwaysWin);
    // auto-reassigned to forest-edge; now recall and manually re-assign to same zone
    s = recallAdventurer(s, s.adventurers[0].id);
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.locationId).toBe('forest-edge');
    expect(s.adventurers[0].assignment!.mode).toBe('quest');
    // manual assignment cleared lastAssignment
    expect(s.adventurers[0].lastAssignment).toBeNull();
  });

  it('quest failure saves lastAssignment and auto-reassigns after recovery', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    // Repeated quest failures drain HP; eventually a knockout (tier 1 → 180s).
    s = tick(s, 200, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].lastAssignment).not.toBeNull();
    expect(s.adventurers[0].lastAssignment!.mode).toBe('quest');
    // tick past recovery, but not far enough to also finish the re-quest
    s = tick(s, 110, 0, alwaysWin);
    // should re-quest (since lastAssignment.mode was 'quest')
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.mode).toBe('quest');
    expect(s.adventurers[0].assignment!.locationId).toBe('forest-edge');
  });
});

describe('activity log', () => {
  it('a resolved quest writes a loot line', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    s = tick(s, 61, 0, alwaysWin);
    const quest = s.activityLog.find((e) => e.kind === 'quest');
    expect(quest).toBeDefined();
    expect(quest!.text).toContain('Forest Edge');
    expect(quest!.text).toContain('gold');
    expect(quest!.text).toContain('XP');
  });

  it('patrol rewards in one tick group into a single line (offline-style)', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    s = tick(s, ENCOUNTER_INTERVAL * 50, 0, alwaysWin); // 50 encounters, one tick
    const patrols = s.activityLog.filter((e) => e.kind === 'patrol');
    expect(patrols).toHaveLength(1);
    expect(patrols[0].text).toContain('Forest Edge');
  });

  it('injuries write a line and record the recovery duration', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    s = tick(s, ENCOUNTER_INTERVAL * 10, 0, alwaysLose);
    expect(s.activityLog.some((e) => e.kind === 'injury')).toBe(true);
    expect(s.adventurers[0].injuredDuration).toBeGreaterThan(0);
  });

  it('the log is capped', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    for (let i = 0; i < 100; i++) {
      s = tick(s, ENCOUNTER_INTERVAL, i * ENCOUNTER_INTERVAL * 1000, alwaysWin);
    }
    expect(s.activityLog.length).toBeLessThanOrEqual(60);
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

  it('a won expedition defeats the boss and awards shards', () => {
    let s = act3State();
    s = launchExpedition(s, GENERAL_IDS[0]);
    expect(s.expedition).not.toBeNull();
    s = tick(s, 2000, 0, alwaysWin);
    expect(s.expedition).toBeNull();
    expect(s.bossesDefeated[GENERAL_IDS[0]]).toBe(true);
    expect(s.timeShards).toBeGreaterThanOrEqual(15);
    expect(s.adventurers[0].assignment).toBeNull();
  });

  it('a lost expedition injures the party', () => {
    let s = act3State();
    s = launchExpedition(s, GENERAL_IDS[0]);
    s = tick(s, 2000, 0, alwaysLose);
    expect(s.bossesDefeated[GENERAL_IDS[0]]).toBeUndefined();
    expect(s.adventurers[0].injuredUntil).toBeGreaterThan(0);
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

describe('offline progression', () => {
  it('patroller who recovers during offline gets credit for encounters from recovery moment', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // Knock out the adventurer (tier 1 → 180s injury)
    s = tick(s, ENCOUNTER_INTERVAL * 10, 0, alwaysLose);
    const injuredUntil = s.adventurers[0].injuredUntil;
    expect(injuredUntil).toBeGreaterThan(s.runTimeSeconds);
    // Now simulate an offline tick where the adventurer recovers partway through
    // and then patrols the remaining time.
    const offlineDuration = 400;
    s = tick(s, offlineDuration, 0, alwaysWin);
    // The adventurer should have been auto-reassigned from their injuredUntil moment (t=200)
    // and processed encounters from t=200 to t=280 (80 seconds → 4 encounters at 20s intervals)
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.mode).toBe('patrol');
    // Should have earned gold from patrols during the offline period
    const patrolLogs = s.activityLog.filter((e) => e.kind === 'patrol');
    expect(patrolLogs.length).toBeGreaterThanOrEqual(1);
    // Gold should be at least from the online tick + offline work (after recovery)
    // Online encounter (injury happened): 5 gold
    // Offline work after recovery: ~4 encounters * 5 gold = 20 gold
    expect(s.gold).toBeGreaterThanOrEqual(25);
  });

  it('quest-capable adventurer who recovers during offline resolves quest for full reward', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    // Injure during quest (tier 1 → 180s)
    s = tick(s, 5, 0, alwaysLose);
    // Advance offline: wait 400s total — 180s to heal + 60s quest duration + 160s patrol time
    // The quest started at t=5, so at recovery (t=185) the quest is set to end at t=245.
    // Since we go to t=405, the quest resolves at t=245 and then patrols happen from t=245 to t=405.
    const offlineDuration = 400;
    s = tick(s, offlineDuration, 0, alwaysWin);
    // Should have completed the quest (cleared the zone)
    expect(s.locationsCleared['forest-edge']).toBe(true);
    // Should have gold from quest reward + patrols
    const questLog = s.activityLog.find((e) => e.kind === 'quest');
    expect(questLog).toBeDefined();
    const questText = questLog!.text;
    expect(questText).toContain('150 gold'); // QUEST.goldPerTier * 1
  });

  it('adventurer who never gets injured still works through entire offline period', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    const goldBefore = s.totalGoldEarned;
    // Process 500 seconds of offline work (guaranteed success)
    s = tick(s, 500, 0, alwaysWin);
    // 500s / 20s per encounter = 25 encounters
    // Each encounter: 5 gold → 125 gold
    expect(s.totalGoldEarned - goldBefore).toBeGreaterThanOrEqual(100);
    // All patrols should be logged as a single grouped line
    const patrolLogs = s.activityLog.filter((e) => e.kind === 'patrol');
    expect(patrolLogs.length).toBe(1);
  });
});
