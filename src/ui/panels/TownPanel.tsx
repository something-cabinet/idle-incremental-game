import { JOBS, WORKER_CAP, WORKER_PRODUCTION } from '../../game/config';
import {
  buyJob,
  click,
  effectiveClickPower,
  hireWorker,
  jobCost,
  workerCost,
} from '../../game/logic';
import { canFoundGuild, foundGuild, guildFoundingCost } from '../../game/story';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

export function TownPanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();

  return (
    <div className="panel">
      <button className="click-button" onClick={() => store.dispatch(click)}>
        Work Odd Jobs 🪙
        <span className="click-power">+{fmt(effectiveClickPower(state))} gold per click</span>
      </button>

      {state.act === 1 && (
        <button
          className={`found-guild ${canFoundGuild(state) ? '' : 'unaffordable'}`}
          disabled={!canFoundGuild(state)}
          onClick={() => store.dispatch(foundGuild)}
        >
          🛡 Found the Guild — {fmt(guildFoundingCost(state))} gold
          <span className="found-guild-hint">
            Take your place as the town’s leader
          </span>
        </button>
      )}

      <section className="rows">
        {JOBS.map((job) => {
          const owned = state.jobs[job.id] ?? 0;
          const cost = jobCost(state, job.id);
          const affordable = state.gold >= cost;
          const revealed = owned > 0 || state.totalGoldEarned >= job.baseCost * 0.5;
          if (!revealed) return <div key={job.id} className="row locked">???</div>;
          return (
            <button
              key={job.id}
              className={`row ${affordable ? '' : 'unaffordable'}`}
              disabled={!affordable}
              onClick={() => store.dispatch((s) => buyJob(s, job.id))}
            >
              <div className="row-info">
                <span className="row-name">
                  {job.name} <span className="row-sub">×{owned}</span>
                </span>
                <span className="row-desc">{job.description}</span>
                <span className="row-good">
                  {fmt(job.baseProduction)} /sec each
                  {owned > 0 && ` · ${fmt(job.baseProduction * owned)} /sec`}
                </span>
              </div>
              <div className="row-cost">{fmt(cost)} 🪙</div>
            </button>
          );
        })}
      </section>

      {state.act >= 2 && (
        <section className="rows">
          <button
            className={`row ${state.gold >= workerCost(state) && state.workers < WORKER_CAP ? '' : 'unaffordable'}`}
            disabled={state.gold < workerCost(state) || state.workers >= WORKER_CAP}
            onClick={() => store.dispatch(hireWorker)}
          >
            <div className="row-info">
              <span className="row-name">
                Hire Worker <span className="row-sub">×{state.workers}</span>
              </span>
              <span className="row-desc">Steady hands for the town.</span>
              <span className="row-good">
                +{WORKER_PRODUCTION} gold/sec each
                {state.workers > 0 && ` · ${fmt(state.workers * WORKER_PRODUCTION)} /sec`}
              </span>
            </div>
            <div className="row-cost">
              {state.workers >= WORKER_CAP ? 'Max' : `${fmt(workerCost(state))} 🪙`}
            </div>
          </button>
        </section>
      )}
    </div>
  );
}
