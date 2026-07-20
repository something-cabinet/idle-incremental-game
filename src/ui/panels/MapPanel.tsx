import { useState } from 'react';
import { MATERIALS } from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  batchTimeSolo,
  clampBatchSize,
  deleteQuest,
  postQuest,
  previewQuestRates,
  questProgress,
  questRates,
  questTargetDef,
  targetsForLocation,
  isZoneUnlocked,
  unitDifficulty,
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

export function MapPanel() {
  return (
    <div className="panel">
      <section className="rows">
        <h3 className="section-title">Wilds</h3>
        <p className="detail-sub">
          Post bounties on monsters and gatherables. The town’s adventurers pick them
          up — bigger batches finish faster per unit but cost more gold each.
        </p>
        {zones().map((zone) => (
          <ZoneCard key={zone.id} zone={zone} />
        ))}
      </section>
    </div>
  );
}

function ZoneCard({ zone }: { zone: LocationDef }) {
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
            <TargetRow key={t.id} target={t} />
          ))}
          <h4 className="section-title">🌿 Gatherables</h4>
          {gatherables.map((t) => (
            <TargetRow key={t.id} target={t} />
          ))}

          {activeHere.length > 0 && (
            <>
              <h4 className="section-title">📜 Quests Here</h4>
              {activeHere.map((q) => (
                <ActiveQuestRow key={q.id} quest={q} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TargetRow({ target }: { target: QuestTargetDef }) {
  const store = useGameStore();
  const state = useGameState();
  const [batch, setBatch] = useState(5);
  const size = clampBatchSize(batch);
  const preview = previewQuestRates(state, target.id, size);
  const verb = target.kind === 'monster' ? 'Kill' : 'Collect';
  const batchSeconds =
    preview.adventurers > 0
      ? batchTimeSolo(size, unitDifficulty(target)) / preview.adventurers
      : Infinity;

  return (
    <div className="quest-target">
      <div className="row-info">
        <span className="row-name">{target.name}</span>
        <span className="row-desc">
          {verb} → {materialName(target.materialId)} · first batch in ~{formatDuration(batchSeconds)}
        </span>
        {preview.goldStarved ? (
          <span className="row-bad">⚠ Not enough gold to sustain this quest.</span>
        ) : (
          <span className="row-good">
            ~{rate(preview.materialsPerSec)} {materialName(target.materialId)}/s ·{' '}
            <span className="row-bad">−{rate(preview.goldPerSec)} 🪙/s</span> · +
            {rate(preview.reputationPerSec)} ★/s (reference)
          </span>
        )}
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
        <button
          className="small-button"
          onClick={() => store.dispatch((s) => postQuest(s, target.id, size))}
        >
          Post
        </button>
      </div>
    </div>
  );
}

function ActiveQuestRow({ quest }: { quest: Quest }) {
  const store = useGameStore();
  const state = useGameState();
  const target = questTargetDef(quest.targetId);
  const rates = questRates(state, quest);
  const progress = questProgress(state, quest);
  if (!target) return null;

  return (
    <div className="row item-common">
      <div className="row-info">
        <span className="row-name">
          {target.name} <span className="row-sub">batch {quest.batchSize}</span>
        </span>
        {rates.goldStarved ? (
          <span className="row-bad">⚠ Not enough gold — this quest is stalled.</span>
        ) : (
          <span className="row-desc">
            ~{rate(rates.materialsPerSec)} {materialName(target.materialId)}/s ·{' '}
            −{rate(rates.goldPerSec)} 🪙/s · {rates.adventurers.toFixed(1)} adventurers
          </span>
        )}
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
