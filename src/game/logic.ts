import { maxHp } from './adventurers';
import {
  ADVENTURER_MAX,
  ATTRIBUTES,
  CHAMPION_PERKS,
  CLASS_DEFS,
  CLASS_SKILLS,
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
import { addStats, EMPTY_STATS, migrateStats } from './stats';
import type { Adventurer, Attributes, Equipment, GameState, SaveData, Settings } from './types';

/** Town economy + state lifecycle. Every function is pure: (state) => state. */

/** Pre-v9 quests had a single targetId/batchSize instead of `requirements`. */
interface LegacyQuestShape {
  id: number;
  targetId?: string;
  batchSize?: number;
  requirements?: { targetId: string; batchSize: number }[];
  progress?: number;
  repeatCount?: number;
  completedCount?: number;
  maxAdventurers?: number;
}

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
    reputation: 0,
    quests: [],
    adventurers: [],
    recruitCandidates: [],
    inventory: [],
    guildUpgrades: {},
    expedition: null,
    crafting: null,
    nextEntityId: 1,
    locationsCleared: {},
    bossesDefeated: {},
    dungeonProgress: {},
    activityLog: [],
    storyFlags: {},
    pendingStories: ['a1-arrival'],
    runTimeSeconds: 0,
    timeShards: 0,
    prestigeCount: 0,
    perks: {},
    hometownSaved: false,
    stats: { ...EMPTY_STATS },
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
  const preV5 = data.version < 5;
  return {
    ...base,
    ...s,
    jobs: { ...base.jobs, ...(s.jobs ?? {}) },
    materials: { ...(s.materials ?? {}) },
    townSkills: { ...(s.townSkills ?? {}) },
    activityLog: s.activityLog ?? [],
    settings: { ...base.settings, ...(s.settings ?? {}) },
    // v6 introduced the reputation/quest-board economy (champions went
    // dormant). Older saves simply start with no reputation and no posted quests.
    reputation: s.reputation ?? 0,
    // v7 switched quests from continuous per-tick output to discrete batch
    // completion, adding a `progress` counter. v6 quests just start at 0.
    // v8 added repeatCount/completedCount/maxAdventurers (repeat limits +
    // integer worker caps). Old quests get unlimited repeats (0) and an
    // uncapped worker cap, matching their pre-v8 behavior.
    // v9 replaced a quest's single targetId/batchSize with a `requirements`
    // list, letting one quest bundle several targets together. A pre-v9
    // quest becomes a one-requirement quest with the same target/batch.
    quests: ((s.quests ?? []) as unknown as LegacyQuestShape[])
      .map((q) => ({
        id: q.id,
        requirements:
          q.requirements ?? (q.targetId ? [{ targetId: q.targetId, batchSize: q.batchSize ?? 1 }] : []),
        progress: q.progress ?? 0,
        repeatCount: q.repeatCount ?? 0,
        completedCount: q.completedCount ?? 0,
        maxAdventurers: q.maxAdventurers ?? ADVENTURER_MAX,
      }))
      .filter((q) => q.requirements.length > 0),
    // v5 introduced the attribute/HP combat model and typed equipment. Old
    // items can't map to the new equipment types, so pre-v5 inventory and
    // equipped gear are dropped; adventurers gain fresh attributes + HP.
    inventory: preV5 ? [] : (s.inventory ?? []).map(migrateEquipment),
    adventurers: (s.adventurers ?? []).map((a) => migrateAdventurer(a, preV5)),
    // Candidates awaiting recruitment get the same v14 perk backfill.
    recruitCandidates: (s.recruitCandidates ?? []).map((a) => migrateAdventurer(a, preV5)),
    // v10 added the Forge's single craft job (`crafting`); `base` already
    // defaults it to null, and older saves simply lack the key, so the
    // `...base, ...s` spread above backfills it with no extra code needed.
    // v11 added `tier` to Equipment (drives its stat budget and essence
    // yield); pre-v11 items default to tier 1, same as pre-v11 equipment
    // that never had that stat scaling in the first place.
    // v16 added per-zone dungeon-unlock tracking; older saves start unlocked nowhere.
    dungeonProgress: s.dungeonProgress ?? {},
    // v17 added the Overview tab's lifetime counters. They're display-only, so
    // an older save just starts every counter at 0 rather than back-deriving
    // history it never recorded.
    stats: migrateStats(s.stats),
  };
}

/** Pre-v11 saved items lack `tier` — see migrateSave. */
function migrateEquipment(item: Equipment): Equipment {
  return { ...item, tier: item.tier ?? 1 };
}

/** v13 renamed the 'patrol' assignment mode to 'auto-explore'. */
function migrateAssignment<T extends { mode: string } | null | undefined>(assignment: T): T {
  if (!assignment) return assignment;
  return (assignment as { mode: string }).mode === 'patrol'
    ? ({ ...assignment, mode: 'auto-explore' } as T)
    : assignment;
}

/** Deterministic class-skill pick for pre-v15 saves (no rng at load). */
function classSkillForId(className: Adventurer['className'], id: number): string {
  const pool = CLASS_SKILLS.filter((s) => s.className === className);
  return pool[id % pool.length].id;
}

function migrateAdventurer(a: Adventurer, preV5: boolean): Adventurer {
  const patched: Adventurer = {
    ...a,
    injuredDuration: a.injuredDuration ?? 0,
    lastAssignment: migrateAssignment('lastAssignment' in a ? a.lastAssignment : null),
    assignment: migrateAssignment(a.assignment),
    enemiesDefeated: a.enemiesDefeated ?? 0,
    totalDamageDealt: a.totalDamageDealt ?? 0,
    // v14 gave every champion a passive perk. Pre-v14 champions get one
    // assigned deterministically from their id (no rng available at load).
    perkId: a.perkId ?? CHAMPION_PERKS[a.id % CHAMPION_PERKS.length].id,
    // v15 gave every champion an active skill. Pre-v15 champions get one from
    // their own class pool, chosen deterministically from their id.
    skillId: a.skillId ?? classSkillForId(a.className, a.id),
  };
  if (preV5) {
    const attributes = { ...CLASS_DEFS[patched.className].base } as Attributes;
    for (const { id } of ATTRIBUTES) attributes[id] = attributes[id] ?? 1;
    const migrated: Adventurer = { ...patched, attributes, equipment: {}, hp: 0 };
    return { ...migrated, hp: maxHp(migrated) };
  }
  const equipment = Object.fromEntries(
    Object.entries(patched.equipment).map(([slot, item]) => [
      slot,
      item ? migrateEquipment(item) : item,
    ]),
  ) as Adventurer['equipment'];
  return { ...patched, equipment };
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
    (sum, j) => sum + (j.baseProduction / j.jobDurationSeconds) * (state.jobs[j.id] ?? 0),
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
  return addStats(earnGold(state, effectiveClickPower(state)), { clicks: 1 });
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
  const def = JOBS.find((j) => j.id === jobId);
  if (!def) return state;
  if (def.requiresUpgrade && (state.guildUpgrades[def.requiresUpgrade] ?? 0) < 1) return state;
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
