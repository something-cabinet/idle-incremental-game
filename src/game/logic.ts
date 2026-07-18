import {
  CLICK_BASE_GOLD,
  DAY_LENGTH_SECONDS,
  DEFAULT_SETTINGS,
  JOBS,
  MATERIALS,
  WORKER_BASE_COST,
  WORKER_CAP,
  WORKER_COST_GROWTH,
  WORKER_PRODUCTION,
} from './config';
import { computeModifiers } from './perks';
import { computeTownSkillBonuses } from './skills';
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
    townSkills: {},
    adventurers: [],
    inventory: [],
    guildUpgrades: {},
    expedition: null,
    nextEntityId: 1,
    locationsCleared: {},
    bossesDefeated: {},
    activityLog: [],
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
    townSkills: { ...(s.townSkills ?? {}) },
    activityLog: s.activityLog ?? [],
    settings: { ...base.settings, ...(s.settings ?? {}) },
    // v3/4 adventurers predate injuredDuration and lastAssignment
    adventurers: (s.adventurers ?? []).map((a) => ({
      ...a,
      injuredDuration: a.injuredDuration ?? 0,
      lastAssignment: 'lastAssignment' in a ? a.lastAssignment : null,
    })),
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
  const skills = computeTownSkillBonuses(state);
  const fromJobs = JOBS.reduce(
    (sum, j) => sum + j.baseProduction * (state.jobs[j.id] ?? 0),
    0,
  );
  const fromWorkers = state.workers * WORKER_PRODUCTION;
  return (
    (fromJobs * skills.jobMult + fromWorkers + skills.flatGold) *
    computeModifiers(state).productionMult
  );
}

export function effectiveClickPower(state: GameState): number {
  const skills = computeTownSkillBonuses(state);
  const base =
    state.clickPower +
    skills.clickFlat +
    productionPerSecond(state) * skills.clickGpsPercent;
  return base * skills.clickMult * computeModifiers(state).clickMult;
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

/** Sum of `count` escalating prices starting at `owned` units. */
function bulkCost(base: number, growth: number, owned: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.ceil(base * Math.pow(growth, owned + i));
  }
  return total;
}

export function jobCost(state: GameState, jobId: string, count = 1): number {
  const def = JOBS.find((j) => j.id === jobId);
  if (!def) return Infinity;
  const owned = state.jobs[jobId] ?? 0;
  const costMult = computeModifiers(state).costMult;
  return bulkCost(def.baseCost * costMult, def.costGrowth, owned, count);
}

export function buyJob(state: GameState, jobId: string, count = 1): GameState {
  const cost = jobCost(state, jobId, count);
  if (state.gold < cost) return state;
  return {
    ...state,
    gold: state.gold - cost,
    jobs: { ...state.jobs, [jobId]: (state.jobs[jobId] ?? 0) + count },
  };
}

/** How many workers can still be hired (respects the cap). */
export function workerBuyable(state: GameState, count = 1): number {
  return Math.max(0, Math.min(count, WORKER_CAP - state.workers));
}

export function workerCost(state: GameState, count = 1): number {
  const costMult = computeModifiers(state).costMult;
  return bulkCost(WORKER_BASE_COST * costMult, WORKER_COST_GROWTH, state.workers, count);
}

export function hireWorker(state: GameState, count = 1): GameState {
  const n = workerBuyable(state, count);
  if (n === 0) return state;
  const cost = workerCost(state, n);
  if (state.gold < cost) return state;
  return { ...state, gold: state.gold - cost, workers: state.workers + n };
}

// ---------------------------------------------------------------------------
// Debug cheats (Settings → Debug; for playtesting)
// ---------------------------------------------------------------------------

export function debugAddGold(state: GameState, amount: number): GameState {
  return earnGold(state, amount);
}

export function debugAddMaterials(state: GameState, amount: number): GameState {
  const materials = { ...state.materials };
  for (const mat of MATERIALS) {
    materials[mat.id] = (materials[mat.id] ?? 0) + amount;
  }
  return { ...state, materials };
}

export function debugAddShards(state: GameState, amount: number): GameState {
  return { ...state, timeShards: state.timeShards + amount };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function updateSettings(state: GameState, patch: Partial<Settings>): GameState {
  return { ...state, settings: { ...state.settings, ...patch } };
}
