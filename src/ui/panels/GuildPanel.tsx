import { useState } from 'react';
import { adventurerStats } from '../../game/adventurers';
import { ATTRIBUTES, GUILD_UPGRADES, MATERIALS } from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  adventurerCount,
  buyGuildUpgrade,
  canBuyGuildUpgrade,
  deleteQuest,
  guildUpgradeCost,
  hireCandidate,
  hireCost,
  questBatchSummary,
  questProgress,
  questRates,
  questTargetDef,
  refreshRecruits,
  rosterCap,
  totalQuestGoldPerSec,
  zones,
} from '../../game/guild';
import type { Adventurer, AdventurerClass, Quest } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

type Section = 'adventurers' | 'quests' | 'upgrades';

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

const CLASS_ICON: Record<AdventurerClass, string> = {
  warrior: '🗡️',
  ranger: '🏹',
  mage: '🔮',
};

const CLASS_LABEL: Record<AdventurerClass, string> = {
  warrior: 'Warrior',
  ranger: 'Ranger',
  mage: 'Mage',
};

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
  const store = useGameStore();
  const fmt = useFormat();
  const count = adventurerCount(state);
  const cap = rosterCap(state);
  const [recruitOpen, setRecruitOpen] = useState(false);

  // Next zone still locked behind a reputation threshold, if any.
  const nextZone = zones().find((z) => state.reputation < (z.repRequired ?? 0));

  function openRecruit() {
    store.dispatch((s) => refreshRecruits(s));
    setRecruitOpen(true);
  }

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

      <h3 className="section-title">
        Guild Champions ({state.adventurers.length}/{cap})
      </h3>
      <p className="detail-sub">
        A hand-picked few you recruit, equip, and command directly.
      </p>
      <div className="rows">
        {state.adventurers.map((adv) => (
          <ChampionCard key={adv.id} adv={adv} />
        ))}
        {Array.from({ length: Math.max(0, cap - state.adventurers.length) }, (_, i) => (
          <button key={i} className="empty-slot" onClick={openRecruit}>
            + Recruit Champion
          </button>
        ))}
      </div>

      {recruitOpen && <RecruitDialog onClose={() => setRecruitOpen(false)} />}
    </section>
  );
}

function ChampionCard({ adv }: { adv: Adventurer }) {
  const stats = adventurerStats(adv);
  return (
    <div className="row item-common adventurer-card">
      <div className="row-info">
        <span className="row-name">
          {CLASS_ICON[adv.className]} {adv.name}
        </span>
        <span className="row-desc">
          {CLASS_LABEL[adv.className]} · Lv {adv.level}
        </span>
      </div>
      <span className="row-cost">
        ATK {stats.atk} · DEF {stats.def} · HP {stats.maxHp}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recruit dialog — 3 random candidates, simple view, then a detailed view
// with the actual recruit action once one is picked.
// ---------------------------------------------------------------------------

function RecruitDialog({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const candidates = state.recruitCandidates;
  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const cost = hireCost(state);
  const canAfford = state.gold >= cost;

  function handleRecruit(id: number) {
    store.dispatch((s) => hireCandidate(s, id));
    onClose();
  }

  return (
    <div className="story-overlay" onClick={onClose}>
      <div className="story-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="story-title">Recruit a Champion</h2>
          <button className="small-button" onClick={onClose}>✕</button>
        </div>

        {!selected ? (
          <>
            <p className="detail-sub">Pick one of these three adventurers to recruit.</p>
            <div className="rows">
              {candidates.map((c) => (
                <button key={c.id} className="row" onClick={() => setSelectedId(c.id)}>
                  <div className="row-info">
                    <span className="row-name">
                      {CLASS_ICON[c.className]} {c.name}
                    </span>
                    <span className="row-desc">{CLASS_LABEL[c.className]}</span>
                  </div>
                  <span className="row-cost">{compactStats(c)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="small-button" onClick={() => setSelectedId(null)}>
              ← Back
            </button>
            <ChampionDetail adv={selected} />
            <button
              className="small-button"
              disabled={!canAfford}
              onClick={() => handleRecruit(selected.id)}
            >
              Recruit for {Math.floor(cost).toLocaleString()} 🪙
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function compactStats(adv: Adventurer): string {
  const stats = adventurerStats(adv);
  return `ATK ${stats.atk} · DEF ${stats.def} · HP ${stats.maxHp}`;
}

function ChampionDetail({ adv }: { adv: Adventurer }) {
  const stats = adventurerStats(adv);
  return (
    <div className="rows">
      <h3 className="section-title">{adv.name}</h3>
      <p className="detail-sub">
        {CLASS_ICON[adv.className]} {CLASS_LABEL[adv.className]} · Level {adv.level}
      </p>
      <div className="detail-stats">
        <div className="stat">
          <span className="stat-value">{stats.atk}</span>
          <span className="stat-label">Attack</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.def}</span>
          <span className="stat-label">Defense</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.maxHp}</span>
          <span className="stat-label">Max HP</span>
        </div>
        {ATTRIBUTES.map((a) => (
          <div className="stat" key={a.id}>
            <span className="stat-value">{adv.attributes[a.id]}</span>
            <span className="stat-label">{a.abbr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quests — every standing bounty on the board
// ---------------------------------------------------------------------------

function QuestsSection() {
  const state = useGameState();
  const fmt = useFormat();
  const totalGoldPerSec = totalQuestGoldPerSec(state);
  const [showPerSecond, setShowPerSecond] = useState(false);

  return (
    <section className="rows">
      <div className="section-title-row">
        <h3 className="section-title">Running Quests ({state.quests.length})</h3>
        <button className="small-button" onClick={() => setShowPerSecond((v) => !v)}>
          {showPerSecond ? 'Show round totals' : 'Show per-second rates'}
        </button>
      </div>
      {state.quests.length > 0 && (
        <div className="row locked">
          Total upkeep: <strong>{fmt(totalGoldPerSec)} 🪙/s</strong> across the whole board
        </div>
      )}
      {state.quests.length === 0 && (
        <div className="row locked">
          No quests posted. Open the Map tab and post a bounty on a monster or gatherable.
        </div>
      )}
      {state.quests.map((q) => (
        <QuestRow key={q.id} quest={q} showPerSecond={showPerSecond} />
      ))}
    </section>
  );
}

function repeatsLabel(remaining: number, repeatCount: number, completedCount: number): string {
  if (repeatCount <= 0) return 'unlimited';
  return `${completedCount}/${repeatCount} done, ${Number.isFinite(remaining) ? remaining : '∞'} left`;
}

/** "5 Beast Pelt, 3 Wild Herbs" — one requirement's name isn't shown here
 * since a quest can bundle several different targets into one payout. */
function materialsSummary(materials: { materialId: string; amount: number }[]): string {
  return materials.map((m) => `${m.amount} ${materialName(m.materialId)}`).join(', ');
}

function questTitle(quest: Quest): string {
  const names = quest.requirements
    .map((r) => questTargetDef(r.targetId)?.name)
    .filter((n): n is string => !!n);
  return names.join(' + ') || 'Quest';
}

function QuestRow({ quest, showPerSecond }: { quest: Quest; showPerSecond: boolean }) {
  const store = useGameStore();
  const state = useGameState();
  const rates = questRates(state, quest);
  const progress = questProgress(state, quest);
  const summary = questBatchSummary(state, quest);
  if (!summary) return null;

  return (
    <div className="row item-common">
      <div className="row-info">
        <span className="row-name">{questTitle(quest)}</span>
        {rates.goldStarved ? (
          <span className="row-bad">⚠ Not enough gold — this quest is stalled.</span>
        ) : rates.adventurerStarved ? (
          <span className="row-bad">⚠ No adventurers assigned right now.</span>
        ) : showPerSecond ? (
          <>
            <span className="row-desc">
              {Object.entries(rates.materialsPerSec)
                .map(([id, perSec]) => `~${rate(perSec)} ${materialName(id)}/s`)
                .join(' · ')} · −{rate(rates.goldPerSec)} 🪙/s · +{rate(rates.reputationPerSec)} ★/s
              (reference)
            </span>
            <span className="row-good">{rates.adventurers} adventurers assigned</span>
          </>
        ) : (
          <span className="row-desc">
            {materialsSummary(summary.materials)} · −{rate(summary.gold)} 🪙 · +{rate(summary.reputation)} ★
            · {formatDuration(summary.timeSeconds)}/round · {summary.assigned}/{summary.maxAdventurers}{' '}
            adventurers
          </span>
        )}
        <span className="row-sub">
          {repeatsLabel(summary.repeatsRemaining, summary.repeatCount, summary.completedCount)}
        </span>
        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <span className="progress-time">
            {Number.isFinite(progress.etaSeconds)
              ? `${formatDuration(progress.etaSeconds)} to next round`
              : 'stalled'}
          </span>
        </div>
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
