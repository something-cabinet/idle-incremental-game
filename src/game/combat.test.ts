import { describe, expect, it } from 'vitest';
import { generateAdventurer, isInjured, maxHp } from './adventurers';
import {
  applyBattleResult,
  canExplore,
  processAutoExplore,
  rollMonsterGroup,
  runExplore,
  simulateBattle,
} from './combat';
import type { MonsterInstance } from './combat';
import { ENCOUNTER_INTERVAL, LOCATIONS, SUPER_LOOT_AMOUNT_MULT, SUPER_MONSTER_PREFIX, SUPER_STAT_MULT } from './config';
import { tick } from './engine';
import { sendPartyOnAutoExplore } from './guild';
import { createInitialState } from './logic';
import type { Adventurer, GameState } from './types';

/** Deterministic PRNG for reproducible tests (no Math.random flakiness). */
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

const mid = () => 0.5;

function baseState(): GameState {
  return { ...createInitialState(0), act: 2 as const };
}

function champion(id: number, rng = mid): Adventurer {
  return generateAdventurer(id, rng);
}

describe('rollMonsterGroup', () => {
  it('always returns a group sized 1-3, with every monster having positive stats', () => {
    for (const loc of LOCATIONS.filter((l) => l.kind === 'zone')) {
      const group = rollMonsterGroup(loc.id, mulberry32(loc.tier));
      expect(group.length).toBeGreaterThanOrEqual(1);
      expect(group.length).toBeLessThanOrEqual(3);
      for (const m of group) {
        expect(m.maxHp).toBeGreaterThan(0);
        expect(m.atk).toBeGreaterThan(0);
      }
    }
  });

  it('rolls group sizes 1, 2, and 3 across many attempts, usually landing on 2', () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (let seed = 0; seed < 500; seed++) {
      const group = rollMonsterGroup('forest-edge', mulberry32(seed * 7919 + 1));
      counts[group.length] = (counts[group.length] ?? 0) + 1;
    }
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(0);
    expect(counts[3]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[2]).toBeGreaterThan(counts[3]);
  });

  it('returns nothing for an unknown location', () => {
    expect(rollMonsterGroup('nonexistent', mid)).toEqual([]);
  });

  it('rolls Super monsters more often in smaller groups, with tripled stats and a name prefix', () => {
    let superInSolo = 0;
    let soloTotal = 0;
    let superInTrio = 0;
    let trioTotal = 0;
    let sampleSuper: ReturnType<typeof rollMonsterGroup>[number] | undefined;
    let sampleNormal: ReturnType<typeof rollMonsterGroup>[number] | undefined;

    for (let seed = 0; seed < 2000; seed++) {
      const group = rollMonsterGroup('forest-edge', mulberry32(seed * 104729 + 3));
      if (group.length === 1) {
        soloTotal++;
        if (group[0].isSuper) superInSolo++;
      }
      if (group.length === 3) {
        trioTotal += group.length;
        superInTrio += group.filter((m) => m.isSuper).length;
      }
      for (const m of group) {
        if (m.isSuper && !sampleSuper) sampleSuper = m;
        if (!m.isSuper && !sampleNormal) sampleNormal = m;
      }
    }

    expect(soloTotal).toBeGreaterThan(0);
    expect(trioTotal).toBeGreaterThan(0);
    const soloRate = superInSolo / soloTotal;
    const trioRate = superInTrio / trioTotal;
    expect(soloRate).toBeGreaterThan(trioRate);

    expect(sampleSuper).toBeDefined();
    expect(sampleNormal).toBeDefined();
    expect(sampleSuper!.name.startsWith(SUPER_MONSTER_PREFIX)).toBe(true);
    expect(sampleNormal!.name.startsWith(SUPER_MONSTER_PREFIX)).toBe(false);
    // Same underlying species (targetId) -> stats scale by exactly SUPER_STAT_MULT.
    const base = sampleSuper!.targetId;
    const normalOfSameSpecies = Array.from({ length: 200 }, (_, i) => rollMonsterGroup('forest-edge', mulberry32(i)))
      .flat()
      .find((m) => !m.isSuper && m.targetId === base);
    if (normalOfSameSpecies) {
      expect(sampleSuper!.maxHp).toBe(normalOfSameSpecies.maxHp * SUPER_STAT_MULT);
      expect(sampleSuper!.atk).toBe(normalOfSameSpecies.atk * SUPER_STAT_MULT);
      expect(sampleSuper!.def).toBe(normalOfSameSpecies.def * SUPER_STAT_MULT);
    }
    // Rewards (gold/xp) scale by the same multiplier as combat stats.
    if (normalOfSameSpecies) {
      expect(sampleSuper!.goldReward).toBe(normalOfSameSpecies.goldReward * SUPER_STAT_MULT);
      expect(sampleSuper!.xpReward).toBe(normalOfSameSpecies.xpReward * SUPER_STAT_MULT);
    }
  });

  it('a Super monster drops materials/equipment more often than a normal one', () => {
    const state = { ...createInitialState(0), act: 2 as const };
    const strong = { ...champion(1, mid), level: 40 };
    const monster = (isSuper: boolean): MonsterInstance => ({
      instanceId: 0,
      targetId: 'wolf',
      name: isSuper ? 'Super Wolf' : 'Wolf',
      materialId: 'beast-pelt',
      maxHp: 10,
      atk: 1,
      def: 0,
      speed: 1,
      xpReward: 5,
      goldReward: 5,
      isSuper,
    });

    let normalDrops = 0;
    let superDrops = 0;
    const trials = 400;
    for (let seed = 0; seed < trials; seed++) {
      const rNormal = simulateBattle(state, [strong], [monster(false)], 'forest-edge', mulberry32(seed), true);
      if (Object.keys(rNormal.rewards.materials).length > 0 || rNormal.rewards.equipment.length > 0) normalDrops++;
      const rSuper = simulateBattle(state, [strong], [monster(true)], 'forest-edge', mulberry32(seed + 100000), true);
      if (Object.keys(rSuper.rewards.materials).length > 0 || rSuper.rewards.equipment.length > 0) superDrops++;
    }
    expect(superDrops).toBeGreaterThan(normalDrops);
  });

  it('a Super monster drop grants triple the material stack and triple the equipment count', () => {
    const state = { ...createInitialState(0), act: 2 as const };
    const strong = { ...champion(1, mid), level: 40 };
    const monster = (isSuper: boolean): MonsterInstance => ({
      instanceId: 0,
      targetId: 'wolf',
      name: isSuper ? 'Super Wolf' : 'Wolf',
      materialId: 'beast-pelt',
      maxHp: 10,
      atk: 1,
      def: 0,
      speed: 1,
      xpReward: 5,
      goldReward: 5,
      isSuper,
    });

    let normalMaterialAmount = 0;
    let superMaterialAmount = 0;
    let normalEquipCount = 0;
    let superEquipCount = 0;
    const trials = 400;
    for (let seed = 0; seed < trials; seed++) {
      const rNormal = simulateBattle(state, [strong], [monster(false)], 'forest-edge', mulberry32(seed), true);
      normalMaterialAmount += rNormal.rewards.materials['beast-pelt'] ?? 0;
      normalEquipCount += rNormal.rewards.equipment.length;
      const rSuper = simulateBattle(state, [strong], [monster(true)], 'forest-edge', mulberry32(seed + 100000), true);
      superMaterialAmount += rSuper.rewards.materials['beast-pelt'] ?? 0;
      superEquipCount += rSuper.rewards.equipment.length;
    }
    // Every individual material drop and equipment drop is tripled in amount
    // (SUPER_LOOT_AMOUNT_MULT), on top of the higher drop chance itself, so
    // the aggregate totals over many trials should differ by well over 3x.
    expect(superMaterialAmount).toBeGreaterThan(normalMaterialAmount * SUPER_LOOT_AMOUNT_MULT);
    expect(superEquipCount).toBeGreaterThan(normalEquipCount * SUPER_LOOT_AMOUNT_MULT);
  });
});

describe('simulateBattle', () => {
  it('an overwhelming party always wins against a trivial tier-1 group', () => {
    const state = baseState();
    const party = [1, 2, 3].map((id) => {
      const a = champion(id, mid);
      return { ...a, level: 30, hp: maxHp({ ...a, level: 30 }) };
    });
    const monsters = rollMonsterGroup('forest-edge', mulberry32(1));
    const result = simulateBattle(state, party, monsters, 'forest-edge', mulberry32(2));
    expect(result.outcome).toBe('win');
    expect(result.rewards.gold).toBeGreaterThan(0);
    expect(result.rewards.xp).toBeGreaterThan(0);
    expect(result.party.every((p) => !p.knockedOut)).toBe(true);
  });

  it('a lone level-1 champion loses to a stacked frontier-pass group and is injured', () => {
    const state = baseState();
    const party = [champion(1, mid)];
    const monsters = rollMonsterGroup('frontier-pass', mulberry32(6));
    const result = simulateBattle(state, party, monsters, 'frontier-pass', mulberry32(3));
    expect(result.outcome).toBe('loss');
    expect(result.rewards.gold).toBe(0);
    expect(result.rewards.xp).toBe(0);
    expect(result.party[0].knockedOut).toBe(true);
    expect(result.party[0].injurySeconds).toBeGreaterThan(0);
  });

  it('the combat log is ordered and damage always keeps hp within [0, maxHp]', () => {
    const state = baseState();
    const party = [1, 2].map((id) => champion(id, mulberry32(id)));
    const monsters = rollMonsterGroup('old-mines', mulberry32(9));
    const result = simulateBattle(state, party, monsters, 'old-mines', mulberry32(4));
    expect(result.log.length).toBeGreaterThan(0);
    for (const entry of result.log) {
      expect(entry.damage).toBeGreaterThan(0);
      expect(entry.defenderHpAfter).toBeGreaterThanOrEqual(0);
      expect(entry.defenderHpAfter).toBeLessThanOrEqual(entry.defenderMaxHp);
      expect(entry.defenderDefeated).toBe(entry.defenderHpAfter === 0);
    }
  });

  it('every log entry snapshots each party member\'s active buff/status labels (partyEffects)', () => {
    const state = baseState();
    // War Cry is a warrior buff (ATK ↑ on allies, 6 turns) — cast early since
    // skills start half-charged.
    const warrior = { ...champion(1, mid), level: 15, className: 'warrior' as const, skillId: 'war-cry' };
    const party = [{ ...warrior, hp: maxHp(warrior) }];
    const monsters = rollMonsterGroup('old-mines', mulberry32(1));
    const result = simulateBattle(state, party, monsters, 'old-mines', mulberry32(2), true);

    // Every entry carries a full partyEffects snapshot for every party member.
    for (const entry of result.log) {
      expect(entry.partyEffects).toBeDefined();
      expect(entry.partyEffects![warrior.id]).toBeDefined();
    }

    const buffEntry = result.log.find((e) => e.kind === 'buff');
    expect(buffEntry).toBeDefined();
    expect(buffEntry!.partyEffects![warrior.id]).toContain('ATK ↑');

    // Before the buff was cast, it wasn't active yet.
    const buffIndex = result.log.indexOf(buffEntry!);
    if (buffIndex > 0) {
      expect(result.log[buffIndex - 1].partyEffects![warrior.id]).not.toContain('ATK ↑');
    }
  });
});

describe('canExplore', () => {
  it('is false while injured, true once healthy and unassigned', () => {
    const state = { ...baseState(), runTimeSeconds: 100 };
    const injured = { ...champion(1, mid), injuredUntil: 200 };
    const healthy = { ...champion(2, mid), injuredUntil: 0 };
    expect(canExplore(state, injured)).toBe(false);
    expect(canExplore(state, healthy)).toBe(true);
  });

  it('is false while assigned to an auto-explore/quest', () => {
    const state = baseState();
    const busy = {
      ...champion(1, mid),
      assignment: { locationId: 'forest-edge', mode: 'auto-explore' as const, lastEncounterAt: 0 },
    };
    expect(canExplore(state, busy)).toBe(false);
  });
});

describe('applyBattleResult / runExplore', () => {
  it('on a win: grants gold/xp/materials, appends a log entry, leaves champions at full hp', () => {
    let state = baseState();
    const strong = { ...champion(1, mid), level: 30 };
    state = { ...state, adventurers: [{ ...strong, hp: maxHp(strong) }] };
    const { state: next, result } = runExplore(state, 'forest-edge', [strong.id], mulberry32(11));
    expect(result.outcome).toBe('win');
    expect(next.gold).toBe(state.gold + result.rewards.gold);
    expect(next.activityLog.length).toBe(1);
    expect(next.activityLog[0].kind).toBe('explore');
    const adv = next.adventurers.find((a) => a.id === strong.id)!;
    expect(adv.hp).toBe(maxHp(adv));
    expect(adv.injuredUntil).toBe(0);
  });

  it('on a loss: grants nothing, injures the knocked-out champion', () => {
    let state = baseState();
    const weak = champion(1, mid);
    state = { ...state, adventurers: [{ ...weak, hp: maxHp(weak) }] };
    const { state: next, result } = runExplore(state, 'frontier-pass', [weak.id], mulberry32(12));
    expect(result.outcome).toBe('loss');
    expect(next.gold).toBe(state.gold);
    const adv = next.adventurers.find((a) => a.id === weak.id)!;
    expect(adv.hp).toBe(0);
    expect(adv.injuredUntil).toBeGreaterThan(state.runTimeSeconds);
    expect(next.activityLog[0].kind).toBe('explore');
  });

  it('is a no-op for unknown party ids (no crash, empty party loses)', () => {
    const state = baseState();
    const { result } = runExplore(state, 'forest-edge', [999], mulberry32(1));
    expect(result.outcome).toBe('loss');
    expect(result.party).toEqual([]);
  });

  it('splits total monster XP evenly across the party (solo earns the full pot)', () => {
    // Same rolled battle applied to a solo vs a trio: solo gets the whole XP
    // pot, each trio member gets a third.
    const state = baseState();
    const a = { ...champion(1, mid), level: 30 };
    const b = { ...champion(2, mid), level: 30 };
    const c = { ...champion(3, mid), level: 30 };
    const party = [a, b, c];
    const monsters = rollMonsterGroup('forest-edge', mulberry32(1));

    const soloResult = simulateBattle(state, [a], monsters, 'forest-edge', mulberry32(2));
    const trioResult = simulateBattle(state, party, monsters, 'forest-edge', mulberry32(2));
    // Give everyone the same starting XP baseline via a fresh state each apply.
    const soloState = applyBattleResult({ ...state, adventurers: [a] }, soloResult, mulberry32(9));
    const trioState = applyBattleResult({ ...state, adventurers: party }, trioResult, mulberry32(9));

    const soloXp = soloState.adventurers[0].xp;
    const trioXp = trioState.adventurers[0].xp;
    expect(soloResult.outcome).toBe('win');
    expect(soloXp).toBeGreaterThan(0);
    // Solo pot ≈ 3× a trio member's share (integer floor makes it approximate).
    expect(soloXp).toBeGreaterThan(trioXp);
  });
});

describe('processAutoExplore (auto-battle, online + offline)', () => {
  function withAutoExplorer(level: number, id = 1): GameState {
    const adv = { ...champion(id, mid), level };
    return {
      ...baseState(),
      reputation: 5000, // unlock all zones
      guildUpgrades: { 'auto-explore': 1 }, // unlock the feature itself
      adventurers: [{ ...adv, hp: maxHp(adv) }],
    };
  }

  it('is gated behind the auto-explore guild upgrade', () => {
    const locked = { ...withAutoExplorer(30), guildUpgrades: {} };
    const s = sendPartyOnAutoExplore(locked, [1], 'forest-edge');
    expect(s.adventurers[0].assignment).toBeNull(); // rejected, upgrade not bought
  });

  it('runs no encounter until a full ENCOUNTER_INTERVAL of game time has passed', () => {
    let s = sendPartyOnAutoExplore(withAutoExplorer(30), [1], 'forest-edge');
    const before = s.gold;
    s = processAutoExplore({ ...s, runTimeSeconds: s.runTimeSeconds + ENCOUNTER_INTERVAL - 1 }, mulberry32(3));
    expect(s.gold).toBe(before); // not enough time elapsed yet
  });

  it('a strong solo auto-explorer earns gold + xp once intervals elapse', () => {
    let s = sendPartyOnAutoExplore(withAutoExplorer(30), [1], 'forest-edge');
    expect(s.adventurers[0].assignment?.mode).toBe('auto-explore');
    // Advance 5 intervals of game time, then process.
    s = { ...s, runTimeSeconds: s.runTimeSeconds + ENCOUNTER_INTERVAL * 5 };
    s = processAutoExplore(s, mulberry32(4));
    const adv = s.adventurers[0];
    expect(s.gold).toBeGreaterThan(0);
    expect(adv.xp + adv.level).toBeGreaterThan(1); // gained xp/levels
    expect(adv.assignment?.mode).toBe('auto-explore'); // still auto-exploring
    expect(adv.enemiesDefeated).toBeGreaterThan(0);
  });

  it('offline catch-up through tick auto-battles and pays out loot', () => {
    let s = sendPartyOnAutoExplore(withAutoExplorer(30), [1], 'forest-edge');
    const startGold = s.gold;
    // One big tick simulating ~1 hour offline (3600s).
    s = tick(s, 3600, Date.now(), mulberry32(7));
    expect(s.gold).toBeGreaterThan(startGold);
    expect(s.adventurers[0].enemiesDefeated).toBeGreaterThan(0);
  });

  it('a weak solo auto-explorer gets injured and rests, then auto-resumes after healing', () => {
    let s = sendPartyOnAutoExplore(withAutoExplorer(1), [1], 'frontier-pass');
    s = { ...s, runTimeSeconds: s.runTimeSeconds + ENCOUNTER_INTERVAL };
    s = processAutoExplore(s, mulberry32(5));
    const adv = s.adventurers[0];
    expect(adv.injuredUntil).toBeGreaterThan(s.runTimeSeconds); // hurt and resting
    expect(adv.assignment?.mode).toBe('auto-explore'); // still posted, not recalled
    expect(isInjured(adv, s.runTimeSeconds)).toBe(true);
  });

  it('caps a zone at EXPLORE_MAX_PARTY_SIZE auto-explorers', () => {
    let s = withAutoExplorer(30, 1);
    s = { ...s, adventurers: [1, 2, 3, 4].map((id) => {
      const a = { ...champion(id, mid), level: 30 };
      return { ...a, hp: maxHp(a) };
    }) };
    s = sendPartyOnAutoExplore(s, [1, 2, 3, 4], 'forest-edge');
    const here = s.adventurers.filter((a) => a.assignment?.locationId === 'forest-edge');
    expect(here.length).toBe(3); // 4th rejected
  });
});

describe('simulateBattle carryIn', () => {
  it('seeds starting HP from carryIn instead of full HP (a dungeon room continuing the last)', () => {
    const state = baseState();
    // Deliberately weak vs. a high-tier zone so they take a hit before
    // dealing with the whole monster group (outcome doesn't matter here).
    const weak = { ...champion(1, mid), level: 1 };
    const carryHp = 50;
    const carryIn = { [weak.id]: { hp: carryHp, skillCooldownRemaining: 0 } };
    const monsters = rollMonsterGroup('frontier-pass', mulberry32(3));
    const result = simulateBattle(state, [weak], monsters, 'frontier-pass', mulberry32(3), true, carryIn);

    // The first hit landed on the champion must start from the carried HP,
    // not a fresh full HP — every hit deals at least 1 damage (rollDamage's
    // floor), so it must land strictly below the carried-in value.
    const firstHitOnChampion = result.log.find((e) => e.defenderSide === 'party');
    expect(firstHitOnChampion).toBeDefined();
    expect(firstHitOnChampion!.defenderHpAfter).toBeLessThan(carryHp);
  });
});
