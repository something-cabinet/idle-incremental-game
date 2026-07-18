import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_SECONDS, GUILD_FOUNDING_COST } from './config';
import { applyOfflineProgress, tick } from './engine';
import {
  buyJob,
  click,
  createInitialState,
  currentDay,
  hireWorker,
  jobCost,
  migrateSave,
  productionPerSecond,
} from './logic';
import { canFoundGuild, foundGuild } from './story';
import type { GameState } from './types';

const rng = () => 0.99; // never triggers chance-based drops/failures alone

describe('act 1 town loop', () => {
  it('clicking earns gold', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 10; i++) s = click(s);
    expect(s.gold).toBe(10);
    expect(s.totalGoldEarned).toBe(10);
  });

  it('buying a job spends gold and adds production', () => {
    let s = { ...createInitialState(0), gold: 20 };
    s = buyJob(s, 'errands');
    expect(s.gold).toBe(15);
    expect(s.jobs.errands).toBe(1);
    expect(productionPerSecond(s)).toBeCloseTo(0.35);
  });

  it('job cost grows exponentially', () => {
    let s = { ...createInitialState(0), gold: 10_000 };
    expect(jobCost(s, 'errands')).toBe(5);
    s = buyJob(s, 'errands');
    expect(jobCost(s, 'errands')).toBe(Math.ceil(5 * 1.15));
  });

  it('tick earns production over time', () => {
    let s = { ...createInitialState(0), gold: 20 };
    s = buyJob(s, 'errands');
    s = tick(s, 100, 0, rng);
    expect(s.gold).toBeCloseTo(15 + 35); // 0.35/sec * 100s
  });

  it('workers add production (act 2)', () => {
    let s: GameState = { ...createInitialState(0), act: 2, gold: 500 };
    s = hireWorker(s);
    expect(s.workers).toBe(1);
    expect(productionPerSecond(s)).toBeCloseTo(2);
  });
});

describe('acts & story', () => {
  it('founding the guild needs gold and moves to act 2', () => {
    const poor = createInitialState(0);
    expect(canFoundGuild(poor)).toBe(false);
    let s = { ...poor, gold: GUILD_FOUNDING_COST };
    expect(canFoundGuild(s)).toBe(true);
    s = foundGuild(s);
    expect(s.act).toBe(2);
    expect(s.pendingStories).toContain('a2-guild-founded');
  });

  it('clearing the last zone triggers act 3', () => {
    let s: GameState = { ...createInitialState(0), act: 2 };
    s = { ...s, locationsCleared: { 'frontier-pass': true } };
    s = tick(s, 1, 0, rng);
    expect(s.act).toBe(3);
    expect(s.pendingStories).toContain('a3-discovery');
  });

  it('days advance with game time', () => {
    let s = createInitialState(0);
    expect(currentDay(s)).toBe(1);
    s = tick(s, DAY_LENGTH_SECONDS * 3, 0, rng);
    expect(currentDay(s)).toBe(4);
  });
});

describe('offline progress', () => {
  it('credits elapsed time up to the cap', () => {
    let s = { ...createInitialState(0), gold: 20 };
    s = buyJob(s, 'errands');
    s = { ...s, lastUpdate: 0 };
    const { offlineSeconds, goldEarned } = applyOfflineProgress(s, 3600_000, rng);
    expect(offlineSeconds).toBe(3600);
    expect(goldEarned).toBeCloseTo(1260); // 0.35/sec * 1h
  });

  it('caps offline time at 8h base', () => {
    const s = { ...createInitialState(0), lastUpdate: 0 };
    const { offlineSeconds } = applyOfflineProgress(s, 1000 * 3600_000, rng);
    expect(offlineSeconds).toBe(8 * 3600);
  });

  it('respects the offline-progress setting', () => {
    const s = {
      ...createInitialState(0),
      lastUpdate: 0,
      settings: { ...createInitialState(0).settings, offlineProgress: false },
    };
    const { offlineSeconds } = applyOfflineProgress(s, 3600_000, rng);
    expect(offlineSeconds).toBe(0);
  });
});

describe('save migration', () => {
  it('pre-v3 saves start a fresh game (full redesign)', () => {
    const old = { version: 2, state: { energy: 999 } } as never;
    const s = migrateSave(old, 0);
    expect(s.act).toBe(1);
    expect(s.gold).toBe(0);
  });
});
