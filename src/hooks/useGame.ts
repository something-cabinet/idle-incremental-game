import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { AUTOSAVE_INTERVAL_MS } from '../game/config';
import { tick } from '../game/logic';
import type { GameStore } from '../game/store';
import type { GameState } from '../game/types';
import { localStorageAdapter, toSaveData } from '../platform/storage';

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

/** Drives the simulation (10 ticks/sec) and autosave. Mount once. */
export function useGameLoop(store: GameStore): void {
  useEffect(() => {
    let last = performance.now();
    const loop = setInterval(() => {
      const now = performance.now();
      // Clamp dt so a suspended tab doesn't produce one giant tick;
      // long gaps are handled by offline progress on load instead.
      const dt = Math.min((now - last) / 1000, 1);
      last = now;
      store.dispatch((s) => tick(s, dt));
    }, 100);

    const autosave = setInterval(() => {
      localStorageAdapter.save(toSaveData(store.getState()));
    }, AUTOSAVE_INTERVAL_MS);

    const saveNow = () => localStorageAdapter.save(toSaveData(store.getState()));
    window.addEventListener('beforeunload', saveNow);

    return () => {
      clearInterval(loop);
      clearInterval(autosave);
      window.removeEventListener('beforeunload', saveNow);
      saveNow();
    };
  }, [store]);
}
