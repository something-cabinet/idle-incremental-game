import type {
  AdventurerClass,
  GuildUpgradeDef,
  JobDef,
  LocationDef,
  MaterialDef,
  PerkDef,
  Rarity,
  Settings,
  StoryBeatDef,
} from './types';

/**
 * All balance numbers and content definitions live here. Names/descriptions
 * are placeholders until the theme pass — retheme by editing this file only.
 * Design reference: docs/game-design.md
 */

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Real seconds per in-game day. 20 min/day → deadline day 100 ≈ 33h of game time. */
export const DAY_LENGTH_SECONDS = 1200;

/** The demon king razes the hometown on this day; beat him sooner to save it. */
export const HOMETOWN_DEADLINE_DAY = 100;

/** Base offline time credited, in hours (perk can raise). */
export const OFFLINE_CAP_HOURS = 8;

export const AUTOSAVE_INTERVAL_MS = 10_000;
export const SAVE_VERSION = 3;

// ---------------------------------------------------------------------------
// Act 1 — town income (low numbers by design)
// ---------------------------------------------------------------------------

export const JOBS: JobDef[] = [
  { id: 'errands', name: 'Run Errands', description: 'Fetch, carry, repeat.', baseCost: 10, costGrowth: 1.15, baseProduction: 0.2 },
  { id: 'stall', name: 'Market Stall', description: 'Sell whatever sells.', baseCost: 60, costGrowth: 1.15, baseProduction: 1.2 },
  { id: 'garden', name: 'Herb Garden', description: 'Healers pay well.', baseCost: 400, costGrowth: 1.15, baseProduction: 7 },
  { id: 'workshop', name: 'Workshop', description: 'Tools for the town.', baseCost: 2_500, costGrowth: 1.15, baseProduction: 35 },
  { id: 'caravan', name: 'Trade Caravan', description: 'Goods to distant markets.', baseCost: 15_000, costGrowth: 1.15, baseProduction: 180 },
];

export const CLICK_BASE_GOLD = 1;

/** Founding the Guild (act 1 → 2) */
export const GUILD_FOUNDING_COST = 3_000;

// ---------------------------------------------------------------------------
// Act 2 — guild
// ---------------------------------------------------------------------------

/** Workers: flat gold/sec each; cost grows per hire. */
export const WORKER_BASE_COST = 150;
export const WORKER_COST_GROWTH = 1.2;
export const WORKER_PRODUCTION = 2;
export const WORKER_CAP = 50;

/** Adventurer hiring: cost grows with roster size. */
export const HIRE_BASE_COST = 500;
export const HIRE_COST_GROWTH = 2.2;
export const BASE_ROSTER_CAP = 2; // + guild-hall level, max 8

export const CLASS_DEFS: Record<
  AdventurerClass,
  { atk: number; def: number; atkGrowth: number; defGrowth: number }
> = {
  warrior: { atk: 8, def: 8, atkGrowth: 3, defGrowth: 3 },
  ranger: { atk: 12, def: 4, atkGrowth: 4, defGrowth: 2 },
  mage: { atk: 14, def: 2, atkGrowth: 5, defGrowth: 1 },
};

/** XP needed to go from `level` to `level+1`. */
export function xpToNext(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.5));
}

export const ADVENTURER_FIRST_NAMES = [
  'Ash', 'Bryn', 'Corin', 'Dara', 'Edda', 'Fenn', 'Garet', 'Hild',
  'Ivo', 'Jora', 'Kell', 'Lina', 'Merek', 'Nyssa', 'Orin', 'Petra',
  'Quill', 'Rook', 'Sable', 'Tamsin', 'Ulric', 'Vera', 'Wren', 'Yara',
];
export const ADVENTURER_EPITHETS = [
  'the Bold', 'of the Ford', 'Quickblade', 'the Quiet', 'Ironhand',
  'the Stray', 'Duskwalker', 'the Younger', 'Longstride', 'the Unlucky',
];

export const MATERIALS: MaterialDef[] = [
  { id: 'beast-pelt', name: 'Beast Pelt' },
  { id: 'iron-ore', name: 'Iron Ore' },
  { id: 'spirit-essence', name: 'Spirit Essence' },
  { id: 'demon-ash', name: 'Demon Ash' },
];

/**
 * Zones unlock in order: a zone opens once the previous zone's quest has been
 * cleared. Clearing the last zone's quest triggers Act 3.
 */
export const LOCATIONS: LocationDef[] = [
  {
    id: 'forest-edge', name: 'Forest Edge', kind: 'zone', tier: 1, power: 20,
    materialId: 'beast-pelt', questDuration: 600, shardChance: 0.005,
    description: 'Wolves and worse in the treeline.',
  },
  {
    id: 'old-mines', name: 'Old Mines', kind: 'zone', tier: 2, power: 60,
    materialId: 'iron-ore', questDuration: 1200, shardChance: 0.005,
    description: 'Abandoned shafts, occupied tunnels.',
  },
  {
    id: 'haunted-marsh', name: 'Haunted Marsh', kind: 'zone', tier: 3, power: 150,
    materialId: 'spirit-essence', questDuration: 1800, shardChance: 0.008,
    description: 'The dead here are restless.',
  },
  {
    id: 'frontier-pass', name: 'Frontier Pass', kind: 'zone', tier: 4, power: 300,
    materialId: 'demon-ash', questDuration: 2400, shardChance: 0.01,
    description: 'The road home. Something burned through here.',
  },
  // ---- Act 3 expedition targets ----
  {
    id: 'general-marrow', name: "General Marrow's Camp", kind: 'boss', tier: 5,
    power: 500, materialId: 'demon-ash', questDuration: 1800, shardChance: 0.02,
    bossShardReward: 15, description: 'The legion’s butcher.',
  },
  {
    id: 'general-vex', name: "General Vex's Spire", kind: 'boss', tier: 6,
    power: 750, materialId: 'demon-ash', questDuration: 1800, shardChance: 0.02,
    bossShardReward: 20, description: 'The legion’s sorcerer.',
  },
  {
    id: 'general-thane', name: "General Thane's Bastion", kind: 'boss', tier: 7,
    power: 1000, materialId: 'demon-ash', questDuration: 1800, shardChance: 0.02,
    bossShardReward: 25, description: 'The legion’s shield.',
  },
  {
    id: 'demon-king', name: 'The Demon King’s Citadel', kind: 'boss', tier: 8,
    power: 1300, materialId: 'demon-ash', questDuration: 2400, shardChance: 0.02,
    bossShardReward: 60, description: 'Where it all ends. Or begins.',
  },
];

export const GENERAL_IDS = ['general-marrow', 'general-vex', 'general-thane'];
export const DEMON_KING_ID = 'demon-king';

export const GUILD_UPGRADES: GuildUpgradeDef[] = [
  {
    id: 'guild-hall', name: 'Guild Hall', maxLevel: 6,
    description: '+1 adventurer roster slot per level.',
    baseCostGold: 1_000, costGrowth: 2.5, materials: { 'beast-pelt': 10 },
  },
  {
    id: 'infirmary', name: 'Infirmary', maxLevel: 5,
    description: 'Injured adventurers recover 20% faster per level.',
    baseCostGold: 800, costGrowth: 2.2, materials: { 'iron-ore': 8 },
  },
  {
    id: 'training-yard', name: 'Training Yard', maxLevel: 5,
    description: 'Adventurers gain +15% XP per level.',
    baseCostGold: 1_200, costGrowth: 2.2, materials: { 'beast-pelt': 5, 'iron-ore': 5 },
  },
];

// ---------------------------------------------------------------------------
// Combat / drops tuning
// ---------------------------------------------------------------------------

/** Game seconds between patrol encounters. */
export const ENCOUNTER_INTERVAL = 60;
/** Safety cap on encounters processed per adventurer per tick (offline catch-up). */
export const MAX_ENCOUNTERS_PER_TICK = 1000;

export const PATROL = {
  goldPerTier: 5,
  xpPerTier: 8,
  materialChance: 0.4,
  equipmentChance: 0.02,
  chestChance: 0.03,
  chestGoldPerTier: 100,
};

export const QUEST = {
  goldPerTier: 150,
  xpPerTier: 100,
  materialsPerTier: 5,
  shardChanceMult: 20, // quest completion shard chance = location.shardChance * this
};

/** Injury duration in game seconds per location tier (before infirmary/perks). */
export const INJURY_SECONDS_PER_TIER = 900;

/** Success chance = clamp(power/locationPower, min, max) */
export const SUCCESS_CHANCE_MIN = 0.1;
export const SUCCESS_CHANCE_MAX = 0.95;

export const RARITY_WEIGHTS: [Rarity, number][] = [
  ['common', 0.7],
  ['rare', 0.25],
  ['epic', 0.05],
];
export const RARITY_MULT: Record<Rarity, number> = { common: 1, rare: 1.6, epic: 2.5 };
export const RARITY_SELL_GOLD: Record<Rarity, number> = { common: 25, rare: 100, epic: 400 };

// ---------------------------------------------------------------------------
// Perks (Time Shard shop — persists across timelines)
// ---------------------------------------------------------------------------

export const PERKS: PerkDef[] = [
  {
    id: 'town-prosperity', name: 'Echo of Prosperity',
    description: '+10% town gold production per level.',
    maxLevel: 10, baseCost: 5, costGrowth: 1.6,
    effect: { kind: 'goldProduction', perLevel: 0.1 },
  },
  {
    id: 'strong-hands', name: 'Practiced Hands',
    description: '+25% click gold per level.',
    maxLevel: 8, baseCost: 3, costGrowth: 1.5,
    effect: { kind: 'clickPower', perLevel: 0.25 },
  },
  {
    id: 'haggler', name: 'Haggler’s Memory',
    description: 'Everything costs 2% less per level.',
    maxLevel: 10, baseCost: 8, costGrowth: 1.7,
    effect: { kind: 'costReduction', perLevel: 0.02 },
  },
  {
    id: 'veteran-instincts', name: 'Veteran Instincts',
    description: '+10% adventurer power per level.',
    maxLevel: 10, baseCost: 8, costGrowth: 1.7,
    effect: { kind: 'adventurerPower', perLevel: 0.1 },
  },
  {
    id: 'chrono-rest', name: 'Chrono Rest',
    description: 'Injuries heal 15% faster per level.',
    maxLevel: 6, baseCost: 6, costGrowth: 1.6,
    effect: { kind: 'healSpeed', perLevel: 0.15 },
    requires: ['veteran-instincts'],
  },
  {
    id: 'shard-sense', name: 'Shard Sense',
    description: '+20% time shard find chance per level.',
    maxLevel: 8, baseCost: 10, costGrowth: 1.8,
    effect: { kind: 'shardFind', perLevel: 0.2 },
  },
  {
    id: 'night-watch', name: 'Night Watch',
    description: '+2h offline progress cap per level.',
    maxLevel: 8, baseCost: 6, costGrowth: 1.6,
    effect: { kind: 'offlineCap', perLevel: 2 },
  },
];

// ---------------------------------------------------------------------------
// Story beats (placeholder prose — theme pass later)
// ---------------------------------------------------------------------------

export const STORY_BEATS: StoryBeatDef[] = [
  {
    id: 'a1-arrival', title: 'Ashes Behind You',
    text: 'You arrive with nothing but the road dust on your boots. Behind you, smoke on the horizon where home used to be. This small town doesn’t know you. Work. Earn. Survive.',
  },
  {
    id: 'a1-standing', title: 'A Name in Town',
    text: 'People nod at you in the street now. The market saves you the good stock. Coin buys standing — and standing, someday, buys power.',
  },
  {
    id: 'a2-guild-founded', title: 'The Guild',
    text: 'The town looks to you now. You sign the charter, hang the crest, and open the guild doors. Workers to build. Adventurers to fight. The wilds won’t hold you here.',
  },
  {
    id: 'a2-first-adventurer', title: 'First Blade',
    text: 'Your first adventurer signs on — half legend in their own mind, all debt in everyone else’s books. They’ll do.',
  },
  {
    id: 'a3-discovery', title: 'The Road Home',
    text: 'Past Frontier Pass, the scouts go quiet. Then the report: your hometown. Razed. The demon king’s legion did this — and their banners still fly over the ruins. You are done running.',
  },
  {
    id: 'a3-king-dead', title: 'The Chamber of the King',
    text: 'The demon king falls. It doesn’t bring anyone back. But in his chamber, a crystal hums with borrowed time — and you understand: you can go back. Further this time. Before the raid. You can save them.',
  },
  {
    id: 'ending-hometown-saved', title: 'Before the Smoke',
    text: 'The demon king dies before his legion ever marches. In this timeline, your hometown stands. You watch, from a distance, another you — laughing at a family table, unburdened, whole. It isn’t your life. It never can be. But it is enough. You find peace.',
  },
];

export const DEFAULT_SETTINGS: Settings = {
  numberFormat: 'short',
  confirmPrestige: true,
  offlineProgress: true,
  reducedMotion: false,
};
