import { onGameEvent, emitGameEvent, type GameEvent } from '../game/events';

let paused = false;
let backlog: GameEvent[] = [];

export function pauseToasts() {
  paused = true;
  backlog = [];
}

export function resumeToasts() {
  paused = false;
  const summary = { questsCompleted: 0, championsLeveled: 0, itemsForged: 0 };
  for (const ev of backlog) {
    if (ev.type === 'quest-completed') {
      summary.questsCompleted += (ev.payload?.count as number) ?? 1;
    }
    if (ev.type === 'champion-level-up') summary.championsLeveled++;
    if (ev.type === 'crafting-complete') summary.itemsForged++;
  }
  backlog = [];
  if (summary.questsCompleted > 0 || summary.championsLeveled > 0 || summary.itemsForged > 0) {
    emitGameEvent({ type: 'offline-summary', payload: summary });
  }
}

export function isToastsPaused() {
  return paused;
}

export function subscribeWithPause(fn: (event: GameEvent) => void) {
  return onGameEvent((event) => {
    if (paused) {
      if (event.type === 'quest-completed' || event.type === 'champion-level-up' || event.type === 'crafting-complete' || event.type === 'zone-unlocked') {
        backlog.push(event);
      }
      return;
    }
    fn(event);
  });
}
