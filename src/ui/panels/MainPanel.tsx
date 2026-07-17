import { GENERATORS } from '../../game/config';
import { click, effectiveClickPower } from '../../game/logic';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { GeneratorRow } from '../GeneratorRow';

export function MainPanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();

  return (
    <div className="panel">
      <button className="click-button" onClick={() => store.dispatch(click)}>
        Generate ⚡
        <span className="click-power">
          +{fmt(effectiveClickPower(state))} per click
        </span>
      </button>

      <section className="generators">
        {GENERATORS.map((g) => (
          <GeneratorRow key={g.id} def={g} />
        ))}
      </section>
    </div>
  );
}
