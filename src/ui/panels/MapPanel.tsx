import { useState } from 'react';
import { adventurerPower, isInjured } from '../../game/adventurers';
import { MATERIALS } from '../../game/config';
import { successChance } from '../../game/engine';
import {
  assignAdventurer,
  bosses,
  expeditionCandidates,
  isBossUnlocked,
  isZoneUnlocked,
  launchExpedition,
  locationDef,
  zones,
} from '../../game/guild';
import type { LocationDef } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

export function MapPanel() {
  const state = useGameState();
  return (
    <div className="panel">
      <section className="rows">
        <h3 className="section-title">Wilds</h3>
        {zones().map((zone) => (
          <ZoneCard key={zone.id} zone={zone} />
        ))}
      </section>

      {state.act >= 3 && (
        <section className="rows">
          <h3 className="section-title">⚔ The Legion — Expeditions</h3>
          <ExpeditionStatus />
          {bosses().map((boss) => (
            <BossCard key={boss.id} boss={boss} />
          ))}
        </section>
      )}
    </div>
  );
}

function ZoneCard({ zone }: { zone: LocationDef }) {
  const store = useGameStore();
  const state = useGameState();
  const [selected, setSelected] = useState<number | ''>('');
  const unlocked = isZoneUnlocked(state, zone.id);
  const available = state.adventurers.filter(
    (a) => a.assignment === null && !isInjured(a, state.runTimeSeconds),
  );
  const here = state.adventurers.filter((a) => a.assignment?.locationId === zone.id);
  const materialName =
    MATERIALS.find((m) => m.id === zone.materialId)?.name ?? zone.materialId;

  if (!unlocked) {
    return (
      <div className="row locked">
        🔒 {zone.name} — clear the previous zone’s quest
      </div>
    );
  }

  const send = (mode: 'patrol' | 'quest') => {
    if (selected === '') return;
    store.dispatch((s) => assignAdventurer(s, selected, zone.id, mode));
    setSelected('');
  };

  return (
    <div className="zone-card">
      <div className="row-info">
        <span className="row-name">
          {zone.name}{' '}
          <span className="row-sub">
            danger {zone.power} {state.locationsCleared[zone.id] && '· ✓ cleared'}
          </span>
        </span>
        <span className="row-desc">
          {zone.description} Drops: {materialName}.
        </span>
        {here.length > 0 && (
          <span className="row-good">
            {here.map((a) => `${a.name.split(' ')[0]} (${a.assignment!.mode})`).join(', ')}
          </span>
        )}
      </div>
      <div className="zone-actions">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">Send who?</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name.split(' ')[0]} · {Math.round(successChance(adventurerPower(state, a), zone.power) * 100)}%
            </option>
          ))}
        </select>
        <button className="small-button" disabled={selected === ''} onClick={() => send('quest')}>
          Quest ({Math.round(zone.questDuration / 60)}m)
        </button>
        <button className="small-button" disabled={selected === ''} onClick={() => send('patrol')}>
          Patrol
        </button>
      </div>
    </div>
  );
}

function ExpeditionStatus() {
  const state = useGameState();
  if (!state.expedition) return null;
  const loc = locationDef(state.expedition.locationId);
  const minutes = Math.max(0, Math.ceil((state.expedition.endsAt - state.runTimeSeconds) / 60));
  return (
    <div className="row expedition-active">
      ⚔ Expedition marching on {loc?.name ?? '???'} — {state.expedition.memberIds.length}{' '}
      adventurers, resolves in ~{minutes}m
    </div>
  );
}

function BossCard({ boss }: { boss: LocationDef }) {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const defeated = !!state.bossesDefeated[boss.id];
  const unlocked = isBossUnlocked(state, boss.id);
  const party = expeditionCandidates(state);
  const partyPower = party.reduce((sum, a) => sum + adventurerPower(state, a), 0);
  const chance = Math.round(successChance(partyPower, boss.power) * 100);
  const canLaunch = unlocked && !state.expedition && party.length > 0;

  if (defeated) {
    return <div className="row boss-defeated">☠ {boss.name} — defeated</div>;
  }
  if (!unlocked) {
    return <div className="row locked">🔒 {boss.name}</div>;
  }

  return (
    <div className="zone-card boss-card">
      <div className="row-info">
        <span className="row-name">
          {boss.name} <span className="row-sub">power {boss.power}</span>
        </span>
        <span className="row-desc">
          {boss.description} Reward: {fmt(boss.bossShardReward ?? 0)} ⏳ shards.
        </span>
        <span className={chance >= 60 ? 'row-good' : 'row-bad'}>
          Party of {party.length} idle adventurers · {chance}% success
        </span>
      </div>
      <button
        className="small-button danger"
        disabled={!canLaunch}
        onClick={() => store.dispatch((s) => launchExpedition(s, boss.id))}
      >
        Launch ({Math.round(boss.questDuration / 60)}m)
      </button>
    </div>
  );
}
