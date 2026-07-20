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
  return (
    <div className="panel">
      <section className="rows">
        <h3 className="section-title">Wilds</h3>
        <p className="detail-sub">
          Browse each zone's monsters and gatherables, then post a quest there for
          whichever of them you need — see Guild → Quests to manage what's running.
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
  const [dialogOpen, setDialogOpen] = useState(false);
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
          <div className="section-title-row">
            <h4 className="section-title">👹 Monsters</h4>
            <button className="small-button" onClick={() => setDialogOpen(true)}>
              + Post Quest
            </button>
          </div>
          {monsters.map((t) => (
            <TargetCatalogRow key={t.id} target={t} />
          ))}
          <h4 className="section-title">🌿 Gatherables</h4>
          {gatherables.map((t) => (
            <TargetCatalogRow key={t.id} target={t} />
          ))}
        </div>
      )}

      {dialogOpen && <QuestCreationDialog zone={zone} onClose={() => setDialogOpen(false)} />}
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
// Quest creation dialog — pick multiple monsters/gatherables from THIS zone,
// required together. Quests can't span zones: mixing them would make every
// downstream calculation (unlocks, tier-based difficulty) reason about a set
// of zones instead of one, for no real gameplay benefit.
// ---------------------------------------------------------------------------

const DEFAULT_AMOUNT = 5;

function QuestCreationDialog({ zone, onClose }: { zone: LocationDef; onClose: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // targetId -> requested amount, as raw input text (not a parsed number) so
  // the field can sit empty mid-edit instead of snapping back to a fallback
  // value and eating the digit the player is trying to type or delete. Kept
  // for every target (not just checked ones) so the amount box stays put —
  // and keeps its value — when a checkbox is toggled, instead of
  // appearing/disappearing and shifting the row.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [maxAdvInput, setMaxAdvInput] = useState(String(QUEST_DEFAULT_MAX_ADVENTURERS));
  const [repeatsInput, setRepeatsInput] = useState(''); // '' = unlimited

  const targets = targetsForLocation(zone.id);
  const selectedIds = Object.keys(checked).filter((id) => checked[id]);
  const atCap = selectedIds.length >= QUEST_MAX_REQUIREMENTS;
  const maxAdv = Number(maxAdvInput) || 1;
  const repeats = Number(repeatsInput) || 0;

  function toggle(targetId: string) {
    setChecked((prev) => {
      if (!prev[targetId] && selectedIds.length >= QUEST_MAX_REQUIREMENTS) return prev;
      return { ...prev, [targetId]: !prev[targetId] };
    });
  }

  function setAmount(targetId: string, raw: string) {
    setAmounts((prev) => ({ ...prev, [targetId]: raw }));
  }

  const requirements: QuestRequirement[] = selectedIds.map((targetId) => ({
    targetId,
    batchSize: clampBatchSize(Number(amounts[targetId]) || DEFAULT_AMOUNT),
  }));
  const summary = requirements.length > 0 ? previewBatchSummary(state, requirements, maxAdv, repeats) : null;

  function handlePost() {
    if (requirements.length === 0) return;
    store.dispatch((s) => postQuest(s, requirements, maxAdv, repeats));
    setChecked({});
    onClose();
  }

  return (
    <div className="story-overlay" onClick={onClose}>
      <div className="story-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="story-title">Post a Quest — {zone.name}</h2>
          <button className="small-button" onClick={onClose}>✕</button>
        </div>
        <p className="detail-sub">
          Check everything this quest requires (up to {QUEST_MAX_REQUIREMENTS}) — the whole
          bundle must be fulfilled together before it pays out.
        </p>

        <div className="rows">
          {targets.map((target) => {
            const isSelected = !!checked[target.id];
            const checkboxDisabled = !isSelected && atCap;
            return (
              <div
                key={target.id}
                className={`row quest-checklist-row ${checkboxDisabled ? 'disabled' : ''}`}
                onClick={() => !checkboxDisabled && toggle(target.id)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={checkboxDisabled}
                  readOnly
                />
                <div className="row-info">
                  <span className="row-name">{target.name}</span>
                  <span className="row-desc">
                    {target.kind === 'monster' ? 'Kill' : 'Collect'} → {materialName(target.materialId)}
                  </span>
                </div>
                <label className="field-label" onClick={(e) => e.stopPropagation()}>
                  amount
                  <input
                    type="number"
                    min={1}
                    max={50}
                    disabled={!isSelected}
                    value={amounts[target.id] ?? String(DEFAULT_AMOUNT)}
                    onChange={(e) => setAmount(target.id, e.target.value)}
                  />
                </label>
              </div>
            );
          })}
        </div>

        <h3 className="section-title">Settings</h3>
        <div className="quest-post">
          <label className="field-label">
            max adv
            <input
              type="number"
              min={1}
              max={500}
              value={maxAdvInput}
              onChange={(e) => setMaxAdvInput(e.target.value)}
            />
          </label>
          <label className="field-label">
            repeats
            <input
              type="number"
              min={0}
              max={QUEST_MAX_REPEATS_INPUT}
              placeholder="∞"
              value={repeatsInput}
              onChange={(e) => setRepeatsInput(e.target.value)}
            />
          </label>
        </div>

        <h3 className="section-title">Preview</h3>
        {summary ? (
          <div className="row locked">
            {summary.materials.map((m) => `${m.amount} ${materialName(m.materialId)}`).join(' · ')}
            <br />
            −{rate(summary.gold)} 🪙 · +{rate(summary.reputation)} ★ · ~
            {formatDuration(summary.timeSeconds)}/round · {summary.assigned}/{summary.maxAdventurers}{' '}
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
