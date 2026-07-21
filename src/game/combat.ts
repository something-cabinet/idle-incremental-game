import {
  adventurerStats,
  effectiveAttributes,
  gainXp,
  generateEquipment,
  isInjured,
  maxHp,
} from './adventurers';
import {
  COMBAT_DAMAGE_VARIANCE,
  COMBAT_DEF_MITIGATION_K,
  ENCOUNTER_INTERVAL,
  EXPLORE_EQUIPMENT_CHANCE,
  EXPLORE_MAX_PARTY_SIZE,
  EXPLORE_MAX_TURNS,
  INFIRMARY_HEAL_BONUS,
  INJURY_MIN_FRACTION,
  INJURY_SECONDS_PER_TIER,
  LOG_PHRASES,
  MONSTER_ATK_BASE,
  MONSTER_ATK_PER_TIER,
  MONSTER_DEF_BASE,
  MONSTER_DEF_PER_TIER,
  MONSTER_GOLD_PER_TIER,
  MONSTER_HP_BASE,
  MONSTER_HP_PER_TIER,
  MONSTER_MATERIAL_CHANCE,
  MAX_ENCOUNTERS_PER_TICK,
  MONSTER_SPEED_BASE,
  MONSTER_SPEED_PER_TIER,
  MONSTER_XP_PER_TIER,
  exploreMonsterCount,
  tierXp,
} from './config';
import { autoExploreMembers, locationDef, targetsForLocation } from './guild';
import { computeModifiers } from './perks';
import type { Adventurer, Equipment, GameState, LogEntry, LogKind, QuestTargetDef, Rng } from './types';

/** Pure turn-based Explore combat: party vs a location's monsters, resolved
 * with speed-ordered initiative until one side is fully defeated. Separate
 * from the auto-resolving quest board in engine.ts/guild.ts — Explore is a
 * manual, on-demand action for the named Champion roster (see docs). */

export interface MonsterInstance {
  instanceId: number;
  targetId: string;
  name: string;
  materialId: string;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  xpReward: number;
  goldReward: number;
}

interface Combatant {
  side: 'party' | 'monsters';
  refId: number;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
}

export interface BattleLogEntry {
  attackerSide: 'party' | 'monsters';
  attackerName: string;
  defenderSide: 'party' | 'monsters';
  defenderName: string;
  damage: number;
  defenderHpAfter: number;
  defenderMaxHp: number;
  defenderDefeated: boolean;
}

export interface PartyBattleResult {
  advId: number;
  name: string;
  finalHp: number;
  maxHp: number;
  knockedOut: boolean;
  injurySeconds: number;
  enemiesDefeated: number;
  damageDealt: number;
}

export interface BattleOutcome {
  locationId: string;
  outcome: 'win' | 'loss';
  log: BattleLogEntry[];
  monsters: MonsterInstance[];
  party: PartyBattleResult[];
  rewards: {
    gold: number;
    xp: number;
    materials: Record<string, number>;
    equipment: Equipment[];
    timeShards: number;
  };
}

/** A champion is available to Explore if healthy and not otherwise assigned. */
export function canExplore(state: GameState, adv: Adventurer): boolean {
  return !isInjured(adv, state.runTimeSeconds) && adv.assignment === null;
}

function monsterCombatStats(target: QuestTargetDef, tier: number) {
  const hp = Math.round((MONSTER_HP_BASE + MONSTER_HP_PER_TIER * tier) * target.difficulty);
  const atk = Math.round((MONSTER_ATK_BASE + MONSTER_ATK_PER_TIER * tier) * target.difficulty);
  const def = Math.round((MONSTER_DEF_BASE + MONSTER_DEF_PER_TIER * tier) * target.difficulty);
  const speed = MONSTER_SPEED_BASE + MONSTER_SPEED_PER_TIER * tier;
  const xpReward = Math.round(tierXp(MONSTER_XP_PER_TIER, tier) * target.difficulty);
  const goldReward = Math.round(MONSTER_GOLD_PER_TIER * tier * target.difficulty);
  return { hp, atk, def, speed, xpReward, goldReward };
}

/** Roll a monster group for a zone: count scales with tier, each slot drawn
 * (with replacement) from that zone's monster targets. */
export function rollMonsterGroup(locationId: string, rng: Rng): MonsterInstance[] {
  const loc = locationDef(locationId);
  if (!loc) return [];
  const pool = targetsForLocation(locationId).filter((t) => t.kind === 'monster');
  if (pool.length === 0) return [];
  const count = exploreMonsterCount(loc.tier);
  const group: MonsterInstance[] = [];
  for (let i = 0; i < count; i++) {
    const target = pool[Math.floor(rng() * pool.length)];
    const stats = monsterCombatStats(target, loc.tier);
    group.push({
      instanceId: i,
      targetId: target.id,
      name: target.name,
      materialId: target.materialId,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      speed: stats.speed,
      xpReward: stats.xpReward,
      goldReward: stats.goldReward,
    });
  }
  return group;
}

function rollDamage(atk: number, def: number, rng: Rng): number {
  const mitigated = atk * (COMBAT_DEF_MITIGATION_K / (COMBAT_DEF_MITIGATION_K + def));
  const variance = 1 - COMBAT_DAMAGE_VARIANCE / 2 + rng() * COMBAT_DAMAGE_VARIANCE;
  return Math.max(1, Math.round(mitigated * variance));
}

/** How long a knocked-out champion needs to recover: scales with the zone's
 * tier and how badly they were overkilled, reduced by heal-speed perks and
 * the Infirmary guild upgrade. */
function injurySecondsFor(overkillHp: number, hp: number, tier: number, healSpeedMult: number): number {
  const overkillFraction = Math.min(1, Math.max(0, overkillHp / Math.max(1, hp)));
  const fraction = INJURY_MIN_FRACTION + (1 - INJURY_MIN_FRACTION) * overkillFraction;
  return Math.round((INJURY_SECONDS_PER_TIER * tier * fraction) / healSpeedMult);
}

/**
 * Simulate one battle: party vs a monster group, speed-ordered initiative,
 * single random-target attacks each turn, until one side is fully defeated
 * (or EXPLORE_MAX_TURNS is hit, in which case the party retreats as a loss).
 * Pure & deterministic given `rng` — callers decide whether/how to animate
 * `log` for playback; this function does not touch GameState.
 */
export function simulateBattle(
  state: GameState,
  party: Adventurer[],
  monsters: MonsterInstance[],
  locationId: string,
  rng: Rng,
): BattleOutcome {
  const loc = locationDef(locationId);
  const tier = loc?.tier ?? 1;

  const combatants: Combatant[] = [
    ...party.map((a): Combatant => {
      const stats = adventurerStats(a);
      return {
        side: 'party',
        refId: a.id,
        name: a.name,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        atk: stats.atk,
        def: stats.def,
        speed: effectiveAttributes(a).dex,
      };
    }),
    ...monsters.map((m): Combatant => ({
      side: 'monsters',
      refId: m.instanceId,
      name: m.name,
      hp: m.maxHp,
      maxHp: m.maxHp,
      atk: m.atk,
      def: m.def,
      speed: m.speed,
    })),
  ];

  const alive = (side: 'party' | 'monsters') => combatants.some((c) => c.side === side && c.hp > 0);
  const log: BattleLogEntry[] = [];

  let turns = 0;
  outer: while (turns < EXPLORE_MAX_TURNS && alive('party') && alive('monsters')) {
    const order = combatants
      .filter((c) => c.hp > 0)
      .sort((a, b) => b.speed - a.speed || a.refId - b.refId);
    for (const attacker of order) {
      if (attacker.hp <= 0) continue;
      if (!alive('party') || !alive('monsters')) break outer;
      const enemies = combatants.filter((c) => c.side !== attacker.side && c.hp > 0);
      if (enemies.length === 0) continue;
      const target = enemies[Math.floor(rng() * enemies.length)];
      const damage = rollDamage(attacker.atk, target.def, rng);
      target.hp -= damage;
      turns++;
      log.push({
        attackerSide: attacker.side,
        attackerName: attacker.name,
        defenderSide: target.side,
        defenderName: target.name,
        damage,
        defenderHpAfter: Math.max(0, target.hp),
        defenderMaxHp: target.maxHp,
        defenderDefeated: target.hp <= 0,
      });
      if (turns >= EXPLORE_MAX_TURNS) break outer;
    }
  }

  const outcome: 'win' | 'loss' = alive('party') && !alive('monsters') ? 'win' : 'loss';
  const healSpeedMult =
    computeModifiers(state).healSpeedMult * (1 + INFIRMARY_HEAL_BONUS * (state.guildUpgrades.infirmary ?? 0));

  // Track damage dealt and kills per party member
  const partyDamage: Record<number, number> = {};
  const partyKills: Record<number, number> = {};
  for (const entry of log) {
    if (entry.attackerSide === 'party') {
      const adv = party.find((a) => a.name === entry.attackerName);
      if (adv) {
        partyDamage[adv.id] = (partyDamage[adv.id] ?? 0) + entry.damage;
      }
    }
    if (entry.defenderDefeated && entry.defenderSide === 'monsters') {
      // Find who landed the killing blow
      const killer = party.find((a) => a.name === entry.attackerName);
      if (killer) {
        partyKills[killer.id] = (partyKills[killer.id] ?? 0) + 1;
      }
    }
  }

  const partyResults: PartyBattleResult[] = combatants
    .filter((c): c is Combatant => c.side === 'party')
    .map((c) => {
      const knockedOut = c.hp <= 0;
      return {
        advId: c.refId,
        name: c.name,
        finalHp: Math.max(0, c.hp),
        maxHp: c.maxHp,
        knockedOut,
        injurySeconds: knockedOut ? injurySecondsFor(-c.hp, c.maxHp, tier, healSpeedMult) : 0,
        enemiesDefeated: partyKills[c.refId] ?? 0,
        damageDealt: partyDamage[c.refId] ?? 0,
      };
    });

  let gold = 0;
  let xp = 0;
  const materials: Record<string, number> = {};
  const equipment: Equipment[] = [];
  let timeShards = 0;
  let nextId = state.nextEntityId;
  // Explore uses boosted equipment drop chance
  const equipChance = EXPLORE_EQUIPMENT_CHANCE;
  if (outcome === 'win') {
    for (const m of monsters) {
      gold += m.goldReward;
      xp += m.xpReward;
      if (rng() < MONSTER_MATERIAL_CHANCE) {
        materials[m.materialId] = (materials[m.materialId] ?? 0) + 1;
      }
      if (rng() < equipChance) {
        equipment.push(generateEquipment(nextId++, tier, rng));
      }
    }
    if (loc && rng() < loc.shardChance) timeShards += 1;
  }

  return {
    locationId,
    outcome,
    log,
    monsters,
    party: partyResults,
    rewards: { gold, xp, materials, equipment, timeShards },
  };
}

/** Apply a resolved battle to GameState: grants rewards on a win, injures any
 * knocked-out champion regardless of outcome, and (optionally) appends an
 * activity log entry. Pure — does not touch React/UI state.
 *
 * Gold, materials, equipment and shards are shared guild spoils. XP is the
 * exception: the monster group's total XP is split *evenly* across the party,
 * so a lone champion earns the whole pot (harder fight, faster leveling) while
 * a full trio each get a third — see docs discussion / user design intent.
 *
 * `logKind` controls the activity-log entry: 'explore' (default) for a manual
 * Explore fight, 'injury' for an Auto-Explore encounter that hurt someone, or
 * null to stay silent (routine Auto-Explore wins, to avoid flooding the log). */
export function applyBattleResult(
  state: GameState,
  result: BattleOutcome,
  rng: Rng,
  logKind: LogKind | null = 'explore',
): GameState {
  const loc = locationDef(result.locationId);
  const xpEach =
    result.party.length > 0 ? Math.floor(result.rewards.xp / result.party.length) : 0;

  const adventurers = state.adventurers.map((a) => {
    const pr = result.party.find((p) => p.advId === a.id);
    if (!pr) return a;
    let next = a;
    if (pr.knockedOut) {
      next = {
        ...next,
        hp: 0,
        injuredUntil: state.runTimeSeconds + pr.injurySeconds,
        injuredDuration: pr.injurySeconds,
      };
    } else {
      next = { ...next, hp: maxHp(next) };
    }
    if (result.outcome === 'win' && xpEach > 0) {
      next = gainXp(next, xpEach);
    }
    if (pr.enemiesDefeated > 0) {
      next = { ...next, enemiesDefeated: next.enemiesDefeated + pr.enemiesDefeated };
    }
    if (pr.damageDealt > 0) {
      next = { ...next, totalDamageDealt: next.totalDamageDealt + pr.damageDealt };
    }
    return next;
  });

  const materials = { ...state.materials };
  for (const [id, amount] of Object.entries(result.rewards.materials)) {
    materials[id] = (materials[id] ?? 0) + amount;
  }

  const equipCount = result.rewards.equipment.length;
  const logId = state.nextEntityId + equipCount;
  let activityLog = state.activityLog;
  if (logKind) {
    const locName = loc?.name ?? result.locationId;
    let text: string;
    if (logKind === 'injury') {
      const hurt = result.party.filter((p) => p.knockedOut).map((p) => p.name).join(', ');
      const phrase = LOG_PHRASES.questFail[Math.floor(rng() * LOG_PHRASES.questFail.length)];
      text = `${hurt} ${phrase} ${locName}.`;
    } else {
      const names = result.party.map((p) => p.name).join(', ');
      const phrase =
        result.outcome === 'win'
          ? LOG_PHRASES.questSuccess[Math.floor(rng() * LOG_PHRASES.questSuccess.length)]
          : LOG_PHRASES.questFail[Math.floor(rng() * LOG_PHRASES.questFail.length)];
      text = `${names} ${phrase} ${locName}.`;
    }
    const entry: LogEntry = { id: logId, at: state.runTimeSeconds, kind: logKind, text };
    activityLog = [...state.activityLog, entry];
  }

  return {
    ...state,
    adventurers,
    gold: state.gold + result.rewards.gold,
    totalGoldEarned: state.totalGoldEarned + result.rewards.gold,
    materials,
    inventory: [...state.inventory, ...result.rewards.equipment],
    timeShards: state.timeShards + result.rewards.timeShards,
    // Equipment consumed [nextEntityId .. logId); the log entry (if any) takes logId.
    nextEntityId: logKind ? logId + 1 : logId,
    activityLog,
  };
}

/** Roll a monster group, simulate the battle, and apply its result to state
 * in one step — the single entry point the manual Explore UI calls. */
export function runExplore(
  state: GameState,
  locationId: string,
  partyIds: number[],
  rng: Rng,
): { state: GameState; result: BattleOutcome } {
  const party = partyIds
    .map((id) => state.adventurers.find((a) => a.id === id))
    .filter((a): a is Adventurer => !!a);
  const monsters = rollMonsterGroup(locationId, rng);
  const result = simulateBattle(state, party, monsters, locationId, rng);
  return { state: applyBattleResult(state, result, rng), result };
}

// ---------------------------------------------------------------------------
// Auto-Explore: champions assigned (mode 'auto-explore') to a zone auto-battle
// a fresh monster group there every ENCOUNTER_INTERVAL of game time. This runs
// inside engine.tick, so a single big offline dt replays the same fixed-step
// loop — champions earn XP/loot and take injuries while the player is away.
// Gated behind the 'auto-explore' guild upgrade (see guild.ts assignAdventurer).
// ---------------------------------------------------------------------------

/** Advance every auto-exploring champion at `locationId` to a new encounter
 * clock, whether or not they fought this step (keeps the group in sync). */
function setAutoExploreClock(state: GameState, locationId: string, at: number): GameState {
  return {
    ...state,
    adventurers: state.adventurers.map((a) =>
      a.assignment?.mode === 'auto-explore' && a.assignment.locationId === locationId
        ? { ...a, assignment: { ...a.assignment, lastEncounterAt: at } }
        : a,
    ),
  };
}

/**
 * Process all pending Auto-Explore encounters up to state.runTimeSeconds. Pure
 * and dt-agnostic: called once per tick with time already advanced, it steps
 * each auto-exploring zone forward in fixed ENCOUNTER_INTERVAL beats (capped by
 * MAX_ENCOUNTERS_PER_TICK across all zones so a huge offline gap stays bounded).
 *
 * Each beat forms a party of up to EXPLORE_MAX_PARTY_SIZE *healthy* members at
 * that zone (a member injured earlier in the same offline window is skipped
 * until their injury elapses, then auto-rejoins), fights a rolled group, and
 * applies the result. Knocked-out members stay assigned but rest until healed
 * — no permadeath, no manual re-assign needed.
 */
export function processAutoExplore(state: GameState, rng: Rng): GameState {
  const locationIds = Array.from(
    new Set(
      state.adventurers
        .filter((a) => a.assignment?.mode === 'auto-explore')
        .map((a) => a.assignment!.locationId),
    ),
  );
  if (locationIds.length === 0) return state;

  let s = state;
  let budget = MAX_ENCOUNTERS_PER_TICK;

  for (const locationId of locationIds) {
    while (budget > 0) {
      const assigned = autoExploreMembers(s, locationId);
      if (assigned.length === 0) break;
      const clock = Math.max(...assigned.map((a) => a.assignment!.lastEncounterAt));
      const stepTime = clock + ENCOUNTER_INTERVAL;
      if (stepTime > s.runTimeSeconds) break; // no full interval elapsed yet

      const party = assigned
        .filter((a) => !isInjured(a, stepTime))
        .slice(0, EXPLORE_MAX_PARTY_SIZE);

      if (party.length > 0) {
        const monsters = rollMonsterGroup(locationId, rng);
        const result = simulateBattle(s, party, monsters, locationId, rng);
        const logKind = result.party.some((p) => p.knockedOut) ? 'injury' : null;
        s = applyBattleResult(s, result, rng, logKind);
      }
      // Advance the whole group's clock (fighters and resting injured alike).
      s = setAutoExploreClock(s, locationId, stepTime);
      budget--;
    }
  }

  return s;
}
