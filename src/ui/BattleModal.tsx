import { useEffect, useRef, useState } from 'react';
import type { BattleLogEntry, BattleOutcome } from '../game/combat';
import { itemIcon } from './itemDisplay';

/** Real-time playback speed (ms per log line) — deliberately independent of
 * the debug game-speed multiplier, which only scales the simulation clock. */
const TICK_MS = 550;

interface FighterView {
  side: 'party' | 'monsters';
  refId: number;
  name: string;
  maxHp: number;
  hp: number;
  defeated: boolean;
}

function initialFighters(result: BattleOutcome): FighterView[] {
  return [
    ...result.party.map((p): FighterView => ({
      side: 'party',
      refId: p.advId,
      name: p.name,
      maxHp: p.maxHp,
      hp: p.maxHp,
      defeated: false,
    })),
    ...result.monsters.map((m): FighterView => ({
      side: 'monsters',
      refId: m.instanceId,
      name: m.name,
      maxHp: m.maxHp,
      hp: m.maxHp,
      defeated: false,
    })),
  ];
}

function applyEntry(fighters: FighterView[], entry: BattleLogEntry): FighterView[] {
  let matched = false;
  return fighters.map((f) => {
    if (matched || f.side !== entry.defenderSide || f.name !== entry.defenderName || f.defeated) return f;
    matched = true;
    return { ...f, hp: entry.defenderHpAfter, defeated: entry.defenderDefeated };
  });
}

/**
 * Blocking battle modal: no close button/overlay-dismiss until playback of
 * the (already-resolved) combat log finishes — the outcome and rewards are
 * committed to state the instant Explore was clicked, this just reveals it.
 * Playback runs on a plain setInterval (real time), so the debug game-speed
 * slider — which only scales the simulation tick — cannot fast-forward it.
 */
export function BattleModal({
  result,
  locationName,
  reducedMotion,
  onClose,
  continueLabel,
}: {
  result: BattleOutcome;
  locationName: string;
  reducedMotion: boolean;
  onClose: () => void;
  continueLabel?: string;
}) {
  const [revealed, setRevealed] = useState(reducedMotion ? result.log.length : 0);
  const [fighters, setFighters] = useState<FighterView[]>(() => initialFighters(result));
  const skippedRef = useRef(reducedMotion);

  useEffect(() => {
    if (skippedRef.current) {
      setFighters((prev) => result.log.reduce(applyEntry, prev));
      return;
    }
    if (revealed >= result.log.length) return;
    const t = setTimeout(() => {
      setFighters((prev) => applyEntry(prev, result.log[revealed]));
      setRevealed((r) => r + 1);
    }, TICK_MS);
    return () => clearTimeout(t);
  }, [revealed, result.log]);

  function skip() {
    skippedRef.current = true;
    setFighters((prev) => result.log.reduce(applyEntry, prev));
    setRevealed(result.log.length);
  }

  const done = revealed >= result.log.length;
  const visibleLog = result.log.slice(0, revealed);
  const lastEntry = visibleLog[visibleLog.length - 1];

  return (
    <div className="story-overlay battle-overlay">
      <div className="story-modal detail-modal battle-modal">
        <div className="detail-header">
          <h2 className="story-title">Exploring — {locationName}</h2>
          {!done && (
            <button className="small-button" onClick={skip}>
              Skip ▶▶
            </button>
          )}
        </div>

        <div className="battle-field">
          <BattleSide title="Party" fighters={fighters.filter((f) => f.side === 'party')} flash={lastEntry} />
          <div className="battle-vs">VS</div>
          <BattleSide title="Monsters" fighters={fighters.filter((f) => f.side === 'monsters')} flash={lastEntry} />
        </div>

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

        {done && <BattleSummary result={result} onClose={onClose} continueLabel={continueLabel} />}
      </div>
    </div>
  );
}

function BattleSide({
  title,
  fighters,
  flash,
}: {
  title: string;
  fighters: FighterView[];
  flash?: BattleLogEntry;
}) {
  return (
    <div className="battle-side">
      <h4 className="section-title">{title}</h4>
      {fighters.map((f) => {
        const pct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
        const isHit = flash && flash.defenderSide === f.side && flash.defenderName === f.name;
        return (
          <div
            key={`${f.side}-${f.refId}`}
            className={`battle-fighter ${f.defeated ? 'defeated' : ''} ${isHit ? 'hit-flash' : ''}`}
          >
            <span className="row-name">{f.defeated ? '💀' : f.side === 'party' ? '🧑‍🤝‍🧑' : '👹'} {f.name}</span>
            <div className="progress-line">
              <div className="progress-track">
                <div className="progress-fill hp" style={{ width: `${pct}%` }} />
              </div>
              <span className="progress-time">{Math.round(f.hp)}/{f.maxHp}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BattleSummary({ result, onClose, continueLabel }: { result: BattleOutcome; onClose: () => void; continueLabel?: string }) {
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
        <button className="small-button" onClick={onClose} style={{ marginTop: 8 }}>
          {continueLabel ?? 'Continue'}
        </button>
      </div>
    </div>
  );
}
