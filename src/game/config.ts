import type {
  AdventurerClass,
  AttributeDef,
  AttributeId,
  Attributes,
  ChampionPerkDef,
  ClassSkillDef,
  EquipTypeDef,
  GuildUpgradeDef,
  ItemPrefixDef,
  JobDef,
  LocationDef,
  MaterialDef,
  PerkDef,
  QuestTargetDef,
  Rarity,
  Settings,
  StoryBeatDef,
  TownSkillDef,
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
/**
 * If wall-clock time drifts this far ahead of the last processed tick, treat
 * it as "the tab was backgrounded/suspended" and route the gap through
 * applyOfflineProgress (capped, respects the offline-progress setting)
 * instead of the live loop's small per-tick clamp. Mobile browsers routinely
 * throttle or fully pause background tabs, so this can't rely on the
 * interval firing on schedule — see useGameLoop's visibility listeners.
 */
export const BACKGROUND_CATCHUP_GAP_MS = 3_000;
export const SAVE_VERSION = 15;

// ---------------------------------------------------------------------------
// Act 1 — town income (low numbers by design)
// ---------------------------------------------------------------------------

export const JOBS: JobDef[] = [
  { id: 'errands', name: 'Run Errands', description: 'Fetch, carry, repeat.', baseCost: 5, costGrowth: 1.15, baseProduction: 0.35, jobDurationSeconds: 1 },
  { id: 'stall', name: 'Market Stall', description: 'Sell whatever sells.', baseCost: 25, costGrowth: 1.15, baseProduction: 6, jobDurationSeconds: 3 },
  { id: 'garden', name: 'Herb Garden', description: 'Healers pay well.', baseCost: 150, costGrowth: 1.15, baseProduction: 66, jobDurationSeconds: 6 },
  { id: 'workshop', name: 'Workshop', description: 'Tools for the town.', baseCost: 900, costGrowth: 1.15, baseProduction: 550, jobDurationSeconds: 10 },
  { id: 'caravan', name: 'Trade Caravan', description: 'Goods to distant markets.', baseCost: 15_000, costGrowth: 1.15, baseProduction: 2_700, jobDurationSeconds: 15, requiresUpgrade: 'unlock-caravan' },
  { id: 'bank', name: 'Money Lender', description: 'Coin breeds coin.', baseCost: 90_000, costGrowth: 1.15, baseProduction: 22_500, jobDurationSeconds: 25, requiresUpgrade: 'unlock-bank' },
  { id: 'trade-guild', name: 'Trading Company', description: 'Ships on every horizon.', baseCost: 550_000, costGrowth: 1.15, baseProduction: 180_000, jobDurationSeconds: 40, requiresUpgrade: 'unlock-trade-guild' },
];

export const CLICK_BASE_GOLD = 1;

/** Founding the Guild (act 1 → 2) */
export const GUILD_FOUNDING_COST = 3_000;

/**
 * Town skill tree (Town tab → Skills). Two branches; each node needs the one
 * above it. Cost scales with depth via baseCostGold. Resets on time travel.
 */
export const TOWN_SKILLS: TownSkillDef[] = [
  // ---- Industry branch: job production ----
  {
    id: 'work-ethic', name: 'Work Ethic', tier: 1, branch: 'industry',
    description: '+0.5 gold/sec per level.',
    maxLevel: 10, baseCostGold: 50, costGrowth: 1.35,
    effect: { kind: 'flatGold', perLevel: 0.5 },
  },
  {
    id: 'guild-ledgers', name: 'Guild Ledgers', tier: 2, branch: 'industry',
    description: '+10% job production per level.',
    maxLevel: 10, baseCostGold: 600, costGrowth: 1.5, requires: 'work-ethic',
    effect: { kind: 'jobMult', perLevel: 0.1 },
  },
  {
    id: 'trade-contracts', name: 'Trade Contracts', tier: 3, branch: 'industry',
    description: '+25% job production per level.',
    maxLevel: 5, baseCostGold: 12_000, costGrowth: 2, requires: 'guild-ledgers',
    materials: { 'beast-pelt': 5 },
    effect: { kind: 'jobMult', perLevel: 0.25 },
  },
  {
    id: 'town-charter', name: 'Town Charter', tier: 4, branch: 'industry',
    description: 'Doubles job production.',
    maxLevel: 1, baseCostGold: 250_000, costGrowth: 1, requires: 'trade-contracts',
    materials: { 'iron-ore': 25 },
    effect: { kind: 'jobMult', perLevel: 1 },
  },
  // ---- Hustle branch: clicking ----
  {
    id: 'calloused-hands', name: 'Calloused Hands', tier: 1, branch: 'hustle',
    description: '+1 gold per click per level.',
    maxLevel: 10, baseCostGold: 25, costGrowth: 1.4,
    effect: { kind: 'clickFlat', perLevel: 1 },
  },
  {
    id: 'market-instinct', name: 'Market Instinct', tier: 2, branch: 'hustle',
    description: '+25% click gold per level.',
    maxLevel: 10, baseCostGold: 400, costGrowth: 1.5, requires: 'calloused-hands',
    effect: { kind: 'clickMult', perLevel: 0.25 },
  },
  {
    id: 'silver-tongue', name: 'Silver Tongue', tier: 3, branch: 'hustle',
    description: 'Clicks also earn +2% of your gold/sec per level.',
    maxLevel: 10, baseCostGold: 6_000, costGrowth: 1.8, requires: 'market-instinct',
    effect: { kind: 'clickGpsPercent', perLevel: 0.02 },
  },
  {
    id: 'golden-touch', name: 'Golden Touch', tier: 4, branch: 'hustle',
    description: 'Clicks earn an extra +25% of your gold/sec.',
    maxLevel: 1, baseCostGold: 200_000, costGrowth: 1, requires: 'silver-tongue',
    materials: { 'spirit-essence': 10 },
    effect: { kind: 'clickGpsPercent', perLevel: 0.25 },
  },
];

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

/** Rerolling recruit candidates: cost grows with current adventurer count. */
export const REROLL_BASE_COST = 100;
export const REROLL_COST_GROWTH = 2.2;

// ---------------------------------------------------------------------------
// Attributes & classes
// ---------------------------------------------------------------------------

export const ATTRIBUTES: AttributeDef[] = [
  { id: 'str', name: 'Strength', abbr: 'STR' },
  { id: 'dex', name: 'Dexterity', abbr: 'DEX' },
  { id: 'int', name: 'Intellect', abbr: 'INT' },
  { id: 'con', name: 'Constitution', abbr: 'CON' },
  { id: 'res', name: 'Resilience', abbr: 'RES' },
  { id: 'lck', name: 'Luck', abbr: 'LCK' },
];

export const CLASS_DEFS: Record<
  AdventurerClass,
  {
    /** Governing offense attribute (drives base attack) */
    primary: AttributeId;
    /** Attribute values at level 1 (hire variance applied on top) */
    base: Attributes;
    /** Attribute gain per level */
    growth: Attributes;
    /** Damage multiplier per weapon type — off-class weapons are weak */
    weaponProficiency: Record<string, number>;
  }
> = {
  warrior: {
    primary: 'str',
    base: { str: 8, dex: 4, int: 2, con: 8, res: 6, lck: 3 },
    growth: { str: 2.2, dex: 0.8, int: 0.3, con: 1.8, res: 1.2, lck: 0.4 },
    weaponProficiency: {
      sword: 1.1, greatsword: 1.2, axe: 1.1, mace: 1.1, dagger: 0.8,
      bow: 0.5, crossbow: 0.5, wand: 0.35, staff: 0.35,
    },
  },
  ranger: {
    primary: 'dex',
    base: { str: 4, dex: 9, int: 3, con: 6, res: 4, lck: 5 },
    growth: { str: 0.7, dex: 2.4, int: 0.5, con: 1.2, res: 0.8, lck: 0.9 },
    weaponProficiency: {
      sword: 0.9, greatsword: 0.5, axe: 0.7, mace: 0.6, dagger: 1.1,
      bow: 1.2, crossbow: 1.15, wand: 0.6, staff: 0.5,
    },
  },
  mage: {
    primary: 'int',
    base: { str: 2, dex: 4, int: 10, con: 4, res: 6, lck: 4 },
    growth: { str: 0.3, dex: 0.7, int: 2.6, con: 0.8, res: 1.5, lck: 0.6 },
    weaponProficiency: {
      sword: 0.5, greatsword: 0.35, axe: 0.4, mace: 0.5, dagger: 0.7,
      bow: 0.4, crossbow: 0.45, wand: 1.15, staff: 1.2,
    },
  },
};

/**
 * Champion passive perks — every generated champion rolls exactly one, uniformly
 * (see generateAdventurer). Ordering matters for the deterministic tests that
 * generate champions with a constant rng of 0.5: `pick` lands on index
 * floor(0.5 * length) = 12, which must stay a combat-neutral perk (Fortunate).
 * See ChampionPerkDef for how effects apply to stats vs. live combat.
 */
export const CHAMPION_PERKS: ChampionPerkDef[] = [
  // ---- Minor: a single upside (indices 0-12) ----
  {
    id: 'keen-eye', name: 'Keen Eye', tier: 'minor',
    description: '25% chance to land a critical hit for 1.6× damage (Explore only).',
    effects: [{ kind: 'crit', chance: 0.25, mult: 1.6 }],
  },
  {
    id: 'bloodthirsty', name: 'Bloodthirsty', tier: 'minor',
    description: 'Heals for 12% of the damage it deals (Explore only).',
    effects: [{ kind: 'lifesteal', fraction: 0.12 }],
  },
  {
    id: 'fleet-footed', name: 'Fleet-Footed', tier: 'minor',
    description: '+12% Dexterity.',
    effects: [{ kind: 'attrMult', attr: 'dex', mult: 1.12 }],
  },
  {
    id: 'brawny', name: 'Brawny', tier: 'minor',
    description: '+12% Strength.',
    effects: [{ kind: 'attrMult', attr: 'str', mult: 1.12 }],
  },
  {
    id: 'sharp-mind', name: 'Sharp Mind', tier: 'minor',
    description: '+12% Intellect.',
    effects: [{ kind: 'attrMult', attr: 'int', mult: 1.12 }],
  },
  {
    id: 'hardy', name: 'Hardy', tier: 'minor',
    description: '+12% Constitution.',
    effects: [{ kind: 'attrMult', attr: 'con', mult: 1.12 }],
  },
  {
    id: 'stalwart', name: 'Stalwart', tier: 'minor',
    description: '+15% Resilience.',
    effects: [{ kind: 'attrMult', attr: 'res', mult: 1.15 }],
  },
  {
    id: 'iron-skin', name: 'Iron Skin', tier: 'minor',
    description: '+12% max HP.',
    effects: [{ kind: 'hpMult', mult: 1.12 }],
  },
  {
    id: 'quick-healer', name: 'Quick Healer', tier: 'minor',
    description: 'Recovers from injuries 30% faster.',
    effects: [{ kind: 'recoveryMult', mult: 0.7 }],
  },
  {
    id: 'fast-learner', name: 'Fast Learner', tier: 'minor',
    description: '+25% experience gained.',
    effects: [{ kind: 'xpMult', mult: 1.25 }],
  },
  {
    id: 'well-rounded', name: 'Well-Rounded', tier: 'minor',
    description: '+5% to every attribute.',
    effects: [{ kind: 'allAttrMult', mult: 1.05 }],
  },
  {
    id: 'battle-ready', name: 'Battle-Ready', tier: 'minor',
    description: '+8% Strength and +8% Dexterity.',
    effects: [
      { kind: 'attrMult', attr: 'str', mult: 1.08 },
      { kind: 'attrMult', attr: 'dex', mult: 1.08 },
    ],
  },
  {
    // Index 12 — kept combat-neutral for the constant-rng(0.5) tests.
    id: 'fortunate', name: 'Fortunate', tier: 'minor',
    description: '+20% Luck.',
    effects: [{ kind: 'attrMult', attr: 'lck', mult: 1.2 }],
  },
  // ---- Major: a big benefit paired with a real drawback (indices 13+) ----
  {
    id: 'titans-blood', name: "Titan's Blood", tier: 'major',
    description: 'Double max HP, but Dexterity is halved.',
    effects: [
      { kind: 'hpMult', mult: 2 },
      { kind: 'attrMult', attr: 'dex', mult: 0.5 },
    ],
  },
  {
    id: 'glass-cannon', name: 'Glass Cannon', tier: 'major',
    description: '+50% Strength, Dexterity & Intellect, but max HP is halved.',
    effects: [
      { kind: 'attrMult', attr: 'str', mult: 1.5 },
      { kind: 'attrMult', attr: 'dex', mult: 1.5 },
      { kind: 'attrMult', attr: 'int', mult: 1.5 },
      { kind: 'hpMult', mult: 0.5 },
    ],
  },
  {
    id: 'late-bloomer', name: 'Late Bloomer', tier: 'major',
    description: '+45% attribute growth per level, but gains XP 40% slower.',
    effects: [
      { kind: 'growthMult', mult: 1.45 },
      { kind: 'xpMult', mult: 0.6 },
    ],
  },
  {
    id: 'prodigy', name: 'Prodigy', tier: 'major',
    description: '+60% experience gained, but −15% to every attribute.',
    effects: [
      { kind: 'xpMult', mult: 1.6 },
      { kind: 'allAttrMult', mult: 0.85 },
    ],
  },
  {
    id: 'berserker', name: 'Berserker', tier: 'major',
    description: 'Converts 25% of every other attribute into Strength.',
    effects: [{ kind: 'convertToStat', to: 'str', fraction: 0.25 }],
  },
  {
    id: 'arcanist', name: 'Arcanist', tier: 'major',
    description: 'Converts 25% of every other attribute into Intellect.',
    effects: [{ kind: 'convertToStat', to: 'int', fraction: 0.25 }],
  },
  {
    id: 'duelist', name: 'Duelist', tier: 'major',
    description: 'Converts 25% of every other attribute into Dexterity.',
    effects: [{ kind: 'convertToStat', to: 'dex', fraction: 0.25 }],
  },
  {
    id: 'juggernaut', name: 'Juggernaut', tier: 'major',
    description: '+60% Constitution and +25% max HP, but −40% Dexterity.',
    effects: [
      { kind: 'attrMult', attr: 'con', mult: 1.6 },
      { kind: 'hpMult', mult: 1.25 },
      { kind: 'attrMult', attr: 'dex', mult: 0.6 },
    ],
  },
  {
    id: 'colossus', name: 'Colossus', tier: 'major',
    description: 'Double Constitution, but −30% Strength, Dexterity & Intellect.',
    effects: [
      { kind: 'attrMult', attr: 'con', mult: 2 },
      { kind: 'attrMult', attr: 'str', mult: 0.7 },
      { kind: 'attrMult', attr: 'dex', mult: 0.7 },
      { kind: 'attrMult', attr: 'int', mult: 0.7 },
    ],
  },
  {
    id: 'feral', name: 'Feral', tier: 'major',
    description: '+30% to every attribute, but recovers from injuries twice as slowly.',
    effects: [
      { kind: 'allAttrMult', mult: 1.3 },
      { kind: 'recoveryMult', mult: 2 },
    ],
  },
  {
    id: 'gambler', name: 'Gambler', tier: 'major',
    description: '+150% Luck, but −25% Constitution & Resilience.',
    effects: [
      { kind: 'attrMult', attr: 'lck', mult: 2.5 },
      { kind: 'attrMult', attr: 'con', mult: 0.75 },
      { kind: 'attrMult', attr: 'res', mult: 0.75 },
    ],
  },
];

/**
 * Class active skills — every champion rolls one from their class's pool at
 * generation (see generateAdventurer). Auto-cast in manual Explore battles the
 * moment they come off cooldown; Auto-Explore/offline skip skills entirely for
 * simplicity (see combat.ts). Single-target effects are tuned stronger than
 * their AoE siblings.
 */
export const CLASS_SKILLS: ClassSkillDef[] = [
  // ---- Warrior: melee bruiser, buffs & control ----
  {
    id: 'heavy-strike', name: 'Heavy Strike', className: 'warrior', cooldownSeconds: 5,
    description: 'A crushing blow dealing 220% attack to one enemy.',
    effects: [{ kind: 'damage', targeting: 'single', power: 2.2 }],
  },
  {
    id: 'cleave', name: 'Cleave', className: 'warrior', cooldownSeconds: 6,
    description: 'Sweep every enemy for 70% attack.',
    effects: [{ kind: 'damage', targeting: 'aoe', power: 0.7 }],
  },
  {
    id: 'shield-bash', name: 'Shield Bash', className: 'warrior', cooldownSeconds: 8,
    description: '120% attack to one enemy and stuns it for 3s.',
    effects: [
      { kind: 'damage', targeting: 'single', power: 1.2 },
      { kind: 'status', status: 'stun', targeting: 'enemy-single', durationSeconds: 3 },
    ],
  },
  {
    id: 'war-cry', name: 'War Cry', className: 'warrior', cooldownSeconds: 14,
    description: 'Rally the party: +30% attack to all champions for 12s.',
    effects: [{ kind: 'buff', stat: 'atk', mult: 1.3, targeting: 'allies', durationSeconds: 12 }],
  },
  {
    id: 'shield-wall', name: 'Shield Wall', className: 'warrior', cooldownSeconds: 14,
    description: 'Brace the line: +50% defense to all champions for 12s.',
    effects: [{ kind: 'buff', stat: 'def', mult: 1.5, targeting: 'allies', durationSeconds: 12 }],
  },
  // ---- Ranger: precise single-target, poison & mobility ----
  {
    id: 'power-shot', name: 'Power Shot', className: 'ranger', cooldownSeconds: 5,
    description: 'A piercing arrow dealing 210% attack to one enemy.',
    effects: [{ kind: 'damage', targeting: 'single', power: 2.1 }],
  },
  {
    id: 'volley', name: 'Volley', className: 'ranger', cooldownSeconds: 7,
    description: 'Rain arrows on every enemy for 75% attack.',
    effects: [{ kind: 'damage', targeting: 'aoe', power: 0.75 }],
  },
  {
    id: 'serpent-sting', name: 'Serpent Sting', className: 'ranger', cooldownSeconds: 7,
    description: '100% attack to one enemy, then poisons it for 8s.',
    effects: [
      { kind: 'damage', targeting: 'single', power: 1 },
      { kind: 'status', status: 'poison', targeting: 'enemy-single', durationSeconds: 8, potency: 0.4 },
    ],
  },
  {
    id: 'crippling-shot', name: 'Crippling Shot', className: 'ranger', cooldownSeconds: 8,
    description: '110% attack to one enemy and slows it (−50% speed) for 6s.',
    effects: [
      { kind: 'damage', targeting: 'single', power: 1.1 },
      { kind: 'status', status: 'slow', targeting: 'enemy-single', durationSeconds: 6, potency: 0.5 },
    ],
  },
  {
    id: 'hunters-focus', name: "Hunter's Focus", className: 'ranger', cooldownSeconds: 13,
    description: 'Take aim: +40% attack and +30% speed to self for 10s.',
    effects: [
      { kind: 'buff', stat: 'atk', mult: 1.4, targeting: 'self', durationSeconds: 10 },
      { kind: 'buff', stat: 'speed', mult: 1.3, targeting: 'self', durationSeconds: 10 },
    ],
  },
  // ---- Mage: area damage & elemental status ----
  {
    id: 'arcane-bolt', name: 'Arcane Bolt', className: 'mage', cooldownSeconds: 5,
    description: 'A focused blast dealing 230% attack to one enemy.',
    effects: [{ kind: 'damage', targeting: 'single', power: 2.3 }],
  },
  {
    id: 'fireball', name: 'Fireball', className: 'mage', cooldownSeconds: 8,
    description: '80% attack to every enemy and burns them for 6s.',
    effects: [
      { kind: 'damage', targeting: 'aoe', power: 0.8 },
      { kind: 'status', status: 'burn', targeting: 'enemy-all', durationSeconds: 6, potency: 0.35 },
    ],
  },
  {
    id: 'frost-nova', name: 'Frost Nova', className: 'mage', cooldownSeconds: 9,
    description: '50% attack to every enemy and slows them (−50% speed) for 6s.',
    effects: [
      { kind: 'damage', targeting: 'aoe', power: 0.5 },
      { kind: 'status', status: 'slow', targeting: 'enemy-all', durationSeconds: 6, potency: 0.5 },
    ],
  },
  {
    id: 'chain-lightning', name: 'Chain Lightning', className: 'mage', cooldownSeconds: 7,
    description: 'Arcs to 3 random enemies for 110% attack each.',
    effects: [{ kind: 'damage', targeting: 'random', power: 1.1, hits: 3 }],
  },
  {
    id: 'mana-shield', name: 'Mana Shield', className: 'mage', cooldownSeconds: 13,
    description: 'Ward the party: +40% defense to all champions for 12s.',
    effects: [{ kind: 'buff', stat: 'def', mult: 1.4, targeting: 'allies', durationSeconds: 12 }],
  },
];

/** Battle-seconds that elapse each combat round — maps skill cooldowns (kept in
 *  seconds for design clarity) onto the round-based Explore combat loop. */
export const BATTLE_SECONDS_PER_ROUND = 2;

/** Hire-time variance: each attribute rolls base ± this. */
export const HIRE_ATTR_VARIANCE = 1;

// ---- HP / damage / regen ----

export const HP_BASE = 20;
export const HP_PER_CON = 5;
/** Base attack contributed per point of the class's primary attribute. */
export const ATK_PER_PRIMARY = 2;
/** Defense contributed per point of CON and RES. */
export const DEF_PER_CON = 0.7;
export const DEF_PER_RES = 0.7;
/**
 * Weapon damage scaling from its governing attribute:
 * mult = WEAPON_SCALE_BASE + stat / WEAPON_SCALE_DIV, capped.
 */
export const WEAPON_SCALE_BASE = 0.4;
export const WEAPON_SCALE_DIV = 50;
export const WEAPON_SCALE_MAX = 2.5;

/** Raw damage taken per location tier on a failed patrol encounter. */
export const DAMAGE_PER_TIER = 12;
/** A failed quest hits harder than a patrol scuffle. */
export const QUEST_DAMAGE_MULT = 2.5;
/** RES mitigation: damage * K / (K + res). */
export const RES_MITIGATION_K = 40;

/** Passive HP regen per second, as a fraction of max HP. */
export const REGEN_FRACTION_ACTIVE = 0.004; // while assigned
export const REGEN_FRACTION_IDLE = 0.012; // resting at the guild hall
/** Infirmary: +this much regen/recovery speed per level (also speeds injuries). */
export const INFIRMARY_HEAL_BONUS = 0.2;

/** LCK: +this much find chance (materials/equipment/shards) per point. */
export const LCK_FIND_PER_POINT = 0.01;

/** XP needed to go from `level` to `level+1`. */
export function xpToNext(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.5));
}

/**
 * XP rewards grow geometrically per location tier (unlike gold, which stays
 * linear — see docs/game-design.md discussion on gold's town/guild balance).
 * This keeps pushing into harder zones meaningfully more rewarding than
 * farming an old, safe one at capped success chance.
 */
export const XP_TIER_RATIO = 1.6;
export function tierXp(perTier: number, tier: number): number {
  return perTier * Math.pow(XP_TIER_RATIO, tier - 1);
}

export const ADVENTURER_FIRST_NAMES = [
  'Ash', 'Bryn', 'Corin', 'Dara', 'Edda', 'Fenn', 'Garet', 'Hild',
  'Ivo', 'Jora', 'Kell', 'Lina', 'Merek', 'Nyssa', 'Orin', 'Petra',
  'Quill', 'Rook', 'Sable', 'Tamsin', 'Ulric', 'Vera', 'Wren', 'Yara',
  'Alden', 'Brynja', 'Cass', 'Doran', 'Elin', 'Finch', 'Gwen', 'Harlan',
  'Isolde', 'Joric', 'Kessa', 'Leif', 'Maren', 'Nolan', 'Oswin', 'Perrin',
  'Quenna', 'Ren', 'Sylas', 'Tova', 'Umber', 'Vidar', 'Wyn', 'Yorick',
  'Ainsley', 'Bracken', 'Cyrus', 'Delwyn', 'Ember', 'Faye', 'Gideon', 'Hess',
  'Ilsa', 'Jax', 'Korrin', 'Liora', 'Mabel', 'Niall', 'Osric', 'Pryda',
];
export const ADVENTURER_SURNAMES = [
  'Ashford', 'Blackwood', 'Cindervale', 'Dunmore', 'Emberlyn', 'Fairwind',
  'Graystone', 'Hollowmere', 'Ironvale', 'Larkspur', 'Marrow', 'Nightshade',
  'Oakhaven', 'Proudfoot', 'Ravensworth', 'Stormcrow', 'Thistlewood', 'Underhill',
  'Vaneshire', 'Whitlock', 'Yewbranch', 'Amberfell', 'Brightwater', 'Coldharbor',
  'Drakemoor', 'Elmsworth', 'Foxglove', 'Greywick', 'Hartley', 'Ivywood',
  'Kestrel', 'Ledger', 'Moonwhisper', 'Northgate', 'Pemberton', 'Quarrow',
  'Redfern', 'Silverpine', 'Thornbury', 'Vale',
];
export const ADVENTURER_EPITHETS = [
  'the Bold', 'of the Ford', 'Quickblade', 'the Quiet', 'Ironhand',
  'the Stray', 'Duskwalker', 'the Younger', 'Longstride', 'the Unlucky',
  'the Grim', 'Stonefist', 'the Wanderer', 'Nightblade', 'the Merciful',
  'Farsight', 'the Reckless', 'Ashenblood', 'the Steadfast', 'Wolfsbane',
  'the Cunning', 'Ravenshadow', 'the Lucky', 'Stormrider', 'the Weary',
  'Goldtooth', 'the Silent', 'Doomhollow', 'the Fair', 'Grimjaw',
];

export const MATERIALS: MaterialDef[] = [
  { id: 'beast-pelt', name: 'Beast Pelt' },
  { id: 'iron-ore', name: 'Iron Ore' },
  { id: 'spirit-essence', name: 'Spirit Essence' },
  { id: 'demon-ash', name: 'Demon Ash' },
  { id: 'raw-meat', name: 'Raw Meat' },
  { id: 'herbs', name: 'Wild Herbs' },
  { id: 'timber', name: 'Timber' },
  { id: 'silk', name: 'Spider Silk' },
  { id: 'crystal', name: 'Crystal Shard' },
  // ---- Disassembly byproducts (see guild.ts disassembleItem) ----
  { id: 'common-essence', name: 'Common Essence' },
  { id: 'rare-essence', name: 'Rare Essence' },
  { id: 'epic-essence', name: 'Epic Essence' },
  { id: 'exalted-essence', name: 'Exalted Essence' },
];

/**
 * Zones unlock in order: a zone opens once the previous zone's quest has been
 * cleared. Clearing the last zone's quest triggers Act 3.
 *
 * Power curve: tiers 1-6 grow ~1.75x per tier (vs the old ~1.6x), and boss
 * tiers 7-10 grow ~1.6x with a steeper final jump for the demon king. This
 * is tuned so a naked, average-attribute adventurer's raw stat growth alone
 * (~6.5 power/level) no longer outpaces zone difficulty — reaching a zone's
 * ~95% success cap now takes both a meaningfully higher level *and* gear on
 * top, instead of leveling alone trivializing every zone.
 */
export const LOCATIONS: LocationDef[] = [
  {
    id: 'forest-edge', name: 'Forest Edge', kind: 'zone', tier: 1, power: 20,
    materialId: 'beast-pelt', questDuration: 60, shardChance: 0.005, repRequired: 0,
    description: 'Wolves and worse in the treeline.',
  },
  {
    id: 'river-crossing', name: 'River Crossing', kind: 'zone', tier: 2, power: 35,
    materialId: 'beast-pelt', questDuration: 180, shardChance: 0.005, repRequired: 25,
    description: 'Bandits favor the ford.',
  },
  {
    id: 'old-mines', name: 'Old Mines', kind: 'zone', tier: 3, power: 61,
    materialId: 'iron-ore', questDuration: 300, shardChance: 0.006, repRequired: 90,
    description: 'Abandoned shafts, occupied tunnels.',
  },
  {
    id: 'haunted-marsh', name: 'Haunted Marsh', kind: 'zone', tier: 4, power: 107,
    materialId: 'spirit-essence', questDuration: 480, shardChance: 0.008, repRequired: 250,
    description: 'The dead here are restless.',
  },
  {
    id: 'sunken-ruins', name: 'Sunken Ruins', kind: 'zone', tier: 5, power: 187,
    materialId: 'spirit-essence', questDuration: 660, shardChance: 0.009, repRequired: 650,
    description: 'Something ancient still guards the depths.',
  },
  {
    id: 'frontier-pass', name: 'Frontier Pass', kind: 'zone', tier: 6, power: 328,
    materialId: 'demon-ash', questDuration: 900, shardChance: 0.01, repRequired: 1600,
    description: 'The road home. Something burned through here.',
  },
  // ---- Act 3 expedition targets ----
  {
    id: 'general-marrow', name: "General Marrow's Camp", kind: 'boss', tier: 7,
    power: 500, materialId: 'demon-ash', questDuration: 600, shardChance: 0.02,
    bossShardReward: 15, description: 'The legion’s butcher.',
  },
  {
    id: 'general-vex', name: "General Vex's Spire", kind: 'boss', tier: 8,
    power: 800, materialId: 'demon-ash', questDuration: 720, shardChance: 0.02,
    bossShardReward: 20, description: 'The legion’s sorcerer.',
  },
  {
    id: 'general-thane', name: "General Thane's Bastion", kind: 'boss', tier: 9,
    power: 1_280, materialId: 'demon-ash', questDuration: 840, shardChance: 0.02,
    bossShardReward: 25, description: 'The legion’s shield.',
  },
  {
    id: 'demon-king', name: 'The Demon King’s Citadel', kind: 'boss', tier: 10,
    power: 2_240, materialId: 'demon-ash', questDuration: 1200, shardChance: 0.02,
    bossShardReward: 60, description: 'Where it all ends. Or begins.',
  },
];

export const GENERAL_IDS = ['general-marrow', 'general-vex', 'general-thane'];
export const DEMON_KING_ID = 'demon-king';

// ---------------------------------------------------------------------------
// Quest targets — monsters (loot tied to the monster) and gatherables (tied to
// the location) that the guild can post bounties on. Placeholder content.
// ---------------------------------------------------------------------------

export const QUEST_TARGETS: QuestTargetDef[] = [
  // Forest Edge (tier 1)
  { id: 'gray-wolf', locationId: 'forest-edge', kind: 'monster', name: 'Gray Wolf', materialId: 'beast-pelt', difficulty: 1 },
  { id: 'wild-boar', locationId: 'forest-edge', kind: 'monster', name: 'Wild Boar', materialId: 'raw-meat', difficulty: 1.2 },
  { id: 'forest-herbs', locationId: 'forest-edge', kind: 'gatherable', name: 'Forest Herbs', materialId: 'herbs', difficulty: 0.8 },
  { id: 'deadfall', locationId: 'forest-edge', kind: 'gatherable', name: 'Deadfall Timber', materialId: 'timber', difficulty: 0.7 },
  // River Crossing (tier 2)
  { id: 'river-bandit', locationId: 'river-crossing', kind: 'monster', name: 'River Bandit', materialId: 'iron-ore', difficulty: 1.3 },
  { id: 'giant-frog', locationId: 'river-crossing', kind: 'monster', name: 'Giant Frog', materialId: 'raw-meat', difficulty: 1 },
  { id: 'river-reeds', locationId: 'river-crossing', kind: 'gatherable', name: 'River Reeds', materialId: 'timber', difficulty: 0.9 },
  { id: 'riverbank-herbs', locationId: 'river-crossing', kind: 'gatherable', name: 'Riverbank Herbs', materialId: 'herbs', difficulty: 1 },
  // Old Mines (tier 3)
  { id: 'cave-spider', locationId: 'old-mines', kind: 'monster', name: 'Cave Spider', materialId: 'silk', difficulty: 1.1 },
  { id: 'kobold', locationId: 'old-mines', kind: 'monster', name: 'Kobold Digger', materialId: 'iron-ore', difficulty: 1.3 },
  { id: 'iron-vein', locationId: 'old-mines', kind: 'gatherable', name: 'Iron Vein', materialId: 'iron-ore', difficulty: 1 },
  { id: 'raw-gemstone', locationId: 'old-mines', kind: 'gatherable', name: 'Raw Gemstone', materialId: 'crystal', difficulty: 1.4 },
  // Haunted Marsh (tier 4)
  { id: 'bog-wraith', locationId: 'haunted-marsh', kind: 'monster', name: 'Bog Wraith', materialId: 'spirit-essence', difficulty: 1.3 },
  { id: 'giant-leech', locationId: 'haunted-marsh', kind: 'monster', name: 'Giant Leech', materialId: 'raw-meat', difficulty: 1 },
  { id: 'witch-herbs', locationId: 'haunted-marsh', kind: 'gatherable', name: "Witch's Herbs", materialId: 'herbs', difficulty: 1.2 },
  { id: 'marsh-crystal', locationId: 'haunted-marsh', kind: 'gatherable', name: 'Marsh Crystal', materialId: 'crystal', difficulty: 1.3 },
  // Sunken Ruins (tier 5)
  { id: 'drowned-guardian', locationId: 'sunken-ruins', kind: 'monster', name: 'Drowned Guardian', materialId: 'spirit-essence', difficulty: 1.4 },
  { id: 'ruin-crawler', locationId: 'sunken-ruins', kind: 'monster', name: 'Ruin Crawler', materialId: 'silk', difficulty: 1.2 },
  { id: 'ancient-relic', locationId: 'sunken-ruins', kind: 'gatherable', name: 'Ancient Relic', materialId: 'crystal', difficulty: 1.6 },
  { id: 'sunken-timber', locationId: 'sunken-ruins', kind: 'gatherable', name: 'Sunken Timber', materialId: 'timber', difficulty: 1 },
  // Frontier Pass (tier 6)
  { id: 'demon-scout', locationId: 'frontier-pass', kind: 'monster', name: 'Demon Scout', materialId: 'demon-ash', difficulty: 1.5 },
  { id: 'hellhound', locationId: 'frontier-pass', kind: 'monster', name: 'Hellhound', materialId: 'beast-pelt', difficulty: 1.3 },
  { id: 'scorched-ore', locationId: 'frontier-pass', kind: 'gatherable', name: 'Scorched Ore', materialId: 'iron-ore', difficulty: 1.4 },
  { id: 'ember-crystal', locationId: 'frontier-pass', kind: 'gatherable', name: 'Ember Crystal', materialId: 'crystal', difficulty: 1.6 },
];

// ---------------------------------------------------------------------------
// Quest economy tuning
// ---------------------------------------------------------------------------

/** Batch time/rep scale with unit difficulty = target.difficulty * tier. */
export const QUEST_BATCH_TIME_BASE = 4; // solo seconds per batch at unitDiff 1, B 1
export const QUEST_TIME_EXP = 0.7; // <1: bigger batches are more time-efficient per unit
export const QUEST_REP_BASE = 0.5; // reputation per batch at unitDiff 1, B 1
export const QUEST_MIN_BATCH = 1;
export const QUEST_MAX_BATCH = 100;

/**
 * Gold cost scales with target.difficulty * tier^QUEST_GOLD_TIER_EXP — a
 * steeper-than-linear tier exponent, separate from the (linear-in-tier) time
 * cost, so quests in later, more dangerous zones cost disproportionately more
 * gold to fund (hazard pay), not just proportionally more like everything
 * else. QUEST_GOLD_BASE sets the overall price level; QUEST_GOLD_EXP keeps
 * bigger batches a gold sink (cost grows faster than the units requested).
 */
export const QUEST_GOLD_BASE = 6; // gold per batch at unitDiff 1, B 1
export const QUEST_GOLD_EXP = 1.25; // >1: bigger batches cost more gold per unit
export const QUEST_GOLD_TIER_EXP = 1.4; // >1: later zones cost more gold per unit than time alone implies

/** The numerous town adventurers: a derived number driven by reputation. */
export const ADVENTURER_BASE = 3;
/** count = ADVENTURER_BASE + sqrt(reputation / ADVENTURER_REP_SCALE), soft-capped. */
export const ADVENTURER_REP_SCALE = 1;
export const ADVENTURER_MAX = 500;

/** repeatCount sentinel: 0 means "unlimited" (never stored as Infinity — that
 * would serialize to null through JSON.stringify/localStorage). */
export const QUEST_UNLIMITED_REPEATS = 0;
/** Highest repeatCount a player can type in when posting a quest (sanity cap; not a balance number). */
export const QUEST_MAX_REPEATS_INPUT = 9_999;
export const QUEST_DEFAULT_MAX_ADVENTURERS = ADVENTURER_MAX;
export const QUEST_MIN_ADVENTURERS = 1;
/** Sane UI cap on how many distinct targets one quest posting can bundle. */
export const QUEST_MAX_REQUIREMENTS = 6;

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
  // ---- Feature unlocks (one-time) ----
  {
    id: 'forge', name: 'Forge', maxLevel: 1,
    description: 'Unlocks the Crafting tab — forge your own equipment from gold and materials.',
    baseCostGold: 4_000, costGrowth: 1, materials: { 'iron-ore': 15 },
  },
  {
    id: 'auto-explore', name: 'Auto-Explore Charter', maxLevel: 1,
    description:
      'Unlocks Auto-Explore — post champions to a zone and they fight it on their own, ' +
      'earning XP and loot even while you\'re away.',
    baseCostGold: 6_000, costGrowth: 1, materials: { 'beast-pelt': 10, 'iron-ore': 10 },
    repRequired: 500,
  },
  // ---- Job unlocks (one-time) ----
  {
    id: 'unlock-caravan', name: 'Trade Routes', maxLevel: 1,
    description: 'Unlock the Trade Caravan job.',
    baseCostGold: 8_000, costGrowth: 1, materials: { 'beast-pelt': 5 },
  },
  {
    id: 'unlock-bank', name: 'Coin Lending', maxLevel: 1,
    description: 'Unlock the Money Lender job.',
    baseCostGold: 50_000, costGrowth: 1, materials: { 'iron-ore': 10 },
  },
  {
    id: 'unlock-trade-guild', name: 'Merchant Guild', maxLevel: 1,
    description: 'Unlock the Trading Company job.',
    baseCostGold: 300_000, costGrowth: 1, materials: { 'iron-ore': 20, 'spirit-essence': 5 },
  },
];

// ---------------------------------------------------------------------------
// Combat / drops tuning
// ---------------------------------------------------------------------------

/** Game seconds between auto-explore encounters. */
export const ENCOUNTER_INTERVAL = 20;
/** Safety cap on encounters processed per adventurer per tick (offline catch-up). */
export const MAX_ENCOUNTERS_PER_TICK = 2000;

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
export const INJURY_SECONDS_PER_TIER = 180;
/** A knocked-out party member's injury is at least this fraction of the full
 * per-tier duration, scaling up to the full duration the harder they were
 * overkilled (see combat.ts injurySecondsFor). */
export const INJURY_MIN_FRACTION = 0.3;

// ---------------------------------------------------------------------------
// Explore: manual, on-demand turn-based battles for the named Champion
// roster (separate from the auto-resolving quest board above — see combat.ts)
// ---------------------------------------------------------------------------

/** Max champions in one Explore party. */
export const EXPLORE_MAX_PARTY_SIZE = 3;
/** Safety cap on individual attacks in one battle (extreme edge case only —
 * damage always exceeds 0, so real fights resolve in a handful of rounds). */
export const EXPLORE_MAX_TURNS = 300;

/** Monster group size scales with location tier: 1 at tier 1-2, up to 3 at tier 5+. */
export function exploreMonsterCount(tier: number): number {
  return Math.min(3, 1 + Math.floor((tier - 1) / 2));
}

// Monster combat stats are derived from location tier * the monster's own
// QuestTargetDef.difficulty, mirroring how adventurer stats derive from
// attributes rather than being hand-authored per monster.
export const MONSTER_HP_BASE = 15;
export const MONSTER_HP_PER_TIER = 18;
export const MONSTER_ATK_BASE = 3;
export const MONSTER_ATK_PER_TIER = 4;
export const MONSTER_DEF_BASE = 1;
export const MONSTER_DEF_PER_TIER = 2;
export const MONSTER_SPEED_BASE = 6;
export const MONSTER_SPEED_PER_TIER = 0.6;
export const MONSTER_XP_PER_TIER = 10; // fed through tierXp()
export const MONSTER_GOLD_PER_TIER = 6;
export const MONSTER_MATERIAL_CHANCE = 0.5;
export const MONSTER_EQUIPMENT_CHANCE = 0.05;

/** Damage formula: atk mitigated by the defender's def, K / (K + def), with
 * +/- variance so identical match-ups don't play out identically every time. */
export const COMBAT_DEF_MITIGATION_K = 50;
export const COMBAT_DAMAGE_VARIANCE = 0.3; // roll spans base * [0.85, 1.15]

/** Explore fights get boosted equipment drop chance vs regular monster drops. */
export const EXPLORE_EQUIPMENT_CHANCE = 0.1;

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

/** Max entries kept in the guild activity log. */
export const ACTIVITY_LOG_MAX = 60;

/** Phrase variations for log lines: "<name> <verb> ..." */
export const LOG_PHRASES = {
  questSuccess: ['completed', 'triumphed at', 'swept through', 'returned victorious from'],
  questFail: ['was injured and retreated from', 'barely escaped', 'was driven back from'],
  patrol: ['collected', 'brought back', 'scrounged up', 'hauled in'],
  patrolFail: ['was ambushed and wounded patrolling', 'took a bad hit patrolling', 'limped home from a patrol at'],
};

/** Success chance = clamp(power/locationPower, min, max) */
export const SUCCESS_CHANCE_MIN = 0.1;
export const SUCCESS_CHANCE_MAX = 0.95;

export const RARITY_WEIGHTS: [Rarity, number][] = [
  ['common', 0.75],
  ['rare', 0.2],
  ['epic', 0.05],
];
/** Zone tier at/above which drops get a shot at exalted (Sunken Ruins onward). */
export const EXALTED_MIN_TIER = 5;
/** Exalted's roll chance at/above EXALTED_MIN_TIER, carved out of epic's slice. */
export const EXALTED_WEIGHT = 0.015;

export const RARITY_MULT: Record<Rarity, number> = { common: 1, rare: 1.6, epic: 2.5, exalted: 4 };

/** Number of bonus attributes rolled from the type's pool, by rarity. */
export const RARITY_BONUS_ATTRS: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, exalted: 3 };
/** Bonus attribute points per roll: 1 + floor(tier / 2). */
export const BONUS_ATTR_TIER_DIV = 2;

/**
 * Overall stat budget an item's atk/def/hp are carved from:
 * budget = EQUIP_BUDGET_BASE * (1 + EQUIP_TIER_RATE)^(tier - 1) * RARITY_MULT
 *          * type.budgetMult * (0.8-1.2 variance).
 * Geometric in tier so every tier is a flat percentage stronger than the
 * last (rather than the old linear `4 + tier * 4`, which flattened out at
 * high tiers) — tier and rarity are independent multiplicative factors, same
 * as everywhere else costs/rewards scale in this game.
 */
export const EQUIP_BUDGET_BASE = 8;
export const EQUIP_TIER_RATE = 0.25;

/**
 * Disassembling an item (guild.ts disassembleItem) grants essence of its own
 * rarity, not gold: amount = RARITY_ESSENCE_BASE[rarity] * (1 + floor(tier /
 * ESSENCE_TIER_DIV)) — a stronger (higher-tier) item of the same rarity
 * yields more essence than a weak one.
 */
export const RARITY_ESSENCE_BASE: Record<Rarity, number> = { common: 1, rare: 2, epic: 4, exalted: 8 };
export const ESSENCE_TIER_DIV = 2;

// ---------------------------------------------------------------------------
// Equipment types & name prefixes
// ---------------------------------------------------------------------------

export const EQUIP_TYPES: EquipTypeDef[] = [
  // ---- Weapons: atk-heavy, damage scales with the governing attribute ----
  { id: 'sword', slot: 'weapon', names: ['Sword', 'Blade', 'Saber'], icon: '🗡️',
    scaling: 'str', atkShare: 0.8, budgetMult: 1.0, bonusAttrs: ['str', 'dex'] },
  { id: 'greatsword', slot: 'weapon', names: ['Greatsword', 'Claymore', 'Zweihander'], icon: '⚔️',
    scaling: 'str', atkShare: 0.9, budgetMult: 1.2, bonusAttrs: ['str', 'con'] },
  { id: 'axe', slot: 'weapon', names: ['Axe', 'War Axe', 'Cleaver'], icon: '🪓',
    scaling: 'str', atkShare: 0.85, budgetMult: 1.1, bonusAttrs: ['str', 'con'] },
  { id: 'mace', slot: 'weapon', names: ['Mace', 'Warhammer', 'Morningstar'], icon: '🔨',
    scaling: 'str', atkShare: 0.75, budgetMult: 1.05, bonusAttrs: ['str', 'res'] },
  { id: 'dagger', slot: 'weapon', names: ['Dagger', 'Dirk', 'Stiletto'], icon: '🔪',
    scaling: 'dex', atkShare: 0.85, budgetMult: 0.9, bonusAttrs: ['dex', 'lck'] },
  { id: 'bow', slot: 'weapon', names: ['Bow', 'Longbow', 'Recurve Bow'], icon: '🏹',
    scaling: 'dex', atkShare: 0.9, budgetMult: 1.05, bonusAttrs: ['dex', 'lck'] },
  { id: 'crossbow', slot: 'weapon', names: ['Crossbow', 'Arbalest', 'Repeater'], icon: '🎯',
    scaling: 'dex', atkShare: 0.9, budgetMult: 1.15, bonusAttrs: ['dex', 'str'] },
  { id: 'wand', slot: 'weapon', names: ['Wand', 'Scepter', 'Rod'], icon: '🪄',
    scaling: 'int', atkShare: 0.85, budgetMult: 0.95, bonusAttrs: ['int', 'lck'] },
  { id: 'staff', slot: 'weapon', names: ['Staff', 'Warstaff', 'Greatstaff'], icon: '🦯',
    scaling: 'int', atkShare: 0.9, budgetMult: 1.15, bonusAttrs: ['int', 'res'] },
  // ---- Armor: def-heavy, biggest HP share ----
  { id: 'plate', slot: 'armor', names: ['Plate Armor', 'Breastplate', 'Full Plate'], icon: '🛡️',
    atkShare: 0.1, budgetMult: 1.25, bonusAttrs: ['con', 'str'], hpShare: 0.35 },
  { id: 'mail', slot: 'armor', names: ['Chainmail', 'Hauberk', 'Scale Mail'], icon: '⛓️',
    atkShare: 0.15, budgetMult: 1.1, bonusAttrs: ['con', 'res'], hpShare: 0.35 },
  { id: 'leather', slot: 'armor', names: ['Leather Armor', 'Brigandine', 'Jerkin'], icon: '🥋',
    atkShare: 0.2, budgetMult: 1.0, bonusAttrs: ['dex', 'con'], hpShare: 0.35 },
  { id: 'cloak', slot: 'armor', names: ['Cloak', 'Mantle', 'Shroud'], icon: '🧥',
    atkShare: 0.25, budgetMult: 0.85, bonusAttrs: ['dex', 'lck'], hpShare: 0.35 },
  { id: 'robe', slot: 'armor', names: ['Robe', 'Vestment', 'Raiment'], icon: '👘',
    atkShare: 0.2, budgetMult: 0.9, bonusAttrs: ['int', 'res'], hpShare: 0.35 },
  // ---- Trinkets: balanced, smaller HP share ----
  { id: 'ring', slot: 'trinket', names: ['Ring', 'Signet', 'Band'], icon: '💍',
    atkShare: 0.5, budgetMult: 0.7, bonusAttrs: ['dex', 'lck'], hpShare: 0.2 },
  { id: 'amulet', slot: 'trinket', names: ['Amulet', 'Pendant', 'Locket'], icon: '📿',
    atkShare: 0.4, budgetMult: 0.7, bonusAttrs: ['int', 'res'], hpShare: 0.2 },
  { id: 'charm', slot: 'trinket', names: ['Charm', 'Fetish', 'Keepsake'], icon: '🧿',
    atkShare: 0.5, budgetMult: 0.7, bonusAttrs: ['lck', 'int'], hpShare: 0.2 },
  { id: 'idol', slot: 'trinket', names: ['Idol', 'Totem', 'Effigy'], icon: '🗿',
    atkShare: 0.45, budgetMult: 0.7, bonusAttrs: ['con', 'str'], hpShare: 0.2 },
];

/**
 * Prefixes modify item stats deterministically — a "Sharp" anything always
 * means +25% atk. attrs grant points scaled by tier (see generateEquipment).
 */
export const ITEM_PREFIXES: ItemPrefixDef[] = [
  { id: 'worn', name: 'Worn', weight: 10, atkMult: 0.85, defMult: 0.85 },
  { id: 'plain', name: 'Plain', weight: 20 },
  { id: 'sharp', name: 'Sharp', weight: 10, atkMult: 1.25 },
  { id: 'sturdy', name: 'Sturdy', weight: 10, defMult: 1.3 },
  { id: 'brutal', name: 'Brutal', weight: 6, atkMult: 1.4, defMult: 0.85 },
  { id: 'guardian', name: 'Guardian', weight: 6, defMult: 1.4, hpPerTier: 4 },
  { id: 'vital', name: 'Vital', weight: 8, hpPerTier: 6 },
  { id: 'mighty', name: 'Mighty', weight: 7, attrs: { str: 1 } },
  { id: 'nimble', name: 'Nimble', weight: 7, attrs: { dex: 1 } },
  { id: 'arcane', name: 'Arcane', weight: 7, attrs: { int: 1 } },
  { id: 'stalwart', name: 'Stalwart', weight: 7, attrs: { con: 1 } },
  { id: 'warding', name: 'Warding', weight: 7, attrs: { res: 1 } },
  { id: 'lucky', name: 'Lucky', weight: 5, attrs: { lck: 1 } },
  { id: 'masterwork', name: 'Masterwork', weight: 3, atkMult: 1.2, defMult: 1.2 },
  { id: 'ancient', name: 'Ancient', weight: 2, atkMult: 1.15, defMult: 1.15, hpPerTier: 4, attrs: { lck: 1 } },
];

/**
 * Exclusive to exalted-rarity drops — never rolled on common/rare/epic items,
 * and exalted items never roll from ITEM_PREFIXES. Each grants a richer
 * multi-attribute spread than any normal prefix can.
 */
export const EXALTED_PREFIXES: ItemPrefixDef[] = [
  { id: 'godslayers', name: "Godslayer's", weight: 10, atkMult: 1.5, attrs: { str: 1, dex: 1 } },
  { id: 'worldenders', name: "World-Ender's", weight: 10, atkMult: 1.6, defMult: 0.9, attrs: { str: 2 } },
  { id: 'saints', name: "Saint's", weight: 10, defMult: 1.5, hpPerTier: 8, attrs: { con: 1, res: 1 } },
  { id: 'archmages', name: "Archmage's", weight: 10, atkMult: 1.3, attrs: { int: 2, lck: 1 } },
  { id: 'immortals', name: "Immortal's", weight: 10, defMult: 1.3, hpPerTier: 12, attrs: { con: 2 } },
  { id: 'fated', name: 'Fated', weight: 10, atkMult: 1.2, defMult: 1.2, attrs: { lck: 2 } },
];

// ---------------------------------------------------------------------------
// Crafting (the Forge) — turn gold + materials into equipment on a timer.
// Reuses generateEquipment/rollRarity (adventurers.ts) with a forced slot, so
// tier here behaves exactly like a monster-drop's location tier: it scales
// the stat budget and unlocks a shot at exalted at EXALTED_MIN_TIER, but
// never changes the common/rare/epic odds.
// ---------------------------------------------------------------------------

/** Highest craftable tier is otherwise capped by the highest zone tier the
 * guild's reputation has unlocked (see guild.ts maxCraftableTier) — this is
 * just the ceiling on that, matching LOCATIONS' highest zone tier. */
export const CRAFT_MAX_TIER = 6;

/** The Forge can only ever roll common/rare gear — epic/exalted are reserved
 * for monster drops brought back by the managed Champion roster (dormant
 * until that combat loop is built; see types.ts). */
export const CRAFT_MAX_RARITY: Rarity = 'rare';

/** Materials consumed per single crafted item, by tier. Later tiers ask for
 * more units and pull in materials that only drop in higher-tier zones. */
export const CRAFT_TIER_MATERIALS: Record<number, Record<string, number>> = {
  1: { 'beast-pelt': 4 },
  2: { 'beast-pelt': 6, timber: 3 },
  3: { 'iron-ore': 8, timber: 4 },
  4: { 'iron-ore': 6, 'spirit-essence': 5 },
  5: { 'spirit-essence': 10, crystal: 4 },
  6: { 'demon-ash': 8, crystal: 8 },
};

/** Gold cost per single crafted item at tier T = base * T^exp. */
export const CRAFT_GOLD_BASE = 50;
export const CRAFT_GOLD_TIER_EXP = 1.5;

/** Craft duration = base * tier^tierExp * quantity^qtyExp. qtyExp < 1 gives
 * bulk crafting a time discount, mirroring the quest board's batch timing. */
export const CRAFT_TIME_BASE = 8;
export const CRAFT_TIME_TIER_EXP = 1;
export const CRAFT_TIME_QTY_EXP = 0.6;

/** Batch sizes offered in the Crafting UI. */
export const CRAFT_QUANTITIES: number[] = [1, 10, 100];

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
  sfxEnabled: true,
  gameSpeed: 1,
};
