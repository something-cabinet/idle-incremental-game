import { useEffect, useRef, useState } from 'react';
import type { BattleOutcome } from '../game/combat';
import { itemIcon } from './itemDisplay';
import { BattleViewer } from './BattleViewer';

/**
 * Blocking battle modal: no close button/overlay-dismiss until playback of
 * the (already-resolved) combat log finishes — the outcome and rewards are
 * committed to state the instant Explore was clicked, this just reveals it.
 * The battlefield is rendered by a PixiJS canvas with animated fighters.
 *
 * Explore chains fights back-to-back until the player stops it, so this modal
 * stays mounted across many `result`s in a row (the PixiJS app persists —
 * only the scene rebuilds). `autoAdvance` controls whether it waits for a
 * manual "Continue" click between fights or, once a fight's playback
 * finishes, proceeds on its own (used both for the auto-continue toggle and
 * once the player has pressed Stop, so the in-flight fight still plays out
 * to completion instead of cutting off mid-animation).
 */
export function BattleModal({
  result,
  locationName,
  tier,
  reducedMotion,
  onClose,
  autoAdvance,
  onStop,
}: {
  result: BattleOutcome;
  locationName: string;
  tier: number;
  reducedMotion: boolean;
  onClose: () => void;
  autoAdvance: boolean;
  onStop: () => void;
}) {
  const [revealed, setRevealed] = useState(reducedMotion ? result.log.length : 0);
  const [pixiDone, setPixiDone] = useState(false);
  const skippedRef = useRef(reducedMotion);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // BattleModal stays mounted across a repeat/chain of fights (so the PixiJS
  // app underneath isn't torn down each time) — reset playback state whenever
  // a new `result` comes in, or leftover `pixiDone`/`revealed` from the
  // previous fight makes the summary appear instantly.
  useEffect(() => {
    setRevealed(reducedMotion ? result.log.length : 0);
    setPixiDone(false);
    skippedRef.current = reducedMotion;
  }, [result, reducedMotion]);

  useEffect(() => {
    if (revealed >= result.log.length) return;
    const t = setTimeout(() => {
      setRevealed((r) => r + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [revealed, result.log]);

  function skip() {
    skippedRef.current = true;
    setRevealed(result.log.length);
  }

  const done = pixiDone && revealed >= result.log.length;
  const visibleLog = result.log.slice(0, revealed);

  // Auto-continue mode (or a pending Stop) proceeds on its own once playback
  // finishes — brief pause so the summary is still readable. Uses a ref for
  // onClose so the frequent game-tick re-renders of the parent don't reset
  // this timer before it fires.
  useEffect(() => {
    if (!done || !autoAdvance) return;
    const t = setTimeout(() => onCloseRef.current(), 600);
    return () => clearTimeout(t);
  }, [done, autoAdvance]);

  return (
    <div className="story-overlay battle-overlay">
      <div className="story-modal detail-modal battle-modal">
        <div className="detail-header">
          <h2 className="story-title">Exploring — {locationName}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {!pixiDone && (
              <button className="small-button" onClick={skip}>
                Skip ▶▶
              </button>
            )}
            <button className="small-button danger" onClick={onStop}>
              Stop
            </button>
          </div>
        </div>

        <BattleViewer
          result={result}
          tier={tier}
          skip={skippedRef.current || reducedMotion}
          onFinish={() => setPixiDone(true)}
        />

        <div className="battle-log">
          {visibleLog.map((entry, i) => (
            <div key={i} className={`battle-log-line ${entry.attackerSide === 'party' ? 'good' : 'bad'}`}>
              <strong>{entry.attackerName}</strong> hits <strong>{entry.defenderName}</strong> for{' '}
              {entry.damage} dmg{' '}
              {entry.defenderDefeated ? '— defeated!' : `(${entry.defenderHpAfter}/${entry.defenderMaxHp} HP)`}
            </div>
          ))}
          {visibleLog.length === 0 && <div className="battle-log-line">The battle begins...</div>}
        </div>

        {done && <BattleSummary result={result} onClose={onClose} autoAdvance={autoAdvance} />}
      </div>
    </div>
  );
}

function BattleSummary({
  result,
  onClose,
  autoAdvance,
}: {
  result: BattleOutcome;
  onClose: () => void;
  autoAdvance: boolean;
}) {
  const win = result.outcome === 'win';
  const injured = result.party.filter((p) => p.knockedOut);
  return (
    <div className={`row ${win ? 'item-common' : 'row-bad'}`}>
      <div className="row-info">
        <span className="row-name">{win ? '🏆 Victory!' : '💀 Defeat...'}</span>
        {win ? (
          <span className="row-desc">
            +{result.rewards.gold} 🪙 · +{result.rewards.xp} XP
            {Object.keys(result.rewards.materials).length > 0 &&
              ` · ${Object.entries(result.rewards.materials).map(([, n]) => `+${n} material`).join(', ')}`}
            {result.rewards.equipment.length > 0 &&
              ` · ${result.rewards.equipment.map((e) => `${itemIcon(e)} ${e.name}`).join(', ')}`}
            {result.rewards.timeShards > 0 && ` · +${result.rewards.timeShards} ⏳`}
          </span>
        ) : (
          <span className="row-desc">The party was overwhelmed and driven back to town.</span>
        )}
        {injured.length > 0 && (
          <span className="row-bad">{injured.map((p) => p.name).join(', ')} knocked out — recovering at town.</span>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {autoAdvance ? (
            <span className="row-sub">Continuing…</span>
          ) : (
            <button className="small-button" onClick={onClose}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
