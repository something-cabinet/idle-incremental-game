import { adventurerPower, gainXp, generateEquipment } from './adventurers';
import {
  ENCOUNTER_INTERVAL,
  INJURY_SECONDS_PER_TIER,
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
import type { Adventurer, GameState, LocationDef, Rng } from './types';

/**
 * The simulation tick. Handles any dt — 100ms live ticks and multi-hour
 * offline catch-ups go through the same code path (encounters are processed
 * in fixed game-time steps, capped for safety).
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

  return checkStoryTriggers(next);
}

// ---------------------------------------------------------------------------

interface AdventurerResult {
  adventurer: Adventurer;
  gold: number;
  shards: number;
}

/** Mutates `state`'s materials/inventory/locationsCleared; returns new adventurer. */
function processAdventurer(
  state: GameState,
  adv: Adventurer,
  healSpeedMult: number,
  shardFindMult: number,
  rng: Rng,
): AdventurerResult {
  const result: AdventurerResult = { adventurer: adv, gold: 0, shards: 0 };
  if (!adv.assignment || adv.assignment.mode === 'expedition') return result;

  const loc = locationDef(adv.assignment.locationId);
  if (!loc) return { ...result, adventurer: { ...adv, assignment: null } };

  let current = adv;
  const nowSec = state.runTimeSeconds;

  // Quest phase: nothing happens until the quest timer resolves.
  if (current.assignment!.mode === 'quest') {
    const endsAt = current.assignment!.questEndsAt ?? 0;
    if (nowSec < endsAt) return { ...result, adventurer: current };
    current = resolveQuest(state, current, loc, endsAt, healSpeedMult, shardFindMult, rng, result);
    if (!current.assignment) return { ...result, adventurer: current }; // failed → injured
  }

  // Patrol phase: process encounters at fixed game-time intervals.
  let encounters = 0;
  while (
    current.assignment &&
    nowSec - current.assignment.lastEncounterAt >= ENCOUNTER_INTERVAL &&
    encounters < MAX_ENCOUNTERS_PER_TICK
  ) {
    const at = current.assignment.lastEncounterAt + ENCOUNTER_INTERVAL;
    encounters += 1;
    const power = adventurerPower(state, current);
    const success = rng() < successChance(power, loc.power);

    if (!success) {
      current = injure(current, loc, at, healSpeedMult);
      break;
    }

    result.gold += PATROL.goldPerTier * loc.tier;
    current = gainXp(current, xpWithTraining(state, PATROL.xpPerTier * loc.tier));
    if (rng() < PATROL.materialChance) addMaterial(state, loc.materialId, 1);
    if (rng() < PATROL.equipmentChance) dropEquipment(state, loc.tier, rng);
    if (rng() < PATROL.chestChance) {
      // Chest: guaranteed equipment or gold treasure
      if (rng() < 0.5) dropEquipment(state, loc.tier, rng);
      else result.gold += PATROL.chestGoldPerTier * loc.tier;
    }
    if (rng() < loc.shardChance * shardFindMult) result.shards += 1;

    current = {
      ...current,
      assignment: { ...current.assignment!, lastEncounterAt: at },
    };
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
    result.adventurer = adv;
    return injure(adv, loc, endedAt, healSpeedMult);
  }

  result.gold += QUEST.goldPerTier * loc.tier;
  addMaterial(state, loc.materialId, QUEST.materialsPerTier * loc.tier);
  dropEquipment(state, loc.tier, rng); // guaranteed equipment at quest end
  if (rng() < loc.shardChance * QUEST.shardChanceMult * shardFindMult) {
    result.shards += 1;
  }
  state.locationsCleared[loc.id] = true;

  const leveled = gainXp(adv, xpWithTraining(state, QUEST.xpPerTier * loc.tier));
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
  return { ...adv, assignment: null, injuredUntil: at + duration };
}

function xpWithTraining(state: GameState, base: number): number {
  const trainingLevel = state.guildUpgrades['training-yard'] ?? 0;
  return Math.round(base * (1 + 0.15 * trainingLevel));
}

function addMaterial(state: GameState, materialId: string, amount: number): void {
  state.materials[materialId] = (state.materials[materialId] ?? 0) + amount;
}

function dropEquipment(state: GameState, tier: number, rng: Rng): void {
  state.inventory.push(generateEquipment(state.nextEntityId, tier, rng));
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
