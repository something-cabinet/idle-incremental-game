/**
 * The game's whole icon vocabulary — one monochrome line-art set drawn on a
 * 24x24 grid, stroked with `currentColor` so every icon inherits the colour of
 * the text around it (rarity tints, accent gold, red warnings, dim captions).
 *
 * Deliberately small. Icons are shared aggressively across concepts that read
 * the same at 16px: all blade weapons use `blade`, every essence uses
 * `essence`, reputation and quality both use `star`. A player learns ~25
 * shapes instead of ~50 emoji, and the set stays visually consistent because
 * it's one hand.
 *
 * Sizing is em-based, so an icon always matches its line of text.
 */

import type { ReactNode } from 'react';

export type IconName =
  // combat & stats
  | 'sword' | 'shield' | 'heart' | 'star' | 'target' | 'sparkle' | 'skull' | 'trophy'
  // equipment shapes
  | 'blade' | 'axe' | 'bow' | 'staff' | 'plate' | 'cloth' | 'ring' | 'amulet'
  // resources
  | 'coin' | 'hourglass' | 'gem' | 'hide' | 'ore' | 'flora' | 'essence' | 'flame'
  // navigation
  | 'chart' | 'home' | 'banner' | 'map' | 'pack' | 'gear' | 'hammer'
  // interface
  | 'lock' | 'check' | 'chevron' | 'close' | 'plus' | 'dice' | 'info' | 'bandage'
  | 'up' | 'down' | 'beast' | 'warning';

/**
 * Each entry is the icon's inner geometry. Shapes that need a fill opt in with
 * `fill="currentColor"`; everything else inherits the stroked default.
 */
const SHAPES: Record<IconName, ReactNode> = {
  // ---- Combat & stats ----------------------------------------------------
  sword: (
    <>
      <path d="M12 2.5 15 8v7H9V8z" />
      <path d="M6.5 15h11M12 15v5M10 20.5h4" />
    </>
  ),
  shield: <path d="M12 2.5 20 5.5v6c0 5-3.4 8.9-8 10.6-4.6-1.7-8-5.6-8-10.6v-6z" />,
  heart: <path d="M12 20.5C7 17.6 3.5 14.2 3.5 10.3A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 8.5 2.3c0 3.9-3.5 7.3-8.5 10.2z" />,
  star: <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 3.5 12.8 9l5.5 1.8-5.5 1.8L11 18l-1.8-5.4L3.7 10.8 9.2 9z" />
      <path d="M18 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  skull: (
    <>
      <path d="M12 2.5a8 8 0 0 0-8 8c0 2.6 1.3 4.3 2.7 5.3V19a1.5 1.5 0 0 0 1.5 1.5h7.6A1.5 1.5 0 0 0 17.3 19v-3.2c1.4-1 2.7-2.7 2.7-5.3a8 8 0 0 0-8-8z" />
      <circle cx="9" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3.5h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5H5v1.5A3.5 3.5 0 0 0 8 10M16 5h3v1.5A3.5 3.5 0 0 1 16 10" />
      <path d="M10.5 12.5h3v4h-3zM7.5 20.5h9" />
    </>
  ),

  // ---- Equipment shapes --------------------------------------------------
  blade: (
    <>
      <path d="M12 2.5 14.5 8v7h-5V8z" />
      <path d="M7 15h10M12 15v5.5" />
    </>
  ),
  axe: (
    <>
      <path d="M9 21.5V3" />
      <path d="M9 4h3.5A5.5 5.5 0 0 1 18 9.5v1a1 1 0 0 1-1 1H9z" />
    </>
  ),
  bow: (
    <>
      <path d="M7.5 3a11 11 0 0 1 0 18M7.5 3v18" />
      <path d="M5.5 12h13M15.5 9l3 3-3 3" />
    </>
  ),
  staff: (
    <>
      <path d="M6.5 21.5 14 9" />
      <circle cx="16.5" cy="5.5" r="3" />
    </>
  ),
  plate: (
    <>
      <path d="M12 2.5 20 5.5v6c0 5-3.4 8.9-8 10.6-4.6-1.7-8-5.6-8-10.6v-6z" />
      <path d="M12 3.5v18" />
    </>
  ),
  cloth: (
    <>
      <path d="M9 3h6l3 3.5-2.5 1.5V21H8.5V8L6 6.5z" />
      <path d="M12 8v13" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="14.5" r="6" />
      <path d="m12 2.5 2.8 3.2L12 8.9 9.2 5.7z" />
    </>
  ),
  amulet: (
    <>
      <path d="M6.5 3.5c0 6 11 6 11 0" />
      <circle cx="12" cy="16" r="4.5" />
    </>
  ),

  // ---- Resources ---------------------------------------------------------
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6.5 2.5h11M6.5 21.5h11" />
      <path d="M7.5 2.5v3.2L12 12l-4.5 6.3v3.2M16.5 2.5v3.2L12 12l4.5 6.3v3.2" />
    </>
  ),
  gem: (
    <>
      <path d="M12 2.5 18.5 9 12 21.5 5.5 9z" />
      <path d="M5.5 9h13M12 2.5 9 9l3 12.5M12 2.5 15 9l-3 12.5" />
    </>
  ),
  hide: (
    <>
      <path d="M7.5 3.5 10 6.5h4l2.5-3c2 3.6 1.2 6.6 0 8.5 1.2 3 1.2 6 0 8.5H7.5c-1.2-2.5-1.2-5.5 0-8.5-1.2-1.9-2-4.9 0-8.5z" />
    </>
  ),
  ore: (
    <>
      <path d="m12 3 7.5 4.5-2.5 12H7L4.5 7.5z" />
      <path d="M4.5 7.5 12 11l7.5-3.5M12 11v8.5" />
    </>
  ),
  flora: (
    <>
      <path d="M12 21.5V9" />
      <path d="M12 12.5c-4.1 0-6-3-6-6.5 3.4 0 6 2.4 6 6.5 0-4.1 2.6-6.5 6-6.5 0 3.5-1.9 6.5-6 6.5z" />
    </>
  ),
  essence: (
    <>
      <path d="M9 2.5h6" />
      <path d="M10 2.5v6.2l-3.8 8.1a2.2 2.2 0 0 0 2 3.2h7.6a2.2 2.2 0 0 0 2-3.2L14 8.7V2.5" />
      <path d="M7.6 14.5h8.8" />
    </>
  ),
  flame: <path d="M12 2.5c3 4.2 5.2 6.2 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2 1-3.2 2.1-4.2 0 2.1 1 3.1 2 3.1 0-3.1.7-6.2 1.1-8.9z" />,

  // ---- Navigation --------------------------------------------------------
  chart: <path d="M3.5 20.5h17M7 20.5v-6M12 20.5V5.5M17 20.5v-10" />,
  home: (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M5.5 9.5v11h13v-11M10 20.5v-6h4v6" />
    </>
  ),
  banner: (
    <>
      <path d="M6 2.5h12v13l-6 6-6-6z" />
      <path d="M12 7v7" />
    </>
  ),
  map: (
    <>
      <path d="M9 3.5 3.5 5.5v16L9 19.5l6 2 5.5-2v-16l-5.5 2z" />
      <path d="M9 3.5v16M15 5.5v16" />
    </>
  ),
  // A chest, not a backpack: a bag's rounded top strap read as the padlock
  // shape at tab size, so "Items" and "locked" looked like the same glyph.
  pack: (
    <>
      <path d="M3.5 9.5h17v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.5 9.5V7a2.5 2.5 0 0 1 2.5-2.5h12A2.5 2.5 0 0 1 20.5 7v2.5" />
      <path d="M10.3 9.5h3.4v3.6h-3.4z" />
    </>
  ),
  // Short teeth hugging the hub, not long spokes — at 16px, spokes reaching
  // the icon's edge read as a sun rather than a cog.
  gear: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M17.6 12h2.8M6.4 12H3.6M12 17.6v2.8M12 6.4V3.6M15.96 15.96l1.98 1.98M8.04 8.04 6.06 6.06M8.04 15.96l-1.98 1.98M15.96 8.04l1.98-1.98" />
    </>
  ),
  hammer: (
    <>
      <path d="m13.5 2.5 8 8-3 3-8-8z" />
      <path d="m10.5 8.5-8 8v5h5l8-8" />
    </>
  ),

  // ---- Interface ---------------------------------------------------------
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11.5" rx="2" />
      <path d="M8 10V6.5a4 4 0 0 1 8 0V10" />
    </>
  ),
  check: <path d="m4 12.5 5.5 5.5L20 6" />,
  chevron: <path d="m6 9.5 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  dice: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  bandage: (
    <>
      <rect x="1.5" y="8.5" width="21" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="m9 9 6 6" />
    </>
  ),
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  beast: (
    <>
      <path d="M4.5 9.5a7.5 7.5 0 0 1 15 0v3.5a7.5 7.5 0 0 1-15 0z" />
      <path d="M4.8 7 3 3l4.5 2M19.2 7 21 3l-4.5 2" />
      <circle cx="9.3" cy="11" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="11" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 22 20.5H2z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  /** CSS length; defaults to `1em` so the icon tracks its line of text. */
  size?: string | number;
  className?: string;
  /**
   * Icons are decorative by default (adjacent text carries the meaning). Pass
   * a label only when the icon is the sole content of a control.
   */
  label?: string;
}

export function Icon({ name, size = '1em', className, label }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
