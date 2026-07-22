import { describe, expect, it } from 'vitest';
import {
  championPerk,
  effectiveAttributes,
  gainXp,
  generateAdventurer,
  maxHp,
  perkRecoveryMult,
} from './adventurers';
import { rollMonsterGroup, simulateBattle } from './combat';
import { CHAMPION_PERKS } from './config';
import { createInitialState } from './logic';
import type { Adventurer } from './types';

const mid = () => 0.5;

function champ(perkId: string): Adventurer {
  const base = { ...generateAdventurer(1, mid), perkId, level: 20 };
  return { ...base, hp: maxHp(base) };
}

describe('champion perks', () => {
  it('provides at least 10 minor and 10 major perks, all with names & effects', () => {
    const minor = CHAMPION_PERKS.filter((p) => p.tier === 'minor');
    const major = CHAMPION_PERKS.filter((p) => p.tier === 'major');
    expect(minor.length).toBeGreaterThanOrEqual(10);
    expect(major.length).toBeGreaterThanOrEqual(10);
    for (const p of CHAMPION_PERKS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.effects.length).toBeGreaterThan(0);
    }
    // Perk ids are unique.
    expect(new Set(CHAMPION_PERKS.map((p) => p.id)).size).toBe(CHAMPION_PERKS.length);
  });

  it('every generated champion is born with a valid perk', () => {
    for (let i = 0; i < 30; i++) {
      const adv = generateAdventurer(i, () => (i * 37) % 100 / 100);
      expect(championPerk(adv.perkId)).toBeDefined();
    }
  });

  it("the constant-rng(0.5) roll stays a combat-neutral perk (test-determinism guard)", () => {
    expect(CHAMPION_PERKS[Math.floor(0.5 * CHAMPION_PERKS.length)].id).toBe('fortunate');
  });

  it('an attribute-multiplier perk raises that stat', () => {
    const plain = champ('fortunate'); // no STR effect
    const brawny = champ('brawny'); // +12% STR
    expect(effectiveAttributes(brawny).str).toBeGreaterThan(effectiveAttributes(plain).str);
  });

  it('convertToStat moves other attributes into the target stat', () => {
    const plain = champ('fortunate');
    const berserker = champ('berserker'); // 25% of others -> STR
    const before = effectiveAttributes(plain);
    const after = effectiveAttributes(berserker);
    expect(after.str).toBeGreaterThan(before.str);
    expect(after.con).toBeLessThan(before.con); // drained into STR
  });

  it("Titan's Blood doubles max HP but halves DEX", () => {
    const plain = champ('fortunate');
    const titan = champ('titans-blood');
    expect(maxHp(titan)).toBeGreaterThan(maxHp(plain) * 1.8);
    expect(effectiveAttributes(titan).dex).toBeLessThan(effectiveAttributes(plain).dex);
  });

  it('gear bonuses stay flat regardless of a percentage stat perk', () => {
    const brawny = champ('brawny');
    const beforeStr = effectiveAttributes(brawny).str;
    const withRing: Adventurer = {
      ...brawny,
      equipment: {
        trinket: { id: 9, slot: 'trinket', typeId: 'ring', name: 'Ring', rarity: 'epic', tier: 1, atk: 0, def: 0, hp: 30, attrs: { str: 5 } },
      },
    };
    // A +5 STR ring always yields exactly +5, never +5 * perk mult.
    expect(effectiveAttributes(withRing).str).toBe(beforeStr + 5);
    expect(maxHp(withRing)).toBe(maxHp(brawny) + 30);
  });

  it('xp perks scale experience gained', () => {
    const fast = gainXp(champ('fast-learner'), 100).xp; // +25%
    const plain = gainXp(champ('fortunate'), 100).xp;
    const slow = gainXp(champ('late-bloomer'), 100).xp; // -40% (before level-ups)
    expect(fast).toBeGreaterThan(plain);
    expect(slow).toBeLessThan(plain);
  });

  it('recovery perks shorten/lengthen injury time', () => {
    expect(perkRecoveryMult(champ('quick-healer'))).toBeLessThan(1);
    expect(perkRecoveryMult(champ('feral'))).toBeGreaterThan(1);
    expect(perkRecoveryMult(champ('fortunate'))).toBe(1);
  });

  it('live-combat crit perk only fires when simulateBattle runs in live mode', () => {
    const state = createInitialState(0);
    // A Keen Eye champion strong enough to win, so damage is logged.
    const keen = { ...champ('keen-eye'), level: 40 };
    keen.hp = maxHp(keen);
    const monsters = rollMonsterGroup('forest-edge', () => 0.3);
    const live = simulateBattle(state, [keen], monsters, 'forest-edge', () => 0.05, true);
    const auto = simulateBattle(state, [keen], monsters, 'forest-edge', () => 0.05, false);
    const maxHit = (o: typeof live) => Math.max(...o.log.filter((e) => e.attackerSide === 'party').map((e) => e.damage));
    // With rng always low, crit triggers in live mode → a bigger max party hit.
    expect(maxHit(live)).toBeGreaterThan(maxHit(auto));
  });
});
