import { adventurerPower, gainXp, generateEquipment, isInjured } from './adventurers';
import {
  ACTIVITY_LOG_MAX,
  ENCOUNTER_INTERVAL,
  INJURY_SECONDS_PER_TIER,
  LOG_PHRASES,
  MATERIALS,
  MAX_ENCOUNTERS_PER_TICK,
  PATROL,
  QUEST,
  SUCCESS_CHANCE_MAX,
  SUCCESS_CHANCE_MIN,
} from './config';
import { locationDef } from './guild';
import { productionPerSecond } from './logic';
import { computeModifiers } from './perks';
import { checkStoryTriggers } from './story';
import type { Adventurer, GameState, LocationDef, LogKind, Rng } from './types';

/**
 * The simulation tick. Handles any dt — 100ms live ticks and multi-hour
 * offline catch-ups go through the same code path (encounters are processed
 * in fixed game-time steps, capped). Patrol rewards accumulated within one
 * tick are logged as a single grouped line, so offline catch-up naturally
 * produces one summary entry per adventurer.
 */
export function tick(
  state: GameState,
  dtSeconds: number,
  now = Date.now(),
  rng: Rng = Math.random,
): GameState {
  if (dtSeconds <= 0) return { ...state, lastUpdate: now };

  const mods = computeModifiers(state);
  const next: GameState = {
    ...state,
    runTimeSeconds: state.runTimeSeconds + dtSeconds,
    lastUpdate: now,
    materials: { ...state.materials },
    inventory: [...state.inventory],
    locationsCleared: { ...state.locationsCleared },
    bossesDefeated: { ...state.bossesDefeated },
    activityLog: [...state.activityLog],
  };

  // Passive town income
  let goldGained = productionPerSecond(state) * dtSeconds;

  // Adventurer activity
  next.adventurers = next.adventurers.map((adv) => {
    const result = processAdventurer(next, adv, mods.healSpeedMult, mods.shardFindMult, rng);
    goldGained += result.gold;
    next.timeShards += result.shards;
    return result.adventurer;
  });

  // Expedition resolution (combined party fight)
  if (next.expedition && next.runTimeSeconds >= next.expedition.endsAt) {
    resolveExpedition(next, mods.healSpeedMult, rng);
  }

  next.gold += goldGained;
  next.totalGoldEarned += goldGained;

  if (next.activityLog.length > ACTIVITY_LOG_MAX) {
    next.activityLog = next.activityLog.slice(-ACTIVITY_LOG_MAX);
  }

  return checkStoryTriggers(next);
}

// ---------------------------------------------------------------------------

interface AdventurerResult {
  adventurer: Adventurer;
  gold: number;
  shards: number;
}

/** Loot accumulated over one tick's worth of patrol encounters. */
interface Loot {
  gold: number;
  xp: number;
  materials: Record<string, number>;
  equipment: string[];
  shards: number;
}

function emptyLoot(): Loot {
  return { gold: 0, xp: 0, materials: {}, equipment: [], shards: 0 };
}

/** Mutates `state`'s materials/inventory/log/etc; returns new adventurer. */
function processAdventurer(
  state: GameState,
  adv: Adventurer,
  healSpeedMult: number,
  shardFindMult: number,
  rng: Rng,
): AdventurerResult {
  const result: AdventurerResult = { adventurer: adv, gold: 0, shards: 0 };

  // Auto-reassign: if the adventurer has recovered from injury and has a
  // lastAssignment, send them back to the same location/mode.
  let current = adv;
  const nowSec = state.runTimeSeconds;
  if (!current.assignment && current.lastAssignment && !isInjured(current, nowSec)) {
    const lastLoc = locationDef(current.lastAssignment.locationId);
    if (lastLoc && lastLoc.kind === 'zone') {
      current = {
        ...current,
        assignment: {
          locationId: current.lastAssignment.locationId,
          mode: current.lastAssignment.mode,
          questEndsAt:
            current.lastAssignment.mode === 'quest'
              ? nowSec + lastLoc.questDuration
              : undefined,
          lastEncounterAt: nowSec,
        },
        lastAssignment: null, // clear so we don't loop on re-injury
      };
    }
  }

  if (!current.assignment || current.assignment.mode === 'expedition') return { ...result, adventurer: current };

  const loc = locationDef(current.assignment.locationId);
  if (!loc) return { ...result, adventurer: { ...current, assignment: null } };

  // Quest phase: nothing happens until the quest timer resolves.
  if (current.assignment!.mode === 'quest') {
    const endsAt = current.assignment!.questEndsAt ?? 0;
    if (nowSec < endsAt) return { ...result, adventurer: current };
    current = resolveQuest(state, current, loc, endsAt, healSpeedMult, shardFindMult, rng, result);
    if (!current.assignment) return { ...result, adventurer: current }; // failed → injured
  }

  // Patrol phase: process encounters at fixed game-time intervals.
  const loot = emptyLoot();
  let encounters = 0;
  let lastAt = nowSec;
  let injured = false;
  while (
    current.assignment &&
    nowSec - current.assignment.lastEncounterAt >= ENCOUNTER_INTERVAL &&
    encounters < MAX_ENCOUNTERS_PER_TICK
  ) {
    const at = current.assignment.lastEncounterAt + ENCOUNTER_INTERVAL;
    lastAt = at;
    encounters += 1;
    const power = adventurerPower(state, current);
    const success = rng() < successChance(power, loc.power);

    if (!success) {
      current = injure(current, loc, at, healSpeedMult);
      injured = true;
      break;
    }

    loot.gold += PATROL.goldPerTier * loc.tier;
    const xp = xpWithTraining(state, PATROL.xpPerTier * loc.tier);
    loot.xp += xp;
    current = gainXp(current, xp);
    if (rng() < PATROL.materialChance) {
      addMaterial(state, loc.materialId, 1);
      loot.materials[loc.materialId] = (loot.materials[loc.materialId] ?? 0) + 1;
    }
    if (rng() < PATROL.equipmentChance) loot.equipment.push(dropEquipment(state, loc.tier, rng));
    if (rng() < PATROL.chestChance) {
      // Chest: guaranteed equipment or gold treasure
      if (rng() < 0.5) loot.equipment.push(dropEquipment(state, loc.tier, rng));
      else loot.gold += PATROL.chestGoldPerTier * loc.tier;
    }
    if (rng() < loc.shardChance * shardFindMult) loot.shards += 1;

    current = {
      ...current,
      assignment: { ...current.assignment!, lastEncounterAt: at },
    };
  }

  result.gold += loot.gold;
  result.shards += loot.shards;
  if (loot.gold > 0 || loot.xp > 0) {
    const verb = pick(LOG_PHRASES.patrol, rng);
    pushLog(state, 'patrol', lastAt,
      `${firstName(adv)} ${verb} ${lootText(loot)} patrolling ${loc.name}.`);
  }
  if (injured) {
    pushLog(state, 'injury', lastAt,
      `${firstName(adv)} ${pick(LOG_PHRASES.patrolFail, rng)} ${loc.name}.`);
  }

  return { ...result, adventurer: current };
}

/** Quest resolution; on success the adventurer auto-switches to patrol. */
function resolveQuest(
  state: GameState,
  adv: Adventurer,
  loc: LocationDef,
  endedAt: number,
  healSpeedMult: number,
  shardFindMult: number,
  rng: Rng,
  result: AdventurerResult,
): Adventurer {
  const power = adventurerPower(state, adv);
  const success = rng() < successChance(power, loc.power);

  if (!success) {
    pushLog(state, 'injury', endedAt,
      `${firstName(adv)} ${pick(LOG_PHRASES.questFail, rng)} the quest at ${loc.name}.`);
    result.adventurer = adv;
    return injure(adv, loc, endedAt, healSpeedMult);
  }

  const loot = emptyLoot();
  loot.gold = QUEST.goldPerTier * loc.tier;
  result.gold += loot.gold;
  addMaterial(state, loc.materialId, QUEST.materialsPerTier * loc.tier);
  loot.materials[loc.materialId] = QUEST.materialsPerTier * loc.tier;
  loot.equipment.push(dropEquipment(state, loc.tier, rng)); // guaranteed at quest end
  if (rng() < loc.shardChance * QUEST.shardChanceMult * shardFindMult) {
    result.shards += 1;
    loot.shards = 1;
  }
  state.locationsCleared[loc.id] = true;

  const xp = xpWithTraining(state, QUEST.xpPerTier * loc.tier);
  loot.xp = xp;
  const leveled = gainXp(adv, xp);
  pushLog(state, 'quest', endedAt,
    `${firstName(adv)} ${pick(LOG_PHRASES.questSuccess, rng)} the quest at ${loc.name} — ${lootText(loot)}.`);
  // Design: after a quest, adventurers auto-switch to patrol.
  return {
    ...leveled,
    assignment: { locationId: loc.id, mode: 'patrol', lastEncounterAt: endedAt },
  };
}

/** Mutates state: resolves the boss expedition as one combined fight. */
function resolveExpedition(state: GameState, healSpeedMult: number, rng: Rng): void {
  const exp = state.expedition!;
  const loc = locationDef(exp.locationId);
  state.expedition = null;
  if (!loc) return;

  const members = state.adventurers.filter((a) => exp.memberIds.includes(a.id));
  const combined = members.reduce((sum, a) => sum + adventurerPower(state, a), 0);
  const success = rng() < successChance(combined, loc.power);
  const xp = xpWithTraining(state, QUEST.xpPerTier * loc.tier);

  state.adventurers = state.adventurers.map((a) => {
    if (!exp.memberIds.includes(a.id)) return a;
    const back = { ...a, assignment: null };
    return success ? gainXp(back, xp) : injure(back, loc, exp.endsAt, healSpeedMult);
  });

  if (success) {
    state.bossesDefeated[loc.id] = true;
    state.timeShards += loc.bossShardReward ?? 0;
    addMaterial(state, loc.materialId, QUEST.materialsPerTier * loc.tier);
    pushLog(state, 'expedition', exp.endsAt,
      `The expedition conquered ${loc.name}! +${loc.bossShardReward ?? 0} time shards.`);
  } else {
    pushLog(state, 'expedition', exp.endsAt,
      `The expedition was routed at ${loc.name} — everyone limped home wounded.`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function successChance(power: number, locationPower: number): number {
  return Math.min(SUCCESS_CHANCE_MAX, Math.max(SUCCESS_CHANCE_MIN, power / locationPower));
}

function injure(
  adv: Adventurer,
  loc: LocationDef,
  at: number,
  healSpeedMult: number,
): Adventurer {
  const duration = (INJURY_SECONDS_PER_TIER * loc.tier) / healSpeedMult;
  return {
    ...adv,
    assignment: null,
    lastAssignment: adv.assignment, // remember what they were doing
    injuredUntil: at + duration,
    injuredDuration: duration,
  };
}

function xpWithTraining(state: GameState, base: number): number {
  const trainingLevel = state.guildUpgrades['training-yard'] ?? 0;
  return Math.round(base * (1 + 0.15 * trainingLevel));
}

function addMaterial(state: GameState, materialId: string, amount: number): void {
  state.materials[materialId] = (state.materials[materialId] ?? 0) + amount;
}

/** Mutates state; returns the dropped item's name for log lines. */
function dropEquipment(state: GameState, tier: number, rng: Rng): string {
  const item = generateEquipment(state.nextEntityId, tier, rng);
  state.inventory.push(item);
  state.nextEntityId += 1;
  return item.name;
}

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function firstName(adv: Adventurer): string {
  return adv.name.split(' ')[0];
}

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

/** "120 gold, 5 Beast Pelt, Fine Bow, 1 time shard, 300 XP" */
function lootText(loot: Loot): string {
  const parts: string[] = [];
  if (loot.gold > 0) parts.push(`${Math.round(loot.gold)} gold`);
  for (const [id, n] of Object.entries(loot.materials)) {
    parts.push(`${n} ${materialName(id)}`);
  }
  parts.push(...loot.equipment);
  if (loot.shards > 0) parts.push(`${loot.shards} time shard${loot.shards > 1 ? 's' : ''}`);
  if (loot.xp > 0) parts.push(`${loot.xp} XP`);
  return parts.join(', ');
}

/** Mutates state: appends a log entry (trimmed to cap at end of tick). */
function pushLog(state: GameState, kind: LogKind, at: number, text: string): void {
  state.activityLog.push({ id: state.nextEntityId, at, kind, text });
  state.nextEntityId += 1;
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
): { state: GameState; offlineSeconds: number; goldEarned: number; shardsFound: number } {
  if (!state.settings.offlineProgress) {
    return { state: { ...state, lastUpdate: now }, offlineSeconds: 0, goldEarned: 0, shardsFound: 0 };
  }
  const capHours = computeModifiers(state).offlineCapHours;
  const elapsed = Math.max(0, (now - state.lastUpdate) / 1000);
  const credited = Math.min(elapsed, capHours * 3600);
  const next = tick(state, credited, now, rng);
  return {
    state: next,
    offlineSeconds: credited,
    goldEarned: next.totalGoldEarned - state.totalGoldEarned,
    shardsFound: next.timeShards - state.timeShards,
  };
}
