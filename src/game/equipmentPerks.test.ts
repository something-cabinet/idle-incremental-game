import { describe, expect, it } from 'vitest';
import { ascendEquipment, generateAdventurer, generateEquipment, maxHp } from './adventurers';
import { simulateBattle } from './combat';
import type { MonsterInstance } from './combat';
import { EQUIPMENT_PERKS, EQUIPMENT_PERK_CAP, EQUIPMENT_PERK_TIER_RATE } from './config';
import {
  equipmentPerkDef,
  equipmentPerkEffect,
  equipmentPerkText,
  equippedPerkEffects,
  rollEquipmentPerk,
} from './equipmentPerks';
import { createInitialState } from './logic';
import type { Adventurer, Equipment, EquipmentPerkEffect, GameState } from './types';

const mid = () => 0.5;

function item(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 1,
    slot: 'weapon',
    typeId: 'sword',
    rarity: 'ascendant',
    tier: 1,
    name: 'Test Blade',
    atk: 10,
    def: 0,
    hp: 0,
    attrs: {},
    ...overrides,
  };
}

describe('perk resolution', () => {
  it('returns nothing for an item with no perk, or an unknown perk id', () => {
    expect(equipmentPerkEffect(item({ perkId: undefined }))).toBeNull();
    expect(equipmentPerkEffect(item({ perkId: 'not-a-perk' }))).toBeNull();
    expect(equipmentPerkText(item({ perkId: undefined }))).toBeNull();
    expect(equipmentPerkDef(undefined)).toBeUndefined();
  });

  it('rollEquipmentPerk only ever returns a real perk id', () => {
    const ids = EQUIPMENT_PERKS.map((p) => p.id);
    for (const roll of [0, 0.25, 0.5, 0.99, 0.999999]) {
      expect(ids).toContain(rollEquipmentPerk(() => roll));
    }
  });

  it('every perk has a description whose placeholders all get substituted', () => {
    for (const perk of EQUIPMENT_PERKS) {
      const text = equipmentPerkText(item({ perkId: perk.id, tier: 4 }));
      expect(text).toBeTruthy();
      expect(text).not.toContain('{v}');
      expect(text).not.toContain('{t}');
    }
  });
});

describe('tier scaling', () => {
  /** The single scalar potency of an effect, whatever kind it is. */
  function potency(e: EquipmentPerkEffect): number {
    switch (e.kind) {
      case 'block':
      case 'twinstrike':
        return e.chance;
      case 'execute':
        return e.mult;
      default:
        return e.fraction;
    }
  }

  it('tier 1 is exactly the configured base', () => {
    for (const perk of EQUIPMENT_PERKS) {
      const scaled = equipmentPerkEffect(item({ perkId: perk.id, tier: 1 }))!;
      expect(potency(scaled)).toBeCloseTo(potency(perk.effect), 6);
    }
  });

  it('grows by EQUIPMENT_PERK_TIER_RATE per tier above 1', () => {
    // Thornmail's base (0.18) stays well under its cap even at tier 6.
    const t1 = equipmentPerkEffect(item({ perkId: 'thornmail', tier: 1 }))!;
    const t6 = equipmentPerkEffect(item({ perkId: 'thornmail', tier: 6 }))!;
    const expected = 1 + 5 * EQUIPMENT_PERK_TIER_RATE;
    expect(potency(t6) / potency(t1)).toBeCloseTo(expected, 6);
  });

  it('scales execute’s bonus above 1×, not the whole multiplier', () => {
    const base = EQUIPMENT_PERKS.find((p) => p.id === 'executioner')!.effect;
    if (base.kind !== 'execute') throw new Error('executioner should be an execute perk');
    const t6 = equipmentPerkEffect(item({ perkId: 'executioner', tier: 6 }))!;
    if (t6.kind !== 'execute') throw new Error('scaling must preserve the effect kind');
    expect(t6.mult).toBeCloseTo(1 + (base.mult - 1) * (1 + 5 * EQUIPMENT_PERK_TIER_RATE), 6);
    // The HP threshold is a condition, not a potency — it never scales.
    expect(t6.threshold).toBe(base.threshold);
  });

  it('never exceeds the per-kind cap, even at absurd tiers', () => {
    for (const perk of EQUIPMENT_PERKS) {
      const scaled = equipmentPerkEffect(item({ perkId: perk.id, tier: 500 }))!;
      const cap = EQUIPMENT_PERK_CAP[perk.effect.kind];
      const value = scaled.kind === 'execute' ? scaled.mult - 1 : potency(scaled);
      expect(value).toBeLessThanOrEqual(cap + 1e-9);
    }
  });
});

describe('ascendEquipment grants a perk', () => {
  it('gives every ascended item exactly one real perk', () => {
    const exalted = { ...generateEquipment(1, 6, mid), rarity: 'exalted' as const, tier: 6 };
    const ascended = ascendEquipment(exalted, mid);
    expect(ascended.rarity).toBe('ascendant');
    expect(EQUIPMENT_PERKS.map((p) => p.id)).toContain(ascended.perkId);
    expect(equipmentPerkEffect(ascended)).not.toBeNull();
  });

  it('leaves non-ascendant gear perkless — drops and crafts never roll one', () => {
    for (const tier of [1, 3, 6]) {
      expect(generateEquipment(1, tier, mid).perkId).toBeUndefined();
      expect(generateEquipment(2, tier, mid, 'armor', 'rare').perkId).toBeUndefined();
    }
  });
});

describe('equippedPerkEffects', () => {
  function champion(equipment: Adventurer['equipment']): Adventurer {
    return { ...generateAdventurer(1, mid), equipment };
  }

  it('collects one scaled effect per perk-bearing equipped item', () => {
    const adv = champion({
      weapon: item({ id: 1, slot: 'weapon', perkId: 'rending', tier: 6 }),
      armor: item({ id: 2, slot: 'armor', typeId: 'plate', perkId: 'aegis', tier: 3 }),
      trinket: item({ id: 3, slot: 'trinket', typeId: 'ring' }), // no perk
    });
    const effects = equippedPerkEffects(adv);
    expect(effects.map((e) => e.kind).sort()).toEqual(['aegis', 'pierce']);
  });

  it('is empty for a champion in ordinary gear', () => {
    expect(equippedPerkEffects(champion({ weapon: item({ perkId: undefined }) }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Combat behavior. Each test pins rng so the effect under test is the only
// thing that differs between the two runs being compared.
// ---------------------------------------------------------------------------

function baseState(): GameState {
  return { ...createInitialState(0), act: 2 as const };
}

function fighter(equipment: Adventurer['equipment'] = {}): Adventurer {
  const base = { ...generateAdventurer(900, mid), level: 20, equipment };
  return { ...base, hp: maxHp(base) };
}

function monster(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return {
    instanceId: 1,
    targetId: 'gray-wolf',
    name: 'Gray Wolf',
    materialId: 'beast-pelt',
    maxHp: 400,
    atk: 60,
    def: 5,
    speed: 1, // always slower than the champion, so the party strikes first
    xpReward: 10,
    goldReward: 5,
    isSuper: false,
    ...overrides,
  };
}

/** Total damage the party took across a battle, from the log. */
function damageTakenByParty(log: { defenderSide: string; damage: number }[]): number {
  return log.filter((e) => e.defenderSide === 'party').reduce((sum, e) => sum + e.damage, 0);
}

/**
 * Two champions in *identical* gear that differs only by whether the pieces
 * carry `perkId`. Comparing these isolates the perk: the items' own atk/def/hp
 * are the same on both sides, so any difference in the fight is the perk's
 * doing and not the stat line of the gear carrying it.
 */
function withAndWithoutPerk(perkId: string, tier = 6): [Adventurer, Adventurer] {
  const gear = (perk: string | undefined): Adventurer['equipment'] => ({
    weapon: item({ id: 2, perkId: perk, tier }),
    armor: item({ id: 3, slot: 'armor', typeId: 'plate', atk: 0, def: 8, perkId: perk, tier }),
  });
  return [fighter(gear(perkId)), fighter(gear(undefined))];
}

describe('combat: gear perks are live-only', () => {
  it('Auto-Explore/offline (live=false) ignores gear perks entirely', () => {
    const plain = fighter();
    const thorned = fighter({ armor: item({ id: 2, slot: 'armor', typeId: 'plate', perkId: 'thornmail', tier: 6 }) });
    const a = simulateBattle(baseState(), [plain], [monster()], 'forest-edge', mid, false);
    const b = simulateBattle(baseState(), [thorned], [monster()], 'forest-edge', mid, false);
    expect(b.log.length).toBe(a.log.length);
    expect(b.log.some((e) => e.effectLabel === 'Thorns')).toBe(false);
  });
});

describe('combat: individual perks', () => {
  it('Thornmail reflects damage back at the attacker', () => {
    const thorned = fighter({
      armor: item({ id: 2, slot: 'armor', typeId: 'plate', perkId: 'thornmail', tier: 6 }),
    });
    const result = simulateBattle(baseState(), [thorned], [monster()], 'forest-edge', mid, true);
    const reflected = result.log.filter((e) => e.effectLabel === 'Thorns');
    expect(reflected.length).toBeGreaterThan(0);
    for (const e of reflected) {
      expect(e.attackerSide).toBe('party');
      expect(e.defenderSide).toBe('monsters');
      expect(e.damage).toBeGreaterThan(0);
    }
  });

  it('Bulwark voids incoming hits, so the party takes strictly less damage', () => {
    const rng = () => 0.05; // under Bulwark's chance
    const [guarded, plain] = withAndWithoutPerk('bulwark');
    const withPerk = simulateBattle(baseState(), [guarded], [monster()], 'forest-edge', rng, true);
    const without = simulateBattle(baseState(), [plain], [monster()], 'forest-edge', rng, true);
    expect(withPerk.log.some((e) => e.effectLabel === 'Blocked' && e.damage === 0)).toBe(true);
    expect(damageTakenByParty(withPerk.log)).toBeLessThan(damageTakenByParty(without.log));
  });

  it('Aegis softens every incoming hit', () => {
    const rng = () => 0.6; // above every chance-based perk; isolates the reduction
    const [warded, plain] = withAndWithoutPerk('aegis');
    const withPerk = simulateBattle(baseState(), [warded], [monster()], 'forest-edge', rng, true);
    const without = simulateBattle(baseState(), [plain], [monster()], 'forest-edge', rng, true);
    const firstTaken = (r: typeof withPerk) => r.log.find((e) => e.defenderSide === 'party')!.damage;
    expect(firstTaken(withPerk)).toBeLessThan(firstTaken(without));
  });

  it('Rending Edge thins the target’s Defense, raising damage dealt', () => {
    const rng = () => 0.6;
    const [rending, plain] = withAndWithoutPerk('rending');
    const withPerk = simulateBattle(baseState(), [rending], [monster({ def: 120 })], 'forest-edge', rng, true);
    const without = simulateBattle(baseState(), [plain], [monster({ def: 120 })], 'forest-edge', rng, true);
    const firstDealt = (r: typeof withPerk) => r.log.find((e) => e.defenderSide === 'monsters')!.damage;
    expect(firstDealt(withPerk)).toBeGreaterThan(firstDealt(without));
  });

  it("Executioner's Mark spares a healthy enemy but amplifies blows on a wounded one", () => {
    const rng = () => 0.6;
    const [marked, plain] = withAndWithoutPerk('executioner');
    // Monsters always enter a fight at full HP, so "wounded" has to be earned:
    // give the target enough HP to survive many hits and compare the first
    // blow (target at 100%, above the threshold) against the last one (target
    // scraping zero, under it). Constant rng makes every other hit identical.
    const tanky = () => monster({ maxHp: 3000, atk: 1 });
    const withPerk = simulateBattle(baseState(), [marked], [tanky()], 'forest-edge', rng, true);
    const without = simulateBattle(baseState(), [plain], [tanky()], 'forest-edge', rng, true);
    const dealt = (r: typeof withPerk) => r.log.filter((e) => e.defenderSide === 'monsters');

    expect(dealt(withPerk)[0].damage).toBe(dealt(without)[0].damage);
    expect(dealt(withPerk).at(-1)!.damage).toBeGreaterThan(dealt(without).at(-1)!.damage);
  });

  it('Twinstrike lets a basic attack land a second time', () => {
    const rng = () => 0.05; // under Twinstrike's chance
    const [twin, plain] = withAndWithoutPerk('twinstrike');
    // A harmless, unkillable, faster-than-the-champion monster: it acts once
    // per round and neither side dies, so both runs burn the same turn budget.
    // Raw strike counts would mislead here (landing more hits per turn ends a
    // real fight *sooner*, lowering the total) — strikes per enemy turn is the
    // figure that actually shows the extra swing.
    const dummy = () => monster({ maxHp: 1_000_000, atk: 1, speed: 1000 });
    const run = (a: Adventurer) => simulateBattle(baseState(), [a], [dummy()], 'forest-edge', rng, true);
    const strikesPerEnemyTurn = (r: ReturnType<typeof run>) => {
      const partyStrikes = r.log.filter((e) => e.attackerSide === 'party' && e.defenderSide === 'monsters').length;
      const enemyTurns = r.log.filter((e) => e.attackerSide === 'monsters').length;
      return partyStrikes / enemyTurns;
    };
    expect(strikesPerEnemyTurn(run(twin))).toBeGreaterThan(strikesPerEnemyTurn(run(plain)));
  });

  it('Lifewell mends its bearer at the start of their turns', () => {
    const [mending] = withAndWithoutPerk('lifewell');
    const result = simulateBattle(
      baseState(),
      [mending],
      [monster({ atk: 80 })],
      'forest-edge',
      mid,
      true,
    );
    const heals = result.log.filter((e) => e.kind === 'buff' && e.effectLabel?.startsWith('+'));
    expect(heals.length).toBeGreaterThan(0);
    for (const h of heals) {
      expect(h.defenderSide).toBe('party');
      expect(h.damage).toBe(0);
    }
  });
});

describe('combat: perks stack across equipped items', () => {
  it('adds same-kind perks together, so three Bulwarks block where one does not', () => {
    // A tier-6 Bulwark is ~14%; three stack to ~42%, clamped to the 35% cap.
    // An rng between those two figures blocks only in the stacked loadout.
    const rng = () => 0.25;
    const gear = (count: number): Adventurer['equipment'] => ({
      weapon: item({ id: 2, perkId: count > 0 ? 'bulwark' : undefined, tier: 6 }),
      armor: item({ id: 3, slot: 'armor', typeId: 'plate', atk: 0, def: 8, perkId: count > 1 ? 'bulwark' : undefined, tier: 6 }),
      trinket: item({ id: 4, slot: 'trinket', typeId: 'ring', atk: 0, perkId: count > 2 ? 'bulwark' : undefined, tier: 6 }),
    });
    const run = (count: number) =>
      simulateBattle(baseState(), [fighter(gear(count))], [monster()], 'forest-edge', rng, true);
    const blocks = (r: ReturnType<typeof run>) =>
      r.log.filter((e) => e.effectLabel === 'Blocked').length;

    expect(blocks(run(1))).toBe(0);
    expect(blocks(run(3))).toBeGreaterThan(0);
  });

  it('sums a stacked kind past its cap, leaving combat.ts to clamp it', () => {
    const adv: Adventurer = {
      ...generateAdventurer(1, mid),
      equipment: {
        weapon: item({ id: 1, perkId: 'bulwark', tier: 6 }),
        armor: item({ id: 2, slot: 'armor', typeId: 'plate', perkId: 'bulwark', tier: 6 }),
        trinket: item({ id: 3, slot: 'trinket', typeId: 'ring', perkId: 'bulwark', tier: 6 }),
      },
    };
    const raw = equippedPerkEffects(adv).reduce(
      (sum, e) => sum + (e.kind === 'block' ? e.chance : 0),
      0,
    );
    // Each item is under the cap on its own; three together overshoot it, which
    // is exactly the case aggregateGearPerks has to clamp.
    expect(raw).toBeGreaterThan(EQUIPMENT_PERK_CAP.block);
  });
});
