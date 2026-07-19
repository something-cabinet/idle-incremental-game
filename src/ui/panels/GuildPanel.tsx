import { useState } from 'react';
import { GUILD_UPGRADES, MATERIALS } from '../../game/config';
import {
  adventurerCount,
  buyGuildUpgrade,
  canBuyGuildUpgrade,
  deleteQuest,
  guildUpgradeCost,
  questRates,
  questTargetDef,
  zones,
} from '../../game/guild';
import type { Quest } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

type Section = 'adventurers' | 'quests' | 'upgrades';

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

function rate(n: number): string {
  if (n === 0) return '0';
  if (n < 10) return n.toFixed(2);
  if (n < 100) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}

export function GuildPanel() {
  const [section, setSection] = useState<Section>('adventurers');

  return (
    <div className="panel">
      <div className="subtab-bar">
        <button
          className={`subtab ${section === 'adventurers' ? 'active' : ''}`}
          onClick={() => setSection('adventurers')}
        >
          Adventurers
        </button>
        <button
          className={`subtab ${section === 'quests' ? 'active' : ''}`}
          onClick={() => setSection('quests')}
        >
          Quests
        </button>
        <button
          className={`subtab ${section === 'upgrades' ? 'active' : ''}`}
          onClick={() => setSection('upgrades')}
        >
          Upgrades
        </button>
      </div>

      {section === 'adventurers' && <AdventurersSection />}
      {section === 'quests' && <QuestsSection />}
      {section === 'upgrades' && <UpgradesSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adventurers — the numerous town pool, driven by reputation
// ---------------------------------------------------------------------------

function AdventurersSection() {
  const state = useGameState();
  const fmt = useFormat();
  const count = adventurerCount(state);

  // Next zone still locked behind a reputation threshold, if any.
  const nextZone = zones().find((z) => state.reputation < (z.repRequired ?? 0));

  return (
    <section className="rows">
      <h3 className="section-title">The Guild’s Adventurers</h3>

      <div className="detail-stats">
        <div className="stat">
          <span className="stat-value">{count}</span>
          <span className="stat-label">Adventurers</span>
        </div>
        <div className="stat">
          <span className="stat-value">★ {fmt(Math.floor(state.reputation))}</span>
          <span className="stat-label">Reputation</span>
        </div>
        <div className="stat">
          <span className="stat-value">{state.quests.length}</span>
          <span className="stat-label">Active Quests</span>
        </div>
      </div>

      <p className="detail-sub">
        These adventurers come and go, taking whatever bounties the guild posts. As
        your <strong>reputation</strong> grows, more of them turn up — and they split
        their effort across every quest on the board.
      </p>

      {nextZone ? (
        <div className="row locked">
          🔒 {nextZone.name} unlocks at ★ {fmt(nextZone.repRequired ?? 0)} reputation
          ({fmt(Math.max(0, Math.ceil((nextZone.repRequired ?? 0) - state.reputation)))} to go)
        </div>
      ) : (
        <div className="row item-common">All wilds unlocked.</div>
      )}

      <p className="detail-sub">
        Guild <strong>Mercenaries</strong> — a hand-picked few you equip and command
        directly — will be recruited here in a later chapter.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quests — every standing bounty on the board
// ---------------------------------------------------------------------------

function QuestsSection() {
  const state = useGameState();

  return (
    <section className="rows">
      <h3 className="section-title">Running Quests ({state.quests.length})</h3>
      {state.quests.length === 0 && (
        <div className="row locked">
          No quests posted. Open the Map tab and post a bounty on a monster or gatherable.
        </div>
      )}
      {state.quests.map((q) => (
        <QuestRow key={q.id} quest={q} />
      ))}
    </section>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  const store = useGameStore();
  const state = useGameState();
  const target = questTargetDef(quest.targetId);
  const rates = questRates(state, quest);
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
          <>
            <span className="row-desc">
              +{rate(rates.materialsPerSec)} {materialName(target.materialId)}/s ·{' '}
              −{rate(rates.goldPerSec)} 🪙/s · +{rate(rates.reputationPerSec)} ★/s
            </span>
            <span className="row-good">{rates.adventurers.toFixed(1)} adventurers assigned</span>
          </>
        )}
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

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

function UpgradesSection() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();

  return (
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
              {maxed ? (
                'Max'
              ) : (
                <>
                  {fmt(cost.gold)} 🪙
                  {Object.entries(cost.materials).map(([id, n]) => (
                    <span key={id} className="mat-cost">
                      {n} {materialName(id)}
                    </span>
                  ))}
                </>
              )}
            </div>
          </button>
        );
      })}
    </section>
  );
}
