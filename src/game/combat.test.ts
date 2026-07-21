import { describe, expect, it } from 'vitest';
import { generateAdventurer, maxHp } from './adventurers';
import { canExplore, rollMonsterGroup, runExplore, simulateBattle } from './combat';
import { exploreMonsterCount, LOCATIONS } from './config';
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
  it('returns a group sized by exploreMonsterCount for the zone tier', () => {
    for (const loc of LOCATIONS.filter((l) => l.kind === 'zone')) {
      const group = rollMonsterGroup(loc.id, mulberry32(loc.tier));
      expect(group.length).toBe(exploreMonsterCount(loc.tier));
      for (const m of group) {
        expect(m.maxHp).toBeGreaterThan(0);
        expect(m.atk).toBeGreaterThan(0);
      }
    }
  });

  it('returns nothing for an unknown location', () => {
    expect(rollMonsterGroup('nonexistent', mid)).toEqual([]);
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
});

describe('canExplore', () => {
  it('is false while injured, true once healthy and unassigned', () => {
    const state = { ...baseState(), runTimeSeconds: 100 };
    const injured = { ...champion(1, mid), injuredUntil: 200 };
    const healthy = { ...champion(2, mid), injuredUntil: 0 };
    expect(canExplore(state, injured)).toBe(false);
    expect(canExplore(state, healthy)).toBe(true);
  });

  it('is false while assigned to a patrol/quest', () => {
    const state = baseState();
    const busy = {
      ...champion(1, mid),
      assignment: { locationId: 'forest-edge', mode: 'patrol' as const, lastEncounterAt: 0 },
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
});
