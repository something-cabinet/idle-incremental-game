# Consolidated UI/UX Design Specification — Guild of Second Chances

**Version:** 2.0 (Post-Audit)  
**Date:** 2026-07-29  
**Authority:** Source of truth for @fixer implementation. No design decisions during coding — only execution.

---

## 1. Typography System

### 1.1 Design Rationale
The current `system-ui` stack reads as a utility app. For a narrative idle game about time-traveling guild leadership, typography must communicate **fantasy gravitas** (display) and **mechanical clarity** (body).

**Pair:**
- **Display:** *Cinzel* (serif, classical, evokes inscribed stone and guild banners)
- **Body:** *Source Sans 3* (humanist sans, legible at small sizes, open-source)

### 1.2 Loading Strategy

**Web (now):** Add to `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
```

**Electron (later):** Self-host into `public/fonts/` and replace the `<link>` with `@font-face` blocks. Document this in `public/fonts/README.md`.

**Preload (optional):**
```html
<link rel="preload" href="https://fonts.gstatic.com/s/cinzel/v19/...woff2" as="font" type="font/woff2" crossorigin>
```
(Exact URL is dynamic; preloading is optional for v1.)

### 1.3 CSS Custom Properties

Replace `:root` in `src/App.css` (after existing color tokens, before spacing scale) with:

```css
:root {
  /* ... existing color tokens ... */

  /* Typography */
  --font-display: 'Cinzel', 'Cinzel Decorative', 'Playfair Display', serif;
  --font-body: 'Source Sans 3', 'Source Sans Pro', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

  /* Font size scale — replaces all ad-hoc rem values */
  --text-xs: 0.66rem;   /* stat labels, perk tags */
  --text-sm: 0.75rem;   /* row desc, info-note-body, settings hints, section titles (was 0.72rem and 0.78rem) */
  --text-md: 0.85rem;   /* row sub, body secondary */
  --text-base: 1rem;    /* buttons, primary body */
  --text-lg: 1.2rem;    /* story modal titles, modal headers */
  --text-xl: 1.5rem;    /* header gold amount */
  --text-2xl: 1.8rem;   /* currency banners, prestige numbers */
  --text-3xl: 2.4rem;   /* reserved for future hero moments */
}
```

**Consolidation rule:** `0.72rem` and `0.78rem` are merged into `--text-sm: 0.75rem`. Accept slight visual shifts in ~20 places. All other rem values map to their nearest `--text-*` token.

### 1.4 Complete CSS Diff Manifest

The following selectors **must** be updated. This is exhaustive — do not skip any.

**`body` (line 50):**
```css
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
}
```

**Display font assignments (`font-family: var(--font-display)`):**
```css
/* App.css line 90 */
.energy-amount {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

/* App.css line 479 */
.click-button {
  font-family: var(--font-display);
  /* ... rest unchanged ... */
}

/* App.css line 236 */
.section-title {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  color: var(--text-dim);
  font-weight: 700;
  /* REMOVE: text-transform: uppercase; */
  letter-spacing: 0.02em;
  /* ... rest unchanged ... */
}

/* App.css line 560 */
.found-guild {
  font-family: var(--font-display);
  /* ... rest unchanged ... */
}

/* App.css line 1591 */
.currency-amount {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  /* ... rest unchanged ... */
}

/* App.css line 1610 */
.prestige-button {
  font-family: var(--font-display);
  /* ... rest unchanged ... */
}

/* App.css line 1718 */
.story-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  margin: 0 0 10px;
  color: var(--accent);
}

/* NEW: any h3 inside modal body */
.modal-body h3 {
  font-family: var(--font-display);
}
```

**Body font assignments (`font-family: var(--font-body)` — explicit where inherited):**
```css
/* App.css line 397 */
.row-name {
  font-family: var(--font-body);
  font-weight: 600;
}

/* App.css line 401 */
.row-sub {
  font-family: var(--font-body);
  color: var(--text-dim);
  font-weight: 400;
  font-size: var(--text-md);
}

/* App.css line 407 */
.row-desc {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-dim);
}

/* App.css line 1103 */
.stat-label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-dim);
  text-align: center;
  line-height: 1.25;
}

/* App.css line 216 */
.tab-label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}

/* App.css line 1724 */
.story-text {
  font-family: var(--font-body);
  margin: 0 0 18px;
  line-height: 1.6;
  color: var(--text);
  font-size: var(--text-md);
}

/* App.css line 841 */
.detail-sub {
  font-family: var(--font-body);
  margin: 0;
  color: var(--text-dim);
  font-size: var(--text-md);
}

/* App.css line 1760 */
.settings-label {
  font-family: var(--font-body);
  font-weight: 600;
}

/* App.css line 777 */
.progress-time {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-dim);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* App.css line 796 */
.log-entry {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  line-height: 1.4;
}

/* App.css line 1163 */
.info-note-body {
  font-family: var(--font-body);
  margin: 0;
  padding: 0 10px 10px;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-dim);
}
```

**Monospace assignments (`font-family: var(--font-mono)`):**
Keep `font-variant-numeric: tabular-nums` on all numeric values. Add explicit mono only where needed:
```css
/* Already have tabular-nums; ensure no accidental font override */
.stat-value,
.row-cost,
.materials-list-qty,
.attr-value,
.progress-time,
.eps,
.day-counter,
.shard-counter,
.rep-counter {
  font-variant-numeric: tabular-nums;
}
```

**Button cascade override:**
`.click-button`, `.prestige-button`, `.found-guild`, `.currency-amount` already have explicit `font-family: var(--font-display)` above. `.small-button`, `.subtab`, and other generic buttons keep `font: inherit` but inherit from `body` (now `--font-body`), which is correct.

### 1.5 PixiJS Font Integration

In `src/ui/BattleViewer.tsx`, Effect 1 (line 641), add `await document.fonts.ready` before PixiJS init:

```tsx
useEffect(() => {
  const div = containerRef.current;
  if (!div) return;

  const w = div.clientWidth || 500;
  const h = div.clientHeight || 280;
  let destroyed = false;

  const app = new Application();

  (async () => {
    await document.fonts.ready; // <-- ADD THIS LINE
    await app.init({
      width: w,
      height: h,
      background: zoneBgColor(tier),
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    if (destroyed) { app.destroy(); return; }
    // ... rest unchanged ...
  })();

  return () => {
    destroyed = true;
    // ... rest unchanged ...
  };
}, []);
```

Replace all `fontFamily: 'monospace'` in `TextStyle` constructors (lines 235, 270, 316, 338) with:
```ts
fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif"
```

### 1.6 Reduced Motion

No `prefers-reduced-font` behavior. Font loading is not animation. Use `display=swap` on Google Fonts link so text remains visible during load.

### 1.7 File Change Manifest

| Action | File | Details |
|--------|------|---------|
| **Modify** | `index.html` | Add Google Fonts `<link>` inside `<head>` |
| **Modify** | `src/App.css` | Add `--font-*` and `--text-*` to `:root`. Update every selector in §1.4. Remove `text-transform: uppercase` from `.section-title`. |
| **Modify** | `src/ui/BattleViewer.tsx` | Add `await document.fonts.ready`. Update `TextStyle` fontFamily strings. |
| **Create** | `public/fonts/README.md` | Document future self-hosting for Electron. |

---

## 2. ConfirmModal + Modal Improvements

### 2.1 Design Rationale
Native `window.confirm()` breaks visual language and accessibility. Two locations must be replaced:
1. `SettingsPanel.tsx` — "Reset all progress"
2. `TimelineSection.tsx` — "Travel back in time?"

### 2.2 ConfirmModal API

Add to `src/ui/components.tsx` (after existing `Modal` export, line 163):

```tsx
export interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel?: () => void;
  dismissable?: boolean;
  icon?: IconName;
}
```

**Rules:**
- No `onClose` prop. The parent controls visibility entirely via `onConfirm` / `onCancel`.
- `message` is `ReactNode` (not `string`) to allow `<strong>`, `<br>`, etc.
- `variant='danger'` → confirm button uses `.small-button.danger`, cancel uses `.small-button`.
- `variant='primary'` → confirm button uses `.small-button.primary`, cancel uses `.small-button`.

### 2.3 ConfirmModal Implementation

```tsx
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
  dismissable = true,
  icon,
}: ConfirmModalProps) {
  return (
    <Modal
      title={icon ? <><Icon name={icon} /> {title}</> : title}
      onClose={() => onCancel?.()}
      dismissable={dismissable}
      footer={
        <>
          <button
            className="small-button"
            onClick={() => onCancel?.()}
            autoFocus={variant === 'danger'}
          >
            {cancelLabel}
          </button>
          <button
            className={`small-button ${variant === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            autoFocus={variant === 'primary'}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="story-text" id="modal-desc">{message}</p>
    </Modal>
  );
}
```

### 2.4 Modal Base Component Improvements

**Add ref and ARIA to `Modal` (`src/ui/components.tsx`, line 126):**

```tsx
export function Modal({
  title,
  onClose,
  children,
  footer,
  dismissable = true,
  className,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  dismissable?: boolean;
  className?: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const modalEl = modalRef.current;
    if (!modalEl) return;

    const focusables = modalEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissable) {
        const activeInModal = modalEl.contains(document.activeElement);
        if (activeInModal) {
          onCloseRef.current();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keydown', onEscape);
      trigger?.focus();
    };
  }, [dismissable]);

  return (
    <div className="story-overlay" onClick={dismissable ? onClose : undefined}>
      <div
        ref={modalRef}
        className={`story-modal detail-modal ${className ?? ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={typeof children === 'object' ? 'modal-desc' : undefined}
      >
        <div className="detail-header">
          <h2 className="story-title" id="modal-title">{title}</h2>
          {dismissable && (
            <button className="icon-button" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
```

**Key rules:**
- `useRef<HTMLDivElement>` attached to the inner modal div.
- `onClose` stored in `onCloseRef` so the effect dependency is only `[dismissable]`.
- Escape only closes if `modalRef.current.contains(document.activeElement)` — prevents closing nested/backdrop modals.
- Focus returns to `trigger` (the element that was active before the modal opened) on unmount.

### 2.5 Keyboard Behavior

| Key | Action |
|-----|--------|
| `Enter` | Triggers the focused button (Cancel if danger variant, Confirm if primary variant). |
| `Escape` | Calls `onCancel()` if `dismissable` and focus is inside the modal. |
| `Tab` | Cycles focusables inside modal. Wraps last→first. |
| `Shift+Tab` | Cycles backwards. Wraps first→last. |

### 2.6 ConfirmModal Usage Replacements

#### SettingsPanel.tsx
**Current (line 112):**
```tsx
if (confirm('Wipe your entire save and start over? This cannot be undone.')) {
  localStorageAdapter.clear();
  store.dispatch(() => createInitialState());
}
```

**New:**
Add state:
```tsx
const [resetOpen, setResetOpen] = useState(false);
```

Replace button:
```tsx
<button className="danger-button" onClick={() => setResetOpen(true)}>
  Reset all progress
</button>
```

Add at end of return:
```tsx
{resetOpen && (
  <ConfirmModal
    title="Reset All Progress"
    message={
      <>
        Wipe your entire save and start over? <strong>This cannot be undone.</strong>
        <br /><br />
        Your timeline, champions, and inventory will be lost forever.
      </>
    }
    confirmLabel="Reset Everything"
    cancelLabel="Keep Playing"
    variant="danger"
    icon="warning"
    onConfirm={() => {
      localStorageAdapter.clear();
      store.dispatch(() => createInitialState());
      setResetOpen(false);
    }}
    onCancel={() => setResetOpen(false)}
  />
)}
```

#### TimelineSection.tsx
**Current (line 36):**
```tsx
if (
  state.settings.confirmPrestige &&
  !confirm(
    'Travel back in time? The town, guild, and adventurers reset. Time Shards and perks persist.',
  )
) {
  return;
}
```

**New:**
Add state:
```tsx
const [travelOpen, setTravelOpen] = useState(false);
```

Replace `travel` function:
```tsx
const travel = () => {
  if (!ready) return;
  if (state.settings.confirmPrestige) {
    setTravelOpen(true);
    return;
  }
  store.dispatch((s) => timeTravel(s));
};
```

Add at end of return (before closing `</div>`):
```tsx
{travelOpen && (
  <ConfirmModal
    title="Travel Back in Time"
    message={
      <>
        The town, guild, and adventurers will reset.
        <br /><br />
        <strong>Time Shards and perks persist across timelines.</strong> Are you ready to begin again?
      </>
    }
    confirmLabel="Travel Back"
    cancelLabel="Stay Here"
    variant="primary"
    icon="hourglass"
    onConfirm={() => {
      store.dispatch((s) => timeTravel(s));
      setTravelOpen(false);
    }}
    onCancel={() => setTravelOpen(false)}
  />
)}
```

### 2.7 File Change Manifest

| Action | File | Details |
|--------|------|---------|
| **Modify** | `src/ui/components.tsx` | Add `ConfirmModal` export. Rewrite `Modal` with `useRef`, focus trap, `aria-labelledby`, `aria-describedby`. |
| **Modify** | `src/ui/panels/SettingsPanel.tsx` | Replace native `confirm` with `ConfirmModal` + `resetOpen` state. |
| **Modify** | `src/ui/panels/TimelineSection.tsx` | Replace native `confirm` with `ConfirmModal` + `travelOpen` state. |

---

## 3. Toast & Celebration System

### 3.1 Design Rationale
Idle games need micro-rewards. Currently no transient feedback for crafting, level-ups, quest completions. The **Peak-End Rule** demands that the prestige moment (the end of a run) be emotionally punctuated.

**Architecture decision:** Toast triggers come from the **game engine**, not UI watcher hooks. This avoids the "panel unmounted = toast lost" problem and keeps UI decoupled from game logic.

### 3.2 Engine Event Emitter

Create `src/game/events.ts`:

```ts
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
  for (const fn of listeners) fn(event);
}

export function onGameEvent(fn: Listener) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}
```

**Rules:**
- `emitGameEvent` is called from pure game functions (e.g., `startCraft`, `hireCandidate`, `postQuest`, `applyOfflineProgress`).
- The UI subscribes via `onGameEvent` in a single `useEffect` inside `ToastStack`.
- No React context. No UI polling.

### 3.3 Emit Points in Game Logic

Add `emitGameEvent` calls at these locations:

| Event | File | Function | When to emit |
|-------|------|----------|--------------|
| `crafting-complete` | `src/game/guild.ts` | `completeCraft` (or wherever crafting finishes) | After `state.inventory.push(...)` |
| `champion-level-up` | `src/game/adventurers.ts` | `addXp` or level-up logic | When `adv.level` increases |
| `quest-posted` | `src/game/guild.ts` | `postQuest` | After quest is added to `state.quests` |
| `quest-completed` | `src/game/engine.ts` | Quest resolution tick | When a quest batch completes |
| `zone-unlocked` | `src/game/guild.ts` or `src/game/engine.ts` | When reputation crosses threshold | When `isZoneUnlocked` becomes true for the first time |
| `forge-unlocked` | `src/game/guild.ts` or `src/game/engine.ts` | When `forgeUnlocked` becomes true | First time only |
| `offline-summary` | `src/game/engine.ts` | `applyOfflineProgress` | After catch-up completes, with summary payload |

**Important:** For "first time only" events (zone unlock, forge unlock), the game logic must track whether it has already emitted. Do not emit on every tick where the condition is true. Use a flag in `GameState` or check the transition inside the emit logic.

### 3.4 ToastStack Component

Create `src/ui/ToastStack.tsx`:

```tsx
import { memo, useEffect, useState } from 'react';
import type { GameEvent } from '../game/events';
import { onGameEvent } from '../game/events';
import { Icon, type IconName } from './icons';

interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning';
  icon?: IconName;
  duration: number;
}

let toastId = 0;

const ToastStack = memo(function ToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return onGameEvent((event: GameEvent) => {
      const item = eventToToast(event);
      if (!item) return;
      setToasts((prev) => {
        const next = [...prev, item];
        if (next.length > 2) next.shift();
        return next;
      });
    });
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
});

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), toast.duration);
    const t2 = setTimeout(onDismiss, toast.duration + 220);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [toast.duration, onDismiss]);

  return (
    <div
      className={`toast toast-tone-${toast.tone} ${exiting ? 'toast-out' : ''}`}
      role={toast.tone === 'warning' ? 'alert' : 'status'}
      aria-live={toast.tone === 'warning' ? 'assertive' : 'polite'}
    >
      {toast.icon && <Icon name={toast.icon} />}
      <span style={{ flex: 1, color: 'var(--text)' }}>{toast.message}</span>
      <button
        className="toast-close"
        onClick={() => {
          setExiting(true);
          setTimeout(onDismiss, 220);
        }}
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
      return {
        id: ++toastId,
        message: 'Forging complete — new equipment ready!',
        tone: 'success',
        icon: 'hammer',
        duration: 3500,
      };
    case 'champion-level-up': {
      const p = event.payload as { name: string; level: number } | undefined;
      return {
        id: ++toastId,
        message: p ? `${p.name} reached level ${p.level}!` : 'A champion gained a level!',
        tone: 'success',
        icon: 'star',
        duration: 3500,
      };
    }
    case 'quest-posted':
      return {
        id: ++toastId,
        message: 'Quest posted to the board.',
        tone: 'info',
        icon: 'plus',
        duration: 3000,
      };
    case 'quest-completed':
      return {
        id: ++toastId,
        message: 'A quest was fulfilled!',
        tone: 'success',
        icon: 'check',
        duration: 3500,
      };
    case 'zone-unlocked': {
      const p = event.payload as { name: string } | undefined;
      return {
        id: ++toastId,
        message: p ? `${p.name} is now open!` : 'A new zone is open!',
        tone: 'success',
        icon: 'map',
        duration: 4000,
      };
    }
    case 'forge-unlocked':
      return {
        id: ++toastId,
        message: 'The Forge is open — craft your own gear.',
        tone: 'success',
        icon: 'hammer',
        duration: 4000,
      };
    case 'offline-summary': {
      const p = event.payload as { questsCompleted: number; championsLeveled: number; itemsForged: number } | undefined;
      if (!p || (p.questsCompleted === 0 && p.championsLeveled === 0 && p.itemsForged === 0)) return null;
      const parts: string[] = [];
      if (p.questsCompleted > 0) parts.push(`${p.questsCompleted} quest${p.questsCompleted === 1 ? '' : 's'} fulfilled`);
      if (p.championsLeveled > 0) parts.push(`${p.championsLeveled} champion${p.championsLeveled === 1 ? '' : 's'} leveled up`);
      if (p.itemsForged > 0) parts.push(`${p.itemsForged} item${p.itemsForged === 1 ? '' : 's'} forged`);
      return {
        id: ++toastId,
        message: `While you were away: ${parts.join(', ')}.`,
        tone: 'info',
        icon: 'info',
        duration: 5000,
      };
    }
    default:
      return null;
  }
}

export default ToastStack;
```

### 3.5 Toast CSS

Add to `src/App.css`:

```css
/* Toast stack positioning */
.toast-stack {
  position: fixed;
  bottom: calc(96px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  max-width: 440px;
  width: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 7;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--panel);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  font-size: var(--text-md);
  animation: toast-in 0.25s ease-out;
}

.toast.toast-out {
  animation: toast-out 0.2s ease-in forwards;
}

.toast-tone-success {
  border-color: var(--green);
}
.toast-tone-success .icon {
  color: var(--green);
}

.toast-tone-warning {
  border-color: var(--red);
}
.toast-tone-warning .icon {
  color: var(--red);
}

.toast-tone-info {
  border-color: var(--accent-dim);
}
.toast-tone-info .icon {
  color: var(--accent);
}

.toast-close {
  margin-left: auto;
  padding: 0;
  min-width: var(--touch); /* 44px */
  min-height: var(--touch); /* 44px */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
}

@keyframes toast-in {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: none; opacity: 1; }
}

@keyframes toast-out {
  from { transform: none; opacity: 1; }
  to { transform: translateY(8px); opacity: 0; }
}

.reduced-motion .toast {
  animation: none;
}
.reduced-motion .toast.toast-out {
  opacity: 0;
  transition: opacity 0.15s;
}

@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none !important;
  }
}
```

### 3.6 Pause/Resume Toasts for Offline Catch-Up

Create `src/ui/toastPause.ts`:

```ts
let paused = false;
let backlog: GameEvent[] = [];

export function pauseToasts() {
  paused = true;
  backlog = [];
}

export function resumeToasts() {
  paused = false;
  // Emit a single offline-summary event if there were any relevant events
  const summary = {
    questsCompleted: 0,
    championsLeveled: 0,
    itemsForged: 0,
  };
  for (const ev of backlog) {
    if (ev.type === 'quest-completed') summary.questsCompleted++;
    if (ev.type === 'champion-level-up') summary.championsLeveled++;
    if (ev.type === 'crafting-complete') summary.itemsForged++;
  }
  if (summary.questsCompleted > 0 || summary.championsLeveled > 0 || summary.itemsForged > 0) {
    emitGameEvent({ type: 'offline-summary', payload: summary });
  }
  backlog = [];
}

export function isToastsPaused() {
  return paused;
}

export function pushBacklog(event: GameEvent) {
  if (paused) backlog.push(event);
}
```

**Integration in `src/game/events.ts`:**
Modify `emitGameEvent` to respect pause:
```ts
export function emitGameEvent(event: GameEvent) {
  if (isToastsPaused()) {
    pushBacklog(event);
    return;
  }
  for (const fn of listeners) fn(event);
}
```

**Integration in `src/App.tsx`:**
In `handleOfflineCatchup` and the init flow:
```tsx
import { pauseToasts, resumeToasts } from './ui/toastPause';

// Before catch-up:
pauseToasts();

// After catch-up:
resumeToasts();
```

### 3.7 Mount Point

In `src/App.tsx`, mount `ToastStack` **outside** `Shell` so it does not re-render on game-state ticks:

```tsx
export default function App() {
  // ... existing state ...
  return (
    <GameContext.Provider value={init.store}>
      <ToastStack />
      <Shell ... />
    </GameContext.Provider>
  );
}
```

Remove `ToastStack` from inside `Shell`.

### 3.8 Prestige Celebration as Story Beat

**Decision:** Prestige celebration is not a separate overlay. It is a **special story beat type** rendered through the existing `StoryModal` system.

**Implementation:**

1. In `src/game/story.ts`, add a new beat definition or generate one dynamically when `timeTravel` is called:
```ts
const PRESTIGE_BEAT_ID = 'prestige-celebration';

// In timeTravel or after it fires:
state.pendingStories.push(PRESTIGE_BEAT_ID);
```

2. In `src/game/story.ts` `storyBeatDef`, handle the prestige beat:
```ts
export function storyBeatDef(id: string): StoryBeat | null {
  if (id === PRESTIGE_BEAT_ID) {
    return {
      id: PRESTIGE_BEAT_ID,
      title: 'Timeline Rewritten',
      text: 'The crystal hums with new possibilities. Everything resets, but you carry the shards forward.',
      type: 'prestige',
    };
  }
  // ... existing lookup ...
}
```

3. In `StoryModal` (refactored to use `Modal`, see §4), detect `type === 'prestige'` and apply special styling:
```tsx
// Inside the refactored StoryModal
const isPrestige = beat.type === 'prestige';
```

4. Add prestige-specific CSS to `App.css`:
```css
.story-modal.prestige-beat {
  border-color: var(--shard);
  background: linear-gradient(180deg, #10222e, #0b1822);
}

.prestige-beat .story-title {
  color: var(--shard);
}

.prestige-beat .story-text {
  color: var(--text-dim);
}

.prestige-beat .story-continue {
  border-color: var(--shard);
  background: linear-gradient(180deg, #10222e, #0b1822);
  color: var(--shard);
}
```

5. Auto-dismiss behavior: The story beat system normally requires explicit "Continue". For the prestige beat, add an auto-dismiss timer inside `StoryModal`:
```tsx
useEffect(() => {
  if (!isPrestige) return;
  const t = setTimeout(() => store.dispatch((s) => dismissStory(s, beatId)), 4000);
  return () => clearTimeout(t);
}, [isPrestige, beatId, store]);
```
For reduced motion, increase to 6000ms or require manual dismissal:
```tsx
const autoDismissMs = state.settings.reducedMotion ? 6000 : 4000;
```

### 3.9 File Change Manifest

| Action | File | Details |
|--------|------|---------|
| **Create** | `src/game/events.ts` | `emitGameEvent`, `onGameEvent`, `GameEvent` types |
| **Create** | `src/ui/toastPause.ts` | `pauseToasts`, `resumeToasts`, `isToastsPaused`, `pushBacklog` |
| **Create** | `src/ui/ToastStack.tsx` | `ToastStack` + `ToastRow` components |
| **Modify** | `src/game/events.ts` | Add pause check inside `emitGameEvent` |
| **Modify** | `src/App.tsx` | Mount `<ToastStack />` outside `Shell`. Call `pauseToasts`/`resumeToasts` around offline catch-up. |
| **Modify** | `src/App.css` | Add `.toast-*`, `.toast-tone-*`, toast animations, `.prestige-beat` styles |
| **Modify** | `src/game/guild.ts` | Add `emitGameEvent` calls for crafting, quest posting, zone unlock, forge unlock |
| **Modify** | `src/game/adventurers.ts` | Add `emitGameEvent` call for level-up |
| **Modify** | `src/game/engine.ts` | Add `emitGameEvent` call for quest completion. Add `emitGameEvent` for offline summary. |
| **Modify** | `src/game/story.ts` | Add prestige beat definition and queue logic |

---

## 4. Scope Additions

### 4.1 StoryModal Refactor to Use Modal

**File:** `src/ui/StoryModal.tsx`

**Current:** Duplicates `.story-overlay` / `.story-modal` markup.
**New:** Compose the shared `Modal` component.

```tsx
import { useEffect } from 'react';
import { dismissStory, storyBeatDef } from '../game/story';
import { useGameState, useGameStore } from '../hooks/useGame';
import { useBattleOpen } from './battlePresence';
import { playNotify } from './sfx';
import { Modal } from './components';

export function StoryModal() {
  const store = useGameStore();
  const state = useGameState();
  const battleOpen = useBattleOpen();
  const beatId = battleOpen ? undefined : (state.pendingStories[0] as string | undefined);

  useEffect(() => {
    if (beatId && store.getState().settings.sfxEnabled) playNotify();
  }, [beatId, store]);

  if (!beatId) return null;
  const beat = storyBeatDef(beatId);
  if (!beat) return null;

  const isPrestige = beat.type === 'prestige';

  return (
    <Modal
      title={beat.title}
      onClose={() => store.dispatch((s) => dismissStory(s, beatId))}
      dismissable={false}
      className={isPrestige ? 'prestige-beat' : ''}
      footer={
        <button
          className="story-continue"
          onClick={() => store.dispatch((s) => dismissStory(s, beatId))}
        >
          Continue
        </button>
      }
    >
      <p className="story-text">{beat.text}</p>
    </Modal>
  );
}
```

**Key changes:**
- Uses `Modal` shell (gets focus trap, ARIA, backdrop, mobile sheet animation for free).
- `dismissable={false}` — story beats require explicit "Continue".
- Prestige beat gets `className="prestige-beat"` for blue/cyan styling.
- Remove the old inline `.story-overlay` / `.story-modal` markup from this file.
- Keep the existing `.story-overlay`, `.story-modal`, `.story-title`, `.story-text`, `.story-continue` CSS classes in `App.css` — they are still used by `Modal`'s inner structure. The `Modal` component renders `className="story-modal detail-modal ${className}"`, so `.story-modal` CSS still applies.

**Auto-dismiss for prestige:** Add inside `StoryModal` — all hooks must be hoisted above early returns per React Rules of Hooks, and use `store.getState()` in the effect to avoid stale closures:
```tsx
useEffect(() => {
  if (beatId && store.getState().settings.sfxEnabled) playNotify();
}, [beatId, store]);

useEffect(() => {
  if (!isPrestige || !beatId) return;
  const ms = store.getState().settings.reducedMotion ? 6000 : 4000;
  const t = setTimeout(() => store.dispatch((s) => dismissStory(s, beatId)), ms);
  return () => clearTimeout(t);
}, [isPrestige, beatId, store]);
```

### 4.2 QuestCreationDialog Checkbox Accessibility Fix

**File:** `src/ui/panels/MapPanel.tsx` (lines 611–644)

**Current:** `readOnly` checkbox with row-level `onClick`.
**Problem:** Screen readers cannot interact. Keyboard users cannot Space/Enter the checkbox.

**New implementation:**

```tsx
{targets.map((target) => {
  const isSelected = !!checked[target.id];
  const checkboxDisabled = !isSelected && atCap;
  return (
    <label
      key={target.id}
      className={`row quest-checklist-row ${checkboxDisabled ? 'disabled' : ''}`}
      htmlFor={`quest-check-${target.id}`}
      onClick={() => !checkboxDisabled && toggle(target.id)}
    >
      <input
        id={`quest-check-${target.id}`}
        type="checkbox"
        checked={isSelected}
        disabled={checkboxDisabled}
        onChange={() => toggle(target.id)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="row-info">
        <span className="row-name">{target.name}</span>
        <span className="row-desc">
          {target.kind === 'monster' ? 'Kill' : 'Collect'} → {materialName(target.materialId)}
        </span>
      </div>
      <div className="field-label" onClick={(e) => e.stopPropagation()}>
        <span>amount</span>
        <input
          type="number"
          min={1}
          max={QUEST_MAX_BATCH}
          disabled={!isSelected}
          value={amounts[target.id] ?? String(DEFAULT_AMOUNT)}
          onChange={(e) => setAmount(target.id, e.target.value)}
        />
      </div>
    </label>
  );
})}
```

**Key changes:**
- `<label>` wraps the entire row. `htmlFor` points to the checkbox `id`.
- Checkbox is no longer `readOnly`. It has a real `onChange` handler.
- `onClick` on the label toggles the checkbox (unless disabled).
- `onClick` on the checkbox itself calls `e.stopPropagation()` to prevent double-toggle.
- The amount input is wrapped in a `<div className="field-label">` instead of a `<label>` to avoid nested label issues. The existing `.field-label` CSS already styles this correctly.

### 4.3 File Change Manifest for Scope Additions

| Action | File | Details |
|--------|------|---------|
| **Modify** | `src/ui/StoryModal.tsx` | Refactor to use `Modal` component. Add prestige auto-dismiss. |
| **Modify** | `src/ui/panels/MapPanel.tsx` | Fix checkbox rows: real `<label>` + `<input>` with `onChange`. |

---

## 5. Implementation Sequence

### Build Order (with Dependencies)

```
1. Typography System
   └── Independent. Do first for visual payoff.

2. Modal Improvements (focus trap, ref, ARIA)
   └── Independent of Typography but can ship together.

3. StoryModal Refactor
   └── Depends on: Modal improvements (step 2).

4. ConfirmModal
   └── Depends on: Modal improvements (step 2).

5. Toast System (ToastStack, events.ts, toastPause.ts)
   └── Independent of Modal. Can ship in parallel with steps 2–4.

6. Emit Points in Game Logic
   └── Depends on: events.ts (step 5).

7. Prestige Celebration as Story Beat
   └── Depends on: StoryModal refactor (step 3) + events.ts (step 5).

8. QuestCreationDialog Checkbox Fix
   └── Independent. Can ship anytime.
```

### Recommended Sprint Breakdown

| Sprint | Items |
|--------|-------|
| **Sprint A** | Typography (1) + Modal improvements (2) + StoryModal refactor (3) |
| **Sprint B** | ConfirmModal (4) + QuestCreationDialog fix (8) |
| **Sprint C** | Toast system (5) + Emit points (6) + Prestige celebration (7) |

---

## 6. Complete File Change Manifest

### Files to Create

| File | Purpose |
|------|---------|
| `public/fonts/README.md` | Electron self-hosting instructions |
| `src/game/events.ts` | Game event emitter (`emitGameEvent`, `onGameEvent`) |
| `src/ui/toastPause.ts` | Toast pause/resume for offline catch-up |
| `src/ui/ToastStack.tsx` | Toast UI component |

### Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add Google Fonts `<link>` |
| `src/App.css` | Add `--font-*`, `--text-*` tokens. Update all selectors per §1.4. Add `.toast-*`, `.prestige-beat` styles. Add `.cost-part` CSS. |
| `src/App.tsx` | Mount `<ToastStack />` outside `Shell`. Call `pauseToasts`/`resumeToasts` around offline catch-up. |
| `src/ui/components.tsx` | Rewrite `Modal` with `useRef`, focus trap, `aria-labelledby`, `aria-describedby`. Add `ConfirmModal` export. |
| `src/ui/StoryModal.tsx` | Refactor to use `Modal`. Add prestige auto-dismiss. |
| `src/ui/BattleViewer.tsx` | Add `await document.fonts.ready`. Update `TextStyle` fontFamily. |
| `src/ui/panels/SettingsPanel.tsx` | Replace native `confirm` with `ConfirmModal` + `resetOpen` state. |
| `src/ui/panels/TimelineSection.tsx` | Replace native `confirm` with `ConfirmModal` + `travelOpen` state. |
| `src/ui/panels/MapPanel.tsx` | Fix checkbox rows: real `<label>` + `<input>` with `onChange`. |
| `src/ui/panels/CraftingPanel.tsx` | Add `emitGameEvent` call on crafting completion. |
| `src/game/guild.ts` | Add `emitGameEvent` calls for quest posting, zone unlock, forge unlock. |
| `src/game/adventurers.ts` | Add `emitGameEvent` call on level-up. |
| `src/game/engine.ts` | Add `emitGameEvent` call for quest completion. Add `emitGameEvent` for offline summary. |
| `src/game/story.ts` | Add prestige beat definition and queue logic. |

---

## 7. Testing Checklist

### Typography
- [ ] No FOUT on slow 3G (font swap works)
- [ ] PixiJS labels render in Source Sans 3, not fallback
- [ ] Tabular nums still align in header, stats, costs
- [ ] iPhone SE (375px): no tab label wrapping, no stat label truncation
- [ ] `.section-title` no longer uppercase; reads cleanly in Cinzel

### Modal / ConfirmModal
- [ ] Tab cycles between Confirm and Cancel buttons
- [ ] Shift+Tab cycles backwards
- [ ] Escape closes only if focus is inside the modal
- [ ] Focus returns to trigger button on close
- [ ] `variant="danger"` focuses Cancel first; Enter cancels
- [ ] `variant="primary"` focuses Confirm first; Enter confirms
- [ ] Screen reader announces dialog name and description

### StoryModal
- [ ] Uses shared Modal shell (inspect DOM: `role="dialog"` present)
- [ ] Cannot be dismissed by Escape or backdrop click
- [ ] Prestige beat auto-dismisses after 4s (6s in reduced motion)
- [ ] Prestige beat has blue/cyan border and title color

### Toast System
- [ ] Crafting completion fires toast when forging finishes
- [ ] Champion level-up fires toast with name and level
- [ ] Max 2 toasts visible; oldest dismissed when third arrives
- [ ] Offline catch-up suppresses individual toasts; shows single summary
- [ ] Toast close button is 44px hit area
- [ ] Reduced motion disables slide animation
- [ ] Warning toasts use `role="alert"` / `aria-live="assertive"`

### QuestCreationDialog
- [ ] Checkbox is focusable and toggleable via keyboard Space/Enter
- [ ] Screen reader announces checkbox state
- [ ] Row click still toggles checkbox (unless disabled)
- [ ] Amount input does not interfere with checkbox toggle

---

**End of Consolidated Specification**