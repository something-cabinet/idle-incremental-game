/**
 * Small presentational pieces shared by every panel. These exist mainly to
 * stop the same markup drifting apart across eight panels — the stat tile and
 * the "3-across stat grid" in particular were hand-rolled in three places with
 * slightly different classes.
 */

import { useState, type ReactNode } from 'react';
import type { StatChip } from './display';
import { Icon, type IconName } from './icons';

// ---------------------------------------------------------------------------
// Stat tiles
// ---------------------------------------------------------------------------

/** A labelled tile. `icon` is optional and sits before the value. */
export function Stat({
  value,
  label,
  icon,
  tone,
}: {
  value: string | number;
  label: string;
  icon?: IconName;
  tone?: 'accent' | 'shard' | 'green';
}) {
  return (
    <div className="stat">
      <span className={`stat-value ${tone ? `tone-${tone}` : ''}`}>
        {icon && <Icon name={icon} />}
        {value}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/**
 * Wraps stat tiles in a grid that fits as many as will fit rather than forcing
 * three columns — a 2-tile group used to leave an orphaned empty cell, and at
 * 320px three columns squeezed labels like "Dungeons Cleared" to nothing.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

// ---------------------------------------------------------------------------
// Stat chips (item ATK/DEF/HP/attributes)
// ---------------------------------------------------------------------------

export function StatChips({ parts, className }: { parts: StatChip[]; className?: string }) {
  return (
    <span className={`stat-chips ${className ?? ''}`}>
      {parts.map((p) => (
        <span className="stat-chip" key={p.key}>
          {p.icon && <Icon name={p.icon} />}
          {p.text}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Collapsible help
// ---------------------------------------------------------------------------

/**
 * Session-scoped record of which help notes the player has collapsed. Module
 * scope (not React state) so switching tabs and back doesn't re-open a note
 * that was just dismissed, and not persisted to the save because this is
 * UI chrome, not progress — same reasoning as hooks/usePanelSection.
 */
const dismissed: Record<string, boolean> = {};

/**
 * Explanatory prose, collapsed behind an ⓘ toggle.
 *
 * Panels used to open with a permanent paragraph of instructions, which costs
 * a phone screen's worth of vertical space forever to explain something once
 * (and players skip it anyway — the Paradox of the Active User). Callers pass
 * `defaultOpen` when the surrounding UI is empty, so a first-time player who
 * has nothing to look at still gets the explanation unprompted.
 */
export function InfoNote({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => (dismissed[id] ? false : defaultOpen));

  function toggle() {
    const next = !open;
    if (!next) dismissed[id] = true;
    setOpen(next);
  }

  return (
    <div className={`info-note ${open ? 'open' : ''}`}>
      <button className="info-note-toggle" onClick={toggle} aria-expanded={open}>
        <Icon name="info" />
        <span>{title}</span>
        <Icon name="chevron" className="info-note-chevron" />
      </button>
      {open && <p className="info-note-body">{children}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

/**
 * Every modal in the game: dim backdrop, click-outside to close, a titled
 * header with a real 44px close target. On phones it docks to the bottom as a
 * sheet (thumb-reachable) instead of floating in the middle.
 */
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
  /** Blocking modals (a battle in progress) opt out of click-outside. */
  dismissable?: boolean;
  className?: string;
}) {
  return (
    <div className="story-overlay" onClick={dismissable ? onClose : undefined}>
      <div
        className={`story-modal detail-modal ${className ?? ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="detail-header">
          <h2 className="story-title">{title}</h2>
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

// ---------------------------------------------------------------------------
// Status rows
// ---------------------------------------------------------------------------

/**
 * A read-only informational row. Distinct from `.row-disabled`: this is
 * legible body text, not a greyed-out unavailable control. Previously both
 * used `.row.locked` at 45% opacity, which pushed live numbers — craft costs,
 * quest previews, guild upkeep — to roughly 2.3:1 contrast.
 */
export function NoteRow({
  children,
  icon,
  tone,
}: {
  children: ReactNode;
  icon?: IconName;
  tone?: 'muted' | 'warning' | 'locked';
}) {
  return (
    <div className={`row row-static ${tone ? `row-${tone}` : ''}`}>
      {icon && <Icon name={icon} className="row-static-icon" />}
      <div className="row-info">{children}</div>
    </div>
  );
}
