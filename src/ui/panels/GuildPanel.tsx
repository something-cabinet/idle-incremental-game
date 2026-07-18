import { adventurerStats, isInjured } from '../../game/adventurers';
import { GUILD_UPGRADES, MATERIALS } from '../../game/config';
import {
  buyGuildUpgrade,
  canBuyGuildUpgrade,
  guildUpgradeCost,
  hireAdventurer,
  hireCost,
  locationDef,
  recallAdventurer,
  rosterCap,
} from '../../game/guild';
import type { Adventurer } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

export function GuildPanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const canHire =
    state.adventurers.length < rosterCap(state) && state.gold >= hireCost(state);

  return (
    <div className="panel">
      <section className="rows">
        <h3 className="section-title">
          Adventurers ({state.adventurers.length}/{rosterCap(state)})
        </h3>
        {state.adventurers.map((adv) => (
          <AdventurerCard key={adv.id} adv={adv} />
        ))}
        <button
          className={`row ${canHire ? '' : 'unaffordable'}`}
          disabled={!canHire}
          onClick={() => store.dispatch((s) => hireAdventurer(s))}
        >
          <div className="row-info">
            <span className="row-name">Hire Adventurer</span>
            <span className="row-desc">
              {state.adventurers.length >= rosterCap(state)
                ? 'Roster full — upgrade the Guild Hall.'
                : 'A new blade for the guild.'}
            </span>
          </div>
          <div className="row-cost">{fmt(hireCost(state))} 🪙</div>
        </button>
      </section>

      <section className="rows">
        <h3 className="section-title">Guild Upgrades</h3>
        {GUILD_UPGRADES.map((def) => {
          const level = state.guildUpgrades[def.id] ?? 0;
          const maxed = level >= def.maxLevel;
          const cost = guildUpgradeCost(state, def.id);
          const affordable = canBuyGuildUpgrade(state, def.id);
          return (
            <button
              key={def.id}
              className={`row ${affordable ? '' : 'unaffordable'}`}
              disabled={!affordable}
              onClick={() => store.dispatch((s) => buyGuildUpgrade(s, def.id))}
            >
              <div className="row-info">
                <span className="row-name">
                  {def.name} <span className="row-sub">Lv {level}/{def.maxLevel}</span>
                </span>
                <span className="row-desc">{def.description}</span>
              </div>
              <div className="row-cost">
                {maxed ? 'Max' : (
                  <>
                    {fmt(cost.gold)} 🪙
                    {Object.entries(cost.materials).map(([id, n]) => (
                      <span key={id} className="mat-cost">
                        {n} {MATERIALS.find((m) => m.id === id)?.name ?? id}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function AdventurerCard({ adv }: { adv: Adventurer }) {
  const store = useGameStore();
  const state = useGameState();
  const { atk, def } = adventurerStats(adv);
  const injured = isInjured(adv, state.runTimeSeconds);
  const status = injured
    ? `🩹 Recovering (${Math.ceil((adv.injuredUntil - state.runTimeSeconds) / 60)}m)`
    : adv.assignment
      ? assignmentLabel(adv)
      : 'Idle at the guild hall';

  return (
    <div className={`adventurer-card ${injured ? 'injured' : ''}`}>
      <div className="row-info">
        <span className="row-name">
          {adv.name}{' '}
          <span className="row-sub">
            Lv {adv.level} {adv.className}
          </span>
        </span>
        <span className="row-desc">
          ⚔ {atk} · 🛡 {def} ·{' '}
          {(['weapon', 'armor', 'trinket'] as const)
            .map((slot) => adv.equipment[slot]?.name ?? `no ${slot}`)
            .join(' · ')}
        </span>
        <span className={injured ? 'row-bad' : 'row-good'}>{status}</span>
      </div>
      {adv.assignment && adv.assignment.mode !== 'expedition' && (
        <button
          className="small-button"
          onClick={() => store.dispatch((s) => recallAdventurer(s, adv.id))}
        >
          Recall
        </button>
      )}
    </div>
  );
}

function assignmentLabel(adv: Adventurer): string {
  const loc = locationDef(adv.assignment!.locationId);
  const name = loc?.name ?? '???';
  switch (adv.assignment!.mode) {
    case 'quest':
      return `📜 On quest — ${name}`;
    case 'expedition':
      return `⚔ On expedition — ${name}`;
    default:
      return `🐾 Patrolling — ${name}`;
  }
}
