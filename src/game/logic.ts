import { DEFAULT_SETTINGS, GENERATORS } from './config';
import { computeModifiers } from './perks';
import type { GameState, Settings } from './types';

/** Pure game logic: every function takes state and returns new state. */

export function createInitialState(now = Date.now()): GameState {
  return {
    energy: 0,
    totalEnergyEarned: 0,
    lifetimeEnergyEarned: 0,
    generators: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    clickPower: 1,
    prestigePoints: 0,
    prestigeCount: 0,
    perks: {},
    settings: { ...DEFAULT_SETTINGS },
    lastUpdate: now,
  };
}

/**
 * Fill in any fields missing from an older save so the app never reads
 * undefined. Runs on load, before offline progress. This is the migration
 * seam — extend it when the save shape changes.
 */
export function normalizeState(partial: Partial<GameState>): GameState {
  const base = createInitialState(partial.lastUpdate ?? Date.now());
  return {
    ...base,
    ...partial,
    generators: { ...base.generators, ...(partial.generators ?? {}) },
    perks: { ...base.perks, ...(partial.perks ?? {}) },
    settings: { ...base.settings, ...(partial.settings ?? {}) },
  };
}

export function productionPerSecond(state: GameState): number {
  const raw = GENERATORS.reduce(
    (sum, g) => sum + g.baseProduction * (state.generators[g.id] ?? 0),
    0,
  );
  return raw * computeModifiers(state).productionMult;
}

export function effectiveClickPower(state: GameState): number {
  return state.clickPower * computeModifiers(state).clickMult;
}

export function generatorCost(state: GameState, generatorId: string): number {
  const def = GENERATORS.find((g) => g.id === generatorId);
  if (!def) return Infinity;
  const owned = state.generators[generatorId] ?? 0;
  const costMult = computeModifiers(state).costMult;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned) * costMult);
}

export function canAfford(state: GameState, generatorId: string): boolean {
  return state.energy >= generatorCost(state, generatorId);
}

export function buyGenerator(state: GameState, generatorId: string): GameState {
  const cost = generatorCost(state, generatorId);
  if (state.energy < cost) return state;
  return {
    ...state,
    energy: state.energy - cost,
    generators: {
      ...state.generators,
      [generatorId]: (state.generators[generatorId] ?? 0) + 1,
    },
  };
}

export function click(state: GameState): GameState {
  return earn(state, effectiveClickPower(state));
}

export function updateSettings(state: GameState, patch: Partial<Settings>): GameState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

/** Advance the simulation by dt seconds. */
export function tick(state: GameState, dtSeconds: number, now = Date.now()): GameState {
  const gained = productionPerSecond(state) * dtSeconds;
  return { ...earn(state, gained), lastUpdate: now };
}

/**
 * Catch up production for time elapsed since the save's lastUpdate.
 * Returns the new state and how much was earned, so the UI can show
 * a "welcome back" message. Respects the offline-progress setting and the
 * offline cap (which the Night Shift perk can raise).
 */
export function applyOfflineProgress(
  state: GameState,
  now = Date.now(),
): { state: GameState; offlineSeconds: number; offlineEarnings: number } {
  if (!state.settings.offlineProgress) {
    return { state: { ...state, lastUpdate: now }, offlineSeconds: 0, offlineEarnings: 0 };
  }
  const capHours = computeModifiers(state).offlineCapHours;
  const elapsed = Math.max(0, (now - state.lastUpdate) / 1000);
  const credited = Math.min(elapsed, capHours * 3600);
  const earnings = productionPerSecond(state) * credited;
  return {
    state: { ...earn(state, earnings), lastUpdate: now },
    offlineSeconds: credited,
    offlineEarnings: earnings,
  };
}

function earn(state: GameState, amount: number): GameState {
  return {
    ...state,
    energy: state.energy + amount,
    totalEnergyEarned: state.totalEnergyEarned + amount,
  };
}
