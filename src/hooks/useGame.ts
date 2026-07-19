import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { AUTOSAVE_INTERVAL_MS, BACKGROUND_CATCHUP_GAP_MS } from '../game/config';
import { applyOfflineProgress, tick } from '../game/engine';
import type { GameStore } from '../game/store';
import type { GameState } from '../game/types';
import { localStorageAdapter, toSaveData } from '../platform/storage';

export type OfflineCatchupResult = ReturnType<typeof applyOfflineProgress>;

export const GameContext = createContext<GameStore | null>(null);

export function useGameStore(): GameStore {
  const store = useContext(GameContext);
  if (!store) throw new Error('useGameStore must be used inside GameContext');
  return store;
}

export function useGameState(): GameState {
  const store = useGameStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}

/**
 * Drives the simulation (10 ticks/sec) and autosave. Mount once.
 *
 * Backgrounded/suspended tabs (switching tabs, minimizing, mobile browsers
 * pausing hidden pages) don't unmount the app, so the one-time offline
 * catch-up in App's init never re-runs. Without help, the live loop's small
 * per-tick dt clamp would silently discard all that elapsed time. Instead,
 * whenever wall-clock time has drifted far ahead of the last processed tick
 * — detected both by the interval itself and by visibility/focus events,
 * since background tabs often stop firing intervals entirely — the gap is
 * routed through the same (capped) applyOfflineProgress used on page load.
 */
export function useGameLoop(store: GameStore, onOfflineCatchup?: (result: OfflineCatchupResult) => void): void {
  useEffect(() => {
    let last = performance.now();

    const runCatchup = () => {
      let result: OfflineCatchupResult | null = null;
      store.dispatch((s) => {
        result = applyOfflineProgress(s);
        return result.state;
      });
      last = performance.now();
      if (result) onOfflineCatchup?.(result);
    };

    const loop = setInterval(() => {
      const now = performance.now();
      const wallGapMs = Date.now() - store.getState().lastUpdate;
      if (wallGapMs > BACKGROUND_CATCHUP_GAP_MS) {
        runCatchup();
        return;
      }
      // Debug game-speed multiplies live game time only (offline stays 1:1).
      const speed = store.getState().settings.gameSpeed || 1;
      const dt = Math.min((now - last) / 1000, 1) * speed;
      last = now;
      store.dispatch((s) => tick(s, dt));
    }, 100);

    const autosave = setInterval(() => {
      localStorageAdapter.save(toSaveData(store.getState()));
    }, AUTOSAVE_INTERVAL_MS);

    const saveNow = () => localStorageAdapter.save(toSaveData(store.getState()));
    const onResume = () => {
      if (document.visibilityState === 'visible') runCatchup();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveNow();
      else onResume();
    };
    // beforeunload is unreliable on mobile browsers; pagehide/visibilitychange
    // fire far more consistently when a tab is backgrounded or closed.
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('focus', onResume);

    return () => {
      clearInterval(loop);
      clearInterval(autosave);
      window.removeEventListener('beforeunload', saveNow);
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('focus', onResume);
      saveNow();
    };
  }, [store, onOfflineCatchup]);
}
