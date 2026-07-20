import { ACTIVITY_LOG_MAX } from './config';
import {
  adventurerCount,
  batchGold,
  batchReputation,
  batchTimeSolo,
  goldUnitDifficulty,
  questTargetDef,
  unitDifficulty,
} from './guild';
import { productionPerSecond } from './logic';
import { computeModifiers } from './perks';
import { checkStoryTriggers } from './story';
import type { GameState, Quest, Rng } from './types';

/**
 * The simulation tick. Handles any dt — 100ms live ticks and multi-hour
 * offline catch-ups go through the same code path.
 *
 * Two income/production streams:
 *  - Passive town gold (jobs + workers), unchanged from Act 1.
 *  - The guild quest board: the numerous town adventurers fulfil standing
 *    quests continuously, converting gold into materials and reputation.
 *
 * The managed Mercenary roster is currently dormant (see types.ts), so it is
 * not processed here; Act 3 expeditions are parked until it is built out.
 */
export function tick(
  state: GameState,
  dtSeconds: number,
  now = Date.now(),
  _rng: Rng = Math.random,
): GameState {
  if (dtSeconds <= 0) return { ...state, lastUpdate: now };

  const next: GameState = {
    ...state,
    runTimeSeconds: state.runTimeSeconds + dtSeconds,
    lastUpdate: now,
    materials: { ...state.materials },
  };

  const townGold = productionPerSecond(state) * dtSeconds;
  const quest = processQuests(state, dtSeconds, townGold);

  for (const [id, amount] of Object.entries(quest.materials)) {
    next.materials[id] = (next.materials[id] ?? 0) + amount;
  }
  next.gold = state.gold + townGold - quest.goldSpent;
  next.totalGoldEarned = state.totalGoldEarned + townGold;
  next.reputation = state.reputation + quest.reputation;
  next.quests = quest.quests;

  if (next.activityLog.length > ACTIVITY_LOG_MAX) {
    next.activityLog = next.activityLog.slice(-ACTIVITY_LOG_MAX);
  }

  return checkStoryTriggers(next);
}

// ---------------------------------------------------------------------------
// Quest board processing
// ---------------------------------------------------------------------------

interface QuestOutput {
  materials: Record<string, number>;
  goldSpent: number;
  reputation: number;
  quests: Quest[];
}

/**
 * Resolve one tick of the standing quest board. The town's adventurer pool is
 * split evenly across all active quests; each quest accumulates adventurer-
 * seconds of work (Quest.progress) toward its batch. Quest time genuinely
 * matters: materials, gold cost, and reputation are only granted in a lump
 * the instant a batch's required work is reached — never smoothly per tick.
 * The "/sec" numbers shown elsewhere (questRates) are a reference estimate,
 * not what's actually being credited each tick.
 *
 * Gold is a hard gate on *resolving* a completed batch, not on doing the
 * work: if the board can't afford the lump cost of every batch completing
 * this tick, none of them resolve — the completed work waits (progress keeps
 * accumulating) until the guild can pay, then resolves in one lump.
 */
function processQuests(state: GameState, dtSeconds: number, townGold: number): QuestOutput {
  const out: QuestOutput = { materials: {}, goldSpent: 0, reputation: 0, quests: state.quests };
  const active = state.quests.length;
  if (active === 0) return out;

  const advPerQuest = adventurerCount(state) / active;

  const rows = state.quests.map((quest) => {
    const target = questTargetDef(quest.targetId);
    if (!target) return { quest, target, diff: 0, required: 0, newProgress: quest.progress, completions: 0 };
    const diff = unitDifficulty(target);
    const required = batchTimeSolo(quest.batchSize, diff);
    const newProgress = quest.progress + advPerQuest * dtSeconds;
    const completions = Math.floor(newProgress / required);
    return { quest, target, diff, required, newProgress, completions };
  });

  const goldNeeded = rows.reduce(
    (sum, r) =>
      r.target && r.completions > 0
        ? sum + r.completions * batchGold(r.quest.batchSize, goldUnitDifficulty(r.target))
        : sum,
    0,
  );
  const available = state.gold + townGold;
  const canResolve = goldNeeded === 0 || available >= goldNeeded;

  out.quests = rows.map((r) => {
    if (!r.target || !canResolve || r.completions <= 0) {
      return { ...r.quest, progress: r.newProgress };
    }
    out.materials[r.target.materialId] =
      (out.materials[r.target.materialId] ?? 0) + r.completions * r.quest.batchSize;
    out.goldSpent += r.completions * batchGold(r.quest.batchSize, goldUnitDifficulty(r.target));
    out.reputation += r.completions * batchReputation(r.quest.batchSize, r.diff);
    return { ...r.quest, progress: r.newProgress - r.completions * r.required };
  });

  return out;
}

// ---------------------------------------------------------------------------
// Offline progress
// ---------------------------------------------------------------------------

/**
 * Catch up the simulation for real time elapsed since the save, up to the
 * offline cap. Game time passes 1:1 with real time.
 */
export function applyOfflineProgress(
  state: GameState,
  now = Date.now(),
  rng: Rng = Math.random,
): {
  state: GameState;
  offlineSeconds: number;
  goldEarned: number;
  shardsFound: number;
  materialsGained: Record<string, number>;
  equipmentGained: number;
} {
  if (!state.settings.offlineProgress) {
    return {
      state: { ...state, lastUpdate: now },
      offlineSeconds: 0,
      goldEarned: 0,
      shardsFound: 0,
      materialsGained: {},
      equipmentGained: 0,
    };
  }
  const capHours = computeModifiers(state).offlineCapHours;
  const elapsed = Math.max(0, (now - state.lastUpdate) / 1000);
  const credited = Math.min(elapsed, capHours * 3600);
  const next = tick(state, credited, now, rng);

  const materialsGained: Record<string, number> = {};
  for (const key of new Set([...Object.keys(state.materials), ...Object.keys(next.materials)])) {
    const before = state.materials[key] ?? 0;
    const after = next.materials[key] ?? 0;
    if (after > before) materialsGained[key] = after - before;
  }

  return {
    state: next,
    offlineSeconds: credited,
    goldEarned: next.totalGoldEarned - state.totalGoldEarned,
    shardsFound: next.timeShards - state.timeShards,
    materialsGained,
    equipmentGained: next.inventory.length - state.inventory.length,
  };
}
