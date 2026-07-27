import { DEMON_KING_ID } from './config';
import { createInitialState } from './logic';
import type { GameState } from './types';

/**
 * Prestige = time travel. After defeating the demon king, the player uses the
 * time crystal to start a new timeline. Time Shards, perks, settings, and
 * lifetime stats persist; the town, guild, and story reset.
 * (Shards are found by adventurers and awarded by bosses — there is no
 * computed prestige-gain formula in this design.)
 */

export function canTimeTravel(state: GameState): boolean {
  return !!state.bossesDefeated[DEMON_KING_ID];
}

/** Prestige/timeline UI becomes visible once the king has fallen once, ever. */
export function isTimeTravelUnlocked(state: GameState): boolean {
  return state.prestigeCount > 0 || canTimeTravel(state);
}

export function timeTravel(state: GameState, now = Date.now()): GameState {
  if (!canTimeTravel(state)) return state;
  const fresh = createInitialState(now);
  return {
    ...fresh,
    timeShards: state.timeShards,
    prestigeCount: state.prestigeCount + 1,
    lifetimeGoldEarned: state.lifetimeGoldEarned + state.totalGoldEarned,
    perks: state.perks,
    hometownSaved: state.hometownSaved,
    stats: state.stats,
    settings: state.settings,
    // Returning travelers skip the intro beat; they've lived this before.
    storyFlags: { 'a1-arrival': true },
    pendingStories: [],
  };
}
