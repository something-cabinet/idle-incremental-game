import {
  PRESTIGE_DIVISOR,
  PRESTIGE_EXPONENT,
  PRESTIGE_UNLOCK_ENERGY,
} from './config';
import { createInitialState } from './logic';
import { computeModifiers } from './perks';
import type { GameState } from './types';

/**
 * Prestige loop: reset the current run in exchange for permanent prestige
 * points, which are spent in the perk/skill menu. Kept separate from the base
 * loop so it's easy to re-theme (e.g. "Ascend", "Rebirth") without touching it.
 */

/** How many prestige points a reset would grant right now. */
export function prestigeGain(state: GameState): number {
  const raw = Math.pow(state.totalEnergyEarned / PRESTIGE_DIVISOR, PRESTIGE_EXPONENT);
  const withPerks = raw * computeModifiers(state).prestigeGainMult;
  return Math.max(0, Math.floor(withPerks));
}

/** Whether the player has unlocked prestige and would gain at least 1 point. */
export function canPrestige(state: GameState): boolean {
  return (
    state.totalEnergyEarned >= PRESTIGE_UNLOCK_ENERGY && prestigeGain(state) >= 1
  );
}

/** Whether the prestige feature has ever been available (for UI reveal). */
export function isPrestigeUnlocked(state: GameState): boolean {
  return (
    state.prestigeCount > 0 ||
    state.lifetimeEnergyEarned >= PRESTIGE_UNLOCK_ENERGY ||
    state.totalEnergyEarned >= PRESTIGE_UNLOCK_ENERGY
  );
}

/**
 * Perform a prestige: wipe the run but keep prestige points, perks, settings,
 * and lifetime stats. A no-op if the player can't prestige yet.
 */
export function performPrestige(state: GameState, now = Date.now()): GameState {
  if (!canPrestige(state)) return state;
  const gain = prestigeGain(state);
  const fresh = createInitialState(now);
  return {
    ...fresh,
    prestigePoints: state.prestigePoints + gain,
    prestigeCount: state.prestigeCount + 1,
    lifetimeEnergyEarned: state.lifetimeEnergyEarned + state.totalEnergyEarned,
    perks: state.perks,
    settings: state.settings,
  };
}
