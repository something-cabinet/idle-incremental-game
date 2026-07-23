import { describe, expect, it } from 'vitest';
import { championSkill, generateAdventurer, maxHp, skillsForClass } from './adventurers';
import { rollMonsterGroup, simulateBattle } from './combat';
import { CLASS_SKILLS } from './config';
import { createInitialState, migrateSave } from './logic';
import type { Adventurer, AdventurerClass } from './types';

const mid = () => 0.5;

// Small seeded PRNG (mirrors combat.test's mulberry32) for repeatable battles.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function champ(skillId: string, level: number): Adventurer {
  // 'well-rounded' perk keeps crit/lifesteal out of the way for clean assertions.
  const base = { ...generateAdventurer(1, mid), perkId: 'well-rounded', skillId, level };
  return { ...base, hp: maxHp(base) };
}

const CLASSES: AdventurerClass[] = ['warrior', 'ranger', 'mage'];

describe('class active skills', () => {
  it('gives each class exactly 5 uniquely-named skills', () => {
    for (const cls of CLASSES) {
      expect(skillsForClass(cls).length).toBe(5);
    }
    expect(new Set(CLASS_SKILLS.map((s) => s.id)).size).toBe(CLASS_SKILLS.length);
    for (const s of CLASS_SKILLS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.cooldownSeconds).toBeGreaterThan(0);
      expect(s.effects.length).toBeGreaterThan(0);
    }
  });

  it('single-target damage is tuned stronger than the aoe equivalent', () => {
    const heavy = championSkill('heavy-strike')!.effects[0];
    const cleave = championSkill('cleave')!.effects[0];
    expect(heavy.kind === 'damage' && cleave.kind === 'damage').toBe(true);
    if (heavy.kind === 'damage' && cleave.kind === 'damage') {
      expect(heavy.power).toBeGreaterThan(cleave.power);
    }
  });

  it('every generated champion gets a skill from its own class pool', () => {
    for (let i = 0; i < 30; i++) {
      const adv = generateAdventurer(i, mulberry32(i + 1));
      const skill = championSkill(adv.skillId);
      expect(skill).toBeDefined();
      expect(skill!.className).toBe(adv.className);
    }
  });

  it('champions do NOT use skills in a non-live (auto-explore/offline) battle', () => {
    const state = createInitialState(0);
    const a = champ('fireball', 40); // an mage AoE+burn skill
    const monsters = rollMonsterGroup('old-mines', mulberry32(9));
    const out = simulateBattle(state, [a], monsters, 'old-mines', mulberry32(4), false);
    expect(out.log.some((e) => e.skillName || e.kind === 'buff' || e.kind === 'status' || e.kind === 'dot')).toBe(false);
  });

  it('a live battle auto-casts the champion skill and labels the hit', () => {
    const state = createInitialState(0);
    const a = champ('arcane-bolt', 40);
    const monsters = rollMonsterGroup('old-mines', mulberry32(9));
    const out = simulateBattle(state, [a], monsters, 'old-mines', mulberry32(4), true);
    expect(out.log.some((e) => e.skillName === 'Arcane Bolt' && e.damage > 0)).toBe(true);
  });

  it('a buff skill applies a buff log line to the party', () => {
    const state = createInitialState(0);
    const a = champ('war-cry', 40);
    const monsters = rollMonsterGroup('old-mines', mulberry32(9));
    const out = simulateBattle(state, [a], monsters, 'old-mines', mulberry32(4), true);
    expect(out.log.some((e) => e.kind === 'buff' && e.effectLabel === 'ATK ↑')).toBe(true);
  });

  it('a poison skill inflicts a status and then ticks damage over time', () => {
    const state = createInitialState(0);
    // Modest champion vs a stacked frontier group: the fight lasts long enough
    // for the poison to tick before the target dies.
    const a = champ('serpent-sting', 18);
    const monsters = rollMonsterGroup('frontier-pass', mulberry32(6));
    const out = simulateBattle(state, [a], monsters, 'frontier-pass', mulberry32(2), true);
    expect(out.log.some((e) => e.kind === 'status' && e.effectLabel === 'Poison')).toBe(true);
    expect(out.log.some((e) => e.kind === 'dot' && e.effectLabel === 'Poison' && e.damage > 0)).toBe(true);
  });

  it('cooldowns force basic attacks between casts (skills are not spammed)', () => {
    const state = createInitialState(0);
    const a = champ('power-shot', 40); // 5s CD single-target
    const monsters = rollMonsterGroup('frontier-pass', mulberry32(6));
    const out = simulateBattle(state, [a], monsters, 'frontier-pass', mulberry32(2), true);
    const casts = out.log.filter((e) => e.attackerSide === 'party' && e.skillName).length;
    const basics = out.log.filter((e) => e.attackerSide === 'party' && !e.skillName && e.damage > 0).length;
    expect(casts).toBeGreaterThan(0);
    expect(basics).toBeGreaterThan(0);
  });

  it('backfills a class skill for pre-v15 saved champions', () => {
    const legacy = { ...generateAdventurer(3, mid) } as Partial<Adventurer>;
    delete legacy.skillId;
    const migrated = migrateSave({ version: 14, state: { ...createInitialState(0), adventurers: [legacy as Adventurer] } });
    const skill = championSkill(migrated.adventurers[0].skillId);
    expect(skill).toBeDefined();
    expect(skill!.className).toBe(migrated.adventurers[0].className);
  });
});
