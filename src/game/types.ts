/** Pure game types. No React, no DOM — keep it that way. */

/** Injectable random source so logic stays testable. */
export type Rng = () => number;

// ---------------------------------------------------------------------------
// Town (Act 1 loop, remains the economic base later)
// ---------------------------------------------------------------------------

export interface JobDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  /** Gold produced per job completion */
  baseProduction: number;
  /** Seconds per job cycle */
  jobDurationSeconds: number;
  /** Guild upgrade id that must be purchased to unlock this job (one-time) */
  requiresUpgrade?: string;
}

// ---------------------------------------------------------------------------
// Guild: adventurers, equipment, locations (Act 2+)
// ---------------------------------------------------------------------------

export type AdventurerClass = 'warrior' | 'ranger' | 'mage';
export type EquipSlot = 'weapon' | 'armor' | 'trinket';
export type Rarity = 'common' | 'rare' | 'epic' | 'exalted';

/** RPG attributes. LCK boosts material/equipment/shard find chances. */
export type AttributeId = 'str' | 'dex' | 'int' | 'con' | 'res' | 'lck';
export type Attributes = Record<AttributeId, number>;

export interface AttributeDef {
  id: AttributeId;
  name: string;
  abbr: string;
}

/**
 * Equipment subtype (sword, greatsword, bow, plate, robe, ring, ...).
 * Weapons declare a `scaling` attribute — their atk is multiplied by how
 * well the wielder's stat and class fit the weapon.
 */
export interface EquipTypeDef {
  id: string;
  slot: EquipSlot;
  /** Base name variants for generated items */
  names: string[];
  icon: string;
  /** Weapons only: the attribute this weapon's damage scales with */
  scaling?: AttributeId;
  /** Share of the non-HP stat budget that goes to atk (rest goes to def) */
  atkShare: number;
  /** Multiplier on the overall stat budget */
  budgetMult: number;
  /** Attributes this type may roll as rarity bonuses */
  bonusAttrs: AttributeId[];
  /** Share of the total stat budget diverted to bonus max HP instead of
   * atk/def (0/omitted = no bonus HP, e.g. weapons). */
  hpShare?: number;
}

/** Deterministic name prefix: same prefix always modifies stats the same way. */
export interface ItemPrefixDef {
  id: string;
  name: string;
  /** Relative roll weight */
  weight: number;
  atkMult?: number;
  defMult?: number;
  /** Bonus max HP per location tier */
  hpPerTier?: number;
  /** Attribute points granted, scaled by tier: value * (1 + floor(tier / 2)) */
  attrs?: Partial<Attributes>;
}

export interface Equipment {
  id: number;
  slot: EquipSlot;
  /** EquipTypeDef id (sword, plate, ring, ...) */
  typeId: string;
  name: string;
  rarity: Rarity;
  /** Location/craft tier this item was generated at — drives its stat
   * budget (see generateEquipment) and, on disassembly, its essence yield. */
  tier: number;
  atk: number;
  def: number;
  /** Bonus max HP */
  hp: number;
  /** Bonus attributes */
  attrs: Partial<Attributes>;
}

export type AssignmentMode = 'auto-explore' | 'quest' | 'expedition';

export interface Assignment {
  locationId: string;
  mode: AssignmentMode;
  /** runTimeSeconds at which a quest resolves (quests only) */
  questEndsAt?: number;
  /** runTimeSeconds of the last processed auto-explore encounter */
  lastEncounterAt: number;
}

// ---------------------------------------------------------------------------
// Champion passive perks
// ---------------------------------------------------------------------------

/**
 * Every champion is born with one passive perk. Two flavors:
 *  - 'minor' — a single upside (a stat nudge, faster healing, a combat quirk).
 *  - 'major' — a big benefit paired with a real drawback.
 *
 * Effects split into two camps by kind:
 *  - Stat/progression effects (attrMult, allAttrMult, hpMult, convertToStat,
 *    growthMult, xpMult, recoveryMult) fold into the champion's derived stats,
 *    so they apply *everywhere* — manual Explore, Auto-Explore and offline.
 *  - Live-combat effects (crit, lifesteal) only fire during a manual Explore
 *    battle; Auto-Explore / offline deliberately ignore them for simplicity
 *    (see combat.ts simulateBattle `live`).
 */
export type ChampionPerkEffect =
  | { kind: 'attrMult'; attr: AttributeId; mult: number }
  | { kind: 'allAttrMult'; mult: number }
  | { kind: 'hpMult'; mult: number }
  /** Move `fraction` of every OTHER attribute into `to`. */
  | { kind: 'convertToStat'; to: AttributeId; fraction: number }
  /** Scale the class's per-level attribute growth. */
  | { kind: 'growthMult'; mult: number }
  | { kind: 'xpMult'; mult: number }
  /** <1 = recovers from injury faster; >1 = slower. */
  | { kind: 'recoveryMult'; mult: number }
  /** Live combat only: `chance` to multiply a hit by `mult`. */
  | { kind: 'crit'; chance: number; mult: number }
  /** Live combat only: heal `fraction` of damage dealt. */
  | { kind: 'lifesteal'; fraction: number };

export interface ChampionPerkDef {
  id: string;
  name: string;
  tier: 'minor' | 'major';
  /** Human-readable summary shown in the champion detail view. */
  description: string;
  effects: ChampionPerkEffect[];
}

// ---------------------------------------------------------------------------
// Active combat skills
// ---------------------------------------------------------------------------

/** Ongoing debuffs a skill can inflict on enemies. */
export type StatusKind = 'stun' | 'poison' | 'burn' | 'slow';
/** Combat stats a buff can raise on allies. */
export type BuffStat = 'atk' | 'def' | 'speed';

/**
 * One effect of an active skill. A skill may bundle several (e.g. damage + a
 * status). Single-target effects are tuned stronger than their AoE equivalents.
 *
 * `durationTurns` (buff/status) counts the AFFECTED combatant's OWN turns —
 * same turn-based philosophy as ClassSkillDef.cooldownTurns (see combat.ts):
 * a value of 3 means "active for 3 of the affected combatant's own turns",
 * regardless of anyone else's turns or any shared clock.
 */
export type ClassSkillEffect =
  /** Deal `power`× the caster's attack. 'single' = one enemy, 'aoe' = every
   *  enemy, 'random' = `hits` randomly-chosen enemies. */
  | { kind: 'damage'; targeting: 'single' | 'aoe' | 'random'; power: number; hits?: number }
  /** Multiply an ally stat by `mult` for `durationTurns` ('self' or all 'allies'). */
  | { kind: 'buff'; stat: BuffStat; mult: number; targeting: 'self' | 'allies'; durationTurns: number }
  /** Inflict a status on one ('enemy-single') or every ('enemy-all') enemy.
   *  `potency` means DoT damage as a fraction of the caster's attack per turn
   *  (poison/burn) or the speed multiplier while slowed. */
  | { kind: 'status'; status: StatusKind; targeting: 'enemy-single' | 'enemy-all'; durationTurns: number; potency?: number };

/**
 * A class active skill. Every champion is generated with one skill drawn from
 * their class's pool, auto-cast in battle the moment it comes off cooldown
 * (see combat.ts). Champions can only ever hold one today, but the combat
 * engine tracks skills as a list so future champions/enemies can carry several.
 */
export interface ClassSkillDef {
  id: string;
  name: string;
  className: AdventurerClass;
  description: string;
  /**
   * Cooldown counted in the number of this champion's OWN turns (not a
   * shared battle clock) — see combat.ts's per-combatant cooldown tracking.
   */
  cooldownTurns: number;
  effects: ClassSkillEffect[];
}

export interface Adventurer {
  id: number;
  name: string;
  className: AdventurerClass;
  /** Passive perk id (see CHAMPION_PERKS); assigned at generation. */
  perkId: string;
  /** Active skill id (see CLASS_SKILLS), drawn from the class pool at generation. */
  skillId: string;
  level: number;
  xp: number;
  /**
   * Level-1 attribute values (class base + hire variance). Effective
   * attributes are derived: this + class growth * (level - 1) + gear.
   */
  attributes: Attributes;
  /** Current HP. Reaching 0 knocks the adventurer out (injury, as before). */
  hp: number;
  equipment: Partial<Record<EquipSlot, Equipment>>;
  assignment: Assignment | null;
  /** runTimeSeconds until which this adventurer is recovering; 0 = healthy */
  injuredUntil: number;
  /** Total seconds of the current injury (for recovery progress bars) */
  injuredDuration: number;
  /** The assignment the adventurer had before being injured, so they can
   *  auto-reassign to the same location/mode when they recover. */
  lastAssignment: Assignment | null;
  /** Total enemies defeated in Explore battles */
  enemiesDefeated: number;
  /** Total damage dealt in Explore battles */
  totalDamageDealt: number;
}

export interface LocationDef {
  id: string;
  name: string;
  description: string;
  tier: number;
  /** Difficulty rating fights are resolved against */
  power: number;
  /** Material dropped here */
  materialId: string;
  /** Quest length in game seconds */
  questDuration: number;
  /** Chance per encounter to find a time shard (act 3 zones are higher) */
  shardChance: number;
  /** 'zone' = auto-explore/quest farming; 'boss' = expedition target (act 3) */
  kind: 'zone' | 'boss';
  /** Shards awarded when a boss is defeated */
  bossShardReward?: number;
  /** Reputation required before this zone can be quested (zones only). */
  repRequired?: number;
}

/**
 * A quest target inside a location. Monsters carry their own loot (loot is
 * tied to the monster, not the location); gatherables are tied to the location.
 * Both are things the guild can post a bounty on.
 */
export type QuestTargetKind = 'monster' | 'gatherable';

export interface QuestTargetDef {
  id: string;
  locationId: string;
  kind: QuestTargetKind;
  name: string;
  /** Material yielded per unit killed/collected. */
  materialId: string;
  /** Per-unit difficulty multiplier (scales quest time, gold cost, reputation). */
  difficulty: number;
}

/** One target requested within a quest, and how many units of it. */
export interface QuestRequirement {
  targetId: string;
  batchSize: number;
}

/**
 * A standing quest posted to the guild board — one or more requirements
 * (e.g. "5 Gray Wolves AND 3 Forest Herbs") that must ALL be fulfilled
 * together before the batch pays out. The numerous town adventurers work it
 * until it's deleted (or, if `repeatCount` is set, until it finishes that
 * many batches and auto-removes itself). Materials/gold/reputation are
 * granted in one discrete lump when every requirement's batch finishes — see
 * `progress` and engine.ts processQuests. The displayed "/sec" rates
 * elsewhere are a reference estimate only.
 *
 * Adventurers assigned to a quest are always a whole number (never
 * fractional) — see guild.ts allocateAdventurers.
 */
export interface Quest {
  id: number;
  /** At least one requirement. */
  requirements: QuestRequirement[];
  /** Accumulated adventurer-seconds of work toward completing every
   * requirement together (see guild.ts questRequiredWork). */
  progress: number;
  /** How many times this quest completes before auto-removing itself.
   * 0 means unlimited (the default — runs until deleted). */
  repeatCount: number;
  /** How many times it has completed so far. */
  completedCount: number;
  /** Max adventurers that may work this quest at once (integer >= 1).
   * When repeatCount is set, this can never exceed it — no point assigning
   * more workers than there are repeats left to do. */
  maxAdventurers: number;
}

export interface MaterialDef {
  id: string;
  name: string;
}

export interface GuildUpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCostGold: number;
  costGrowth: number;
  /** Material cost: id -> amount at level 1 (scales with costGrowth) */
  materials: Record<string, number>;
  /** Reputation threshold required to buy (gate, not spent — like a zone's
   * repRequired). Omitted = no reputation gate. */
  repRequired?: number;
}

export interface Expedition {
  locationId: string;
  endsAt: number;
  memberIds: number[];
}

/** The Forge's single active job — one craft (of `quantity` items) at a time. */
export interface CraftJob {
  slot: EquipSlot;
  tier: number;
  quantity: number;
  /** runTimeSeconds when this job was started */
  startedAt: number;
  /** runTimeSeconds when it completes */
  endsAt: number;
}

// ---------------------------------------------------------------------------
// Town skills (gold-bought tree, resets each timeline)
// ---------------------------------------------------------------------------

export type TownSkillEffect =
  | { kind: 'flatGold'; perLevel: number } // +gold/sec, flat
  | { kind: 'jobMult'; perLevel: number } // +% job production
  | { kind: 'clickFlat'; perLevel: number } // +gold per click, flat
  | { kind: 'clickMult'; perLevel: number } // +% click gold
  | { kind: 'clickGpsPercent'; perLevel: number }; // click adds % of gold/sec

export interface TownSkillDef {
  id: string;
  name: string;
  description: string;
  /** Depth in the tree; used for layout and implied by `requires` */
  tier: number;
  /** Which visual branch column this node belongs to */
  branch: string;
  maxLevel: number;
  baseCostGold: number;
  costGrowth: number;
  /** Material cost at level 1 (scales with costGrowth); most skills omit this */
  materials?: Record<string, number>;
  /** Skill that must be owned (level ≥ 1) before this one unlocks */
  requires?: string;
  effect: TownSkillEffect;
}

/** Derived bonuses from bought town skills. */
export interface TownSkillBonuses {
  flatGold: number;
  jobMult: number;
  clickFlat: number;
  clickMult: number;
  clickGpsPercent: number;
}

// ---------------------------------------------------------------------------
// Activity log (quest/auto-explore results shown in the Guild tab)
// ---------------------------------------------------------------------------

export type LogKind = 'quest' | 'patrol' | 'injury' | 'expedition' | 'explore';

export interface LogEntry {
  id: number;
  /** runTimeSeconds when this happened */
  at: number;
  kind: LogKind;
  text: string;
}

// ---------------------------------------------------------------------------
// Perks (bought with Time Shards, persist across timelines)
// ---------------------------------------------------------------------------

export type PerkEffect =
  | { kind: 'goldProduction'; perLevel: number }
  | { kind: 'clickPower'; perLevel: number }
  | { kind: 'costReduction'; perLevel: number }
  | { kind: 'offlineCap'; perLevel: number }
  | { kind: 'adventurerPower'; perLevel: number }
  | { kind: 'healSpeed'; perLevel: number }
  | { kind: 'shardFind'; perLevel: number };

export interface PerkDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  effect: PerkEffect;
  requires?: string[];
}

/** Derived multipliers computed from owned perks. */
export interface Modifiers {
  productionMult: number;
  clickMult: number;
  costMult: number;
  offlineCapHours: number;
  powerMult: number;
  healSpeedMult: number;
  shardFindMult: number;
}

// ---------------------------------------------------------------------------
// Story / acts
// ---------------------------------------------------------------------------

export interface StoryBeatDef {
  id: string;
  title: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Settings & state
// ---------------------------------------------------------------------------

export type NumberFormat = 'short' | 'scientific';

export interface Settings {
  numberFormat: NumberFormat;
  confirmPrestige: boolean;
  offlineProgress: boolean;
  reducedMotion: boolean;
  sfxEnabled: boolean;
  /** Debug: simulation speed multiplier applied to live ticks (1 = normal) */
  gameSpeed: number;
}

export interface GameState {
  act: 1 | 2 | 3;

  // Economy
  gold: number;
  totalGoldEarned: number; // this timeline
  lifetimeGoldEarned: number; // across all timelines
  clickPower: number;
  jobs: Record<string, number>;
  workers: number;
  materials: Record<string, number>;
  townSkills: Record<string, number>;

  // Guild reputation: earned by completing posted quests. Grows the numerous
  // town-adventurer pool (see adventurerCount) and gates zone unlocks.
  reputation: number;
  /** Standing quests posted to the guild board. */
  quests: Quest[];

  // Guild — the managed Champion roster (stats/gear/expeditions). Recruiting
  // and the equip-slot UI are live; assignment/expedition play is still
  // DORMANT — the engine does not process this roster, so `inventory` has no
  // drop source yet (see docs/game-design.md).
  adventurers: Adventurer[];
  /** 3 champion candidates currently shown for recruitment (empty if not yet generated) */
  recruitCandidates: Adventurer[];
  inventory: Equipment[]; // unequipped items
  guildUpgrades: Record<string, number>;
  expedition: Expedition | null;
  /** The Forge's single active craft job, if any (see guild.ts craft*). */
  crafting: CraftJob | null;
  nextEntityId: number; // shared id counter for adventurers/equipment
  locationsCleared: Record<string, boolean>; // first quest success per zone
  bossesDefeated: Record<string, boolean>; // this timeline
  activityLog: LogEntry[]; // newest last, capped at ACTIVITY_LOG_MAX

  // Story
  storyFlags: Record<string, boolean>; // beats already seen/dismissed
  pendingStories: string[]; // beats triggered, awaiting display

  // Time
  /** Game seconds elapsed this timeline (played + credited offline) */
  runTimeSeconds: number;

  // Prestige
  timeShards: number;
  prestigeCount: number; // timelines traveled
  perks: Record<string, number>;
  hometownSaved: boolean;

  settings: Settings;
  /** unix ms of last tick, used for offline progress */
  lastUpdate: number;
}

export interface SaveData {
  version: number;
  state: GameState;
}