import { useState } from 'react';
import { canExplore } from '../../game/combat';
import type { BattleCarryIn, BattleOutcome } from '../../game/combat';
import {
  campaignBossDef,
  campaignLockReason,
  campaignTargets,
  fightCampaignStage,
  CAMPAIGN_TOTAL_STAGES,
} from '../../game/campaign';
import {
  CAMPAIGN_GUARD_STAGES,
  DEMON_KING_ID,
  EXPLORE_MAX_PARTY_SIZE,
  HOMETOWN_DEADLINE_DAY,
} from '../../game/config';
import { currentDay } from '../../game/logic';
import type { CampaignBossDef, LocationDef } from '../../game/types';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { BattleModal } from '../BattleModal';
import { InfoNote, Modal, NoteRow } from '../components';
import { Icon } from '../icons';
import { ExplorePartyRow } from '../PartyPicker';

/**
 * Act 3 — the campaign. One card per boss, marched on in order, each a manual
 * gauntlet resolved stage by stage (see game/campaign.ts). Deliberately built
 * on the same bones as the Dungeons subtab next door: the player already knows
 * how a party is picked and how a run plays, so the new thing here is the
 * stakes, not the interaction.
 */
export function CampaignSection() {
  const state = useGameState();
  const day = currentDay(state);
  const daysLeft = HOMETOWN_DEADLINE_DAY - day;

  return (
    <section className="rows">
      <InfoNote id="campaign-help" title="How the campaign works" defaultOpen>
        March on the demon king's generals one at a time — {CAMPAIGN_GUARD_STAGES} waves of their
        elite guard, then the general themself. Your party carries its wounds from stage to stage,
        so a march is one long fight. Lose and you simply come home to heal and try again; there is
        no permadeath and no lockout. Fell all three generals and the citadel opens.
      </InfoNote>

      <NoteRow icon={daysLeft > 0 ? 'hourglass' : 'warning'} tone={daysLeft > 0 ? undefined : 'muted'}>
        <span className="row-desc">
          {daysLeft > 0 ? (
            <>
              Day {day}. The legion razes your hometown on day {HOMETOWN_DEADLINE_DAY} —{' '}
              <strong>{daysLeft}</strong> day{daysLeft === 1 ? '' : 's'} left. Killing the king
              before then, in a later timeline, is how you save them.
            </>
          ) : (
            <>Day {day}. The raid has already come and gone in this timeline. Kill him anyway —
            then go back further.</>
          )}
        </span>
      </NoteRow>

      {campaignTargets().map((target) => (
        <CampaignCard key={target.id} target={target} />
      ))}
    </section>
  );
}

function CampaignCard({ target }: { target: LocationDef }) {
  const state = useGameState();
  const [open, setOpen] = useState(false);
  const boss = campaignBossDef(target.id);
  if (!boss) return null;

  const defeated = !!state.bossesDefeated[target.id];
  const lockReason = campaignLockReason(state, target.id);

  if (lockReason) {
    return (
      <NoteRow icon="lock" tone="muted">
        <span className="row-desc">
          {target.name} — {lockReason}
        </span>
      </NoteRow>
    );
  }

  return (
    <div className="zone-card">
      <div className="zone-header">
        <span className="row-name">
          {boss.name} <span className="row-sub">tier {target.tier}</span>
        </span>
        <span className="row-desc">{target.name}</span>
      </div>
      <div className="zone-detail">
        {defeated ? (
          <NoteRow icon="trophy">
            <span className="row-desc">
              {boss.victoryLog}
              {target.id === DEMON_KING_ID && ' The time crystal waits in Overview → Timeline.'}
            </span>
          </NoteRow>
        ) : (
          <>
            <p className="row-desc">{boss.intro}</p>
            <button className="small-button primary" onClick={() => setOpen(true)}>
              <Icon name="skull" /> March on {boss.name}
            </button>
          </>
        )}
      </div>
      {open && <MarchDialog boss={boss} target={target} onClose={() => setOpen(false)} />}
    </div>
  );
}

/**
 * One march, stage by stage. Structurally identical to MapPanel's
 * DungeonRunDialog — stage progress and the surviving party are UI-local, only
 * rewards and the kill persist — with the run's outcome mattering rather more.
 */
function MarchDialog({
  boss,
  target,
  onClose,
}: {
  boss: CampaignBossDef;
  target: LocationDef;
  onClose: () => void;
}) {
  const store = useGameStore();
  const state = useGameState();
  const [partyIds, setPartyIds] = useState<number[]>([]);
  const [battle, setBattle] = useState<BattleOutcome | null>(null);
  const [stage, setStage] = useState(0);
  const [activeIds, setActiveIds] = useState<number[]>([]);
  const [carry, setCarry] = useState<BattleCarryIn>({});
  /** Set only when a march breaks — a won march closes out to its story beat. */
  const [failed, setFailed] = useState(false);

  function toggle(id: number) {
    setPartyIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= EXPLORE_MAX_PARTY_SIZE) return prev;
      return [...prev, id];
    });
  }

  function fightStage(ids: number[], index: number, carryIn: BattleCarryIn) {
    let outcome: BattleOutcome | null = null;
    let carryOut: BattleCarryIn = {};
    store.dispatch((s) => {
      const result = fightCampaignStage(s, target.id, ids, index, Math.random, carryIn);
      outcome = result.result;
      carryOut = result.carryOut;
      return result.state;
    });
    if (outcome) setBattle(outcome);
    setCarry(carryOut);
  }

  function begin() {
    setFailed(false);
    setActiveIds(partyIds);
    setStage(0);
    fightStage(partyIds, 0, {});
  }

  function handleBattleClose() {
    if (!battle) return;
    const knockedOut = new Set(battle.party.filter((p) => p.knockedOut).map((p) => p.advId));
    const survivors = activeIds.filter((id) => !knockedOut.has(id));
    setActiveIds(survivors);
    if (battle.outcome === 'loss' || survivors.length === 0) {
      setBattle(null);
      setFailed(true);
      return;
    }
    if (stage === CAMPAIGN_TOTAL_STAGES - 1) {
      // Won. No summary modal: this boss's story beat is already queued and
      // fires the moment the battle closes (see story.ts / battlePresence),
      // and it says everything a summary would, better.
      setBattle(null);
      onClose();
      return;
    }
    const next = stage + 1;
    setStage(next);
    setBattle(null);
    fightStage(survivors, next, carry);
  }

  if (battle) {
    const isBossStage = stage === CAMPAIGN_GUARD_STAGES;
    return (
      <BattleModal
        result={battle}
        locationName={
          isBossStage ? boss.name : `${target.name} — Guard ${stage + 1}/${CAMPAIGN_GUARD_STAGES}`
        }
        verb="Marching on"
        tier={target.tier}
        reducedMotion={state.settings.reducedMotion}
        onClose={handleBattleClose}
        autoAdvance={false}
        onStop={() => {}}
      />
    );
  }

  if (failed) {
    return (
      <Modal
        title={boss.name}
        onClose={onClose}
        footer={
          <button className="small-button primary" onClick={onClose}>
            Close
          </button>
        }
      >
        <NoteRow icon="bandage">
          <span className="row-desc">
            The march broke before {boss.name} fell. Your champions are recovering in town — heal
            them, gear them, and march again. {boss.name} is back to full strength.
          </span>
        </NoteRow>
      </Modal>
    );
  }

  return (
    <Modal
      title={`March on ${boss.name}`}
      onClose={onClose}
      footer={
        <button className="small-button primary" disabled={partyIds.length === 0} onClick={begin}>
          <Icon name="skull" /> Begin March ({partyIds.length}/{EXPLORE_MAX_PARTY_SIZE})
        </button>
      }
    >
      <InfoNote
        id="campaign-march-help"
        title={`${CAMPAIGN_GUARD_STAGES} guard waves, then ${boss.name}`}
        defaultOpen={state.adventurers.length === 0}
      >
        Wounds and skill cooldowns carry from one stage to the next, so bring champions who can go
        the distance. A knocked-out champion sits out the rest of the march; if everyone falls, the
        general is restored to full and you can march again once your roster heals.
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
