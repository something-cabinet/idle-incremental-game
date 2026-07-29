export type GameEventType =
  | 'crafting-complete'
  | 'champion-level-up'
  | 'quest-posted'
  | 'quest-completed'
  | 'zone-unlocked'
  | 'forge-unlocked'
  | 'offline-summary';

export interface GameEvent {
  type: GameEventType;
  payload?: Record<string, unknown>;
}

type Listener = (event: GameEvent) => void;
const listeners: Listener[] = [];

export function emitGameEvent(event: GameEvent) {
  for (const fn of listeners) {
    try { fn(event); } catch (e) { console.error('Game event handler threw:', e); }
  }
}

export function onGameEvent(fn: Listener) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}
