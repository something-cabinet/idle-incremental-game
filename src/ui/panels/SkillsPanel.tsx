import { PERKS } from '../../game/config';
import {
  buyPerk,
  canBuyPerk,
  isPerkMaxed,
  isPerkUnlocked,
  perkCost,
  perkDef,
  perkLevel,
} from '../../game/perks';
import type { PerkDef } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

export function SkillsPanel() {
  const state = useGameState();
  const fmt = useFormat();

  return (
    <div className="panel">
      <div className="currency-banner">
        <span className="currency-amount">{fmt(state.prestigePoints)}</span>
        <span className="currency-label">prestige points to spend</span>
      </div>

      <section className="perk-grid">
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
  const cost = perkCost(state, def.id);

  if (!unlocked) {
    const reqNames = (def.requires ?? [])
      .filter((r) => r !== def.id)
      .map((r) => perkDef(r)?.name ?? r)
      .join(', ');
    return (
      <div className="perk-card locked">
        <span className="perk-name">🔒 {def.name}</span>
        <span className="perk-desc">Requires: {reqNames}</span>
      </div>
    );
  }

  return (
    <div className={`perk-card ${maxed ? 'maxed' : ''}`}>
      <div className="perk-header">
        <span className="perk-name">{def.name}</span>
        <span className="perk-level">
          {level}/{def.maxLevel}
        </span>
      </div>
      <span className="perk-desc">{def.description}</span>
      <button
        className="perk-buy"
        disabled={!affordable}
        onClick={() => store.dispatch((s) => buyPerk(s, def.id))}
      >
        {maxed ? 'Maxed' : `Upgrade · ${fmt(cost)} pts`}
      </button>
    </div>
  );
}
