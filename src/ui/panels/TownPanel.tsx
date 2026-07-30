import { useState, type CSSProperties, type MouseEvent } from 'react';
import { JOBS, TOWN_SKILLS, WORKER_CAP, WORKER_PRODUCTION } from '../../game/config';
import {
  buyJob,
  click,
  effectiveClickPower,
  hireWorker,
  jobCost,
  workerBuyable,
  workerCost,
} from '../../game/logic';
import {
  buyTownSkill,
  canBuyTownSkill,
  isTownSkillUnlocked,
  townSkillCost,
  townSkillLevel,
} from '../../game/skills';
import { canFoundGuild, foundGuild, guildFoundingCost } from '../../game/story';
import type { TownSkillDef } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';
import { materialName } from '../display';
import { Icon } from '../icons';

const BUY_AMOUNTS = [1, 5, 10, 100] as const;

interface ClickFeedback {
  id: number;
  amount: number;
  x: number;
  drift: number;
  tilt: number;
}

export function TownPanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const [section, setSection] = usePanelSection<'jobs' | 'skills'>('town', 'jobs');
  const [buyAmount, setBuyAmount] = useState<number>(1);
  // The core action lands like a guild seal: a pressure ring appears exactly
  // where the player struck, then the earned amount lifts clear of the button.
  const [pops, setPops] = useState<ClickFeedback[]>([]);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const amount = effectiveClickPower(state);
    const id = Date.now() + Math.random();
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.detail === 0
      ? 50
      : ((event.clientX - bounds.left) / bounds.width) * 100;
    const x = Math.max(18, Math.min(82, pointerX));
    const drift = Math.round((Math.random() - 0.5) * 28);
    const tilt = Math.round((Math.random() - 0.5) * 8);

    setPops((current) => [...current.slice(-4), { id, amount, x, drift, tilt }]);
    setTimeout(() => setPops((current) => current.filter((item) => item.id !== id)), 720);
    store.dispatch(click);
  }

  const foundingCost = guildFoundingCost(state);
  const foundingProgress = Math.min(1, state.gold / foundingCost);

  return (
    <div className="panel">
      <button className="click-button" onClick={handleClick}>
        <span className="click-label">
          <Icon name="coin" /> Work Odd Jobs
        </span>
        <span className="click-power">+{fmt(effectiveClickPower(state))} gold per click</span>
        <span className="click-pops" aria-hidden="true">
          {pops.map((pop) => (
            <span
              key={pop.id}
              className="click-feedback"
              style={{
                '--feedback-x': `${pop.x}%`,
                '--feedback-drift': `${pop.drift}px`,
                '--feedback-tilt': `${pop.tilt}deg`,
              } as CSSProperties}
            >
              <span className="click-impact" />
              <span className="click-pop">+{fmt(pop.amount)}</span>
            </span>
          ))}
        </span>
      </button>

      {state.act === 1 && (
        <button
          className={`found-guild ${canFoundGuild(state) ? '' : 'unaffordable'}`}
          disabled={!canFoundGuild(state)}
          onClick={() => store.dispatch(foundGuild)}
        >
          <span>
            <Icon name="banner" /> Found the Guild — {fmt(foundingCost)} gold
          </span>
          {/* Goal-gradient: showing how close you are is what makes the last
              stretch of a long save-up feel worth grinding. */}
          <span className="progress-track found-guild-track">
            <span className="progress-fill" style={{ width: `${foundingProgress * 100}%` }} />
          </span>
          <span className="found-guild-hint">
            {canFoundGuild(state)
              ? 'Take your place as the town’s leader'
              : `${fmt(Math.max(0, foundingCost - state.gold))} to go`}
          </span>
        </button>
      )}

      <div className="subtab-bar">
        <button
          className={`subtab ${section === 'jobs' ? 'active' : ''}`}
          onClick={() => setSection('jobs')}
        >
          Jobs
        </button>
        <button
          className={`subtab ${section === 'skills' ? 'active' : ''}`}
          onClick={() => setSection('skills')}
        >
          Skills
        </button>
      </div>

      {section === 'jobs' ? (
        <JobsSection buyAmount={buyAmount} onBuyAmount={setBuyAmount} />
      ) : (
        <SkillsSection />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

function JobsSection({
  buyAmount,
  onBuyAmount,
}: {
  buyAmount: number;
  onBuyAmount: (n: number) => void;
}) {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();

  return (
    <>
      <div className="buy-amount-bar">
        <span className="buy-amount-label">Buy</span>
        {BUY_AMOUNTS.map((n) => (
          <button
            key={n}
            className={`subtab ${buyAmount === n ? 'active' : ''}`}
            onClick={() => onBuyAmount(n)}
          >
            ×{n}
          </button>
        ))}
      </div>

      <section className="rows">
        {JOBS.map((job) => {
          const owned = state.jobs[job.id] ?? 0;
          const cost = jobCost(state, job.id, buyAmount);
          const affordable = state.gold >= cost;
          const unlocked = !job.requiresUpgrade || (state.guildUpgrades[job.requiresUpgrade] ?? 0) >= 1;
          const revealed = unlocked && (owned > 0 || state.totalGoldEarned >= job.baseCost * 0.5);
          // A bare "???" hid how close the next job was. Showing the threshold
          // turns dead rows into something to aim at.
          if (!revealed) {
            return (
              <div key={job.id} className="row row-locked">
                <div className="row-info">
                  <span className="row-name">
                    <Icon name="lock" /> Locked
                  </span>
                  <span className="row-desc">
                    Earn {fmt(job.baseCost * 0.5)} gold total to discover this job
                  </span>
                </div>
              </div>
            );
          }
          return (
            <button
              key={job.id}
              className={`row ${affordable ? '' : 'unaffordable'}`}
              disabled={!affordable}
              onClick={() => store.dispatch((s) => buyJob(s, job.id, buyAmount))}
            >
              <div className="row-info">
                <span className="row-name">
                  {job.name} <span className="row-sub">×{owned}</span>
                </span>
                <span className="row-desc">{job.description}</span>
                <span className="row-good">
                  {fmt(job.baseProduction)} gold / {job.jobDurationSeconds}s each
                  {owned > 0 && ` · ${fmt(job.baseProduction * owned / job.jobDurationSeconds)} /sec`}
                </span>
              </div>
              <div className="row-cost">
                <span><Icon name="coin" /> {fmt(cost)}</span>
                {buyAmount > 1 && <span className="mat-cost">for {buyAmount}</span>}
              </div>
            </button>
          );
        })}
      </section>

      {state.act >= 2 && <WorkerRow buyAmount={buyAmount} />}
    </>
  );
}

function WorkerRow({ buyAmount }: { buyAmount: number }) {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const buyable = workerBuyable(state, buyAmount);
  const cost = workerCost(state, buyable || 1);
  const canBuy = buyable > 0 && state.gold >= cost;

  return (
    <section className="rows">
      <button
        className={`row ${canBuy ? '' : 'unaffordable'}`}
        disabled={!canBuy}
        onClick={() => store.dispatch((s) => hireWorker(s, buyAmount))}
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
          {state.workers >= WORKER_CAP ? 'Max' : (
            <>
              <span><Icon name="coin" /> {fmt(cost)}</span>
              {buyable > 1 && <span className="mat-cost">for {buyable}</span>}
            </>
          )}
        </div>
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Skill tree
// ---------------------------------------------------------------------------

const BRANCH_TITLES: Record<string, string> = {
  industry: 'Industry',
  hustle: 'Hustle',
};

function SkillsSection() {
  const branches = [...new Set(TOWN_SKILLS.map((s) => s.branch))];
  return (
    <div className="skill-tree">
      {branches.map((branch) => (
        <div key={branch} className="skill-branch">
          <h3 className="section-title">{BRANCH_TITLES[branch] ?? branch}</h3>
          {TOWN_SKILLS.filter((s) => s.branch === branch)
            .sort((a, b) => a.tier - b.tier)
            .map((def, i) => (
              <SkillNode key={def.id} def={def} isRoot={i === 0} />
            ))}
        </div>
      ))}
    </div>
  );
}

function SkillNode({ def, isRoot }: { def: TownSkillDef; isRoot: boolean }) {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const level = townSkillLevel(state, def.id);
  const unlocked = isTownSkillUnlocked(state, def.id);
  const maxed = level >= def.maxLevel;
  const affordable = canBuyTownSkill(state, def.id);
  const cost = townSkillCost(state, def.id);

  return (
    <>
      {!isRoot && <div className={`skill-link ${level > 0 ? 'bought' : ''}`} />}
      {unlocked ? (
        <button
          className={`row skill-node ${maxed ? 'maxed' : affordable ? '' : 'unaffordable'}`}
          disabled={!affordable}
          onClick={() => store.dispatch((s) => buyTownSkill(s, def.id))}
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
                <span><Icon name="coin" /> {fmt(cost.gold)}</span>
                {Object.entries(cost.materials).map(([id, n]) => (
                  <span key={id} className="mat-cost">
                    {n} {materialName(id)}
                  </span>
                ))}
              </>
            )}
          </div>
        </button>
      ) : (
        <div className="row row-locked skill-node">
          <span className="row-name">
            <Icon name="lock" /> {def.name}
          </span>
        </div>
      )}
    </>
  );
}
