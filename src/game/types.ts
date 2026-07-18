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
  /** Gold produced per second per unit */
  baseProduction: number;
}

// ---------------------------------------------------------------------------
// Guild: adventurers, equipment, locations (Act 2+)
// ---------------------------------------------------------------------------

export type AdventurerClass = 'warrior' | 'ranger' | 'mage';
export type EquipSlot = 'weapon' | 'armor' | 'trinket';
export type Rarity = 'common' | 'rare' | 'epic';

export interface Equipment {
  id: number;
  slot: EquipSlot;
  name: string;
  rarity: Rarity;
  atk: number;
  def: number;
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
  equipment: Partial<Record<EquipSlot, Equipment>>;
  assignment: Assignment | null;
  /** runTimeSeconds until which this adventurer is recovering; 0 = healthy */
  injuredUntil: number;
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

  // Guild
  adventurers: Adventurer[];
  inventory: Equipment[]; // unequipped items
  guildUpgrades: Record<string, number>;
  expedition: Expedition | null;
  nextEntityId: number; // shared id counter for adventurers/equipment
  locationsCleared: Record<string, boolean>; // first quest success per zone
  bossesDefeated: Record<string, boolean>; // this timeline

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
