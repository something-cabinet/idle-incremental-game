import { generateEquipment } from './adventurers';
import { processAutoExplore } from './combat';
import { ACTIVITY_LOG_MAX, CRAFT_MAX_RARITY } from './config';
import {
  allocateAdventurers,
  questRequiredWork,
  questTargetDef,
  questTotalGold,
  questTotalReputation,
  remainingRepeats,
  zones,
} from './guild';
import { emitGameEvent } from './events';
import { productionPerSecond } from './logic';
import { computeModifiers } from './perks';
import { addStats } from './stats';
import { checkStoryTriggers } from './story';
import type { CraftJob, Equipment, GameState, Quest, Rng } from './types';

/**
 * The simulation tick. Handles any dt — 100ms live ticks and multi-hour
 * offline catch-ups go through the same code path.
 *
 * Three income/production streams:
 *  - Passive town gold (jobs + workers), unchanged from Act 1.
 *  - The guild quest board: the numerous town adventurers fulfil standing
 *    quests continuously, converting gold into materials and reputation.
 *  - The Forge: one craft job at a time, minting equipment once its timer
 *    elapses (see processCrafting) — gold/materials are spent up front when
 *    the job starts (guild.ts startCraft), not here.
 *
 * The managed Champion roster is also processed here now: champions posted to
 * a zone on Auto-Explore (guild.ts assignAdventurer, gated behind the
 * 'auto-explore' guild upgrade) auto-battle it every ENCOUNTER_INTERVAL via
 * processAutoExplore (combat.ts), earning XP/loot and taking injuries —
 * online and, through the same replayed loop, offline. Manual play (Explore,
 * dungeon runs, Act 3 campaign marches) resolves instantly on the player's
 * click instead, so none of it passes through here.
 */
export function tick(
  state: GameState,
  dtSeconds: number,
  now = Date.now(),
  rng: Rng = Math.random,
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

  // Emit for any newly unlocked zones
  for (const zone of zones()) {
    const wasUnlocked = state.reputation >= (zone.repRequired ?? 0);
    const isUnlocked = next.reputation >= (zone.repRequired ?? 0);
    if (!wasUnlocked && isUnlocked) {
      emitGameEvent({ type: 'zone-unlocked', payload: { name: zone.name } });
    }
  }

  // Emit when quest batches complete
  if (quest.completions > 0) {
    emitGameEvent({ type: 'quest-completed', payload: { count: quest.completions } });
  }

  const craft = processCrafting(next, rng);
  next.crafting = craft.crafting;
  next.inventory = craft.inventory;
  next.nextEntityId = craft.nextEntityId;

  next.stats = addStats(next, {
    timePlayedSeconds: dtSeconds,
    questsCompleted: quest.completions,
    itemsCrafted: craft.crafted,
  }).stats;

  // Auto-Explore: assigned champions fight the zone they're posted to. Returns
  // a fresh state (roster/gold/materials/inventory/shards/log all updated), so
  // reassign rather than mutate. Offline catch-up replays this same loop.
  let out = processAutoExplore(next, rng);

  if (out.activityLog.length > ACTIVITY_LOG_MAX) {
    out = { ...out, activityLog: out.activityLog.slice(-ACTIVITY_LOG_MAX) };
  }

  return checkStoryTriggers(out);
}

// ---------------------------------------------------------------------------
// Quest board processing
// ---------------------------------------------------------------------------

interface QuestOutput {
  materials: Record<string, number>;
  goldSpent: number;
  reputation: number;
  quests: Quest[];
  /** Batches finished this tick, for the lifetime counter (see stats.ts). */
  completions: number;
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
  const out: QuestOutput = {
    materials: {},
    goldSpent: 0,
    reputation: 0,
    quests: state.quests,
    completions: 0,
  };
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
    out.completions += r.completions;

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
// Crafting (the Forge)
// ---------------------------------------------------------------------------

interface CraftOutput {
  crafting: CraftJob | null;
  inventory: Equipment[];
  nextEntityId: number;
  /** Items minted this tick, for the lifetime counter (see stats.ts). */
  crafted: number;
}

/**
 * Resolve the Forge's single active job once its timer elapses — works the
 * same for a live tick or a multi-hour offline catch-up, since it's just a
 * one-shot deadline check (no per-encounter chunking needed, unlike Auto-Explore).
 * Mints `quantity` items at the job's tier/slot via the same generateEquipment
 * used for monster drops, so tier only feeds the stat budget and the
 * exalted-rarity gate — never the common/rare/epic odds (see rollRarity).
 */
function processCrafting(state: GameState, rng: Rng): CraftOutput {
  const job = state.crafting;
  if (!job || state.runTimeSeconds < job.endsAt) {
    return {
      crafting: job,
      inventory: state.inventory,
      nextEntityId: state.nextEntityId,
      crafted: 0,
    };
  }
  let nextId = state.nextEntityId;
  const items: Equipment[] = [];
  for (let i = 0; i < job.quantity; i++) {
    items.push(generateEquipment(nextId++, job.tier, rng, job.slot, CRAFT_MAX_RARITY));
  }
  emitGameEvent({ type: 'crafting-complete' });
  return {
    crafting: null,
    inventory: [...state.inventory, ...items],
    nextEntityId: nextId,
    crafted: items.length,
  };
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
