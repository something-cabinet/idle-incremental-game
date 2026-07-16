import type { GeneratorDef } from './types';

/**
 * All balance numbers live here. Tweak this file to tune the game —
 * nothing else needs to change.
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

/** Max offline time credited, in hours. */
export const OFFLINE_CAP_HOURS = 8;

/** Autosave interval in ms. */
export const AUTOSAVE_INTERVAL_MS = 10_000;

export const SAVE_VERSION = 1;
