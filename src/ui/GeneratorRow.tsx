import { buyGenerator, canAfford, generatorCost } from '../game/logic';
import type { GeneratorDef } from '../game/types';
import { useFormat } from '../hooks/useFormat';
import { useGameState, useGameStore } from '../hooks/useGame';

export function GeneratorRow({ def }: { def: GeneratorDef }) {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const owned = state.generators[def.id] ?? 0;
  const cost = generatorCost(state, def.id);
  const affordable = canAfford(state, def.id);
  // Hide generators far beyond reach to create a sense of discovery
  const revealed = owned > 0 || state.totalEnergyEarned >= def.baseCost * 0.5;

  if (!revealed) {
    return <div className="generator-row locked">???</div>;
  }

  return (
    <button
      className={`generator-row ${affordable ? '' : 'unaffordable'}`}
      onClick={() => store.dispatch((s) => buyGenerator(s, def.id))}
      disabled={!affordable}
    >
      <div className="generator-info">
        <span className="generator-name">
          {def.name} <span className="generator-owned">×{owned}</span>
        </span>
        <span className="generator-desc">{def.description}</span>
        <span className="generator-production">
          {fmt(def.baseProduction)} /sec each
          {owned > 0 && ` · ${fmt(def.baseProduction * owned)} /sec total`}
        </span>
      </div>
      <div className="generator-cost">{fmt(cost)} ⚡</div>
    </button>
  );
}
