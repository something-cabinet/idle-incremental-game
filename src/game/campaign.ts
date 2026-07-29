import { generateEquipment } from './adventurers';
import {
  applyBattleResult,
  disambiguateMonsterNames,
  monsterCombatStats,
  simulateBattle,
} from './combat';
import type { BattleCarryIn, BattleOutcome, MonsterInstance } from './combat';
import {
  CAMPAIGN_BOSSES,
  CAMPAIGN_BOSS_ATK_MULT,
  CAMPAIGN_BOSS_DEF_MULT,
  CAMPAIGN_BOSS_HP_MULT,
  CAMPAIGN_GUARD_STAGES,
  CAMPAIGN_MINIONS,
  CAMPAIGN_VICTORY_EQUIPMENT_COUNT,
  CAMPAIGN_VICTORY_MATERIAL_AMOUNT,
  DEMON_KING_ID,
  GENERAL_IDS,
  rollMonsterCount,
} from './config';
import { bosses, isBossUnlocked, locationDef } from './guild';
import { addStats } from './stats';
import type {
  Adventurer,
  CampaignBossDef,
  Equipment,
  GameState,
  LocationDef,
  LogEntry,
  QuestTargetDef,
  Rng,
} from './types';

/**
 * Act 3: the campaign against the demon king's legion.
 *
 * A march on a boss is a manual gauntlet — CAMPAIGN_GUARD_STAGES waves of that
 * boss's elite minions, then the boss itself with an escort — resolved stage by
 * stage exactly like a dungeon run (see dungeon.ts, whose carryIn/carryOut
 * shape this reuses): the party's HP and skill cooldowns thread from one stage
 * into the next, so a march plays as one long fight. Stage-to-stage progress is
 * UI-local; only rewards and the kill persist.
 *
 * Two things make a march different from a dungeon:
 *  - It can only be won once per timeline (GameState.bossesDefeated), and the
 *    generals must fall in order before the citadel opens (isBossUnlocked).
 *  - Failure costs nothing but time: knocked-out champions recover in the
 *    infirmary as always, the boss is restored to full, and the player marches
 *    again. The pressure comes from the Day HOMETOWN_DEADLINE_DAY calendar,
 *    not from a lockout.
 *
 * Killing the demon king is what unlocks time travel (see prestige.ts), so
 * this module is the hinge the whole prestige loop hangs off.
 */

/** Stages in one march: the minion waves plus the boss stage itself. */
export const CAMPAIGN_TOTAL_STAGES = CAMPAIGN_GUARD_STAGES + 1;

/** Every campaign target, in march order (three generals, then the king). */
export function campaignTargets(): LocationDef[] {
  return bosses();
}

export function campaignBossDef(locationId: string): CampaignBossDef | undefined {
  return CAMPAIGN_BOSSES.find((b) => b.locationId === locationId);
}

/** Why a march can't be started yet — null when it can, for the UI's lock row. */
export function campaignLockReason(state: GameState, locationId: string): string | null {
  if (state.bossesDefeated[locationId]) return null; // defeated, not locked
  if (state.act < 3) return 'The road home has not been found yet.';
  if (locationId === DEMON_KING_ID) {
    const left = GENERAL_IDS.filter((id) => !state.bossesDefeated[id]).length;
    if (left > 0) {
      return `The citadel is sealed while ${left} of the king's generals still stand.`;
    }
    return null;
  }
  const index = GENERAL_IDS.indexOf(locationId);
  if (index > 0 && !state.bossesDefeated[GENERAL_IDS[index - 1]]) {
    const prev = campaignBossDef(GENERAL_IDS[index - 1])?.name ?? 'the previous general';
    return `${prev} must fall first.`;
  }
  return null;
}

function minionsFor(locationId: string): QuestTargetDef[] {
  return CAMPAIGN_MINIONS.filter((m) => m.locationId === locationId);
}

/** A wave of the boss's elite minions. Unlike a zone roll these never produce
 *  Super variants — at these tiers the boss is the spike, not a lucky monster. */
function rollMinionGroup(loc: LocationDef, rng: Rng, firstInstanceId = 0): MonsterInstance[] {
  const pool = minionsFor(loc.id);
  if (pool.length === 0) return [];
  const count = rollMonsterCount(rng);
  const group: MonsterInstance[] = [];
  for (let i = 0; i < count; i++) {
    const target = pool[Math.floor(rng() * pool.length)];
    const stats = monsterCombatStats(target, loc.tier);
    group.push({
      instanceId: firstInstanceId + i,
      targetId: target.id,
      name: target.name,
      materialId: target.materialId,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      speed: stats.speed,
      xpReward: stats.xpReward,
      goldReward: stats.goldReward,
      isSuper: false,
    });
  }
  return group;
}

/**
 * The boss itself: the usual tier/difficulty monster formula, amplified per
 * stat by the CAMPAIGN_BOSS_*_MULT constants (HP most, Defense least — see
 * config), and armed with its own skill kit. Its XP/gold scale with the HP
 * multiplier, since that's what sets how long the fight actually takes.
 */
function bossInstance(loc: LocationDef, boss: CampaignBossDef): MonsterInstance {
  const asTarget: QuestTargetDef = {
    id: boss.locationId,
    locationId: loc.id,
    kind: 'monster',
    name: boss.name,
    materialId: loc.materialId,
    difficulty: boss.difficulty,
  };
  const stats = monsterCombatStats(asTarget, loc.tier);
  return {
    instanceId: 0,
    targetId: asTarget.id,
    name: boss.name,
    materialId: loc.materialId,
    maxHp: Math.round(stats.hp * CAMPAIGN_BOSS_HP_MULT),
    atk: Math.round(stats.atk * CAMPAIGN_BOSS_ATK_MULT),
    def: Math.round(stats.def * CAMPAIGN_BOSS_DEF_MULT),
    speed: stats.speed,
    xpReward: Math.round(stats.xpReward * CAMPAIGN_BOSS_HP_MULT),
    goldReward: Math.round(stats.goldReward * CAMPAIGN_BOSS_HP_MULT),
    isSuper: false,
    isBoss: true,
    skillIds: boss.skillIds,
  };
}

/**
 * Roll one stage's opposition: a plain minion wave for stages
 * 0..CAMPAIGN_GUARD_STAGES-1, and for the final stage the boss (instanceId 0,
 * the only one flagged isBoss) fighting alongside an unamplified escort — it
 * never stands alone.
 */
export function rollCampaignStage(
  locationId: string,
  stageIndex: number,
  rng: Rng,
): MonsterInstance[] {
  const loc = locationDef(locationId);
  if (!loc || loc.kind !== 'boss') return [];
  if (stageIndex < CAMPAIGN_GUARD_STAGES) {
    return disambiguateMonsterNames(rollMinionGroup(loc, rng));
  }
  const boss = campaignBossDef(locationId);
  if (!boss) return [];
  const escort = rollMinionGroup(loc, rng, 1);
  return [bossInstance(loc, boss), ...disambiguateMonsterNames(escort)];
}

/** A march that couldn't be started (locked, or unknown target) — reported as
 *  a loss with nothing in it, so a caller never mistakes it for a kill. */
function noBattle(locationId: string): BattleOutcome {
  return {
    locationId,
    outcome: 'loss',
    log: [],
    monsters: [],
    party: [],
    rewards: { gold: 0, xp: 0, materials: {}, equipment: [], timeShards: 0 },
  };
}

/**
 * One-time spoils for felling a campaign boss, on top of the battle's own
 * drops: the location's `bossShardReward` in time shards (the prestige
 * currency this whole act exists to produce), a lump of its material, and a
 * couple of guaranteed high-roll items — generated with the Super rarity
 * table, so a boss kill is the best loot event in the game.
 */
function grantVictorySpoils(state: GameState, loc: LocationDef, boss: CampaignBossDef, rng: Rng): GameState {
  let nextId = state.nextEntityId;
  const equipment: Equipment[] = [];
  for (let i = 0; i < CAMPAIGN_VICTORY_EQUIPMENT_COUNT; i++) {
    equipment.push(generateEquipment(nextId++, loc.tier, rng, undefined, 'exalted', true));
  }
  const shards = loc.bossShardReward ?? 0;
  const entry: LogEntry = {
    id: nextId++,
    at: state.runTimeSeconds,
    kind: 'campaign',
    text: boss.victoryLog,
  };

  const next: GameState = {
    ...state,
    bossesDefeated: { ...state.bossesDefeated, [loc.id]: true },
    materials: {
      ...state.materials,
      [loc.materialId]: (state.materials[loc.materialId] ?? 0) + CAMPAIGN_VICTORY_MATERIAL_AMOUNT,
    },
    inventory: [...state.inventory, ...equipment],
    timeShards: state.timeShards + shards,
    nextEntityId: nextId,
    activityLog: [...state.activityLog, entry],
  };

  return addStats(next, {
    bossesFelled: 1,
    itemsFound: equipment.length,
    shardsFound: shards,
  });
}

/**
 * Fight one stage of a march (0-based; CAMPAIGN_GUARD_STAGES is the boss
 * stage) and apply its result — the single entry point the campaign UI calls
 * per stage, mirroring dungeon.ts's fightDungeonRoom. Winning the boss stage
 * marks the boss defeated for this timeline and grants its one-time spoils;
 * the resulting story beat (and, for the king, time travel) is picked up by
 * checkStoryTriggers on the next tick.
 */
export function fightCampaignStage(
  state: GameState,
  locationId: string,
  partyIds: number[],
  stageIndex: number,
  rng: Rng,
  carryIn?: BattleCarryIn,
): { state: GameState; result: BattleOutcome; carryOut: BattleCarryIn } {
  const loc = locationDef(locationId);
  const boss = campaignBossDef(locationId);
  if (!loc || !boss || !isBossUnlocked(state, locationId)) {
    return { state, result: noBattle(locationId), carryOut: {} };
  }

  const party = partyIds
    .map((id) => state.adventurers.find((a) => a.id === id))
    .filter((a): a is Adventurer => !!a);
  const monsters = rollCampaignStage(locationId, stageIndex, rng);
  const result = simulateBattle(state, party, monsters, locationId, rng, true, carryIn);
  let next = applyBattleResult(state, result, rng, 'campaign');
  if (result.outcome === 'win' && stageIndex === CAMPAIGN_GUARD_STAGES) {
    next = grantVictorySpoils(next, loc, boss, rng);
  }

  const carryOut: BattleCarryIn = {};
  for (const p of result.party) {
    if (p.knockedOut) continue;
    carryOut[p.advId] = { hp: p.finalHp, skillCooldownRemaining: p.skillCooldownRemaining };
  }
  return { state: next, result, carryOut };
}
