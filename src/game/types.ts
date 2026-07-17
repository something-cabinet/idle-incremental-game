/** Pure game types. No React, no DOM — keep it that way. */

export interface GeneratorDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  /** Cost multiplier per unit owned (classic idle curve, e.g. 1.15) */
  costGrowth: number;
  /** Energy produced per second per unit */
  baseProduction: number;
}

/**
 * A perk is a permanent, prestige-currency-purchased upgrade. Effects are
 * data, not code, so new perks are added by editing config only. Every effect
 * kind must be handled in `computeModifiers` (perks.ts).
 */
export type PerkEffect =
  /** +perLevel fraction to all production (0.1 = +10% per level) */
  | { kind: 'globalProduction'; perLevel: number }
  /** +perLevel fraction to click power */
  | { kind: 'clickPower'; perLevel: number }
  /** -perLevel fraction off generator purchase cost (0.02 = 2% cheaper/level) */
  | { kind: 'costReduction'; perLevel: number }
  /** +perLevel hours to the offline earnings cap */
  | { kind: 'offlineCap'; perLevel: number }
  /** +perLevel fraction to prestige currency gained */
  | { kind: 'prestigeGain'; perLevel: number };

export interface PerkDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  /** Cost multiplier per level already owned */
  costGrowth: number;
  effect: PerkEffect;
  /** Optional perk ids that must be maxed (or owned) before this unlocks */
  requires?: string[];
}

/** Derived multipliers computed from owned perks. */
export interface Modifiers {
  productionMult: number;
  clickMult: number;
  /** Multiplies generator cost; <= 1 means cheaper */
  costMult: number;
  offlineCapHours: number;
  prestigeGainMult: number;
}

export type NumberFormat = 'short' | 'scientific';

export interface Settings {
  numberFormat: NumberFormat;
  confirmPrestige: boolean;
  offlineProgress: boolean;
  reducedMotion: boolean;
}

export interface GameState {
  energy: number;
  /** Earned during the current prestige run (resets on prestige) */
  totalEnergyEarned: number;
  /** Earned across all runs (never resets) */
  lifetimeEnergyEarned: number;
  /** generator id -> count owned */
  generators: Record<string, number>;
  clickPower: number;
  /** Permanent currency spent in the perk/skill menu */
  prestigePoints: number;
  /** How many times the player has prestiged */
  prestigeCount: number;
  /** perk id -> level owned */
  perks: Record<string, number>;
  settings: Settings;
  /** unix ms of last tick, used for offline progress */
  lastUpdate: number;
}

export interface SaveData {
  version: number;
  state: GameState;
}
