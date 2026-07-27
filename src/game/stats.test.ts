import { describe, expect, it } from 'vitest';
import { generateAdventurer, maxHp } from './adventurers';
import { runExplore } from './combat';
import { ADVENTURER_MAX, DEMON_KING_ID, DUNGEON_ROOM_COUNT } from './config';
import { fightDungeonRoom } from './dungeon';
import { tick } from './engine';
import { disassembleItems, hireAdventurer, postQuest, questRequiredWork } from './guild';
import { click, createInitialState, migrateSave } from './logic';
import { timeTravel } from './prestige';
import { EMPTY_STATS, addStats, migrateStats } from './stats';
import type { Equipment, GameState, SaveData } from './types';

const mid = () => 0.5;

/** Deterministic PRNG so battle outcomes are reproducible. */
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

function guildState(): GameState {
  return { ...createInitialState(0), act: 2 as const, gold: 100_000 };
}

/** A champion strong enough to reliably win a tier-1 zone fight. */
function withChampion(state: GameState, id = 900): GameState {
  const base = generateAdventurer(id, mid);
  const adv = { ...base, level: 40, hp: maxHp({ ...base, level: 40 }) };
  return { ...state, adventurers: [...state.adventurers, adv] };
}

describe('addStats', () => {
  it('adds only the named counters and leaves the rest untouched', () => {
    const s = addStats(createInitialState(0), { clicks: 2, battlesWon: 1 });
    expect(s.stats.clicks).toBe(2);
    expect(s.stats.battlesWon).toBe(1);
    expect(s.stats.monstersDefeated).toBe(0);
  });

  it('returns the same state object for an empty or all-zero patch', () => {
    const base = createInitialState(0);
    expect(addStats(base, {})).toBe(base);
    expect(addStats(base, { clicks: 0 })).toBe(base);
  });
});

describe('counters', () => {
  it('counts clicks', () => {
    const s = click(click(createInitialState(0)));
    expect(s.stats.clicks).toBe(2);
  });

  it('counts simulated seconds, including a long offline catch-up dt', () => {
    let s = tick(createInitialState(0), 5);
    s = tick(s, 3_600);
    expect(s.stats.timePlayedSeconds).toBeCloseTo(3_605);
  });

  it('counts hires', () => {
    const s = hireAdventurer(hireAdventurer(guildState(), mid), mid);
    expect(s.stats.championsHired).toBe(2);
  });

  it('counts disassembled items', () => {
    const item = (id: number): Equipment => ({
      id,
      slot: 'weapon',
      typeId: 'sword',
      name: 'Test Sword',
      rarity: 'common',
      tier: 1,
      atk: 5,
      def: 0,
      hp: 0,
      attrs: {},
    });
    const s = disassembleItems({ ...guildState(), inventory: [item(1), item(2)] }, [1, 2]);
    expect(s.stats.itemsDisassembled).toBe(2);
  });

  it('counts a battle, its kills and its drops', () => {
    const before = withChampion(guildState());
    const { state, result } = runExplore(before, 'forest-edge', [900], mulberry32(7));
    expect(state.stats.battlesWon + state.stats.battlesLost).toBe(1);
    expect(state.stats.battlesWon).toBe(result.outcome === 'win' ? 1 : 0);
    expect(state.stats.monstersDefeated).toBe(
      result.party.reduce((n, p) => n + p.enemiesDefeated, 0),
    );
    expect(state.stats.itemsFound).toBe(result.rewards.equipment.length);
    expect(state.stats.shardsFound).toBe(result.rewards.timeShards);
  });

  it('counts a dungeon clear only when the boss room is won', () => {
    const rng = mulberry32(3);
    const before = withChampion(guildState());
    const room = fightDungeonRoom(before, 'forest-edge', [900], 0, rng);
    expect(room.state.stats.dungeonsCleared).toBe(0);

    const boss = fightDungeonRoom(before, 'forest-edge', [900], DUNGEON_ROOM_COUNT, rng);
    expect(boss.state.stats.dungeonsCleared).toBe(boss.result.outcome === 'win' ? 1 : 0);
  });

  it('counts completed quest batches', () => {
    const posted = postQuest(guildState(), [{ targetId: 'gray-wolf', batchSize: 1 }], ADVENTURER_MAX, 0);
    // The board only resolves a round it can pay for in full, so keep the
    // treasury far ahead of the lump cost.
    const before = { ...posted, gold: 10_000_000 };
    const required = questRequiredWork(before.quests[0]);
    const after = tick(before, required + 1, 0);
    expect(after.stats.questsCompleted).toBe(after.quests[0].completedCount);
    expect(after.stats.questsCompleted).toBeGreaterThan(0);
  });
});

describe('persistence', () => {
  it('survives time travel while the timeline itself resets', () => {
    const before = {
      ...createInitialState(0),
      bossesDefeated: { [DEMON_KING_ID]: true },
      gold: 5_000,
      stats: { ...EMPTY_STATS, clicks: 42, battlesWon: 7 },
    };
    const after = timeTravel(before, 0);
    expect(after.stats.clicks).toBe(42);
    expect(after.stats.battlesWon).toBe(7);
    expect(after.gold).toBe(0);
  });

  it('backfills a save with no stats block (pre-v17) with zeroes', () => {
    const { stats: _dropped, ...withoutStats } = createInitialState(0);
    const migrated = migrateSave({ version: 16, state: withoutStats } as unknown as SaveData, 0);
    expect(migrated.stats).toEqual(EMPTY_STATS);
  });

  it('backfills only the counters a save is missing', () => {
    expect(migrateStats({ clicks: 3 })).toEqual({ ...EMPTY_STATS, clicks: 3 });
  });
});
