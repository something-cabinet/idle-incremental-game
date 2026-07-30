import { HOMETOWN_DEADLINE_DAY, PERKS } from '../../game/config';
import { currentDay } from '../../game/logic';
import {
  buyPerk,
  canBuyPerk,
  isPerkMaxed,
  isPerkUnlocked,
  perkCost,
  perkDef,
  perkLevel,
} from '../../game/perks';
import { canTimeTravel, timeTravel } from '../../game/prestige';
import type { PerkDef } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { ConfirmModal, NoteRow } from '../components';
import { Icon } from '../icons';
import { useState } from 'react';

/**
 * Prestige, as an Overview section rather than its own tab — it appears only
 * after the demon king falls, and competing for a permanent nav slot from the
 * start meant either a dead tab or a bar that reflows late in the run.
 */
export function TimelineSection() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const ready = canTimeTravel(state);
  const day = currentDay(state);
  const beforeDeadline = day <= HOMETOWN_DEADLINE_DAY;
  const [travelOpen, setTravelOpen] = useState(false);

  const travel = () => {
    if (!ready) return;
    if (state.settings.confirmPrestige) {
      setTravelOpen(true);
      return;
    }
    store.dispatch((s) => timeTravel(s));
  };

  return (
    <div className="panel">
      {state.hometownSaved && (
        <div className="ending-banner">
          The hometown stands. In this timeline, they live. You are at peace.
        </div>
      )}

      <div className="currency-banner">
        <span className="currency-amount">
          <Icon name="hourglass" /> {fmt(state.timeShards)}
        </span>
        <span className="currency-label">
          time shards · timeline #{state.prestigeCount + 1} · day {day}
        </span>
      </div>

      {ready && (
        <div className="rows">
          <p className="prestige-blurb">
            The demon king is dead. The time crystal hums — you can go back
            further this time.{' '}
            {state.prestigeCount >= 1
              ? beforeDeadline
                ? 'You did it before the raid. The hometown is safe in this timeline.'
                : `The raid came on day ${HOMETOWN_DEADLINE_DAY}; you were too late to save them here. Go again.`
              : `To save the hometown, a future timeline must fell him before day ${HOMETOWN_DEADLINE_DAY}.`}
          </p>
          <button className="prestige-button" onClick={travel}>
            <Icon name="hourglass" /> Travel Back in Time
          </button>
        </div>
      )}

      {travelOpen && (
        <ConfirmModal
          title="Travel Back in Time"
          message={
            <>
              The town, guild, and adventurers will reset.
              <br /><br />
              <strong>Time Shards and perks persist across timelines.</strong> Are you ready to begin again?
            </>
          }
          confirmLabel="Travel Back"
          cancelLabel="Stay Here"
          variant="primary"
          icon="hourglass"
          onConfirm={() => {
            store.dispatch((s) => timeTravel(s));
            setTravelOpen(false);
          }}
          onCancel={() => setTravelOpen(false)}
        />
      )}

      <section className="rows">
        <h3 className="section-title">Perks — echoes across timelines</h3>
        {PERKS.map((perk) => (
          <PerkCard key={perk.id} def={perk} />
        ))}
      </section>
    </div>
  );
}

function PerkCard({ def }: { def: PerkDef }) {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();

  const level = perkLevel(state, def.id);
  const unlocked = isPerkUnlocked(state, def.id);
  const maxed = isPerkMaxed(state, def.id);
  const affordable = canBuyPerk(state, def.id);

  if (!unlocked) {
    const reqNames = (def.requires ?? [])
      .map((r) => perkDef(r)?.name ?? r)
      .join(', ');
    return (
      <NoteRow icon="lock" tone="muted">
        <span className="row-desc">
          {def.name} — requires {reqNames}
        </span>
      </NoteRow>
    );
  }

  return (
    <button
      className={`row ${affordable ? '' : 'unaffordable'} ${maxed ? 'maxed' : ''}`}
      disabled={!affordable}
      onClick={() => store.dispatch((s) => buyPerk(s, def.id))}
    >
      <div className="row-info">
        <span className="row-name">
          {def.name} <span className="row-sub">{level}/{def.maxLevel}</span>
        </span>
        <span className="row-desc">{def.description}</span>
      </div>
      <div className="row-cost">
        {maxed ? (
          'Max'
        ) : (
          <span>
            <Icon name="hourglass" /> {fmt(perkCost(state, def.id))}
          </span>
        )}
      </div>
    </button>
  );
}
