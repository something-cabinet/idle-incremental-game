import { useEffect, useRef, useState } from 'react';
import type { BattleOutcome } from '../game/combat';
import { CLASS_ICON } from './display';
import { Icon } from './icons';
import { BattleViewer } from './BattleViewer';
import type { PartyStatusEntry } from './BattleViewer';

/**
 * Blocking battle modal: no close button/overlay-dismiss until playback of
 * the (already-resolved) combat log finishes — the outcome and rewards are
 * committed to state the instant Explore was clicked, this just reveals it.
 * The battlefield is rendered by a PixiJS canvas with animated fighters
 * (current HP is shown right on each fighter's sprite, so there's no
 * separate text log here).
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
  const [pixiDone, setPixiDone] = useState(false);
  const [stopClicked, setStopClicked] = useState(false);
  const [partyStatus, setPartyStatus] = useState<PartyStatusEntry[]>([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function handleStopClick() {
    setStopClicked(true);
    onStop();
  }

  // BattleModal stays mounted across a repeat/chain of fights (so the PixiJS
  // app underneath isn't torn down each time) — reset playback state whenever
  // a new `result` comes in. This must happen *during render*, not in a
  // useEffect: an effect-based reset would let one render of the new `result`
  // pass through with the previous fight's stale `pixiDone` first, briefly
  // showing the summary for a fight that hasn't played yet.
  const [prevResult, setPrevResult] = useState(result);
  if (prevResult !== result) {
    setPrevResult(result);
    setPixiDone(false);
    setStopClicked(false);
  }

  // Auto-continue mode (or a pending Stop) proceeds on its own once playback
  // finishes — brief pause so the summary is still readable. Uses a ref for
  // onClose so the frequent game-tick re-renders of the parent don't reset
  // this timer before it fires.
  useEffect(() => {
    if (!pixiDone || !autoAdvance) return;
    const t = setTimeout(() => onCloseRef.current(), 600);
    return () => clearTimeout(t);
  }, [pixiDone, autoAdvance]);

  return (
    <div className="story-overlay battle-overlay">
      <div className="story-modal detail-modal battle-modal">
        <div className="detail-header">
          <h2 className="story-title">Exploring — {locationName}</h2>
        </div>

        <BattleViewer
          result={result}
          tier={tier}
          skip={reducedMotion}
          onFinish={() => setPixiDone(true)}
          onPartyStatus={setPartyStatus}
        />

        <PartyStatusPanel status={partyStatus} />

        {pixiDone && <BattleSummary result={result} onClose={onClose} autoAdvance={autoAdvance} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="small-button danger" onClick={handleStopClick} disabled={stopClicked}>
            {stopClicked ? 'Stopping…' : 'Stop'}
          </button>
        </div>
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
    <div className={`row has-actions ${win ? 'item-common' : 'row-warning'}`}>
      <div className="row-info">
        <span className="row-name">
          <Icon name={win ? 'trophy' : 'skull'} /> {win ? 'Victory' : 'Defeat'}
        </span>
        {win ? (
          <span className="row-desc">
            +{result.rewards.gold} gold · +{result.rewards.xp} XP
            {Object.keys(result.rewards.materials).length > 0 &&
              ` · ${Object.entries(result.rewards.materials).map(([, n]) => `+${n} material`).join(', ')}`}
            {result.rewards.equipment.length > 0 &&
              ` · ${result.rewards.equipment.map((e) => e.name).join(', ')}`}
            {result.rewards.timeShards > 0 && ` · +${result.rewards.timeShards} time shards`}
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
            <button className="small-button primary" onClick={onClose}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A small live readout of each champion's HP, skill cooldown, and active
 * buffs/statuses, below the battle canvas — mirrors what's happening on
 * their sprite without needing to squint at it. Driven by BattleViewer's
 * onPartyStatus callback, which fires as the fight plays out.
 */
function PartyStatusPanel({ status }: { status: PartyStatusEntry[] }) {
  if (status.length === 0) return null;
  return (
    <div className="party-status-panel">
      {status.map((p) => {
        const knockedOut = p.hp <= 0;
        return (
          <div key={p.advId} className={`row party-status-row ${knockedOut ? 'disabled' : ''}`}>
            <div className="row-info">
              <span className="row-name">
                <Icon name={CLASS_ICON[p.className]} /> {p.name}
              </span>
              <span className="row-sub">
                HP {p.hp}/{p.maxHp}
                {p.cooldownTurns !== null && ` · CD ${p.cooldownTurns > 0 ? `${p.cooldownTurns}t` : 'ready'}`}
                {p.effects.map((e, i) => (
                  <span key={i} className="perk-tag">{e}</span>
                ))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
