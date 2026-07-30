import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../game/events';
import { subscribeWithPause } from './toastPause';
import { Icon, type IconName } from './icons';

interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning';
  icon?: IconName;
  duration: number;
  /** Rare progression beats receive the guild's heraldic notice treatment. */
  ceremonial?: boolean;
}

let toastId = 0;

const ToastStack = memo(function ToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeWithPause((event: GameEvent) => {
      const item = eventToToast(event);
      if (!item) return;
      setToasts((prev) => {
        const next = [...prev, item];
        if (next.length > 2) next.shift();
        return next;
      });
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={dismiss} toastId={t.id} />
      ))}
    </div>
  );
});

function ToastRow({ toast, onDismiss, toastId }: { toast: ToastItem; onDismiss: (id: number) => void; toastId: number }) {
  const [exiting, setExiting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), toast.duration);
    const t2 = setTimeout(() => onDismiss(toastId), toast.duration + 220);
    timers.current = [t1, t2];
    return () => { timers.current.forEach(clearTimeout); };
  }, [toast.duration, toastId, onDismiss]);

  const handleClose = useCallback(() => {
    setExiting(true);
    const t = setTimeout(() => onDismiss(toastId), 220);
    timers.current.push(t);
  }, [toastId, onDismiss]);

  return (
    <div
      className={`toast toast-tone-${toast.tone} ${toast.ceremonial ? 'toast-herald' : ''} ${exiting ? 'toast-out' : ''}`}
      role={toast.tone === 'warning' ? 'alert' : 'status'}
      aria-live={toast.tone === 'warning' ? 'assertive' : 'polite'}
    >
      {toast.icon && (
        <span className="toast-seal" aria-hidden="true">
          <Icon name={toast.icon} />
        </span>
      )}
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={handleClose}
        aria-label="Dismiss"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

function eventToToast(event: GameEvent): ToastItem | null {
  switch (event.type) {
    case 'crafting-complete':
      return { id: ++toastId, message: 'Forging complete — new equipment ready!', tone: 'success', icon: 'hammer', duration: 3500 };
    case 'champion-level-up': {
      const p = event.payload as { name: string; level: number } | undefined;
      return { id: ++toastId, message: p ? `${p.name} reached level ${p.level}!` : 'A champion gained a level!', tone: 'success', icon: 'star', duration: 3500, ceremonial: true };
    }
    case 'quest-posted':
      return { id: ++toastId, message: 'Quest posted to the board.', tone: 'info', icon: 'plus', duration: 3000 };
    case 'quest-completed':
      return { id: ++toastId, message: 'A quest was fulfilled!', tone: 'success', icon: 'check', duration: 3500 };
    case 'zone-unlocked': {
      const p = event.payload as { name: string } | undefined;
      return { id: ++toastId, message: p ? `${p.name} is now open!` : 'A new zone is open!', tone: 'success', icon: 'map', duration: 4000, ceremonial: true };
    }
    case 'forge-unlocked':
      return { id: ++toastId, message: 'The Forge is open — craft your own gear.', tone: 'success', icon: 'hammer', duration: 4000, ceremonial: true };
    case 'offline-summary': {
      const p = event.payload as { questsCompleted: number; championsLeveled: number; itemsForged: number } | undefined;
      if (!p || (p.questsCompleted === 0 && p.championsLeveled === 0 && p.itemsForged === 0)) return null;
      const parts: string[] = [];
      if (p.questsCompleted > 0) parts.push(`${p.questsCompleted} quest${p.questsCompleted === 1 ? '' : 's'} fulfilled`);
      if (p.championsLeveled > 0) parts.push(`${p.championsLeveled} champion${p.championsLeveled === 1 ? '' : 's'} leveled up`);
      if (p.itemsForged > 0) parts.push(`${p.itemsForged} item${p.itemsForged === 1 ? '' : 's'} forged`);
      return { id: ++toastId, message: `While you were away: ${parts.join(', ')}.`, tone: 'info', icon: 'info', duration: 5000 };
    }
    default:
      return null;
  }
}

export default ToastStack;
