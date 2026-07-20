import { useState } from 'react';
import {
  MATERIALS,
  QUEST_DEFAULT_MAX_ADVENTURERS,
  QUEST_MAX_REPEATS_INPUT,
  QUEST_MAX_REQUIREMENTS,
} from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  clampBatchSize,
  isZoneUnlocked,
  postQuest,
  previewBatchSummary,
  targetsForLocation,
  zones,
} from '../../game/guild';
import type { LocationDef, QuestRequirement, QuestTargetDef } from '../../game/types';
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
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="panel">
      <section className="rows">
        <div className="section-title-row">
          <h3 className="section-title">Wilds</h3>
          <button className="small-button" onClick={() => setDialogOpen(true)}>
            + Post Quest
          </button>
        </div>
        <p className="detail-sub">
          Browse the monsters and gatherables the guild knows about, then post a
          quest requesting whichever of them you need — see Guild → Quests to
          manage what's running.
        </p>
        {zones().map((zone) => (
          <ZoneCard key={zone.id} zone={zone} />
        ))}
      </section>

      {dialogOpen && <QuestCreationDialog onClose={() => setDialogOpen(false)} />}
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

  return (
    <div className="zone-card">
      <button className="zone-header" onClick={() => setOpen((o) => !o)}>
        <span className="row-name">
          {zone.name} <span className="row-sub">tier {zone.tier}</span>
        </span>
        <span className="row-desc">{zone.description}</span>
        <span className="zone-toggle">{open ? ' ▲' : ' ▼'}</span>
      </button>

      {open && (
        <div className="zone-detail">
          <h4 className="section-title">👹 Monsters</h4>
          {monsters.map((t) => (
            <TargetCatalogRow key={t.id} target={t} />
          ))}
          <h4 className="section-title">🌿 Gatherables</h4>
          {gatherables.map((t) => (
            <TargetCatalogRow key={t.id} target={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TargetCatalogRow({ target }: { target: QuestTargetDef }) {
  const verb = target.kind === 'monster' ? 'Kill' : 'Collect';
  return (
    <div className="row">
      <div className="row-info">
        <span className="row-name">{target.name}</span>
        <span className="row-desc">
          {verb} → {materialName(target.materialId)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quest creation dialog — pick multiple monsters/gatherables required together
// ---------------------------------------------------------------------------

function QuestCreationDialog({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  // targetId -> batch size, for every currently-selected requirement.
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [maxAdv, setMaxAdv] = useState(QUEST_DEFAULT_MAX_ADVENTURERS);
  const [repeats, setRepeats] = useState(0); // 0 = unlimited

  const unlockedZones = zones().filter((z) => isZoneUnlocked(state, z.id));
  const selectedIds = Object.keys(selected);
  const atCap = selectedIds.length >= QUEST_MAX_REQUIREMENTS;

  function toggle(targetId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (targetId in next) {
        delete next[targetId];
      } else if (Object.keys(next).length < QUEST_MAX_REQUIREMENTS) {
        next[targetId] = 5;
      }
      return next;
    });
  }

  function setBatch(targetId: string, batch: number) {
    setSelected((prev) => (targetId in prev ? { ...prev, [targetId]: batch } : prev));
  }

  const requirements: QuestRequirement[] = selectedIds.map((targetId) => ({
    targetId,
    batchSize: clampBatchSize(selected[targetId]),
  }));
  const summary = requirements.length > 0 ? previewBatchSummary(state, requirements, maxAdv, repeats) : null;

  function handlePost() {
    if (requirements.length === 0) return;
    store.dispatch((s) => postQuest(s, requirements, maxAdv, repeats));
    setSelected({});
    onClose();
  }

  return (
    <div className="story-overlay" onClick={onClose}>
      <div className="story-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="story-title">Post a Quest</h2>
          <button className="small-button" onClick={onClose}>✕</button>
        </div>
        <p className="detail-sub">
          Check everything this quest requires (up to {QUEST_MAX_REQUIREMENTS}) — the whole
          bundle must be fulfilled together before it pays out.
        </p>

        <div className="rows">
          {unlockedZones.map((zone) => (
            <div key={zone.id}>
              <h4 className="section-title">{zone.name}</h4>
              {targetsForLocation(zone.id).map((target) => {
                const isSelected = target.id in selected;
                const disabled = !isSelected && atCap;
                return (
                  <div
                    key={target.id}
                    className={`row quest-checklist-row ${disabled ? 'disabled' : ''}`}
                    onClick={() => !disabled && toggle(target.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      readOnly
                    />
                    <div className="row-info">
                      <span className="row-name">{target.name}</span>
                      <span className="row-desc">
                        {target.kind === 'monster' ? 'Kill' : 'Collect'} → {materialName(target.materialId)}
                      </span>
                    </div>
                    {isSelected && (
                      <label className="batch-label" onClick={(e) => e.stopPropagation()}>
                        batch
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={selected[target.id]}
                          onChange={(e) => setBatch(target.id, Number(e.target.value) || 1)}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <h3 className="section-title">Settings</h3>
        <div className="quest-post">
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
        </div>

        <h3 className="section-title">Preview</h3>
        {summary ? (
          <div className="row locked">
            {summary.materials.map((m) => `${m.amount} ${materialName(m.materialId)}`).join(' · ')}
            <br />
            −{rate(summary.gold)} 🪙 · +{rate(summary.reputation)} ★ · ~
            {formatDuration(summary.timeSeconds)}/batch · {summary.assigned}/{summary.maxAdventurers}{' '}
            adventurers
          </div>
        ) : (
          <div className="row locked">Check at least one monster or gatherable.</div>
        )}

        <button
          className="small-button"
          disabled={requirements.length === 0}
          onClick={handlePost}
        >
          Post Quest
        </button>
      </div>
    </div>
  );
}
