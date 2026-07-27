import {
  adventurerStats,
  championPerkEffects,
  championSkill,
  effectiveAttributes,
  gainXp,
  generateEquipment,
  isInjured,
  maxHp,
  perkRecoveryMult,
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
  DUNGEONS,
  DUNGEON_WINS_REQUIRED,
  rollMonsterCount,
  SUPER_DROP_CHANCE_MULT,
  SUPER_LOOT_AMOUNT_MULT,
  SUPER_MONSTER_CHANCE,
  SUPER_MONSTER_PREFIX,
  SUPER_STAT_MULT,
  tierXp,
} from './config';
import { autoExploreMembers, locationDef, targetsForLocation } from './guild';
import { computeModifiers } from './perks';
import { addStats } from './stats';
import type {
  Adventurer,
  AdventurerClass,
  BuffStat,
  ClassSkillDef,
  ClassSkillEffect,
  Equipment,
  GameState,
  LogEntry,
  LogKind,
  QuestTargetDef,
  Rng,
  StatusKind,
} from './types';

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
  /** A rare, tripled-stat/reward variant — see rollMonsterGroup. */
  isSuper: boolean;
  /** A dungeon's amplified final-room monster — see dungeon.ts. Rendered
   *  bigger and in a distinct color from a Super monster (BattleViewer). */
  isBoss?: boolean;
}

/** A timed multiplier on one combat stat (from a skill buff). Ticks down once
 *  per the OWNER's own turn (see decrementTimedEffects in the main loop) —
 *  same turn-based philosophy as SkillSlot's cooldown, just counting presence
 *  instead of counting down to readiness. */
interface ActiveBuff {
  stat: BuffStat;
  mult: number;
  /** Remaining turns (of the owner's own) this buff is still active for. */
  turnsRemaining: number;
}

/** A timed debuff on a combatant (from a skill status). Ticks down once per
 *  the OWNER's own turn, same as ActiveBuff. */
interface ActiveStatus {
  kind: StatusKind;
  /** Remaining turns (of the owner's own) this status is still active for. */
  turnsRemaining: number;
  /** Damage per turn for poison/burn (0 otherwise). */
  dmgPerRound: number;
  /** Speed multiplier while active for slow (1 otherwise). */
  slowFactor: number;
  /** Who inflicted it — DoT ticks credit their damage/kills to this source. */
  sourceSide: 'party' | 'monsters';
  sourceName: string;
}

/** A skill a combatant carries, plus its own per-combatant cooldown counter.
 *  Combatants can hold several (future enemies/champions with multi-skill
 *  kits). Ticks down once per this combatant's own turn — see the main loop
 *  — independent of any other combatant's turns; there is no shared clock. */
interface SkillSlot {
  def: ClassSkillDef;
  /** Remaining turns (of this combatant's own) before it can be cast again. */
  cooldownRemaining: number;
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
  buffs: ActiveBuff[];
  statuses: ActiveStatus[];
  skills: SkillSlot[];
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
  /** Set when this action came from a skill (drives the viewer's labels). */
  skillName?: string;
  /** True when a crit multiplied the hit. */
  crit?: boolean;
  /** What kind of log line this is; absent/'attack' = a basic strike. */
  kind?: 'attack' | 'skill' | 'buff' | 'status' | 'dot';
  /** Short badge shown for buffs/statuses (e.g. 'ATK ↑', 'Poison'). */
  effectLabel?: string;
  /**
   * Snapshot, taken at this log entry, of every skill-bearing party member's
   * cooldown progress (0 = just cast, 1 = ready). Lets the viewer animate a
   * cooldown bar under each champion's HP bar without re-deriving battle
   * timing itself. Keyed by champion id; only present in live battles.
   */
  cooldownProgress?: Record<number, number>;
  /**
   * Snapshot, taken at this log entry, of every skill-bearing party member's
   * actual remaining cooldown (in that champion's own turns; 0 = ready).
   * Same idea as cooldownProgress but the raw turn count instead of a 0-1
   * fraction, for a UI that just wants to say "N turns left". Keyed by
   * champion id; only present in live battles.
   */
  cooldownTurnsRemaining?: Record<number, number>;
  /**
   * Snapshot, taken at this log entry, of every party member's currently
   * active buff/status labels (e.g. 'ATK ↑', 'Poison') — empty array if none.
   * Same idea as cooldownProgress: lets a UI show "what's currently affecting
   * this champion" without re-deriving buff/status durations itself. Keyed by
   * champion id; only present in live battles.
   */
  partyEffects?: Record<number, string[]>;
}

export interface PartyBattleResult {
  advId: number;
  name: string;
  className: AdventurerClass;
  finalHp: number;
  maxHp: number;
  knockedOut: boolean;
  injurySeconds: number;
  enemiesDefeated: number;
  damageDealt: number;
  /** Remaining turns on this champion's skill cooldown at battle's end (0 if
   *  no skill or not a live battle) — lets a caller carry it into the next
   *  fight instead of resetting to half-charged (see dungeon.ts carryIn). */
  skillCooldownRemaining: number;
}

/** Per-champion HP/cooldown to start a battle with instead of full HP and a
 *  half-charged skill — how a dungeon run carries state from room to room
 *  (see dungeon.ts). Keyed by champion id. */
export type BattleCarryIn = Record<number, { hp: number; skillCooldownRemaining: number }>;

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

/**
 * Roll a monster group for one Explore battle: a weighted-random 1-3 count
 * (see rollMonsterCount — usually 2, independent of zone tier), each slot
 * drawn (with replacement) from that zone's monster targets. Each monster
 * then gets an independent shot at rolling as a Super variant — tripled
 * stats/rewards, a bigger sprite, and better loot odds (see SUPER_*
 * constants) — with the per-monster chance keyed by the group's size, so a
 * solo fight is the likeliest to meet one.
 */
export function rollMonsterGroup(locationId: string, rng: Rng): MonsterInstance[] {
  const loc = locationDef(locationId);
  if (!loc) return [];
  const pool = targetsForLocation(locationId).filter((t) => t.kind === 'monster');
  if (pool.length === 0) return [];
  const count = rollMonsterCount(rng);
  const superChance = SUPER_MONSTER_CHANCE[count] ?? 0;
  const group: MonsterInstance[] = [];
  for (let i = 0; i < count; i++) {
    const target = pool[Math.floor(rng() * pool.length)];
    const stats = monsterCombatStats(target, loc.tier);
    const isSuper = rng() < superChance;
    const mult = isSuper ? SUPER_STAT_MULT : 1;
    group.push({
      instanceId: i,
      targetId: target.id,
      name: isSuper ? `${SUPER_MONSTER_PREFIX} ${target.name}` : target.name,
      materialId: target.materialId,
      maxHp: stats.hp * mult,
      atk: stats.atk * mult,
      def: stats.def * mult,
      speed: stats.speed,
      xpReward: stats.xpReward * mult,
      goldReward: stats.goldReward * mult,
      isSuper,
    });
  }
  return disambiguateMonsterNames(group);
}

/** Monster names/log entries/sprites are all matched by `name`, so duplicates
 * within a group (e.g. two "Wolf"s rolled back to back) are disambiguated
 * once here with " A", " B", " C"... suffixes rather than at each call site. */
function disambiguateMonsterNames(group: MonsterInstance[]): MonsterInstance[] {
  const counts: Record<string, number> = {};
  for (const m of group) counts[m.name] = (counts[m.name] ?? 0) + 1;
  const seen: Record<string, number> = {};
  return group.map((m) => {
    if (counts[m.name] <= 1) return m;
    const idx = seen[m.name] ?? 0;
    seen[m.name] = idx + 1;
    return { ...m, name: `${m.name} ${String.fromCharCode(65 + idx)}` };
  });
}

/** Short badges shown in the viewer for buff/status log lines. */
const BUFF_LABEL: Record<BuffStat, string> = { atk: 'ATK ↑', def: 'DEF ↑', speed: 'SPD ↑' };
const STATUS_LABEL: Record<StatusKind, string> = {
  stun: 'Stun',
  poison: 'Poison',
  burn: 'Burn',
  slow: 'Slow',
};

function rollDamage(atk: number, def: number, rng: Rng): number {
  const mitigated = atk * (COMBAT_DEF_MITIGATION_K / (COMBAT_DEF_MITIGATION_K + def));
  const variance = 1 - COMBAT_DAMAGE_VARIANCE / 2 + rng() * COMBAT_DAMAGE_VARIANCE;
  return Math.max(1, Math.round(mitigated * variance));
}

/** How long a knocked-out champion needs to recover: scales with the zone's
 * tier and how badly they were overkilled, reduced by heal-speed perks and
 * the Infirmary guild upgrade. */
function injurySecondsFor(
  overkillHp: number,
  hp: number,
  tier: number,
  healSpeedMult: number,
  recoveryMult: number,
): number {
  const overkillFraction = Math.min(1, Math.max(0, overkillHp / Math.max(1, hp)));
  const fraction = INJURY_MIN_FRACTION + (1 - INJURY_MIN_FRACTION) * overkillFraction;
  return Math.round((INJURY_SECONDS_PER_TIER * tier * fraction * recoveryMult) / healSpeedMult);
}

/**
 * Simulate one battle: party vs a monster group, speed-ordered initiative,
 * single random-target attacks each turn, until one side is fully defeated
 * (or EXPLORE_MAX_TURNS is hit, in which case the party retreats as a loss).
 * Pure & deterministic given `rng` — callers decide whether/how to animate
 * `log` for playback; this function does not touch GameState.
 *
 * `live` enables the manual-Explore combat layer — champion perks (crit,
 * lifesteal) and auto-cast active skills (damage, buffs, statuses). Auto-Explore
 * / offline leaves it false so those paths stay simple: no skills, no statuses,
 * only stat perks (baked into adventurerStats) matter, and the loop reduces to
 * the plain speed-ordered trade of basic attacks it has always been.
 *
 * Skill cooldowns AND buff/status durations are turn-based, per combatant:
 * each SkillSlot's cooldown counter and each ActiveBuff/ActiveStatus's
 * turnsRemaining tick down by 1 on every one of *that combatant's own* turns
 * (whether or not they land the action — a stunned turn still counts),
 * independent of anyone else's turns — there is no shared battle clock. A
 * champion auto-casts its first ready skill on its turn, else makes a basic
 * attack. Combatants carry a *list* of skills so future multi-skill
 * champions/enemies need no structural change.
 */
export function simulateBattle(
  state: GameState,
  party: Adventurer[],
  monsters: MonsterInstance[],
  locationId: string,
  rng: Rng,
  live = false,
  carryIn?: BattleCarryIn,
): BattleOutcome {
  const loc = locationDef(locationId);
  const tier = loc?.tier ?? 1;

  // Live-combat perk effects keyed by champion id (empty unless `live`).
  const critById: Record<number, { chance: number; mult: number }> = {};
  const lifestealById: Record<number, number> = {};
  if (live) {
    for (const a of party) {
      for (const e of championPerkEffects(a)) {
        if (e.kind === 'crit') critById[a.id] = { chance: e.chance, mult: e.mult };
        else if (e.kind === 'lifesteal') lifestealById[a.id] = e.fraction;
      }
    }
  }

  const combatants: Combatant[] = [
    ...party.map((a): Combatant => {
      const stats = adventurerStats(a);
      // Champions only bring their active skill to manual Explore battles.
      const skill = live ? championSkill(a.skillId) : undefined;
      const carry = carryIn?.[a.id];
      return {
        side: 'party',
        refId: a.id,
        name: a.name,
        hp: carry?.hp ?? stats.maxHp,
        maxHp: stats.maxHp,
        atk: stats.atk,
        def: stats.def,
        speed: effectiveAttributes(a).dex,
        buffs: [],
        statuses: [],
        // Champions enter battle with their skill already half charged (in
        // terms of their own turns), not fresh off a full cooldown — unless
        // `carryIn` says otherwise (a dungeon room continuing a prior one).
        skills: skill
          ? [{ def: skill, cooldownRemaining: carry?.skillCooldownRemaining ?? Math.ceil(skill.cooldownTurns / 2) }]
          : [],
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
      buffs: [],
      statuses: [],
      skills: [],
    })),
  ];

  const alive = (side: 'party' | 'monsters') => combatants.some((c) => c.side === side && c.hp > 0);
  const livingEnemies = (c: Combatant) => combatants.filter((o) => o.side !== c.side && o.hp > 0);
  const livingAllies = (c: Combatant) => combatants.filter((o) => o.side === c.side && o.hp > 0);
  const log: BattleLogEntry[] = [];

  let turns = 0;

  // Effective stats fold in active timed buffs/statuses (all no-ops when none
  // are present, so the non-live path is byte-for-byte the old behavior).
  const buffMult = (c: Combatant, stat: BuffStat) =>
    c.buffs.reduce((m, b) => (b.stat === stat && b.turnsRemaining > 0 ? m * b.mult : m), 1);
  const atkOf = (c: Combatant) => c.atk * buffMult(c, 'atk');
  const defOf = (c: Combatant) => c.def * buffMult(c, 'def');
  const speedOf = (c: Combatant) => {
    let s = c.speed * buffMult(c, 'speed');
    for (const st of c.statuses) if (st.kind === 'slow' && st.turnsRemaining > 0) s *= st.slowFactor;
    return s;
  };
  const isStunned = (c: Combatant) =>
    c.statuses.some((st) => st.kind === 'stun' && st.turnsRemaining > 0);

  /**
   * Buff/status durations tick down once per the OWNER's own turn — called
   * exactly once at the end of each combatant's turn processing (after DoT
   * ticks and the action), decrementing only effects that were already
   * present *before* this turn's action ran (`preBuffs`/`preStatuses`).
   *
   * That distinction matters for a caster who buffs themselves (e.g. War
   * Cry's 'allies' targeting includes the caster, Hunter's Focus targets
   * 'self'): without it, a buff applied mid-turn would get decremented again
   * a moment later by this same call, silently losing its first turn of
   * benefit. Skipping freshly-applied effects means a skill with
   * `durationTurns: N` grants exactly N active turns for every target,
   * caster included — status effects on a *different* combatant (e.g.
   * poison on an enemy) are unaffected either way, since that combatant's
   * own turn (and decrement) always falls in a separate loop iteration.
   */
  function decrementTimedEffects(c: Combatant, preBuffs: ActiveBuff[], preStatuses: ActiveStatus[]) {
    const preBuffSet = new Set(preBuffs);
    const preStatusSet = new Set(preStatuses);
    c.buffs = c.buffs.filter((b) => (preBuffSet.has(b) ? --b.turnsRemaining > 0 : true));
    c.statuses = c.statuses.filter((st) => (preStatusSet.has(st) ? --st.turnsRemaining > 0 : true));
  }

  /** Cooldown progress (0 = just cast, 1 = ready) for every skill-bearing
   *  party member, as of right now — derived straight from each skill's own
   *  turn-based counter, so this reads correctly both for the initial
   *  half-charged state and for any later recast. */
  function snapshotCooldowns(): Record<number, number> {
    const out: Record<number, number> = {};
    for (const c of combatants) {
      if (c.side !== 'party') continue;
      for (const slot of c.skills) {
        const total = slot.def.cooldownTurns;
        out[c.refId] = Math.max(0, Math.min(1, (total - slot.cooldownRemaining) / total));
      }
    }
    return out;
  }

  /** Raw remaining-turns count (0 = ready) for every skill-bearing party
   *  member, as of right now — same idea as snapshotCooldowns but unrounded
   *  turns instead of a 0-1 fraction, for a "N turns left" readout. */
  function snapshotCooldownTurns(): Record<number, number> {
    const out: Record<number, number> = {};
    for (const c of combatants) {
      if (c.side !== 'party') continue;
      for (const slot of c.skills) {
        out[c.refId] = slot.cooldownRemaining;
      }
    }
    return out;
  }

  /** Every party member's currently active buff/status labels, as of right
   *  now — same snapshot-per-entry idea as snapshotCooldowns. */
  function snapshotPartyEffects(): Record<number, string[]> {
    const out: Record<number, string[]> = {};
    for (const c of combatants) {
      if (c.side !== 'party') continue;
      const labels: string[] = [];
      for (const b of c.buffs) if (b.turnsRemaining > 0) labels.push(BUFF_LABEL[b.stat]);
      for (const s of c.statuses) if (s.turnsRemaining > 0) labels.push(STATUS_LABEL[s.kind]);
      out[c.refId] = labels;
    }
    return out;
  }

  function pushLog(
    entry: Omit<BattleLogEntry, 'cooldownProgress' | 'partyEffects' | 'cooldownTurnsRemaining'>,
  ) {
    log.push({
      ...entry,
      cooldownProgress: snapshotCooldowns(),
      cooldownTurnsRemaining: snapshotCooldownTurns(),
      partyEffects: snapshotPartyEffects(),
    });
  }

  /** One hit: mitigated damage (× crit for party), lifesteal, and a log line. */
  function strike(attacker: Combatant, target: Combatant, power: number, skillName?: string) {
    let damage = rollDamage(atkOf(attacker) * power, defOf(target), rng);
    let crit = false;
    if (attacker.side === 'party') {
      const c = critById[attacker.refId];
      if (c && rng() < c.chance) {
        damage = Math.round(damage * c.mult);
        crit = true;
      }
    }
    target.hp -= damage;
    if (attacker.side === 'party') {
      const steal = lifestealById[attacker.refId];
      if (steal) attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(damage * steal));
    }
    turns++;
    pushLog({
      attackerSide: attacker.side,
      attackerName: attacker.name,
      defenderSide: target.side,
      defenderName: target.name,
      damage,
      defenderHpAfter: Math.max(0, target.hp),
      defenderMaxHp: target.maxHp,
      defenderDefeated: target.hp <= 0,
      ...(skillName ? { skillName, kind: 'skill' as const } : {}),
      ...(crit ? { crit: true } : {}),
    });
  }

  function applyDamageEffect(caster: Combatant, eff: Extract<ClassSkillEffect, { kind: 'damage' }>, skillName: string) {
    if (eff.targeting === 'single') {
      const enemies = livingEnemies(caster);
      if (enemies.length === 0) return;
      strike(caster, enemies[Math.floor(rng() * enemies.length)], eff.power, skillName);
    } else if (eff.targeting === 'aoe') {
      for (const t of livingEnemies(caster)) {
        strike(caster, t, eff.power, skillName);
        if (turns >= EXPLORE_MAX_TURNS) return;
      }
    } else {
      for (let i = 0; i < (eff.hits ?? 1); i++) {
        const enemies = livingEnemies(caster);
        if (enemies.length === 0) return;
        strike(caster, enemies[Math.floor(rng() * enemies.length)], eff.power, skillName);
        if (turns >= EXPLORE_MAX_TURNS) return;
      }
    }
  }

  function applyBuffEffect(caster: Combatant, eff: Extract<ClassSkillEffect, { kind: 'buff' }>, skillName: string) {
    const targets = eff.targeting === 'self' ? [caster] : livingAllies(caster);
    for (const t of targets) {
      t.buffs.push({ stat: eff.stat, mult: eff.mult, turnsRemaining: eff.durationTurns });
      turns++;
      pushLog({
        attackerSide: caster.side,
        attackerName: caster.name,
        defenderSide: t.side,
        defenderName: t.name,
        damage: 0,
        defenderHpAfter: Math.max(0, t.hp),
        defenderMaxHp: t.maxHp,
        defenderDefeated: false,
        kind: 'buff',
        skillName,
        effectLabel: BUFF_LABEL[eff.stat],
      });
    }
  }

  function applyStatusEffect(caster: Combatant, eff: Extract<ClassSkillEffect, { kind: 'status' }>, skillName: string) {
    const enemies = livingEnemies(caster);
    if (enemies.length === 0) return;
    const targets =
      eff.targeting === 'enemy-all' ? enemies : [enemies[Math.floor(rng() * enemies.length)]];
    const potency = eff.potency ?? 0;
    for (const t of targets) {
      t.statuses.push({
        kind: eff.status,
        turnsRemaining: eff.durationTurns,
        dmgPerRound:
          eff.status === 'poison' || eff.status === 'burn'
            ? Math.max(1, Math.round(atkOf(caster) * potency))
            : 0,
        slowFactor: eff.status === 'slow' ? potency : 1,
        sourceSide: caster.side,
        sourceName: caster.name,
      });
      turns++;
      pushLog({
        attackerSide: caster.side,
        attackerName: caster.name,
        defenderSide: t.side,
        defenderName: t.name,
        damage: 0,
        defenderHpAfter: Math.max(0, t.hp),
        defenderMaxHp: t.maxHp,
        defenderDefeated: false,
        kind: 'status',
        skillName,
        effectLabel: STATUS_LABEL[eff.status],
      });
    }
  }

  function castSkill(caster: Combatant, slot: SkillSlot) {
    slot.cooldownRemaining = slot.def.cooldownTurns;
    for (const eff of slot.def.effects) {
      if (eff.kind === 'damage') applyDamageEffect(caster, eff, slot.def.name);
      else if (eff.kind === 'buff') applyBuffEffect(caster, eff, slot.def.name);
      else applyStatusEffect(caster, eff, slot.def.name);
      if (turns >= EXPLORE_MAX_TURNS) return;
    }
  }

  /** Poison/burn tick at the start of an afflicted combatant's turn, once per
   *  turn it's active for (checked before this turn's decrementTimedEffects
   *  call, so it ticks on every one of its durationTurns, including the last). */
  function tickDots(c: Combatant) {
    for (const st of c.statuses) {
      if (st.dmgPerRound <= 0 || st.turnsRemaining <= 0) continue;
      c.hp -= st.dmgPerRound;
      turns++;
      pushLog({
        attackerSide: st.sourceSide,
        attackerName: st.sourceName,
        defenderSide: c.side,
        defenderName: c.name,
        damage: st.dmgPerRound,
        defenderHpAfter: Math.max(0, c.hp),
        defenderMaxHp: c.maxHp,
        defenderDefeated: c.hp <= 0,
        kind: 'dot',
        effectLabel: STATUS_LABEL[st.kind],
      });
      if (c.hp <= 0 || turns >= EXPLORE_MAX_TURNS) return;
    }
  }

  outer: while (turns < EXPLORE_MAX_TURNS && alive('party') && alive('monsters')) {
    const order = combatants
      .filter((c) => c.hp > 0)
      .sort((a, b) => speedOf(b) - speedOf(a) || a.refId - b.refId);
    for (const attacker of order) {
      if (attacker.hp <= 0) continue;
      if (!alive('party') || !alive('monsters')) break outer;

      // Cooldowns tick down once per this combatant's own turn — whether or
      // not they land the action — independent of anyone else's turns.
      for (const slot of attacker.skills) {
        if (slot.cooldownRemaining > 0) slot.cooldownRemaining -= 1;
      }

      // Damage-over-time first (only ever populated in live battles).
      let canAct = true;
      if (attacker.statuses.length > 0) {
        tickDots(attacker);
        if (turns >= EXPLORE_MAX_TURNS) break outer;
        if (attacker.hp <= 0) continue;
        if (!alive('party') || !alive('monsters')) break outer;
        if (isStunned(attacker)) canAct = false; // stunned: lose the action
      }

      // Snapshot before acting: the action itself may push a fresh buff/status
      // onto this same attacker (self/ally targeting) — decrementTimedEffects
      // below must not immediately consume that fresh effect's first turn.
      const preBuffs = [...attacker.buffs];
      const preStatuses = [...attacker.statuses];

      // Champions auto-cast their first ready skill; everyone else strikes.
      if (canAct) {
        const ready = attacker.skills.find((s) => s.cooldownRemaining <= 0);
        if (ready) {
          castSkill(attacker, ready);
        } else {
          const enemies = livingEnemies(attacker);
          if (enemies.length > 0) strike(attacker, enemies[Math.floor(rng() * enemies.length)], 1);
        }
      }

      // Buff/status durations consume one of THIS turn's own turns — after
      // the action, so an effect on its last active turn still applied to it.
      decrementTimedEffects(attacker, preBuffs, preStatuses);

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
      const adv = party.find((a) => a.name === c.name);
      const knockedOut = c.hp <= 0;
      return {
        advId: c.refId,
        name: c.name,
        className: adv?.className ?? 'warrior',
        finalHp: Math.max(0, c.hp),
        maxHp: c.maxHp,
        knockedOut,
        injurySeconds: knockedOut
          ? injurySecondsFor(-c.hp, c.maxHp, tier, healSpeedMult, adv ? perkRecoveryMult(adv) : 1)
          : 0,
        enemiesDefeated: partyKills[c.refId] ?? 0,
        damageDealt: partyDamage[c.refId] ?? 0,
        skillCooldownRemaining: c.skills[0]?.cooldownRemaining ?? 0,
      };
    });

  let gold = 0;
  let xp = 0;
  const materials: Record<string, number> = {};
  const equipment: Equipment[] = [];
  let timeShards = 0;
  let nextId = state.nextEntityId;
  // Explore uses boosted equipment drop chance; Super monsters drop even
  // more often (clamped to 1), in triple the amount, and roll better rarity
  // (see generateEquipment).
  if (outcome === 'win') {
    for (const m of monsters) {
      gold += m.goldReward;
      xp += m.xpReward;
      const dropMult = m.isSuper ? SUPER_DROP_CHANCE_MULT : 1;
      const lootAmount = m.isSuper ? SUPER_LOOT_AMOUNT_MULT : 1;
      if (rng() < Math.min(1, MONSTER_MATERIAL_CHANCE * dropMult)) {
        materials[m.materialId] = (materials[m.materialId] ?? 0) + lootAmount;
      }
      if (rng() < Math.min(1, EXPLORE_EQUIPMENT_CHANCE * dropMult)) {
        for (let i = 0; i < lootAmount; i++) {
          equipment.push(generateEquipment(nextId++, tier, rng, undefined, 'exalted', m.isSuper));
        }
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

  const next: GameState = {
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

  // Every battle in the game — manual Explore, Auto-Explore, dungeon rooms —
  // lands here, so this is the one place lifetime combat counters are kept.
  return addStats(next, {
    battlesWon: result.outcome === 'win' ? 1 : 0,
    battlesLost: result.outcome === 'win' ? 0 : 1,
    monstersDefeated: result.party.reduce((n, p) => n + p.enemiesDefeated, 0),
    injuries: result.party.filter((p) => p.knockedOut).length,
    itemsFound: equipCount,
    shardsFound: result.rewards.timeShards,
  });
}

/** A win from *manual* Explore (never Auto-Explore — see processAutoExplore,
 * which never calls this) counts toward that zone's dungeon unlock. Counting
 * stops once unlocked — see DungeonProgress / DUNGEON_WINS_REQUIRED. */
function recordDungeonWin(state: GameState, locationId: string): GameState {
  const dungeon = DUNGEONS.find((d) => d.locationId === locationId);
  if (!dungeon) return state;
  const progress = state.dungeonProgress[locationId] ?? { wins: 0, unlocked: false };
  if (progress.unlocked) return state;
  const wins = progress.wins + 1;
  const unlocked = wins >= DUNGEON_WINS_REQUIRED;
  const dungeonProgress = { ...state.dungeonProgress, [locationId]: { wins, unlocked } };
  if (!unlocked) return { ...state, dungeonProgress };
  const entry: LogEntry = {
    id: state.nextEntityId,
    at: state.runTimeSeconds,
    kind: 'dungeon',
    text: `${dungeon.name} has been discovered nearby.`,
  };
  return {
    ...state,
    dungeonProgress,
    nextEntityId: state.nextEntityId + 1,
    activityLog: [...state.activityLog, entry],
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
  const result = simulateBattle(state, party, monsters, locationId, rng, true);
  let next = applyBattleResult(state, result, rng);
  if (result.outcome === 'win') next = recordDungeonWin(next, locationId);
  return { state: next, result };
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
