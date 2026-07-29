import { useState } from 'react';
import { isInjured } from '../../game/adventurers';
import { canExplore, runExplore } from '../../game/combat';
import type { BattleCarryIn, BattleOutcome } from '../../game/combat';
import {
  DUNGEON_WINS_REQUIRED,
  EXPLORE_MAX_PARTY_SIZE,
  QUEST_DEFAULT_MAX_ADVENTURERS,
  QUEST_MAX_BATCH,
  QUEST_MAX_REPEATS_INPUT,
  QUEST_MAX_REQUIREMENTS,
} from '../../game/config';
import { dungeonDef, dungeonProgress, fightDungeonRoom, DUNGEON_TOTAL_ROOMS } from '../../game/dungeon';
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
import type { DungeonDef, LocationDef, QuestRequirement, QuestTargetDef } from '../../game/types';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { BattleModal } from '../BattleModal';
import { ExplorePartyRow } from '../PartyPicker';
import { CampaignSection } from './CampaignSection';
import { InfoNote, Modal, NoteRow } from '../components';
import { materialName, rate } from '../display';
import { Icon } from '../icons';

export function MapPanel() {
  const state = useGameState();
  const [subtab, setSubtab] = useState<'explore' | 'dungeons' | 'campaign'>('explore');
  // The campaign only exists once the razed hometown has been found (Act 3),
  // so the subtab appears then rather than sitting dead through two acts.
  const campaignOpen = state.act >= 3;
  const active = subtab === 'campaign' && !campaignOpen ? 'explore' : subtab;

  return (
    <div className="panel">
      <div className="subtab-bar">
        <button
          className={`subtab ${active === 'explore' ? 'active' : ''}`}
          onClick={() => setSubtab('explore')}
        >
          Explore
        </button>
        <button
          className={`subtab ${active === 'dungeons' ? 'active' : ''}`}
          onClick={() => setSubtab('dungeons')}
        >
          Dungeons
        </button>
        {campaignOpen && (
          <button
            className={`subtab ${active === 'campaign' ? 'active' : ''}`}
            onClick={() => setSubtab('campaign')}
          >
            Campaign
          </button>
        )}
      </div>
      {active === 'campaign' ? (
        <CampaignSection />
      ) : active === 'explore' ? (
        <section className="rows">
          <InfoNote id="wilds-help" title="How the wilds work">
            Browse each zone's monsters and gatherables, then post a quest there for whichever of
            them you need — see Guild → Quests to manage what's running.
          </InfoNote>
          {zones().map((zone) => (
            <ZoneCard key={zone.id} zone={zone} />
          ))}
        </section>
      ) : (
        <DungeonsSection />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dungeons — a repeatable multi-room gauntlet per zone, unlocked once that
// zone has DUNGEON_WINS_REQUIRED manual Explore wins (Auto-Explore doesn't
// count — see combat.ts recordDungeonWin). Reuses ExplorePartyRow/BattleModal.
// ---------------------------------------------------------------------------

function DungeonsSection() {
  return (
    <section className="rows">
      <InfoNote id="dungeon-help" title="How dungeons work">
        Win {DUNGEON_WINS_REQUIRED} manual Explore battles in a zone to discover its dungeon — a
        multi-room gauntlet capped by a tougher boss fight. Repeatable, with a bonus haul on every
        full clear.
      </InfoNote>
      {zones().map((zone) => (
        <DungeonCard key={zone.id} zone={zone} />
      ))}
    </section>
  );
}

function DungeonCard({ zone }: { zone: LocationDef }) {
  const state = useGameState();
  const [open, setOpen] = useState(false);
  const zoneUnlocked = isZoneUnlocked(state, zone.id);
  const dungeon = dungeonDef(zone.id);
  if (!zoneUnlocked || !dungeon) return null;
  const progress = dungeonProgress(state, zone.id);

  return (
    <div className="zone-card">
      <div className="zone-header">
        <span className="row-name">
          {dungeon.name} <span className="row-sub">tier {zone.tier}</span>
        </span>
        <span className="row-desc">{dungeon.description}</span>
      </div>
      <div className="zone-detail">
        {progress.unlocked ? (
          <button className="small-button primary" onClick={() => setOpen(true)}>
            <Icon name="sword" /> Enter Dungeon
          </button>
        ) : (
          <NoteRow icon="lock" tone="muted">
            <span className="row-desc">
              Win {progress.wins}/{DUNGEON_WINS_REQUIRED} Explore battles at {zone.name} to
              discover this dungeon.
            </span>
          </NoteRow>
        )}
      </div>
      {open && <DungeonRunDialog dungeon={dungeon} zone={zone} onClose={() => setOpen(false)} />}
    </div>
  );
}

function DungeonRunDialog({
  dungeon,
  zone,
  onClose,
}: {
  dungeon: DungeonDef;
  zone: LocationDef;
  onClose: () => void;
}) {
  const store = useGameStore();
  const state = useGameState();
  const [partyIds, setPartyIds] = useState<number[]>([]);
  const [battle, setBattle] = useState<BattleOutcome | null>(null);
  const [roomIndex, setRoomIndex] = useState(0);
  const [activeIds, setActiveIds] = useState<number[]>([]);
  // Survivors' HP/skill cooldown carried from the last room into the next —
  // the run plays as one continuous fight, not a fresh full-HP battle each
  // room (see dungeon.ts fightDungeonRoom's carryIn/carryOut).
  const [carry, setCarry] = useState<BattleCarryIn>({});
  const [finished, setFinished] = useState<'cleared' | 'failed' | null>(null);

  function toggle(id: number) {
    setPartyIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= EXPLORE_MAX_PARTY_SIZE) return prev;
      return [...prev, id];
    });
  }

  function fightRoom(ids: number[], room: number, carryIn: BattleCarryIn) {
    let outcome: BattleOutcome | null = null;
    let carryOut: BattleCarryIn = {};
    store.dispatch((s) => {
      const { state: next, result, carryOut: out } = fightDungeonRoom(s, zone.id, ids, room, Math.random, carryIn);
      outcome = result;
      carryOut = out;
      return next;
    });
    if (outcome) setBattle(outcome);
    setCarry(carryOut);
  }

  function begin() {
    setFinished(null);
    setActiveIds(partyIds);
    setRoomIndex(0);
    fightRoom(partyIds, 0, {});
  }

  function handleBattleClose() {
    if (!battle) return;
    const knockedOutIds = new Set(battle.party.filter((p) => p.knockedOut).map((p) => p.advId));
    const survivors = activeIds.filter((id) => !knockedOutIds.has(id));
    setActiveIds(survivors);
    if (battle.outcome === 'loss' || survivors.length === 0) {
      setBattle(null);
      setFinished('failed');
      return;
    }
    if (roomIndex === DUNGEON_TOTAL_ROOMS - 1) {
      setBattle(null);
      setFinished('cleared');
      return;
    }
    const nextRoom = roomIndex + 1;
    setRoomIndex(nextRoom);
    setBattle(null);
    fightRoom(survivors, nextRoom, carry);
  }

  if (battle) {
    const isBossRoom = roomIndex === DUNGEON_TOTAL_ROOMS - 1;
    return (
      <BattleModal
        result={battle}
        locationName={
          isBossRoom ? `${dungeon.name} — ${dungeon.bossName}` : `${dungeon.name} — Room ${roomIndex + 1}`
        }
        tier={zone.tier}
        reducedMotion={state.settings.reducedMotion}
        onClose={handleBattleClose}
        autoAdvance={false}
        onStop={() => {}}
      />
    );
  }

  if (finished) {
    return (
      <Modal
        title={dungeon.name}
        onClose={onClose}
        footer={
          <button className="small-button primary" onClick={onClose}>
            Close
          </button>
        }
      >
        <NoteRow icon={finished === 'cleared' ? 'trophy' : 'bandage'}>
          <span className="row-desc">
            {finished === 'cleared'
              ? `Cleared! The party defeated ${dungeon.bossName} and returned with a bonus haul.`
              : 'The party was overwhelmed and had to retreat. No permadeath — champions are recovering in town.'}
          </span>
        </NoteRow>
      </Modal>
    );
  }

  return (
    <Modal
      title={dungeon.name}
      onClose={onClose}
      footer={
        <button className="small-button primary" disabled={partyIds.length === 0} onClick={begin}>
          <Icon name="sword" /> Enter Dungeon ({partyIds.length}/{EXPLORE_MAX_PARTY_SIZE})
        </button>
      }
    >
      <InfoNote id="dungeon-run-help" title={`${DUNGEON_TOTAL_ROOMS - 1} rooms, then ${dungeon.bossName}`}>
        Clear every room in one run for a bonus haul. Knocked-out champions sit out the rest of the
        run (no permadeath), and a wipe ends the run with whatever's already been earned.
      </InfoNote>

      <div className="rows">
          {state.adventurers.length === 0 && (
            <NoteRow icon="info" tone="muted">Recruit champions in the Guild tab first.</NoteRow>
          )}
        {state.adventurers.map((adv) => (
          <ExplorePartyRow
            key={adv.id}
            adv={adv}
            selected={partyIds.includes(adv.id)}
            disabled={!canExplore(state, adv) && !partyIds.includes(adv.id)}
            onToggle={() => toggle(adv.id)}
          />
        ))}
      </div>
    </Modal>
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
      <NoteRow icon="lock" tone="muted">
        <span className="row-desc">
          {zone.name} — reach {zone.repRequired} reputation
        </span>
      </NoteRow>
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
        <span className={`zone-toggle ${open ? 'open' : ''}`}>
          <Icon name="chevron" />
        </span>
      </button>

      {open && (
        <div className="zone-detail">
          <div className="section-title-row">
            <h4 className="section-title">
              <Icon name="beast" /> Monsters
            </h4>
            <div className="zone-actions">
              <button className="small-button primary" onClick={() => setExploreOpen(true)}>
                <Icon name="sword" /> Explore
              </button>
              <button className="small-button" onClick={() => setDialogOpen(true)}>
                <Icon name="plus" /> Post Quest
              </button>
            </div>
          </div>
          {monsters.map((t) => (
            <TargetCatalogRow key={t.id} target={t} />
          ))}
          <h4 className="section-title">
            <Icon name="flora" /> Gatherables
          </h4>
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
  const [autoContinue, setAutoContinue] = useState(false);
  // The subset of partyIds still fighting — knocked-out champions are pulled
  // out (to recover in town) between fights instead of ending the whole run.
  const [activeIds, setActiveIds] = useState<number[]>([]);
  const [stopRequested, setStopRequested] = useState(false);

  function toggle(id: number) {
    setPartyIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= EXPLORE_MAX_PARTY_SIZE) return prev;
      return [...prev, id];
    });
  }

  function runNextFight(ids: number[]) {
    let outcome: BattleOutcome | null = null;
    store.dispatch((s) => {
      const { state: next, result } = runExplore(s, zone.id, ids, Math.random);
      outcome = result;
      return next;
    });
    if (outcome) {
      setBattle(outcome);
    }
  }

  function begin() {
    setStopRequested(false);
    setActiveIds(partyIds);
    runNextFight(partyIds);
  }

  function sendOnAutoExplore() {
    if (partyIds.length === 0) return;
    store.dispatch((s) => sendPartyOnAutoExplore(s, partyIds, zone.id));
    onClose();
  }

  // Explore runs unlimited fights until the player stops or the whole squad
  // is knocked out — no repeat count. Champions knocked out in a fight are
  // dropped from the squad (they're already sent to recovery by
  // applyBattleResult) rather than ending the run for everyone else.
  function handleBattleClose() {
    if (!battle) return;
    const knockedOutIds = new Set(
      battle.party.filter((p) => p.knockedOut).map((p) => p.advId),
    );
    const survivors = activeIds.filter((id) => !knockedOutIds.has(id));
    setActiveIds(survivors);
    if (survivors.length === 0 || stopRequested) {
      setBattle(null);
      onClose();
      return;
    }
    runNextFight(survivors);
  }

  function handleStop() {
    setStopRequested(true);
  }

  if (battle) {
    return (
      <BattleModal
        result={battle}
        locationName={zone.name}
        tier={zone.tier}
        reducedMotion={state.settings.reducedMotion}
        onClose={handleBattleClose}
        autoAdvance={autoContinue || stopRequested}
        onStop={handleStop}
      />
    );
  }

  const autoExploring = autoExploreMembers(state, zone.id);
  const autoExploreSlotsLeft = EXPLORE_MAX_PARTY_SIZE - autoExploring.length;
  const unlocked = autoExploreUnlocked(state);

  return (
    <Modal
      title={`Explore — ${zone.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="small-button primary" disabled={partyIds.length === 0} onClick={begin}>
            <Icon name="sword" /> Explore ({partyIds.length}/{EXPLORE_MAX_PARTY_SIZE})
          </button>
          <button
            className="small-button"
            disabled={!unlocked || partyIds.length === 0 || autoExploreSlotsLeft <= 0}
            onClick={sendOnAutoExplore}
            title={!unlocked ? 'Unlock Auto-Explore in Guild → Upgrades' : undefined}
          >
            <Icon name="map" /> Auto
          </button>
        </>
      }
    >
      <InfoNote id="explore-help" title="Explore vs. auto-explore" defaultOpen={!unlocked}>
        <strong>Explore</strong> fights right now, turn by turn, and keeps going until you stop or
        the squad is knocked out.{' '}
        {unlocked
          ? 'Auto sends the party to battle here on their own, earning XP and loot while you are away and resting when a fight goes badly.'
          : 'Auto-Explore is locked — unlock it in Guild → Upgrades.'}{' '}
        No permadeath either way.
      </InfoNote>

        {autoExploring.length > 0 && (
          <div className="rows">
            <h3 className="section-title">
              <Icon name="map" /> Auto-exploring here ({autoExploring.length}/
              {EXPLORE_MAX_PARTY_SIZE})
            </h3>
            {autoExploring.map((adv) => (
              <div key={adv.id} className="row item-common has-actions">
                <div className="row-info">
                  <span className="row-name">{adv.name}</span>
                  <span className="row-desc">
                    Lv {adv.level}
                    {isInjured(adv, state.runTimeSeconds) ? ' · resting' : ' · auto-exploring'}
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
            <NoteRow icon="info" tone="muted">Recruit champions in the Guild tab first.</NoteRow>
          )}
          {state.adventurers.map((adv) => (
            <ExplorePartyRow
              key={adv.id}
              adv={adv}
              selected={partyIds.includes(adv.id)}
              disabled={!canExplore(state, adv) && !partyIds.includes(adv.id)}
                onToggle={() => toggle(adv.id)}
            />
          ))}
        </div>

      <label className="field-label checkbox-label">
        <input
          type="checkbox"
          checked={autoContinue}
          onChange={(e) => setAutoContinue(e.target.checked)}
        />
        Keep fighting without asking
      </label>
    </Modal>
  );
}

function TargetCatalogRow({ target }: { target: QuestTargetDef }) {
  const verb = target.kind === 'monster' ? 'Kill' : 'Collect';
  return (
    <div className="row">
      <div className="row-info">
        <span className="row-name">{target.name}</span>
        <span className="row-desc">
          {verb} · yields {materialName(target.materialId)}
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
    <Modal
      title={`Post a Quest — ${zone.name}`}
      onClose={onClose}
      footer={
        <button
          className="small-button primary"
          disabled={requirements.length === 0}
          onClick={handlePost}
        >
          Post Quest
        </button>
      }
    >
      <InfoNote id="quest-help" title="Bundling requirements" defaultOpen={state.quests.length === 0}>
        Check everything this quest requires (up to {QUEST_MAX_REQUIREMENTS}) — the whole bundle
        must be fulfilled together before it pays out. Max {QUEST_MAX_BATCH} per material type.
      </InfoNote>

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
          <NoteRow icon="check">
            <span className="row-name">
              {summary.materials.map((m) => `${m.amount} ${materialName(m.materialId)}`).join(' · ')}
            </span>
            <span className="row-desc">
              −{rate(summary.gold)} gold · +{rate(summary.reputation)} rep · ~
              {formatDuration(summary.timeSeconds)}/round · {summary.assigned}/
              {summary.maxAdventurers} adventurers
            </span>
          </NoteRow>
        ) : (
          <NoteRow icon="info" tone="muted">Check at least one monster or gatherable.</NoteRow>
        )}

    </Modal>
  );
}
