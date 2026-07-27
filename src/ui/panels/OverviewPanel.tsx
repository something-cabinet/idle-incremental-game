import { adventurerStats, isInjured, maxHp } from '../../game/adventurers';
import {
  DAY_LENGTH_SECONDS,
  DEMON_KING_ID,
  DUNGEONS,
  DUNGEON_WINS_REQUIRED,
  MATERIALS,
} from '../../game/config';
import { DUNGEON_TOTAL_ROOMS, dungeonProgress } from '../../game/dungeon';
import { formatDuration } from '../../game/format';
import {
  adventurerCount,
  autoExploreUnlocked,
  bosses,
  forgeUnlocked,
  locationDef,
  questRates,
  questRequiredWork,
  rosterCap,
  zones,
} from '../../game/guild';
import { currentDay, productionPerSecond } from '../../game/logic';
import { effectiveClickPower } from '../../game/logic';
import { isTimeTravelUnlocked } from '../../game/prestige';
import { guildFoundingCost } from '../../game/story';
import type { Adventurer, GameState, LogEntry, Quest } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';

/**
 * The Overview tab: a read-only dashboard of everything at once — the run,
 * the economy, the guild, what's still locked, and the lifetime record.
 * Deliberately has no actions in it; every number here is derived from
 * GameState or an existing pure helper, so nothing new has to be tracked
 * for the sake of display (except game/stats.ts's lifetime counters).
 */

const RECENT_LOG_COUNT = 12;
const CLASS_ICON: Record<Adventurer['className'], string> = {
  warrior: '⚔️',
  ranger: '🏹',
  mage: '✨',
};
const ACT_TITLE: Record<number, string> = {
  1: 'Act I — A Refugee’s Odd Jobs',
  2: 'Act II — Master of the Guild',
  3: 'Act III — The Long Way Back',
};

export function OverviewPanel() {
  const state = useGameState();
  const [section, setSection] = usePanelSection<'status' | 'records'>('overview', 'status');

  return (
    <div className="panel">
      <div className="subtab-bar">
        <button
          className={`subtab ${section === 'status' ? 'active' : ''}`}
          onClick={() => setSection('status')}
        >
          Status
        </button>
        <button
          className={`subtab ${section === 'records' ? 'active' : ''}`}
          onClick={() => setSection('records')}
        >
          Records
        </button>
      </div>

      {section === 'status' ? (
        <>
          <RunSection />
          <EconomySection />
          {state.act >= 2 && <GuildSection />}
          {state.act >= 2 && <QuestBoardSection />}
          <ProgressSection />
          <RecentActivitySection />
        </>
      ) : (
        <RecordsSection />
      )}
    </div>
  );
}

/** A labelled tile in one of the 3-across stat grids. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/** A single "done / not done yet" line in the Progress section. */
function Milestone({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className={`row overview-milestone ${done ? 'done' : ''}`}>
      <div className="row-info">
        <span className="row-desc">
          {done ? '✔' : '🔒'} {children}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

function RunSection() {
  const state = useGameState();
  const fmt = useFormat();
  return (
    <section className="rows">
      <h3 className="section-title">This Timeline</h3>
      <div className="overview-hero">
        <span className="overview-hero-title">{ACT_TITLE[state.act]}</span>
        <span className="row-desc">
          Day {currentDay(state)} · {formatDuration(state.runTimeSeconds)} elapsed
          {state.prestigeCount > 0 && ` · timeline #${state.prestigeCount + 1}`}
        </span>
      </div>
      <div className="detail-stats">
        <Stat value={fmt(state.gold)} label="Gold" />
        <Stat value={`${fmt(productionPerSecond(state))}/s`} label="Income" />
        <Stat
          value={isTimeTravelUnlocked(state) || state.timeShards > 0 ? `⏳ ${fmt(state.timeShards)}` : '—'}
          label="Time Shards"
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

function EconomySection() {
  const state = useGameState();
  const fmt = useFormat();
  const jobsOwned = Object.values(state.jobs).reduce((a, b) => a + b, 0);
  const materials = MATERIALS.filter((m) => (state.materials[m.id] ?? 0) > 0);

  return (
    <section className="rows">
      <h3 className="section-title">Economy</h3>
      <div className="detail-stats">
        <Stat value={fmt(jobsOwned)} label="Jobs Running" />
        <Stat value={fmt(state.workers)} label="Workers" />
        <Stat value={fmt(effectiveClickPower(state))} label="Per Click" />
      </div>
      <div className="detail-stats">
        <Stat value={fmt(state.totalGoldEarned)} label="Earned This Run" />
        <Stat value={fmt(state.lifetimeGoldEarned + state.totalGoldEarned)} label="Earned Ever" />
        <Stat value={fmt(state.inventory.length)} label="Items Held" />
      </div>
      {materials.length > 0 && (
        // Chips, not one row per material: a late-game stock of every material
        // would otherwise push the rest of the dashboard off the screen.
        <div className="overview-chips">
          {materials.map((m) => (
            <span key={m.id} className="overview-chip">
              {m.name} <strong>{fmt(Math.floor(state.materials[m.id]))}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Guild: the adventurer pool and every champion's live status
// ---------------------------------------------------------------------------

function GuildSection() {
  const state = useGameState();
  const fmt = useFormat();
  return (
    <section className="rows">
      <h3 className="section-title">The Guild</h3>
      <div className="detail-stats">
        <Stat value={`★ ${fmt(Math.floor(state.reputation))}`} label="Reputation" />
        <Stat value={fmt(adventurerCount(state))} label="Adventurers" />
        <Stat value={`${state.adventurers.length}/${rosterCap(state)}`} label="Champions" />
      </div>
      {state.adventurers.length === 0 ? (
        <div className="row locked">No champions recruited yet</div>
      ) : (
        state.adventurers.map((adv) => <ChampionLine key={adv.id} adv={adv} />)
      )}
    </section>
  );
}

/** One champion: level, HP bar and what they're currently doing. */
function ChampionLine({ adv }: { adv: Adventurer }) {
  const state = useGameState();
  const stats = adventurerStats(adv);
  const hpMax = maxHp(adv);
  const injured = isInjured(adv, state.runTimeSeconds);
  const hpPct = hpMax > 0 ? Math.max(0, Math.min(100, (adv.hp / hpMax) * 100)) : 0;

  let activity = 'Idle at the guild hall';
  if (injured) {
    activity = `🩹 Recovering — ${formatDuration(Math.max(0, adv.injuredUntil - state.runTimeSeconds))} left`;
  } else if (adv.assignment) {
    const where = locationDef(adv.assignment.locationId)?.name ?? adv.assignment.locationId;
    activity =
      adv.assignment.mode === 'auto-explore' ? `🗺️ Auto-Exploring ${where}` : `📜 On assignment: ${where}`;
  }

  return (
    <div className="row adventurer-card">
      <div className="row-info">
        <span className="row-name">
          {CLASS_ICON[adv.className]} {adv.name} <span className="row-sub">Lv {adv.level}</span>
        </span>
        <span className="row-sub">
          ATK {stats.atk} · DEF {stats.def} · HP {Math.ceil(adv.hp)}/{hpMax}
        </span>
        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill hp" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <span className={injured ? 'row-bad' : 'row-desc'}>{activity}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quest board
// ---------------------------------------------------------------------------

function QuestBoardSection() {
  const state = useGameState();
  if (state.quests.length === 0) {
    return (
      <section className="rows">
        <h3 className="section-title">Quest Board</h3>
        <div className="row locked">Nothing posted — the board is empty</div>
      </section>
    );
  }
  return (
    <section className="rows">
      <h3 className="section-title">Quest Board ({state.quests.length})</h3>
      {state.quests.map((quest) => (
        <QuestLine key={quest.id} quest={quest} />
      ))}
    </section>
  );
}

function QuestLine({ quest }: { quest: Quest }) {
  const state = useGameState();
  const fmt = useFormat();
  const rates = questRates(state, quest);
  const required = questRequiredWork(quest);
  const pct = required > 0 ? Math.min(100, (quest.progress / required) * 100) : 0;
  const label = quest.requirements
    .map((r) => `${r.batchSize}× ${questTargetName(r.targetId)}`)
    .join(' + ');

  return (
    <div className="row">
      <div className="row-info">
        <span className="row-name">{label}</span>
        <span className="row-sub">
          {rates.adventurers} adventurer{rates.adventurers === 1 ? '' : 's'} ·{' '}
          {quest.completedCount} done
          {quest.repeatCount > 0 && ` / ${quest.repeatCount}`}
        </span>
        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-time">{Math.floor(pct)}%</span>
        </div>
        {rates.goldStarved ? (
          <span className="row-bad">Stalled — the guild can’t pay for the next batch</span>
        ) : rates.adventurers === 0 ? (
          <span className="row-bad">Stalled — no adventurers assigned</span>
        ) : (
          <span className="row-good">
            ≈ ★ {fmt(rates.reputationPerSec)}/s · {fmt(rates.goldPerSec)} gold/s spent
          </span>
        )}
      </div>
    </div>
  );
}

function questTargetName(targetId: string): string {
  // Target ids are kebab-case names ('gray-wolf'); good enough for a summary
  // line, and avoids threading the full QuestTargetDef lookup through here.
  return targetId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Progress: what's unlocked, what's next
// ---------------------------------------------------------------------------

function ProgressSection() {
  const state = useGameState();
  const fmt = useFormat();
  const allZones = zones();
  const unlockedZones = allZones.filter((z) => state.reputation >= (z.repRequired ?? 0));
  const nextZone = allZones.find((z) => state.reputation < (z.repRequired ?? 0));
  const clearedZones = allZones.filter((z) => state.locationsCleared[z.id]).length;
  const unlockedDungeons = DUNGEONS.filter((d) => dungeonProgress(state, d.locationId).unlocked);
  const nextDungeon = DUNGEONS.map((d) => ({ def: d, progress: dungeonProgress(state, d.locationId) }))
    .filter((d) => !d.progress.unlocked && d.progress.wins > 0)
    .sort((a, b) => b.progress.wins - a.progress.wins)[0];
  const bossesSlain = bosses().filter((b) => state.bossesDefeated[b.id]).length;

  return (
    <section className="rows">
      <h3 className="section-title">Progress</h3>
      {/* The wilds don't exist for the player until the guild does — Act 1
          shouldn't spoil zone or dungeon counts. */}
      {state.act >= 2 && (
        <div className="detail-stats">
          <Stat value={`${unlockedZones.length}/${allZones.length}`} label="Zones Open" />
          <Stat value={`${clearedZones}/${allZones.length}`} label="Zones Cleared" />
          <Stat value={`${unlockedDungeons.length}/${DUNGEONS.length}`} label="Dungeons" />
        </div>
      )}

      {state.act === 1 && (
        <Milestone done={false}>
          Found the Guild — {fmt(guildFoundingCost(state))} gold (you have {fmt(state.gold)})
        </Milestone>
      )}
      {state.act >= 2 && nextZone && (
        <Milestone done={false}>
          {nextZone.name} opens at ★ {fmt(nextZone.repRequired ?? 0)} (
          {fmt(Math.max(0, Math.ceil((nextZone.repRequired ?? 0) - state.reputation)))} to go)
        </Milestone>
      )}
      {state.act >= 2 && (
        <>
          <Milestone done={forgeUnlocked(state)}>
            The Forge — craft your own equipment
          </Milestone>
          <Milestone done={autoExploreUnlocked(state)}>
            Auto-Explore — champions farm a zone unattended
          </Milestone>
        </>
      )}
      {nextDungeon && (
        <Milestone done={false}>
          {nextDungeon.def.name} — {nextDungeon.progress.wins}/{DUNGEON_WINS_REQUIRED} Explore wins
          at {locationDef(nextDungeon.def.locationId)?.name ?? nextDungeon.def.locationId}
        </Milestone>
      )}
      {unlockedDungeons.length > 0 && (
        <Milestone done>
          {unlockedDungeons.length} dungeon{unlockedDungeons.length === 1 ? '' : 's'} open ·{' '}
          {DUNGEON_TOTAL_ROOMS} rooms each
        </Milestone>
      )}
      {state.act >= 3 && (
        <>
          <Milestone done={bossesSlain > 0}>
            {bossesSlain}/{bosses().length} great foes defeated
          </Milestone>
          <Milestone done={!!state.bossesDefeated[DEMON_KING_ID]}>
            The Demon King falls — time travel unlocks
          </Milestone>
        </>
      )}
      {state.hometownSaved && <Milestone done>Your hometown was saved.</Milestone>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Lifetime records
// ---------------------------------------------------------------------------

function RecordsSection() {
  const state = useGameState();
  const fmt = useFormat();
  const { stats } = state;
  const battles = stats.battlesWon + stats.battlesLost;
  const winRate = battles > 0 ? Math.round((stats.battlesWon / battles) * 100) : 0;
  const best = bestChampion(state);

  return (
    <>
      <p className="detail-sub">
        Totals across every timeline you’ve lived — they survive time travel.
      </p>

      <section className="rows">
        <h3 className="section-title">Lifetime</h3>
        <div className="detail-stats">
          <Stat value={formatDuration(stats.timePlayedSeconds)} label="Time Played" />
          <Stat value={fmt(state.prestigeCount)} label="Timelines" />
          <Stat value={fmt(stats.clicks)} label="Odd Jobs Worked" />
        </div>
        <div className="detail-stats">
          <Stat value={fmt(state.lifetimeGoldEarned + state.totalGoldEarned)} label="Gold Earned" />
          <Stat value={fmt(stats.questsCompleted)} label="Quests Done" />
          <Stat value={fmt(stats.championsHired)} label="Champions Hired" />
        </div>
      </section>

      <section className="rows">
        <h3 className="section-title">Combat</h3>
        <div className="detail-stats">
          <Stat value={fmt(battles)} label="Battles" />
          <Stat value={`${winRate}%`} label="Win Rate" />
          <Stat value={fmt(stats.monstersDefeated)} label="Monsters Slain" />
        </div>
        <div className="detail-stats">
          <Stat value={fmt(stats.dungeonsCleared)} label="Dungeons Cleared" />
          <Stat value={fmt(stats.injuries)} label="Injuries" />
          <Stat value={fmt(stats.shardsFound)} label="Shards Found" />
        </div>
        {best && (
          <div className="row">
            <div className="row-info">
              <span className="row-name">
                {CLASS_ICON[best.className]} {best.name} <span className="row-sub">Lv {best.level}</span>
              </span>
              <span className="row-desc">
                Your finest champion — {fmt(best.enemiesDefeated)} kills,{' '}
                {fmt(best.totalDamageDealt)} damage dealt
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="rows">
        <h3 className="section-title">Equipment</h3>
        <div className="detail-stats">
          <Stat value={fmt(stats.itemsFound)} label="Found" />
          <Stat value={fmt(stats.itemsCrafted)} label="Crafted" />
          <Stat value={fmt(stats.itemsDisassembled)} label="Disassembled" />
        </div>
      </section>
    </>
  );
}

/** The champion with the most kills — ties broken by level. */
function bestChampion(state: GameState): Adventurer | null {
  if (state.adventurers.length === 0) return null;
  return state.adventurers.reduce((best, a) =>
    a.enemiesDefeated > best.enemiesDefeated ||
    (a.enemiesDefeated === best.enemiesDefeated && a.level > best.level)
      ? a
      : best,
  );
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

function RecentActivitySection() {
  const state = useGameState();
  if (state.activityLog.length === 0) return null;
  const recent = [...state.activityLog].slice(-RECENT_LOG_COUNT).reverse();
  return (
    <section className="rows">
      <h3 className="section-title">Recent Activity</h3>
      <div className="activity-log">
        {recent.map((entry) => (
          <LogLine key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  // Entries store raw game seconds; same day math as logic.currentDay.
  const day = Math.floor(entry.at / DAY_LENGTH_SECONDS) + 1;
  return (
    <div className={`log-entry log-${entry.kind}`}>
      <span className="log-day">Day {day}</span>
      <span className="log-text">{entry.text}</span>
    </div>
  );
}
