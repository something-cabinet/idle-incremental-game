import { useSyncExternalStore } from 'react';

/**
 * Whether a battle is currently on screen.
 *
 * Rewards commit the instant a fight is dispatched — BattleModal only replays
 * the already-decided log — so the story beats those rewards trigger (a general
 * falling, Act 3 opening off a dungeon clear) would otherwise queue up and
 * slam over the top of the battle that is still animating. Beats wait their
 * turn instead: StoryModal holds them until playback is done.
 *
 * Deliberately module-level rather than context: BattleModal is rendered deep
 * inside a panel while StoryModal sits at the app root, and this is a single
 * boolean about "what's on screen", not game state.
 */
let openBattles = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Called by BattleModal on mount; returns the matching "closed" callback. */
export function markBattleOpen(): () => void {
  openBattles++;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openBattles--;
    emit();
  };
}

export function useBattleOpen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => openBattles > 0,
    () => false,
  );
}
