import { ACTIVITY_LOG_MAX } from './config';
import {
  allocateAdventurers,
  questRequiredWork,
  questTargetDef,
  questTotalGold,
  questTotalReputation,
  remainingRepeats,
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
 * Resolve one tick of the standing quest board. Each quest has a fixed round
 * time (Quest.progress counts plain seconds toward questRequiredWork) — how
 * many adventurers are assigned does NOT speed up the round. Instead, every
 * adventurer assigned when a round fills completes their own repeat, so a
 * round credits `assigned` completions at once (capped by however many
 * repeats the quest has left — see allocateAdventurers/effectiveAdventurerCap
 * for why quests never hold more adventurers than they can use). Materials,
 * gold cost, and reputation are only granted in a lump the instant a round's
 * required time is reached — never smoothly per tick. The "/sec" numbers
 * shown elsewhere (questRates) are a reference estimate, not what's actually
 * being credited each tick.
 *
 * Gold is a hard gate on *resolving* a completed round, not on doing the
 * work: if the board can't afford the lump cost of every round completing
 * this tick, none of them resolve — the completed work waits (progress keeps
 * accumulating) until the guild can pay, then resolves in one lump.
 *
 * A quest with a finite repeatCount removes itself once completedCount
 * reaches it — completions are capped at however many repeats it has left,
 * so a huge offline dt can't overshoot past the quest's own limit.
 */
function processQuests(state: GameState, dtSeconds: number, townGold: number): QuestOutput {
  const out: QuestOutput = { materials: {}, goldSpent: 0, reputation: 0, quests: state.quests };
  if (state.quests.length === 0) return out;

  const allocation = allocateAdventurers(state);

  const rows = state.quests.map((quest) => {
    const assigned = allocation[quest.id] ?? 0;
    const remaining = remainingRepeats(quest);
    const required = questRequiredWork(quest);
    if (assigned <= 0 || remaining <= 0 || required <= 0) {
      return { quest, required, rawProgress: quest.progress, rounds: 0, completions: 0 };
    }
    const rawProgress = quest.progress + dtSeconds;
    const rounds = Math.floor(rawProgress / required);
    const completions = Math.min(rounds * assigned, remaining);
    return { quest, required, rawProgress, rounds, completions };
  });

  const goldNeeded = rows.reduce(
    (sum, r) => (r.completions > 0 ? sum + r.completions * questTotalGold(r.quest) : sum),
    0,
  );
  const available = state.gold + townGold;
  const canResolve = goldNeeded === 0 || available >= goldNeeded;

  const nextQuests: Quest[] = [];
  for (const r of rows) {
    if (!canResolve || r.completions <= 0) {
      // Nothing resolves this tick; work still accrues (uncapped raw progress).
      nextQuests.push({ ...r.quest, progress: r.rawProgress });
      continue;
    }
    for (const req of r.quest.requirements) {
      const target = questTargetDef(req.targetId);
      if (!target) continue;
      out.materials[target.materialId] =
        (out.materials[target.materialId] ?? 0) + r.completions * req.batchSize;
    }
    out.goldSpent += r.completions * questTotalGold(r.quest);
    out.reputation += r.completions * questTotalReputation(r.quest);

    const completedCount = r.quest.completedCount + r.completions;
    const finished = r.quest.repeatCount > 0 && completedCount >= r.quest.repeatCount;
    if (finished) continue; // ran its full repeat count — auto-remove from the board

    const remainder = r.rawProgress - r.rounds * r.required;
    nextQuests.push({ ...r.quest, progress: remainder, completedCount });
  }
  out.quests = nextQuests;

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
