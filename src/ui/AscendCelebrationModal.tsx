import { useEffect } from 'react';
import type { Equipment } from '../game/types';
import { useGameState } from '../hooks/useGame';
import { GearPerkBadge } from './GearPerkBadge';
import { itemIcon, itemStatDelta } from './display';
import { Icon } from './icons';
import { playAscend } from './sfx';

/** Sparkles scattered around the item icon, each on its own delay and angle. */
const SPARKLE_COUNT = 6;

/**
 * Shown once after an exalted item successfully ascends (see
 * CraftingPanel.tsx AscendRow) — a brief celebration plus a concrete
 * before/after of exactly what changed, so the upgrade doesn't just
 * disappear into a re-rendered list. `before` is a snapshot taken right
 * before the dispatch; `after` is the same item's live post-ascend state
 * (looked up by id), so this never needs its own copy of the ascend logic.
 */
export function AscendCelebrationModal({
  before,
  after,
  onClose,
}: {
  before: Equipment;
  after: Equipment;
  onClose: () => void;
}) {
  const state = useGameState();
  const reducedMotion = state.settings.reducedMotion;
  const deltas = itemStatDelta(before, after);

  useEffect(() => {
    if (state.settings.sfxEnabled) playAscend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="story-overlay" onClick={onClose}>
      <div
        className={`story-modal detail-modal ascend-modal ${reducedMotion ? 'reduced-motion' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="story-title">Ascension Complete</h2>

        <div className="ascend-stage">
          <div className="ascend-glow" />
          <div className="ascend-glow ascend-glow-fade" />
          <span className="ascend-icon">
            <Icon name={itemIcon(after)} />
          </span>
          {!reducedMotion &&
            Array.from({ length: SPARKLE_COUNT }, (_, i) => (
              <span
                key={i}
                className="ascend-sparkle"
                style={{
                  '--sparkle-rot': `${(360 / SPARKLE_COUNT) * i}deg`,
                  animationDelay: `${i * 0.18}s`,
                } as React.CSSProperties}
              >
                <Icon name="sparkle" />
              </span>
            ))}
        </div>

        <div className="ascend-name-shift">
          {before.name !== after.name && <span className="ascend-name-before">{before.name}</span>}
          <span className="ascend-name-after">{after.name}</span>
        </div>

        <div className="ascend-rarity-shift">
          <span className="equip-detail-rarity rarity-exalted">exalted</span>
          <span className="ascend-delta-arrow">→</span>
          <span className="equip-detail-rarity rarity-ascendant">ascendant</span>
        </div>

        {deltas.length > 0 && (
          <div className="ascend-delta-list">
            {deltas.map((d) => (
              <div key={d.label} className="ascend-delta-row">
                <span className="ascend-delta-label">
                  {d.icon && <Icon name={d.icon} />} {d.label}
                </span>
                <span className="ascend-delta-before">{d.before}</span>
                <span className="ascend-delta-arrow">→</span>
                <span className={`ascend-delta-after ${d.after >= d.before ? 'up' : 'down'}`}>
                  {d.after}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* The perk is the headline reward of ascending, not a footnote. */}
        {after.perkId && (
          <div className="ascend-perk-reveal">
            <span className="ascend-perk-heading">Perk awakened</span>
            <GearPerkBadge item={after} />
          </div>
        )}

        <button className="small-button primary" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}
