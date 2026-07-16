import { SAVE_VERSION } from '../game/config';
import type { GameState, SaveData } from '../game/types';

/**
 * Platform abstraction for saving. The web build uses localStorage;
 * an Electron build (Steam) swaps in a file/steam-cloud adapter and
 * nothing else in the app changes.
 */
export interface SaveAdapter {
  load(): SaveData | null;
  save(data: SaveData): void;
  clear(): void;
}

const KEY = 'idle-game-save';

export const localStorageAdapter: SaveAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      // Future: run migrations when version < SAVE_VERSION
      return data;
    } catch {
      return null;
    }
  },
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // storage full/unavailable — skip this save silently
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};

export function toSaveData(state: GameState): SaveData {
  return { version: SAVE_VERSION, state };
}
