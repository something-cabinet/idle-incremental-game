import { ACTIVITY_LOG_MAX } from './config';
import {
  adventurerCount,
  batchGold,
  batchReputation,
  batchTimeSolo,
  questTargetDef,
  unitDifficulty,
} from './guild';
import { productionPerSecond } from './logic';
import { computeModifiers } from './perks';
import { checkStoryTriggers } from './story';
import type { GameState, Rng } from './types';

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
}

/**
 * Resolve one tick of the standing quest board. The town's adventurer pool is
 * split evenly across all active quests; each quest converts gold into its
 * material plus reputation at a rate set by batch size and difficulty.
 *
 * Gold is a hard constraint: if the board would cost more than the player can
 * pay this tick (current gold + town income), every quest's output is scaled
 * down proportionally so gold never goes negative.
 */
function processQuests(state: GameState, dtSeconds: number, townGold: number): QuestOutput {
  const out: QuestOutput = { materials: {}, goldSpent: 0, reputation: 0 };
  const active = state.quests.length;
  if (active === 0) return out;

  const advPerQuest = adventurerCount(state) / active;

  const rows = state.quests
    .map((q) => {
      const target = questTargetDef(q.targetId);
      if (!target) return null;
      const diff = unitDifficulty(target);
      const batchesPerSec = advPerQuest / batchTimeSolo(q.batchSize, diff);
      return {
        materialId: target.materialId,
        materialPerSec: q.batchSize * batchesPerSec,
        goldPerSec: batchGold(q.batchSize, diff) * batchesPerSec,
        repPerSec: batchReputation(q.batchSize, diff) * batchesPerSec,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const goldNeeded = rows.reduce((sum, r) => sum + r.goldPerSec * dtSeconds, 0);
  const available = state.gold + townGold;
  const scale = goldNeeded > 0 ? Math.min(1, available / goldNeeded) : 1;

  for (const r of rows) {
    out.materials[r.materialId] =
      (out.materials[r.materialId] ?? 0) + r.materialPerSec * dtSeconds * scale;
    out.goldSpent += r.goldPerSec * dtSeconds * scale;
    out.reputation += r.repPerSec * dtSeconds * scale;
  }
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
