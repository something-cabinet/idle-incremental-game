import { GENERATORS, OFFLINE_CAP_HOURS } from './config';
import type { GameState } from './types';

/** Pure game logic: every function takes state and returns new state. */

export function createInitialState(now = Date.now()): GameState {
  return {
    energy: 0,
    totalEnergyEarned: 0,
    generators: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    clickPower: 1,
    lastUpdate: now,
  };
}

export function productionPerSecond(state: GameState): number {
  return GENERATORS.reduce(
    (sum, g) => sum + g.baseProduction * (state.generators[g.id] ?? 0),
    0,
  );
}

export function generatorCost(state: GameState, generatorId: string): number {
  const def = GENERATORS.find((g) => g.id === generatorId);
  if (!def) return Infinity;
  const owned = state.generators[generatorId] ?? 0;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned));
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
  return earn(state, state.clickPower);
}

/** Advance the simulation by dt seconds. */
export function tick(state: GameState, dtSeconds: number, now = Date.now()): GameState {
  const gained = productionPerSecond(state) * dtSeconds;
  return { ...earn(state, gained), lastUpdate: now };
}

/**
 * Catch up production for time elapsed since the save's lastUpdate.
 * Returns the new state and how much was earned, so the UI can show
 * a "welcome back" message.
 */
export function applyOfflineProgress(
  state: GameState,
  now = Date.now(),
): { state: GameState; offlineSeconds: number; offlineEarnings: number } {
  const elapsed = Math.max(0, (now - state.lastUpdate) / 1000);
  const credited = Math.min(elapsed, OFFLINE_CAP_HOURS * 3600);
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
