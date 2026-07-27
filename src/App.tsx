import { useCallback, useEffect, useState } from 'react';
import { applyOfflineProgress } from './game/engine';
import {
  createInitialState,
  currentDay,
  migrateSave,
  productionPerSecond,
} from './game/logic';
import { GameStore } from './game/store';
import { formatDuration } from './game/format';
import { GameContext, useGameLoop, useGameState, type OfflineCatchupResult } from './hooks/useGame';
import { useFormat } from './hooks/useFormat';
import { localStorageAdapter } from './platform/storage';
import { materialsSummary } from './ui/display';
import { Icon } from './ui/icons';
import { playClick, playNotify } from './ui/sfx';
import { StoryModal } from './ui/StoryModal';
import { TabBar, type TabId } from './ui/TabBar';
import { OverviewPanel } from './ui/panels/OverviewPanel';
import { TownPanel } from './ui/panels/TownPanel';
import { GuildPanel } from './ui/panels/GuildPanel';
import { MapPanel } from './ui/panels/MapPanel';
import { ItemsPanel } from './ui/panels/ItemsPanel';
import { SettingsPanel } from './ui/panels/SettingsPanel';
import './App.css';

interface OfflineReport {
  seconds: number;
  gold: number;
  shards: number;
  materials: Record<string, number>;
  equipment: number;
}

/** Only worth surfacing as a "welcome back" toast past this length of absence. */
const OFFLINE_REPORT_THRESHOLD_SECONDS = 60;

function toOfflineReport(result: OfflineCatchupResult): OfflineReport | null {
  const { offlineSeconds, goldEarned, shardsFound, materialsGained, equipmentGained } = result;
  return offlineSeconds > OFFLINE_REPORT_THRESHOLD_SECONDS &&
    (goldEarned > 0 || Object.keys(materialsGained).length > 0 || equipmentGained > 0)
    ? { seconds: offlineSeconds, gold: goldEarned, shards: shardsFound, materials: materialsGained, equipment: equipmentGained }
    : null;
}

function initGame(): { store: GameStore; offline: OfflineReport | null } {
  const saved = localStorageAdapter.load();
  if (!saved) return { store: new GameStore(createInitialState()), offline: null };
  const migrated = migrateSave(saved);
  const result = applyOfflineProgress(migrated);
  return { store: new GameStore(result.state), offline: toOfflineReport(result) };
}

export default function App() {
  const [init] = useState(initGame);
  const [offlineReport, setOfflineReport] = useState(init.offline);
  const [tab, setTab] = useState<TabId>('overview');
  // Settings lives behind a header button rather than a nav slot — it's a
  // once-in-a-session destination competing with five you visit constantly.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Backgrounded tabs don't remount the app, so a long absence (tab switch,
  // minimized browser, mobile suspension) needs the same "welcome back"
  // treatment at runtime that a fresh page load gets.
  const handleOfflineCatchup = useCallback((result: OfflineCatchupResult) => {
    const report = toOfflineReport(result);
    if (report) setOfflineReport(report);
  }, []);

  useGameLoop(init.store, handleOfflineCatchup);
  useClickSfx(init.store);

  return (
    <GameContext.Provider value={init.store}>
      <Shell
        tab={tab}
        settingsOpen={settingsOpen}
        onTab={(next) => {
          setSettingsOpen(false);
          setTab(next);
        }}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        offlineReport={offlineReport}
        onDismissOffline={() => setOfflineReport(null)}
      />
    </GameContext.Provider>
  );
}

/**
 * Everything below the store provider. Split out of App so it can subscribe to
 * game state — the `reduced-motion` class has to react to the setting being
 * toggled, and App itself never re-renders on state changes.
 */
function Shell({
  tab,
  settingsOpen,
  onTab,
  onToggleSettings,
  offlineReport,
  onDismissOffline,
}: {
  tab: TabId;
  settingsOpen: boolean;
  onTab: (tab: TabId) => void;
  onToggleSettings: () => void;
  offlineReport: OfflineReport | null;
  onDismissOffline: () => void;
}) {
  const state = useGameState();
  return (
    <div className={`game ${state.settings.reducedMotion ? 'reduced-motion' : ''}`}>
      <Header settingsOpen={settingsOpen} onToggleSettings={onToggleSettings} />
      <main className="panel-host">
        {settingsOpen ? (
          <SettingsPanel />
        ) : (
          <>
            {tab === 'overview' && <OverviewPanel />}
            {tab === 'town' && <TownPanel />}
            {tab === 'guild' && <GuildPanel />}
            {tab === 'map' && <MapPanel />}
            {tab === 'items' && <ItemsPanel />}
          </>
        )}
      </main>
      <TabBar active={tab} onChange={onTab} />

      <StoryModal />

      {offlineReport && <OfflineToast report={offlineReport} onDismiss={onDismissOffline} />}
    </div>
  );
}

/** Plays the click blip for any button press while SFX is enabled. */
function useClickSfx(store: GameStore) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!store.getState().settings.sfxEnabled) return;
      if ((e.target as HTMLElement | null)?.closest('button')) playClick();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [store]);
}

/**
 * A single sticky resource bar. Gold and income sit left (the numbers you
 * consult while deciding what to buy), run state right. The game's title was
 * dropped: it cost a line of screen to tell the player something they already
 * know, and the tab they're on already says where they are.
 */
function Header({
  settingsOpen,
  onToggleSettings,
}: {
  settingsOpen: boolean;
  onToggleSettings: () => void;
}) {
  const state = useGameState();
  const fmt = useFormat();
  return (
    <header className="header">
      <div className="header-primary">
        <span className="energy-amount">
          <Icon name="coin" /> {fmt(state.gold)}
        </span>
        <span className="eps">+{fmt(productionPerSecond(state))}/s</span>
      </div>
      <div className="header-sub">
        {state.act >= 2 && (
          <span className="rep-counter">
            <Icon name="star" /> {fmt(Math.floor(state.reputation))}
          </span>
        )}
        {(state.timeShards > 0 || state.prestigeCount > 0) && (
          <span className="shard-counter">
            <Icon name="hourglass" /> {fmt(state.timeShards)}
          </span>
        )}
        <span className="day-counter">Day {currentDay(state)}</span>
      </div>
      <button
        className={`header-settings ${settingsOpen ? 'active' : ''}`}
        onClick={onToggleSettings}
        aria-label="Settings"
        aria-pressed={settingsOpen}
      >
        <Icon name="gear" />
      </button>
    </header>
  );
}

function OfflineToast({
  report,
  onDismiss,
}: {
  report: OfflineReport;
  onDismiss: () => void;
}) {
  const state = useGameState();
  const fmt = useFormat();
  useEffect(() => {
    if (state.settings.sfxEnabled) playNotify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const materials = materialsSummary(report.materials);
  return (
    <div className="offline-toast">
      <div className="offline-toast-text">
        Away {formatDuration(report.seconds)} — the town earned{' '}
        <strong>{fmt(report.gold)}</strong> gold
        {materials && <>, <strong>{materials}</strong></>}
        {report.equipment > 0 && (
          <>
            {' '}and <strong>{report.equipment}</strong> piece{report.equipment > 1 ? 's' : ''} of
            equipment
          </>
        )}
        {report.shards > 0 && (
          <>
            {' '}and <strong>{fmt(report.shards)}</strong> time shard
            {report.shards > 1 ? 's' : ''}
          </>
        )}
        .
      </div>
      <button className="icon-button" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="close" />
      </button>
    </div>
  );
}
