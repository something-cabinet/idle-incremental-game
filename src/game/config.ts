import type { GeneratorDef, PerkDef, Settings } from './types';

/**
 * All balance numbers and content definitions live here. Tweak this file to
 * tune the game or re-theme it (names/descriptions) — logic never hardcodes
 * these values.
 */

export const GENERATORS: GeneratorDef[] = [
  {
    id: 'hamster',
    name: 'Hamster Wheel',
    description: 'A very motivated hamster.',
    baseCost: 15,
    costGrowth: 1.15,
    baseProduction: 0.5,
  },
  {
    id: 'solar',
    name: 'Solar Panel',
    description: 'Free energy from the sky.',
    baseCost: 100,
    costGrowth: 1.15,
    baseProduction: 4,
  },
  {
    id: 'turbine',
    name: 'Wind Turbine',
    description: 'Spins majestically.',
    baseCost: 1_100,
    costGrowth: 1.15,
    baseProduction: 30,
  },
  {
    id: 'reactor',
    name: 'Fusion Reactor',
    description: 'A small star in a box.',
    baseCost: 12_000,
    costGrowth: 1.15,
    baseProduction: 220,
  },
  {
    id: 'dyson',
    name: 'Dyson Swarm',
    description: 'Wraps the sun in solar panels.',
    baseCost: 130_000,
    costGrowth: 1.15,
    baseProduction: 1_800,
  },
];

/**
 * Perks — permanent upgrades bought with prestige points in the skill menu.
 * Placeholder names/effects; the tree structure and effect kinds are what
 * matter for the infrastructure.
 */
export const PERKS: PerkDef[] = [
  {
    id: 'overclock',
    name: 'Overclock',
    description: '+10% total production per level.',
    maxLevel: 10,
    baseCost: 1,
    costGrowth: 1.6,
    effect: { kind: 'globalProduction', perLevel: 0.1 },
  },
  {
    id: 'strong-fingers',
    name: 'Strong Fingers',
    description: '+25% click power per level.',
    maxLevel: 8,
    baseCost: 1,
    costGrowth: 1.5,
    effect: { kind: 'clickPower', perLevel: 0.25 },
  },
  {
    id: 'bulk-discount',
    name: 'Bulk Discount',
    description: 'Generators cost 2% less per level.',
    maxLevel: 15,
    baseCost: 2,
    costGrowth: 1.7,
    effect: { kind: 'costReduction', perLevel: 0.02 },
  },
  {
    id: 'night-shift',
    name: 'Night Shift',
    description: '+2h offline earnings cap per level.',
    maxLevel: 8,
    baseCost: 3,
    costGrowth: 1.8,
    effect: { kind: 'offlineCap', perLevel: 2 },
    requires: ['overclock'],
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    description: '+15% prestige points gained per level.',
    maxLevel: 12,
    baseCost: 5,
    costGrowth: 2,
    effect: { kind: 'prestigeGain', perLevel: 0.15 },
    requires: ['overclock', 'compound-interest'],
  },
];

export const DEFAULT_SETTINGS: Settings = {
  numberFormat: 'short',
  confirmPrestige: true,
  offlineProgress: true,
  reducedMotion: false,
};

/** Base offline time credited, in hours (before Night Shift perk). */
export const OFFLINE_CAP_HOURS = 8;

/** Autosave interval in ms. */
export const AUTOSAVE_INTERVAL_MS = 10_000;

/** ---- Prestige tuning ---- */
/** You can't prestige until lifetime run earnings reach this. */
export const PRESTIGE_UNLOCK_ENERGY = 1_000_000;
/** points ≈ (totalEnergyEarned / DIVISOR) ^ EXPONENT */
export const PRESTIGE_DIVISOR = 1_000_000;
export const PRESTIGE_EXPONENT = 0.5;

export const SAVE_VERSION = 2;
