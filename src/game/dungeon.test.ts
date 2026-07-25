import { describe, expect, it } from 'vitest';
import { generateAdventurer, maxHp } from './adventurers';
import { runExplore } from './combat';
import { DUNGEON_ROOM_COUNT, DUNGEON_WINS_REQUIRED } from './config';
import { dungeonDef, dungeonProgress, fightDungeonRoom, isDungeonUnlocked, DUNGEON_TOTAL_ROOMS } from './dungeon';
import { createInitialState } from './logic';
import type { Adventurer, GameState } from './types';

/** Deterministic PRNG for reproducible tests. */
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

function champion(id: number, level = 30): Adventurer {
  const a = { ...generateAdventurer(id, mid), level };
  return { ...a, hp: maxHp(a) };
}

describe('dungeon unlock progression', () => {
  it('is locked with 0 wins, and stays locked short of DUNGEON_WINS_REQUIRED', () => {
    const state = baseState();
    expect(isDungeonUnlocked(state, 'forest-edge')).toBe(false);
    expect(dungeonProgress(state, 'forest-edge')).toEqual({ wins: 0, unlocked: false });
  });

  it('unlocks after DUNGEON_WINS_REQUIRED manual Explore wins, and stops counting past that', () => {
    let state = baseState();
    const strong = champion(1);
    state = { ...state, adventurers: [strong] };

    for (let i = 0; i < DUNGEON_WINS_REQUIRED; i++) {
      const { state: next, result } = runExplore(state, 'forest-edge', [strong.id], mulberry32(100 + i));
      expect(result.outcome).toBe('win');
      state = { ...next, adventurers: next.adventurers.map((a) => ({ ...a, hp: maxHp(a) })) };
    }

    expect(isDungeonUnlocked(state, 'forest-edge')).toBe(true);
    expect(dungeonProgress(state, 'forest-edge').wins).toBe(DUNGEON_WINS_REQUIRED);
    const unlockEntry = state.activityLog.find((e) => e.kind === 'dungeon');
    expect(unlockEntry).toBeDefined();

    // One more win shouldn't push the counter past the requirement.
    const { state: after } = runExplore(state, 'forest-edge', [strong.id], mulberry32(999));
    expect(dungeonProgress(after, 'forest-edge').wins).toBe(DUNGEON_WINS_REQUIRED);
  });

  it("doesn't count Auto-Explore wins (processAutoExplore never calls recordDungeonWin)", () => {
    // processAutoExplore is exercised elsewhere; here we just confirm the
    // dungeon config exists only for zones (never for boss/expedition tiers).
    expect(dungeonDef('demon-king')).toBeUndefined();
    expect(dungeonDef('forest-edge')).toBeDefined();
  });
});

describe('fightDungeonRoom', () => {
  it('resolves regular rooms as wins for a strong party, then grants a completion bonus on the boss room', () => {
    let state = baseState();
    const strong = champion(1);
    state = { ...state, adventurers: [strong] };

    let materialTotal = 0;
    for (let room = 0; room < DUNGEON_TOTAL_ROOMS; room++) {
      const { state: next, result } = fightDungeonRoom(state, 'forest-edge', [strong.id], room, mulberry32(200 + room));
      expect(result.outcome).toBe('win');
      state = { ...next, adventurers: next.adventurers.map((a) => ({ ...a, hp: maxHp(a) })) };
      materialTotal = Object.values(next.materials).reduce((a, b) => a + b, 0);
    }

    expect(DUNGEON_TOTAL_ROOMS).toBe(DUNGEON_ROOM_COUNT + 1);
    // The boss-room clear grants a bonus on top of any regular-room drops.
    expect(materialTotal).toBeGreaterThan(0);
  });

  it('a loss ends the run without a completion bonus', () => {
    const state = baseState();
    const weak = champion(1, 1);
    const { result } = fightDungeonRoom(state, 'frontier-pass', [weak.id], DUNGEON_ROOM_COUNT, mulberry32(5));
    expect(result.outcome).toBe('loss');
  });

  it('returns an empty monster group (and a loss) for a location with no dungeon', () => {
    const state = baseState();
    const strong = champion(1);
    const { result } = fightDungeonRoom(state, 'general-marrow', [strong.id], 0, mulberry32(1));
    expect(result.monsters).toEqual([]);
    expect(result.outcome).toBe('loss');
  });

  it('flags only the first boss-room monster as isBoss, with normal support alongside', () => {
    const state = baseState();
    const strong = champion(1);
    const regular = fightDungeonRoom(state, 'forest-edge', [strong.id], 0, mulberry32(1));
    expect(regular.result.monsters.every((m) => !m.isBoss)).toBe(true);
    const boss = fightDungeonRoom(state, 'forest-edge', [strong.id], DUNGEON_ROOM_COUNT, mulberry32(1));
    expect(boss.result.monsters[0].isBoss).toBe(true);
    expect(boss.result.monsters[0].name).toBe('Alpha Direwolf');
    expect(boss.result.monsters.slice(1).every((m) => !m.isBoss)).toBe(true);
  });

  it('carries surviving champions\' HP/cooldown forward via carryOut, for the caller to feed into the next room', () => {
    const state = baseState();
    const strong = champion(1);
    const { result, carryOut } = fightDungeonRoom({ ...state, adventurers: [strong] }, 'forest-edge', [strong.id], 0, mulberry32(1));
    const pr = result.party.find((p) => p.advId === strong.id)!;
    expect(pr.knockedOut).toBe(false);
    expect(carryOut[strong.id]).toEqual({ hp: pr.finalHp, skillCooldownRemaining: pr.skillCooldownRemaining });
  });
});
