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
  /** Share of the stat budget that goes to atk (rest goes to def) */
  atkShare: number;
  /** Multiplier on the overall stat budget */
  budgetMult: number;
  /** Attributes this type may roll as rarity bonuses */
  bonusAttrs: AttributeId[];
  /** Whether this type may roll bonus max HP */
  bonusHp?: boolean;
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
  atk: number;
  def: number;
  /** Bonus max HP */
  hp: number;
  /** Bonus attributes */
  attrs: Partial<Attributes>;
}

export type AssignmentMode = 'patrol' | 'quest' | 'expedition';

export interface Assignment {
  locationId: string;
  mode: AssignmentMode;
  /** runTimeSeconds at which a quest resolves (quests only) */
  questEndsAt?: number;
  /** runTimeSeconds of the last processed patrol encounter */
  lastEncounterAt: number;
}

export interface Adventurer {
  id: number;
  name: string;
  className: AdventurerClass;
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
  /** 'zone' = patrol/quest farming; 'boss' = expedition target (act 3) */
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

/**
 * A standing quest posted to the guild board. The numerous town adventurers
 * work it until the player deletes it. `batchSize` tunes the time/gold
 * efficiency curve. Materials/gold/reputation are granted in discrete lumps
 * when a batch finishes — see `progress` and engine.ts processQuests. The
 * displayed "/sec" rates elsewhere are a reference estimate only.
 */
export interface Quest {
  id: number;
  targetId: string;
  batchSize: number;
  /** Accumulated adventurer-seconds of work toward the current batch. */
  progress: number;
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
}

export interface Expedition {
  locationId: string;
  endsAt: number;
  memberIds: number[];
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
// Activity log (quest/patrol results shown in the Guild tab)
// ---------------------------------------------------------------------------

export type LogKind = 'quest' | 'patrol' | 'injury' | 'expedition';

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

  // Guild — the managed Mercenary roster (stats/gear/expeditions). Currently
  // DORMANT: no hiring/equipment UI and the engine no longer processes it.
  // Kept in state so the system can be developed later (see docs/game-design.md).
  adventurers: Adventurer[];
  /** 3 adventurer candidates currently shown for recruitment (empty if not yet generated) */
  recruitCandidates: Adventurer[];
  inventory: Equipment[]; // unequipped items
  guildUpgrades: Record<string, number>;
  expedition: Expedition | null;
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