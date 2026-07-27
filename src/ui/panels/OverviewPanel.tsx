import { isInjured } from '../../game/adventurers';
import {
  DAY_LENGTH_SECONDS,
  DEMON_KING_ID,
  DUNGEONS,
  DUNGEON_WINS_REQUIRED,
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
  rosterCap,
  zones,
} from '../../game/guild';
import { currentDay, productionPerSecond } from '../../game/logic';
import { effectiveClickPower } from '../../game/logic';
import { isTimeTravelUnlocked } from '../../game/prestige';
import { guildFoundingCost } from '../../game/story';
import type { Adventurer, GameState, LogEntry } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';
import { Stat } from '../components';
import { CLASS_ICON } from '../display';
import { Icon } from '../icons';
import { TimelineSection } from './TimelineSection';

/**
 * The Overview tab: a read-only dashboard of everything at once — the run,
 * the economy, the guild, what's still locked, and the lifetime record.
 * Deliberately has no actions in it; every number here is derived from
 * GameState or an existing pure helper, so nothing new has to be tracked
 * for the sake of display (except game/stats.ts's lifetime counters).
 */

const RECENT_LOG_COUNT = 12;
const ACT_TITLE: Record<number, string> = {
  1: 'Act I — A Refugee’s Odd Jobs',
  2: 'Act II — Master of the Guild',
  3: 'Act III — The Long Way Back',
};

type Section = 'status' | 'records' | 'timeline';

export function OverviewPanel() {
  const state = useGameState();
  const timeline = isTimeTravelUnlocked(state) || state.timeShards > 0 || state.prestigeCount > 0;
  const [section, setSection] = usePanelSection<Section>('overview', 'status');
  const active = section === 'timeline' && !timeline ? 'status' : section;

  const tabs: { id: Section; label: string }[] = [
    { id: 'status', label: 'Status' },
    { id: 'records', label: 'Records' },
    ...(timeline ? ([{ id: 'timeline', label: 'Timeline' }] as const) : []),
  ];

  return (
    <div className="panel">
      <div className="subtab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`subtab ${active === t.id ? 'active' : ''}`}
            onClick={() => setSection(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'status' && (
        <>
          <RunSection />
          <EconomySection />
          {state.act >= 2 && <GuildSection />}
          {state.act >= 2 && <QuestBoardSection />}
          <ProgressSection />
          <RecentActivitySection />
        </>
      )}
      {active === 'records' && <RecordsSection />}
      {active === 'timeline' && <TimelineSection />}
    </div>
  );
}

/** A single "done / not done yet" line in the Progress section. */
function Milestone({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className={`row overview-milestone ${done ? 'done' : ''}`}>
      <Icon name={done ? 'check' : 'lock'} className={done ? 'milestone-done' : 'milestone-todo'} />
      <div className="row-info">
        <span className="row-desc">{children}</span>
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
        <Stat value={fmt(state.gold)} label="Gold" icon="coin" tone="accent" />
        <Stat value={`${fmt(productionPerSecond(state))}/s`} label="Income" tone="green" />
        {(isTimeTravelUnlocked(state) || state.timeShards > 0) && (
          <Stat value={fmt(state.timeShards)} label="Time Shards" icon="hourglass" tone="shard" />
        )}
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

  return (
    <section className="rows">
      <h3 className="section-title">Economy</h3>
      <div className="detail-stats">
        <Stat value={fmt(jobsOwned)} label="Jobs Running" />
        <Stat value={fmt(state.workers)} label="Workers" />
        <Stat value={fmt(effectiveClickPower(state))} label="Per Click" />
        <Stat value={fmt(state.totalGoldEarned)} label="Earned This Run" />
        <Stat value={fmt(state.inventory.length)} label="Items Held" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Guild: the adventurer pool and every champion's live status
// ---------------------------------------------------------------------------

function GuildSection() {
  const state = useGameState();
  const fmt = useFormat();
  const injured = state.adventurers.filter((a) => isInjured(a, state.runTimeSeconds)).length;
  const busy = state.adventurers.filter(
    (a) => a.assignment && !isInjured(a, state.runTimeSeconds),
  ).length;

  return (
    <section className="rows">
      <h3 className="section-title">The Guild</h3>
      <div className="detail-stats">
        <Stat value={fmt(Math.floor(state.reputation))} label="Reputation" icon="star" tone="accent" />
        <Stat value={`${state.adventurers.length}/${rosterCap(state)}`} label="Champions" />
        <Stat value={fmt(adventurerCount(state))} label="Adventurers" />
      </div>
      {state.adventurers.length > 0 && (
        <div className="row-desc overview-summary-line">
          {busy} out on assignment · {injured} recovering ·{' '}
          {state.adventurers.length - busy - injured} idle
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quest board
// ---------------------------------------------------------------------------

/** A one-line summary of the quest board — aggregate rates, not a breakdown
 *  of each quest's own requirements/progress (the Guild tab has that). */
function QuestBoardSection() {
  const state = useGameState();
  const fmt = useFormat();
  if (state.quests.length === 0) {
    return (
      <section className="rows">
        <h3 className="section-title">Quest Board</h3>
        <div className="row row-static row-muted">
          <Icon name="info" className="row-static-icon" />
          <div className="row-info">Nothing posted — the board is empty</div>
        </div>
      </section>
    );
  }
  let goldPerSec = 0;
  let materialsPerSec = 0;
  for (const quest of state.quests) {
    const rates = questRates(state, quest);
    goldPerSec += rates.goldPerSec;
    for (const amount of Object.values(rates.materialsPerSec)) materialsPerSec += amount;
  }

  return (
    <section className="rows">
      <h3 className="section-title">Quest Board</h3>
      <div className="detail-stats">
        <Stat value={fmt(state.quests.length)} label="Posted" />
        <Stat value={`${fmt(goldPerSec)}/s`} label="Cost" />
        <Stat value={`${fmt(materialsPerSec)}/s`} label="Materials" />
      </div>
    </section>
  );
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
          {nextZone.name} opens at {fmt(nextZone.repRequired ?? 0)} reputation (
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
          <Stat value={fmt(stats.dungeonsCleared)} label="Dungeons Cleared" />
          <Stat value={fmt(stats.injuries)} label="Injuries" />
          <Stat value={fmt(stats.shardsFound)} label="Shards Found" />
        </div>
        {best && (
          <div className="row">
            <div className="row-info">
              <span className="row-name">
                <Icon name={CLASS_ICON[best.className]} /> {best.name}{' '}
                <span className="row-sub">Lv {best.level}</span>
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
