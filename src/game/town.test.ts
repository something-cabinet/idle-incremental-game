import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_SECONDS, GUILD_FOUNDING_COST } from './config';
import { applyOfflineProgress, tick } from './engine';
import {
  buyJob,
  click,
  createInitialState,
  currentDay,
  debugAddGold,
  debugAddMaterials,
  debugAddShards,
  effectiveClickPower,
  hireWorker,
  jobCost,
  migrateSave,
  productionPerSecond,
  workerCost,
} from './logic';
import {
  buyTownSkill,
  canBuyTownSkill,
  isTownSkillUnlocked,
  townSkillCost,
} from './skills';
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

describe('bulk buying', () => {
  it('bulk job cost is the sum of escalating prices', () => {
    const s = { ...createInitialState(0), gold: 1_000_000 };
    const oneByOne =
      jobCost(s, 'errands') +
      jobCost(buyJob(s, 'errands'), 'errands') +
      jobCost(buyJob(buyJob(s, 'errands'), 'errands'), 'errands');
    expect(jobCost(s, 'errands', 3)).toBe(oneByOne);
  });

  it('bulk buy purchases the full batch or nothing', () => {
    let s = { ...createInitialState(0), gold: 1_000_000 };
    s = buyJob(s, 'errands', 10);
    expect(s.jobs.errands).toBe(10);
    const poor = { ...createInitialState(0), gold: jobCost(createInitialState(0), 'errands', 5) - 1 };
    expect(buyJob(poor, 'errands', 5).jobs.errands).toBe(0);
  });

  it('bulk worker hire clamps to the cap', () => {
    let s: GameState = { ...createInitialState(0), act: 2, gold: 1e18, workers: 48 };
    const cost = workerCost(s, 2); // only 2 slots left
    s = hireWorker(s, 100);
    expect(s.workers).toBe(50);
    expect(s.gold).toBe(1e18 - cost);
  });
});

describe('town skills', () => {
  it('locked skills need their parent bought first', () => {
    let s = { ...createInitialState(0), gold: 1_000_000 };
    expect(isTownSkillUnlocked(s, 'guild-ledgers')).toBe(false);
    expect(buyTownSkill(s, 'guild-ledgers').townSkills['guild-ledgers']).toBeUndefined();
    s = buyTownSkill(s, 'work-ethic');
    expect(isTownSkillUnlocked(s, 'guild-ledgers')).toBe(true);
  });

  it('flat gold and job multipliers boost production', () => {
    let s = { ...createInitialState(0), gold: 1_000_000 };
    s = buyJob(s, 'errands', 10); // 3.5/sec
    const base = productionPerSecond(s);
    s = buyTownSkill(s, 'work-ethic'); // +0.5 flat
    expect(productionPerSecond(s)).toBeCloseTo(base + 0.5);
    s = buyTownSkill(s, 'guild-ledgers'); // +10% jobs
    expect(productionPerSecond(s)).toBeCloseTo(base * 1.1 + 0.5);
  });

  it('click skills add flat, percent, and gps-share gold', () => {
    let s = { ...createInitialState(0), gold: 10_000_000 };
    s = buyTownSkill(s, 'calloused-hands'); // +1 flat → 2/click
    expect(effectiveClickPower(s)).toBeCloseTo(2);
    s = buyTownSkill(s, 'market-instinct'); // +25%
    expect(effectiveClickPower(s)).toBeCloseTo(2 * 1.25);
    s = buyJob(s, 'stall', 10); // 20/sec
    s = buyTownSkill(s, 'silver-tongue'); // +2% of gps
    expect(effectiveClickPower(s)).toBeCloseTo((2 + productionPerSecond(s) * 0.02) * 1.25);
  });

  it('cost grows per level and can require materials', () => {
    let s = { ...createInitialState(0), gold: 1_000_000 };
    const first = townSkillCost(s, 'work-ethic').gold;
    s = buyTownSkill(s, 'work-ethic');
    expect(townSkillCost(s, 'work-ethic').gold).toBeGreaterThan(first);
    // trade-contracts needs beast pelts
    s = buyTownSkill(s, 'guild-ledgers');
    expect(canBuyTownSkill(s, 'trade-contracts')).toBe(false);
    s = { ...s, gold: 1_000_000, materials: { 'beast-pelt': 100 } };
    expect(canBuyTownSkill(s, 'trade-contracts')).toBe(true);
    const pelts = s.materials['beast-pelt'];
    s = buyTownSkill(s, 'trade-contracts');
    expect(s.materials['beast-pelt']).toBeLessThan(pelts);
  });

  it('skills cap at maxLevel', () => {
    let s = { ...createInitialState(0), gold: Number.MAX_SAFE_INTEGER };
    for (let i = 0; i < 15; i++) s = buyTownSkill(s, 'work-ethic');
    expect(s.townSkills['work-ethic']).toBe(10);
  });
});

describe('debug cheats', () => {
  it('grant gold, materials, and shards', () => {
    let s = createInitialState(0);
    s = debugAddGold(s, 5000);
    s = debugAddMaterials(s, 50);
    s = debugAddShards(s, 10);
    expect(s.gold).toBe(5000);
    expect(s.materials['beast-pelt']).toBe(50);
    expect(s.materials['demon-ash']).toBe(50);
    expect(s.timeShards).toBe(10);
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

  it('v3 saves gain v4 fields with defaults', () => {
    const v3state = createInitialState(0) as unknown as Record<string, unknown>;
    delete v3state.townSkills;
    delete v3state.activityLog;
    v3state.adventurers = [
      { id: 1, name: 'Ash the Bold', className: 'warrior', level: 1, xp: 0,
        equipment: {}, assignment: null, injuredUntil: 0 },
    ];
    const s = migrateSave({ version: 3, state: v3state } as never, 0);
    expect(s.townSkills).toEqual({});
    expect(s.activityLog).toEqual([]);
    expect(s.adventurers[0].injuredDuration).toBe(0);
    expect(s.settings.sfxEnabled).toBe(true);
    expect(s.settings.gameSpeed).toBe(1);
  });
});
