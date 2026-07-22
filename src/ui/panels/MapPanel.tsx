import { useState } from 'react';
import { adventurerStats, isInjured } from '../../game/adventurers';
import { canExplore, runExplore } from '../../game/combat';
import type { BattleOutcome } from '../../game/combat';
import {
  EXPLORE_MAX_PARTY_SIZE,
  MATERIALS,
  QUEST_DEFAULT_MAX_ADVENTURERS,
  QUEST_MAX_BATCH,
  QUEST_MAX_REPEATS_INPUT,
  QUEST_MAX_REQUIREMENTS,
} from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  autoExploreMembers,
  autoExploreUnlocked,
  clampBatchSize,
  isZoneUnlocked,
  postQuest,
  previewBatchSummary,
  recallAdventurer,
  sendPartyOnAutoExplore,
  targetsForLocation,
  zones,
} from '../../game/guild';
import type { Adventurer, AdventurerClass, LocationDef, QuestRequirement, QuestTargetDef } from '../../game/types';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { BattleModal } from '../BattleModal';

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

const CLASS_LABEL: Record<AdventurerClass, string> = {
  warrior: 'Warrior',
  ranger: 'Ranger',
  mage: 'Mage',
};

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
  const [exploreOpen, setExploreOpen] = useState(false);
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
            <div className="zone-actions">
              <button className="small-button" onClick={() => setExploreOpen(true)}>
                ⚔ Explore
              </button>
              <button className="small-button" onClick={() => setDialogOpen(true)}>
                + Post Quest
              </button>
            </div>
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
      {exploreOpen && <ExploreDialog zone={zone} onClose={() => setExploreOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explore — pick up to EXPLORE_MAX_PARTY_SIZE champions, then fight an
// instant turn-based battle against a rolled monster group from this zone.
// The battle resolves (and its rewards commit) the moment "Begin Explore" is
// clicked; BattleModal just plays the already-decided log back for the
// player to watch, and blocks going elsewhere until it finishes.
// ---------------------------------------------------------------------------

function ExploreDialog({ zone, onClose }: { zone: LocationDef; onClose: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  const [partyIds, setPartyIds] = useState<number[]>([]);
  const [battle, setBattle] = useState<BattleOutcome | null>(null);
  const [repeatInput, setRepeatInput] = useState('');
  const [fightsRemaining, setFightsRemaining] = useState(0);

  const repeatCount = Number(repeatInput) || 0;

  function toggle(id: number) {
    setPartyIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= EXPLORE_MAX_PARTY_SIZE) return prev;
      return [...prev, id];
    });
  }

  function runNextFight() {
    let outcome: BattleOutcome | null = null;
    store.dispatch((s) => {
      const { state: next, result } = runExplore(s, zone.id, partyIds, Math.random);
      outcome = result;
      return next;
    });
    if (outcome) {
      setBattle(outcome);
    }
  }

  function begin() {
    if (repeatCount > 0) {
      setFightsRemaining(repeatCount - 1);
    } else {
      setFightsRemaining(0);
    }
    runNextFight();
  }

  function sendOnAutoExplore() {
    if (partyIds.length === 0) return;
    store.dispatch((s) => sendPartyOnAutoExplore(s, partyIds, zone.id));
    onClose();
  }

  function handleBattleClose() {
    const more = repeatCount === 0 || fightsRemaining > 0;
    if (more) {
      if (repeatCount > 0) {
        setFightsRemaining((r) => r - 1);
      }
      runNextFight();
    } else {
      onClose();
    }
  }

  function handleStop() {
    setBattle(null);
  }

  if (battle) {
    const label =
      repeatCount === 0
        ? 'Continue'
        : `Continue (${fightsRemaining} left)`;
    const showStop = repeatCount === 0 || fightsRemaining > 0;
    return (
      <BattleModal
        result={battle}
        locationName={zone.name}
        tier={zone.tier}
        reducedMotion={state.settings.reducedMotion}
        onClose={handleBattleClose}
        continueLabel={label}
        onStop={showStop ? handleStop : undefined}
      />
    );
  }

  const autoExploring = autoExploreMembers(state, zone.id);
  const autoExploreSlotsLeft = EXPLORE_MAX_PARTY_SIZE - autoExploring.length;
  const unlocked = autoExploreUnlocked(state);

  return (
    <div className="story-overlay" onClick={onClose}>
      <div className="story-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="story-title">Explore — {zone.name}</h2>
          <button className="small-button" onClick={onClose}>✕</button>
        </div>
        <p className="detail-sub">
          Pick up to {EXPLORE_MAX_PARTY_SIZE} champions. <strong>Begin Explore</strong> fights
          right now, turn-by-turn.{' '}
          {unlocked ? (
            <>
              <strong>Send on Auto-Explore</strong> posts them here to auto-battle on their own —
              they keep earning XP and loot while you're away, and rest to recover if a fight goes
              badly.
            </>
          ) : (
            <>Auto-Explore is locked — unlock it in Guild → Upgrades.</>
          )}{' '}
          No permadeath.
        </p>

        {autoExploring.length > 0 && (
          <div className="rows">
            <h3 className="section-title">
              🗺️ Auto-Exploring here ({autoExploring.length}/{EXPLORE_MAX_PARTY_SIZE})
            </h3>
            {autoExploring.map((adv) => (
              <div key={adv.id} className="row item-common">
                <div className="row-info">
                  <span className="row-name">{adv.name}</span>
                  <span className="row-desc">
                    Lv {adv.level}
                    {isInjured(adv, state.runTimeSeconds) ? ' · 🩹 resting' : ' · auto-exploring'}
                  </span>
                </div>
                <button
                  className="small-button danger"
                  onClick={() => store.dispatch((s) => recallAdventurer(s, adv.id))}
                >
                  Recall
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rows">
          {state.adventurers.length === 0 && (
            <div className="row locked">Recruit champions in the Guild tab first.</div>
          )}
          {state.adventurers.map((adv) => (
            <ExplorePartyRow
              key={adv.id}
              adv={adv}
              selected={partyIds.includes(adv.id)}
              disabled={!canExplore(state, adv) && !partyIds.includes(adv.id)}
              injured={isInjured(adv, state.runTimeSeconds)}
              onToggle={() => toggle(adv.id)}
            />
          ))}
        </div>

        <div className="quest-post">
          <label className="field-label">
            repeats
            <input
              type="number"
              min={0}
              placeholder="∞"
              value={repeatInput}
              onChange={(e) => setRepeatInput(e.target.value)}
            />
          </label>
        </div>

        <div className="zone-actions">
          <button className="small-button" disabled={partyIds.length === 0} onClick={begin}>
            ⚔ Begin Explore ({partyIds.length}/{EXPLORE_MAX_PARTY_SIZE})
            {repeatCount > 0 ? ` ×${repeatCount}` : ' ∞'}
          </button>
          <button
            className="small-button"
            disabled={!unlocked || partyIds.length === 0 || autoExploreSlotsLeft <= 0}
            onClick={sendOnAutoExplore}
            title={!unlocked ? 'Unlock Auto-Explore in Guild → Upgrades' : undefined}
          >
            🗺️ Send on Auto-Explore
          </button>
        </div>
      </div>
    </div>
  );
}

function ExplorePartyRow({
  adv,
  selected,
  disabled,
  injured,
  onToggle,
}: {
  adv: Adventurer;
  selected: boolean;
  disabled: boolean;
  injured: boolean;
  onToggle: () => void;
}) {
  const stats = adventurerStats(adv);
  const unavailableReason = injured ? 'Injured — recovering' : adv.assignment ? 'Busy' : null;
  return (
    <div
      className={`row quest-checklist-row ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onToggle()}
    >
      <input type="checkbox" checked={selected} disabled={disabled} readOnly />
      <div className="row-info">
        <span className="row-name">{adv.name}</span>
        <span className="row-desc">
          {CLASS_LABEL[adv.className]} · Lv {adv.level} · ATK {stats.atk} · DEF {stats.def} · HP {stats.maxHp}
        </span>
        {unavailableReason && <span className="row-bad">{unavailableReason}</span>}
      </div>
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
          bundle must be fulfilled together before it pays out. Max {QUEST_MAX_BATCH} per material type.
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
                    max={QUEST_MAX_BATCH}
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
