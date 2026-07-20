import { useState } from 'react';
import { MATERIALS, QUEST_DEFAULT_MAX_ADVENTURERS, QUEST_MAX_REPEATS_INPUT } from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  clampBatchSize,
  deleteQuest,
  isZoneUnlocked,
  postQuest,
  previewBatchSummary,
  previewQuestRates,
  questBatchSummary,
  questProgress,
  questRates,
  questTargetDef,
  targetsForLocation,
  zones,
} from '../../game/guild';
import type { LocationDef, Quest, QuestTargetDef } from '../../game/types';
import { useGameState, useGameStore } from '../../hooks/useGame';

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

/** Compact rate number: 12.3, 0.45, 1,240. */
function rate(n: number): string {
  if (n === 0) return '0';
  if (n < 10) return n.toFixed(2);
  if (n < 100) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}

function repeatsLabel(remaining: number, repeatCount: number, completedCount: number): string {
  if (repeatCount <= 0) return 'unlimited';
  return `${completedCount}/${repeatCount} done, ${Number.isFinite(remaining) ? remaining : '∞'} left`;
}

export function MapPanel() {
  const [showPerSecond, setShowPerSecond] = useState(false);

  return (
    <div className="panel">
      <section className="rows">
        <div className="section-title-row">
          <h3 className="section-title">Wilds</h3>
          <button className="small-button" onClick={() => setShowPerSecond((v) => !v)}>
            {showPerSecond ? 'Show batch totals' : 'Show per-second rates'}
          </button>
        </div>
        <p className="detail-sub">
          Post bounties on monsters and gatherables. The town’s adventurers pick them
          up — bigger batches finish faster per unit but cost more gold each.
        </p>
        {zones().map((zone) => (
          <ZoneCard key={zone.id} zone={zone} showPerSecond={showPerSecond} />
        ))}
      </section>
    </div>
  );
}

function ZoneCard({ zone, showPerSecond }: { zone: LocationDef; showPerSecond: boolean }) {
  const state = useGameState();
  const [open, setOpen] = useState(false);
  const unlocked = isZoneUnlocked(state, zone.id);

  if (!unlocked) {
    return (
      <div className="row locked">
        🔒 {zone.name} — reach {zone.repRequired} reputation
      </div>
    );
  }

  const targets = targetsForLocation(zone.id);
  const monsters = targets.filter((t) => t.kind === 'monster');
  const gatherables = targets.filter((t) => t.kind === 'gatherable');
  const activeHere = state.quests.filter(
    (q) => questTargetDef(q.targetId)?.locationId === zone.id,
  );

  return (
    <div className="zone-card">
      <button className="zone-header" onClick={() => setOpen((o) => !o)}>
        <span className="row-name">
          {zone.name} <span className="row-sub">tier {zone.tier}</span>
        </span>
        <span className="row-desc">{zone.description}</span>
        <span className="zone-toggle">
          {activeHere.length > 0 && (
            <span className="row-good">{activeHere.length} active</span>
          )}
          {open ? ' ▲' : ' ▼'}
        </span>
      </button>

      {open && (
        <div className="zone-detail">
          <h4 className="section-title">👹 Monsters</h4>
          {monsters.map((t) => (
            <TargetRow key={t.id} target={t} showPerSecond={showPerSecond} />
          ))}
          <h4 className="section-title">🌿 Gatherables</h4>
          {gatherables.map((t) => (
            <TargetRow key={t.id} target={t} showPerSecond={showPerSecond} />
          ))}

          {activeHere.length > 0 && (
            <>
              <h4 className="section-title">📜 Quests Here</h4>
              {activeHere.map((q) => (
                <ActiveQuestRow key={q.id} quest={q} showPerSecond={showPerSecond} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TargetRow({ target, showPerSecond }: { target: QuestTargetDef; showPerSecond: boolean }) {
  const store = useGameStore();
  const state = useGameState();
  const [batch, setBatch] = useState(5);
  const [maxAdv, setMaxAdv] = useState(QUEST_DEFAULT_MAX_ADVENTURERS);
  const [repeats, setRepeats] = useState(0); // 0 = unlimited
  const size = clampBatchSize(batch);
  const verb = target.kind === 'monster' ? 'Kill' : 'Collect';
  const summary = previewBatchSummary(state, target.id, size, maxAdv, repeats);
  const rates = previewQuestRates(state, target.id, size, maxAdv, repeats);

  return (
    <div className="quest-target">
      <div className="row-info">
        <span className="row-name">{target.name}</span>
        <span className="row-desc">
          {verb} → {materialName(target.materialId)}
        </span>
        {rates.goldStarved ? (
          <span className="row-bad">⚠ Not enough gold to sustain this quest.</span>
        ) : rates.adventurerStarved ? (
          <span className="row-bad">⚠ No adventurers free to take this on right now.</span>
        ) : showPerSecond ? (
          <span className="row-good">
            ~{rate(rates.materialsPerSec)} {materialName(target.materialId)}/s ·{' '}
            <span className="row-bad">−{rate(rates.goldPerSec)} 🪙/s</span> · +
            {rate(rates.reputationPerSec)} ★/s (reference)
          </span>
        ) : summary ? (
          <span className="row-good">
            {summary.materialAmount} {materialName(target.materialId)} ·{' '}
            <span className="row-bad">−{rate(summary.gold)} 🪙</span> · +{rate(summary.reputation)} ★
            · ~{formatDuration(summary.timeSeconds)}/batch · {summary.assigned}/{summary.maxAdventurers} adventurers
          </span>
        ) : null}
      </div>
      <div className="quest-post">
        <label className="batch-label">
          batch
          <input
            type="number"
            min={1}
            max={50}
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value) || 1)}
          />
        </label>
        <label className="batch-label">
          max adv
          <input
            type="number"
            min={1}
            max={500}
            value={maxAdv}
            onChange={(e) => setMaxAdv(Number(e.target.value) || 1)}
          />
        </label>
        <label className="batch-label">
          repeats
          <input
            type="number"
            min={0}
            max={QUEST_MAX_REPEATS_INPUT}
            placeholder="∞"
            value={repeats || ''}
            onChange={(e) => setRepeats(Number(e.target.value) || 0)}
          />
        </label>
        <button
          className="small-button"
          onClick={() => store.dispatch((s) => postQuest(s, target.id, size, maxAdv, repeats))}
        >
          Post
        </button>
      </div>
    </div>
  );
}

function ActiveQuestRow({ quest, showPerSecond }: { quest: Quest; showPerSecond: boolean }) {
  const store = useGameStore();
  const state = useGameState();
  const target = questTargetDef(quest.targetId);
  const rates = questRates(state, quest);
  const progress = questProgress(state, quest);
  const summary = questBatchSummary(state, quest);
  if (!target || !summary) return null;

  return (
    <div className="row item-common">
      <div className="row-info">
        <span className="row-name">
          {target.name} <span className="row-sub">batch {quest.batchSize}</span>
        </span>
        {rates.goldStarved ? (
          <span className="row-bad">⚠ Not enough gold — this quest is stalled.</span>
        ) : rates.adventurerStarved ? (
          <span className="row-bad">⚠ No adventurers assigned right now.</span>
        ) : showPerSecond ? (
          <span className="row-desc">
            ~{rate(rates.materialsPerSec)} {materialName(target.materialId)}/s ·{' '}
            −{rate(rates.goldPerSec)} 🪙/s · {rates.adventurers} adventurers
          </span>
        ) : (
          <span className="row-desc">
            {summary.materialAmount} {materialName(summary.materialId)} · −{rate(summary.gold)} 🪙 ·
            +{rate(summary.reputation)} ★ · {formatDuration(summary.timeSeconds)}/batch ·{' '}
            {summary.assigned}/{summary.maxAdventurers} adventurers
          </span>
        )}
        <span className="row-sub">
          {repeatsLabel(summary.repeatsRemaining, summary.repeatCount, summary.completedCount)}
        </span>
        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <span className="progress-time">
            {Number.isFinite(progress.etaSeconds)
              ? `${formatDuration(progress.etaSeconds)} to next batch`
              : 'stalled'}
          </span>
        </div>
      </div>
      <button
        className="small-button danger"
        onClick={() => store.dispatch((s) => deleteQuest(s, quest.id))}
      >
        Delete
      </button>
    </div>
  );
}
