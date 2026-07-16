import type { GameState } from './types';

/**
 * Minimal observable store, framework-agnostic. React subscribes via
 * useSyncExternalStore; the game loop mutates it via dispatch.
 */
export class GameStore {
  private listeners = new Set<() => void>();
  private state: GameState;

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  getState = (): GameState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Apply a pure state transition and notify subscribers if it changed. */
  dispatch = (fn: (state: GameState) => GameState): void => {
    const next = fn(this.state);
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  };
}
