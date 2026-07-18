import {
  CLICK_BASE_GOLD,
  DAY_LENGTH_SECONDS,
  DEFAULT_SETTINGS,
  JOBS,
  WORKER_BASE_COST,
  WORKER_CAP,
  WORKER_COST_GROWTH,
  WORKER_PRODUCTION,
} from './config';
import { computeModifiers } from './perks';
import type { GameState, SaveData, Settings } from './types';

/** Town economy + state lifecycle. Every function is pure: (state) => state. */

export function createInitialState(now = Date.now()): GameState {
  return {
    act: 1,
    gold: 0,
    totalGoldEarned: 0,
    lifetimeGoldEarned: 0,
    clickPower: CLICK_BASE_GOLD,
    jobs: Object.fromEntries(JOBS.map((j) => [j.id, 0])),
    workers: 0,
    materials: {},
    adventurers: [],
    inventory: [],
    guildUpgrades: {},
    expedition: null,
    nextEntityId: 1,
    locationsCleared: {},
    bossesDefeated: {},
    storyFlags: {},
    pendingStories: ['a1-arrival'],
    runTimeSeconds: 0,
    timeShards: 0,
    prestigeCount: 0,
    perks: {},
    hometownSaved: false,
    settings: { ...DEFAULT_SETTINGS },
    lastUpdate: now,
  };
}

/**
 * Load-time migration seam. The v2→v3 redesign (energy game → narrative guild
 * game) shares no meaningful fields, so older saves start a fresh game.
 */
export function migrateSave(data: SaveData, now = Date.now()): GameState {
  if (data.version < 3) return createInitialState(now);
  const base = createInitialState(data.state.lastUpdate ?? now);
  const s = data.state;
  return {
    ...base,
    ...s,
    jobs: { ...base.jobs, ...(s.jobs ?? {}) },
    materials: { ...(s.materials ?? {}) },
    settings: { ...base.settings, ...(s.settings ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** In-game day number, starting at day 1. */
export function currentDay(state: GameState): number {
  return Math.floor(state.runTimeSeconds / DAY_LENGTH_SECONDS) + 1;
}

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------

export function productionPerSecond(state: GameState): number {
  const fromJobs = JOBS.reduce(
    (sum, j) => sum + j.baseProduction * (state.jobs[j.id] ?? 0),
    0,
  );
  const fromWorkers = state.workers * WORKER_PRODUCTION;
  return (fromJobs + fromWorkers) * computeModifiers(state).productionMult;
}

export function effectiveClickPower(state: GameState): number {
  return state.clickPower * computeModifiers(state).clickMult;
}

export function earnGold(state: GameState, amount: number): GameState {
  return {
    ...state,
    gold: state.gold + amount,
    totalGoldEarned: state.totalGoldEarned + amount,
  };
}

export function click(state: GameState): GameState {
  return earnGold(state, effectiveClickPower(state));
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export function jobCost(state: GameState, jobId: string): number {
  const def = JOBS.find((j) => j.id === jobId);
  if (!def) return Infinity;
  const owned = state.jobs[jobId] ?? 0;
  const costMult = computeModifiers(state).costMult;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned) * costMult);
}

export function buyJob(state: GameState, jobId: string): GameState {
  const cost = jobCost(state, jobId);
  if (state.gold < cost) return state;
  return {
    ...state,
    gold: state.gold - cost,
    jobs: { ...state.jobs, [jobId]: (state.jobs[jobId] ?? 0) + 1 },
  };
}

export function workerCost(state: GameState): number {
  const costMult = computeModifiers(state).costMult;
  return Math.ceil(
    WORKER_BASE_COST * Math.pow(WORKER_COST_GROWTH, state.workers) * costMult,
  );
}

export function hireWorker(state: GameState): GameState {
  if (state.workers >= WORKER_CAP) return state;
  const cost = workerCost(state);
  if (state.gold < cost) return state;
  return { ...state, gold: state.gold - cost, workers: state.workers + 1 };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function updateSettings(state: GameState, patch: Partial<Settings>): GameState {
  return { ...state, settings: { ...state.settings, ...patch } };
}
