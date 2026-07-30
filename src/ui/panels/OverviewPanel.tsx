import { useState } from 'react';
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
import { useNavigation } from '../../hooks/useNavigation';
import { usePanelSection } from '../../hooks/usePanelSection';
import { Stat } from '../components';
import { CLASS_ICON } from '../display';
import { Icon } from '../icons';
import type { TabId } from '../TabBar';
import { TimelineSection } from './TimelineSection';

/**
 * The Overview tab: a read-only dashboard of everything at once — the run,
 * the economy, the guild, what's still locked, and the lifetime record.
 *
 * Design constraints (from critique):
 * - One Cinzel hero per viewport — the act title owns the Display voice.
 * - No header duplication — gold, shards and day live in the sticky header.
 * - Milestones route (navigation, not mutation) but nothing else acts.
 * - The ending has ceremony — .overview-epilogue if hometownSaved.
 */

const RECENT_LOG_COUNT = 12;
const MILESTONE_CAP = 4;
const ACT_TITLE: Record<number, string> = {
  1: "Act I \u2014 A Refugee\u2019s Odd Jobs",
  2: "Act II \u2014 Master of the Guild",
  3: "Act III \u2014 The Long Way Back",
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
          {state.hometownSaved && <EpilogueBanner />}
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

// ---------------------------------------------------------------------------
// Epilogue: the game's narrative climax (P2 fix — ending ceremony)
// ---------------------------------------------------------------------------

function EpilogueBanner() {
  return (
    <div className="overview-epilogue">
      <div className="overview-epilogue-title">Your Hometown Was Saved</div>
      <div>The long road is behind you. The guild stands. Home endures.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Milestone with progress bar, sort, navigation and cap (P1)
// ---------------------------------------------------------------------------

interface MilestoneData {
  key: string;
  done: boolean;
  label: string;
  progress?: number; // 0–1
  navigateTo?: TabId;
}

function Milestone({
  data,
  nearest,
}: {
  data: MilestoneData;
  nearest: boolean;
}) {
  const navigate = useNavigation();
  const navigable = !data.done && !!data.navigateTo;
  const className = [
    'row overview-milestone',
    data.done ? 'done' : '',
    navigable ? 'navigable' : '',
    nearest ? 'nearest' : '',
  ].filter(Boolean).join(' ');

  function handleClick() {
    if (navigable && data.navigateTo) navigate(data.navigateTo);
  }

  return (
    <div
      className={className}
      onClick={navigable ? handleClick : undefined}
      role={navigable ? 'button' : undefined}
      tabIndex={navigable ? 0 : undefined}
      onKeyDown={navigable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
    >
      <div className="milestone-header">
        <span className="milestone-icon">
          <Icon name={data.done ? 'check' : 'lock'} className={data.done ? 'milestone-done' : 'milestone-todo'} />
        </span>
        <span className="row-desc">{data.label}</span>
        {navigable && (
          <span className="milestone-nav-hint">
            <Icon name="chevron" />
          </span>
        )}
      </div>
      {data.progress != null && data.progress < 1 && (
        <div className="milestone-progress">
          <div
            className="milestone-progress-fill"
            style={{ width: `${Math.min(data.progress * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The run (P1 — rebuilt hero: Cinzel display, no header duplication)
// ---------------------------------------------------------------------------

function RunSection() {
  const state = useGameState();
  const fmt = useFormat();
  return (
    <section className="rows">
      <h3 className="section-title">This Timeline</h3>
      <div className="overview-hero">
        <span className="overview-hero-title">{ACT_TITLE[state.act]}</span>
        <span className="overview-hero-context">
          <span>Day {currentDay(state)} · {formatDuration(state.runTimeSeconds)} elapsed</span>
          {state.prestigeCount > 0 && <span>timeline #{state.prestigeCount + 1}</span>}
          {state.act >= 2 && (
            <span><Icon name="star" /> <span className="tone-accent">{fmt(Math.floor(state.reputation))}</span> reputation</span>
          )}
        </span>
      </div>
      <div className="detail-stats">
        <Stat value={`${fmt(productionPerSecond(state))}/s`} label="Income" tone="green" size="hero" />
        <Stat value={fmt(effectiveClickPower(state))} label="Per Click" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Economy (P1/P2 — tiered stats, ragged grid fixed by reducing to 4 cells)
// ---------------------------------------------------------------------------

function EconomySection() {
  const state = useGameState();
  const fmt = useFormat();
  const jobsOwned = Object.values(state.jobs).reduce((a, b) => a + b, 0);

  return (
    <section className="rows">
      <h3 className="section-title">Economy</h3>
      <div className="detail-stats">
        <Stat value={fmt(state.totalGoldEarned)} label="Earned" tone="accent" size="hero" />
        <Stat value={fmt(jobsOwned)} label="Jobs" />
        <Stat value={fmt(state.workers)} label="Workers" />
        <Stat value={fmt(state.inventory.length)} label="Items" size="compact" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Guild: the adventurer pool
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
        <Stat value={`${state.adventurers.length}/${rosterCap(state)}`} label="Champions" size="hero" />
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
        <Stat value={fmt(state.quests.length)} label="Posted" size="hero" />
        <Stat value={`${fmt(goldPerSec)}/s`} label="Gold/s" />
        <Stat value={`${fmt(materialsPerSec)}/s`} label="Materials/s" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Progress: milestones with progress bars, sorted, navigable, capped at 4
// ---------------------------------------------------------------------------

function ProgressSection() {
  const state = useGameState();
  const fmt = useFormat();
  const [expanded, setExpanded] = useState(false);

  const milestones = buildMilestones(state, fmt);

  // Sort: incomplete milestones with progress closest to 1 first, then done
  const sorted = [...milestones].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    // Among incomplete: higher progress first (nearest to done)
    const ap = a.progress ?? 0;
    const bp = b.progress ?? 0;
    return bp - ap;
  });

  const displayed = expanded ? sorted : sorted.slice(0, MILESTONE_CAP);
  const firstIncomplete = sorted.findIndex((m) => !m.done);

  return (
    <section className="rows">
      <h3 className="section-title">Progress</h3>
      {state.act >= 2 && <ProgressStats />}
      {displayed.map((m, i) => (
        <Milestone
          key={m.key}
          data={m}
          nearest={i === firstIncomplete}
        />
      ))}
      {sorted.length > MILESTONE_CAP && !expanded && (
        <button className="overview-more-milestones" onClick={() => setExpanded(true)}>
          + {sorted.length - MILESTONE_CAP} more milestones…
        </button>
      )}
    </section>
  );
}

function ProgressStats() {
  const state = useGameState();
  const allZones = zones();
  const unlockedZones = allZones.filter((z) => state.reputation >= (z.repRequired ?? 0));
  const clearedZones = allZones.filter((z) => state.locationsCleared[z.id]).length;
  const unlockedDungeons = DUNGEONS.filter((d) => dungeonProgress(state, d.locationId).unlocked);

  return (
    <div className="detail-stats">
      <Stat value={`${unlockedZones.length}/${allZones.length}`} label="Zones" />
      <Stat value={`${clearedZones}/${allZones.length}`} label="Cleared" />
      <Stat value={`${unlockedDungeons.length}/${DUNGEONS.length}`} label="Dungeons" />
    </div>
  );
}

function buildMilestones(state: GameState, fmt: (n: number) => string): MilestoneData[] {
  const ms: MilestoneData[] = [];
  const allZones = zones();

  // Act 1: found the guild
  if (state.act === 1) {
    const cost = guildFoundingCost(state);
    ms.push({
      key: 'found-guild',
      done: false,
      label: `Found the Guild — ${fmt(cost)} gold (you have ${fmt(state.gold)})`,
      progress: Math.min(state.gold / cost, 1),
      navigateTo: 'town',
    });
  }

  // Act 2+: next zone
  if (state.act >= 2) {
    const nextZone = allZones.find((z) => state.reputation < (z.repRequired ?? 0));
    if (nextZone) {
      const needed = nextZone.repRequired ?? 0;
      ms.push({
        key: `zone-${nextZone.id}`,
        done: false,
        label: `${nextZone.name} opens at ${fmt(needed)} reputation (${fmt(Math.max(0, Math.ceil(needed - state.reputation)))} to go)`,
        progress: Math.min(state.reputation / needed, 1),
        navigateTo: 'map',
      });
    }
  }

  // Forge
  if (state.act >= 2) {
    ms.push({
      key: 'forge',
      done: forgeUnlocked(state),
      label: 'The Forge — craft your own equipment',
      navigateTo: 'items',
    });
  }

  // Auto-explore
  if (state.act >= 2) {
    ms.push({
      key: 'auto-explore',
      done: autoExploreUnlocked(state),
      label: 'Auto-Explore — champions farm a zone unattended',
      navigateTo: 'map',
    });
  }

  // Next dungeon (by explore wins progress)
  if (state.act >= 2) {
    const nextDungeon = DUNGEONS.map((d) => ({ def: d, progress: dungeonProgress(state, d.locationId) }))
      .filter((d) => !d.progress.unlocked && d.progress.wins > 0)
      .sort((a, b) => b.progress.wins - a.progress.wins)[0];
    if (nextDungeon) {
      ms.push({
        key: `dungeon-${nextDungeon.def.locationId}`,
        done: false,
        label: `${nextDungeon.def.name} — ${nextDungeon.progress.wins}/${DUNGEON_WINS_REQUIRED} Explore wins at ${locationDef(nextDungeon.def.locationId)?.name ?? nextDungeon.def.locationId}`,
        progress: nextDungeon.progress.wins / DUNGEON_WINS_REQUIRED,
        navigateTo: 'map',
      });
    }
  }

  // Dungeons unlocked
  if (state.act >= 2) {
    const unlockedDungeons = DUNGEONS.filter((d) => dungeonProgress(state, d.locationId).unlocked);
    if (unlockedDungeons.length > 0) {
      ms.push({
        key: 'dungeons-open',
        done: true,
        label: `${unlockedDungeons.length} dungeon${unlockedDungeons.length === 1 ? '' : 's'} open · ${DUNGEON_TOTAL_ROOMS} rooms each`,
      });
    }
  }

  // Act 2 endgate
  if (state.act === 2) {
    ms.push({
      key: 'frontier-pass',
      done: false,
      label: 'Clear the Frontier Pass dungeon to find the road home',
      navigateTo: 'map',
    });
  }

  // Act 3 bosses
  if (state.act >= 3) {
    const bossesSlain = bosses().filter((b) => state.bossesDefeated[b.id]).length;
    ms.push({
      key: 'bosses',
      done: bossesSlain > 0,
      label: `${bossesSlain}/${bosses().length} great foes defeated`,
      progress: bossesSlain / bosses().length,
      navigateTo: 'map',
    });
    ms.push({
      key: 'demon-king',
      done: !!state.bossesDefeated[DEMON_KING_ID],
      label: 'The Demon King falls — time travel unlocks',
      navigateTo: 'map',
    });
  }

  return ms;
}

// ---------------------------------------------------------------------------
// Lifetime records (P1/P2 — tiered, ragged rows fixed)
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
        Totals across every timeline you've lived — they survive time travel.
      </p>

      <section className="rows">
        <h3 className="section-title">Lifetime</h3>
        <div className="detail-stats">
          <Stat value={formatDuration(stats.timePlayedSeconds)} label="Time Played" size="hero" />
          <Stat value={fmt(state.prestigeCount)} label="Timelines" />
          <Stat value={fmt(state.lifetimeGoldEarned + state.totalGoldEarned)} label="Gold Earned" />
        </div>
        <div className="detail-stats">
          <Stat value={fmt(stats.clicks)} label="Odd Jobs" size="compact" />
          <Stat value={fmt(stats.questsCompleted)} label="Quests Done" size="compact" />
          <Stat value={fmt(stats.championsHired)} label="Hired" size="compact" />
        </div>
      </section>

      <section className="rows">
        <h3 className="section-title">Combat</h3>
        <div className="detail-stats">
          <Stat value={`${winRate}%`} label="Win Rate" tone="green" size="hero" />
          <Stat value={fmt(battles)} label="Battles" />
          <Stat value={fmt(stats.monstersDefeated)} label="Monsters Slain" />
        </div>
        <div className="detail-stats">
          <Stat value={fmt(stats.dungeonsCleared)} label="Dungeons" size="compact" />
          <Stat value={fmt(stats.bossesFelled)} label="Great Foes" size="compact" />
          <Stat value={fmt(stats.injuries)} label="Injuries" size="compact" />
          <Stat value={fmt(stats.shardsFound)} label="Shards" size="compact" />
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
  const day = Math.floor(entry.at / DAY_LENGTH_SECONDS) + 1;
  return (
    <div className={`log-entry log-${entry.kind}`}>
      <span className="log-day">Day {day}</span>
      <span className="log-text">{entry.text}</span>
    </div>
  );
}
