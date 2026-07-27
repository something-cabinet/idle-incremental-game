import type { GameState, GameStats } from './types';

/**
 * Lifetime counters, kept purely so the Overview tab can show a player their
 * whole history. Nothing in the simulation ever reads them back, which is what
 * makes them safe to extend: add a key here, backfill it in `migrateStats`,
 * and every existing save simply starts that counter at 0.
 *
 * They survive time travel (see prestige.ts), unlike almost everything else.
 */
export const EMPTY_STATS: GameStats = {
  clicks: 0,
  timePlayedSeconds: 0,
  battlesWon: 0,
  battlesLost: 0,
  monstersDefeated: 0,
  injuries: 0,
  championsHired: 0,
  questsCompleted: 0,
  itemsFound: 0,
  itemsCrafted: 0,
  itemsDisassembled: 0,
  itemsAscended: 0,
  dungeonsCleared: 0,
  shardsFound: 0,
};

/** Add to some counters, leaving the rest alone. Returns the same state object
 *  when the patch is empty/all-zero, so it never forces a pointless re-render. */
export function addStats(state: GameState, patch: Partial<GameStats>): GameState {
  const entries = Object.entries(patch).filter(([, v]) => !!v) as [keyof GameStats, number][];
  if (entries.length === 0) return state;
  const stats = { ...state.stats };
  for (const [key, amount] of entries) stats[key] = (stats[key] ?? 0) + amount;
  return { ...state, stats };
}

/** Backfill a loaded save's stats block (missing entirely on pre-v17 saves,
 *  missing individual keys whenever a new counter is added later). */
export function migrateStats(saved: Partial<GameStats> | undefined): GameStats {
  return { ...EMPTY_STATS, ...(saved ?? {}) };
}
